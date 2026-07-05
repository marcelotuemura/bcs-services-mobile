'use server';

import { revalidatePath } from 'next/cache';
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
