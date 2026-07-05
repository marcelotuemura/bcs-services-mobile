'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { can, requireAllowed, requireCompanyContext } from '@/lib/auth/permissions';
import type { EntityActionState } from '@/actions/customers';

const workOrderSchema = z.object({
  title: z.string().trim().min(1, 'Work order title is required.'),
  customer_id: z.string().uuid().optional().or(z.literal('')),
  asset_id: z.string().uuid().optional().or(z.literal('')),
  technician_id: z.string().uuid().optional().or(z.literal('')),
  status: z.enum([
    'draft',
    'scheduled',
    'checked_in',
    'in_progress',
    'waiting_parts',
    'waiting_approval',
    'completed',
    'delivered',
    'cancelled'
  ]).default('draft'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  scheduled_for: z.string().optional(),
  estimated_hours: z.coerce.number().min(0).optional().or(z.literal('')),
  labor_notes: z.string().trim().optional(),
  internal_notes: z.string().trim().optional(),
  customer_notes: z.string().trim().optional()
});

export async function createWorkOrder(_: EntityActionState, formData: FormData): Promise<EntityActionState> {
  try {
    const context = await requireCompanyContext();
    requireAllowed(await can('workorders.create', context));
    const parsed = workOrderSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message || 'Invalid work order.' };

    const payload = {
      ...parsed.data,
      customer_id: parsed.data.customer_id || null,
      asset_id: parsed.data.asset_id || null,
      technician_id: parsed.data.technician_id || null,
      scheduled_for: parsed.data.scheduled_for || null,
      estimated_hours: parsed.data.estimated_hours || null
    };

    const { data, error } = await context.supabase
      .from('work_orders')
      .insert(payload)
      .select('id')
      .single();

    if (error) return { ok: false, message: error.message };

    await context.supabase.rpc('record_activity', {
      activity_action: 'work_order_created',
      activity_entity_type: 'work_order',
      activity_entity_id: data.id,
      activity_metadata: { title: payload.title, status: payload.status }
    });
    revalidatePath('/work-orders');
    revalidatePath('/dashboard');
    return { ok: true, message: 'Work order created.' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Work order could not be created.' };
  }
}

export async function updateWorkOrderStatus(formData: FormData) {
  const context = await requireCompanyContext();
  const id = z.string().uuid().parse(formData.get('id'));
  const status = z.enum([
    'draft',
    'scheduled',
    'checked_in',
    'in_progress',
    'waiting_parts',
    'waiting_approval',
    'completed',
    'delivered',
    'cancelled'
  ]).parse(formData.get('status'));

  const canComplete = status === 'completed' ? await can('workorders.complete', context) : true;
  requireAllowed(canComplete && (await can('workorders.edit_all', context) || await can('workorders.edit_assigned', context)));

  await context.supabase
    .from('work_orders')
    .update({
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null
    })
    .eq('id', id)
    .eq('company_id', context.membership.company_id);

  await context.supabase.rpc('record_activity', {
    activity_action: 'work_order_status_updated',
    activity_entity_type: 'work_order',
    activity_entity_id: id,
    activity_metadata: { status }
  });
  revalidatePath('/work-orders');
  revalidatePath('/dashboard');
}

export async function convertToInvoice(formData: FormData) {
  const context = await requireCompanyContext();
  requireAllowed(await can('invoices.create', context));

  const id = z.string().uuid().parse(formData.get('id'));

  // 1. Fetch work order details to copy
  const { data: workOrder, error: woError } = await context.supabase
    .from('work_orders')
    .select('*, customers(name)')
    .eq('id', id)
    .eq('company_id', context.membership.company_id)
    .single();

  if (woError || !workOrder) {
    throw new Error(woError?.message || 'Work order not found');
  }

  const customerName = (workOrder.customers as any)?.name || 'Valued Customer';
  const subtotal = (workOrder.labor_cost || 0) + (workOrder.parts_cost || 0);
  const tax = subtotal * 0.07; // Default 7% tax matching bcs standard
  const total = subtotal + tax;

  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

  // 2. Create the invoice
  const { data: invoice, error: invError } = await context.supabase
    .from('invoices')
    .insert({
      company_id: context.membership.company_id,
      customer_id: workOrder.customer_id,
      work_order_id: workOrder.id,
      invoice_number: invoiceNumber,
      status: 'draft',
      issue_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 15 days due
      subtotal,
      tax,
      total,
      amount_paid: 0,
      balance_due: total,
      customer_name: customerName,
      notes: workOrder.customer_notes || 'Invoice generated from Work Order.'
    })
    .select('id')
    .single();

  if (invError || !invoice) {
    throw new Error(invError?.message || 'Failed to create invoice');
  }

  // 3. Create line items from work order costs
  const lineItems = [];
  if (workOrder.labor_cost && workOrder.labor_cost > 0) {
    lineItems.push({
      invoice_id: invoice.id,
      line_number: 1,
      description: `Labor charges for: ${workOrder.title}`,
      quantity: 1,
      unit_price: workOrder.labor_cost,
      total_price: workOrder.labor_cost,
      item_type: 'labor'
    });
  }
  if (workOrder.parts_cost && workOrder.parts_cost > 0) {
    lineItems.push({
      invoice_id: invoice.id,
      line_number: lineItems.length + 1,
      description: `Parts & Materials for: ${workOrder.title}`,
      quantity: 1,
      unit_price: workOrder.parts_cost,
      total_price: workOrder.parts_cost,
      item_type: 'part'
    });
  }

  if (lineItems.length > 0) {
    const { error: itemsError } = await context.supabase
      .from('invoice_items')
      .insert(lineItems);
    if (itemsError) {
      throw new Error(itemsError.message);
    }
  }

  // 4. Update the work order status to completed
  await context.supabase
    .from('work_orders')
    .update({ status: 'completed' })
    .eq('id', id);

  await context.supabase.rpc('record_activity', {
    activity_action: 'invoice_created_from_work_order',
    activity_entity_type: 'invoice',
    activity_entity_id: invoice.id,
    activity_metadata: { invoice_number: invoiceNumber }
  });

  revalidatePath('/work-orders');
  revalidatePath('/invoices');
  revalidatePath('/dashboard');

  redirect(`/invoices/${invoice.id}`);
}
