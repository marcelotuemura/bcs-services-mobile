'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { can, requireAllowed, requireCompanyContext } from '@/lib/auth/permissions';
import { splitTags } from '@/lib/format';

export type EntityActionState = { ok: boolean; message: string };

type CustomerStatus = 'active' | 'lead' | 'inactive' | 'archived';

type CustomerPayload = {
  id?: string;
  name: string;
  email: string | null;
  company_name: string | null;
  phone: string | null;
  mobile: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string;
  tax_id: string | null;
  notes: string | null;
  status: CustomerStatus;
  tags: string[];
};

type CustomerPayloadResult =
  | { ok: true; value: CustomerPayload }
  | { ok: false; error: string };

const customerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Customer name is required.'),
  company_name: z.string().trim().optional(),
  email: z.string().trim().email('Enter a valid email.').optional().or(z.literal('')),
  phone: z.string().trim().optional(),
  mobile: z.string().trim().optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  zip: z.string().trim().optional(),
  country: z.string().trim().default('US'),
  tax_id: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  status: z.enum(['active', 'lead', 'inactive', 'archived']).default('active')
});

function customerPayload(formData: FormData): CustomerPayloadResult {
  const parsed = customerSchema.safeParse({
    id: formData.get('id') || undefined,
    name: formData.get('name'),
    company_name: formData.get('company_name') || undefined,
    email: formData.get('email') || undefined,
    phone: formData.get('phone') || undefined,
    mobile: formData.get('mobile') || undefined,
    address: formData.get('address') || undefined,
    city: formData.get('city') || undefined,
    state: formData.get('state') || undefined,
    zip: formData.get('zip') || undefined,
    country: formData.get('country') || 'US',
    tax_id: formData.get('tax_id') || undefined,
    notes: formData.get('notes') || undefined,
    status: formData.get('status') || 'active'
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message || 'Invalid customer.' };
  }

  const value: CustomerPayload = {
    ...parsed.data,
    email: parsed.data.email || null,
    company_name: parsed.data.company_name || null,
    phone: parsed.data.phone || null,
    mobile: parsed.data.mobile || null,
    address: parsed.data.address || null,
    city: parsed.data.city || null,
    state: parsed.data.state || null,
    zip: parsed.data.zip || null,
    tax_id: parsed.data.tax_id || null,
    notes: parsed.data.notes || null,
    tags: splitTags(formData.get('tags'))
  };
  return { ok: true, value };
}

export async function createCustomer(_: EntityActionState, formData: FormData): Promise<EntityActionState> {
  try {
    const context = await requireCompanyContext();
    requireAllowed(await can('customers.create', context));
    const payload = customerPayload(formData);
    if (!payload.ok) return { ok: false, message: payload.error };

    const { id: _id, ...insertPayload } = payload.value;
    const { data, error } = await context.supabase
      .from('customers')
      .insert(insertPayload)
      .select('id')
      .single();

    if (error) return { ok: false, message: error.message };

    await context.supabase.rpc('record_activity', {
      activity_action: 'customer_created',
      activity_entity_type: 'customer',
      activity_entity_id: data.id,
      activity_metadata: { name: insertPayload.name }
    });
    revalidatePath('/customers');
    revalidatePath('/dashboard');
    return { ok: true, message: 'Customer created.' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Customer could not be created.' };
  }
}

export async function updateCustomer(_: EntityActionState, formData: FormData): Promise<EntityActionState> {
  try {
    const context = await requireCompanyContext();
    requireAllowed(await can('customers.edit', context));
    const payload = customerPayload(formData);
    if (!payload.ok) return { ok: false, message: payload.error };
    if (!payload.value.id) return { ok: false, message: 'Customer id is required.' };

    const { id, ...updatePayload } = payload.value;
    const { error } = await context.supabase
      .from('customers')
      .update(updatePayload)
      .eq('id', id)
      .eq('company_id', context.membership.company_id);

    if (error) return { ok: false, message: error.message };

    await context.supabase.rpc('record_activity', {
      activity_action: 'customer_updated',
      activity_entity_type: 'customer',
      activity_entity_id: id,
      activity_metadata: { name: updatePayload.name }
    });
    revalidatePath('/customers');
    revalidatePath('/dashboard');
    return { ok: true, message: 'Customer updated.' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Customer could not be updated.' };
  }
}

export async function archiveCustomer(formData: FormData) {
  const context = await requireCompanyContext();
  requireAllowed(await can('customers.archive', context));
  const id = z.string().uuid().parse(formData.get('id'));
  await context.supabase
    .from('customers')
    .update({ status: 'archived', archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', context.membership.company_id);
  await context.supabase.rpc('record_activity', {
    activity_action: 'customer_archived',
    activity_entity_type: 'customer',
    activity_entity_id: id
  });
  revalidatePath('/customers');
  revalidatePath('/dashboard');
}

export async function restoreCustomer(formData: FormData) {
  const context = await requireCompanyContext();
  requireAllowed(await can('customers.restore', context));
  const id = z.string().uuid().parse(formData.get('id'));
  await context.supabase
    .from('customers')
    .update({ status: 'active', archived_at: null })
    .eq('id', id)
    .eq('company_id', context.membership.company_id);
  await context.supabase.rpc('record_activity', {
    activity_action: 'customer_restored',
    activity_entity_type: 'customer',
    activity_entity_id: id
  });
  revalidatePath('/customers');
  revalidatePath('/dashboard');
}
