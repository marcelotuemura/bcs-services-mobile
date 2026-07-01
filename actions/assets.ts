'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { can, requireAllowed, requireCompanyContext } from '@/lib/auth/permissions';
import type { EntityActionState } from '@/actions/customers';

const assetSchema = z.object({
  customer_id: z.string().uuid().optional().or(z.literal('')),
  asset_type: z.enum(['boat', 'engine', 'trailer', 'jet_ski', 'rv', 'car', 'equipment']),
  manufacturer: z.string().trim().optional(),
  model: z.string().trim().optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional().or(z.literal('')),
  vin: z.string().trim().optional(),
  hin: z.string().trim().optional(),
  registration: z.string().trim().optional(),
  engine: z.string().trim().optional(),
  serial_number: z.string().trim().optional(),
  hours: z.coerce.number().min(0).optional().or(z.literal('')),
  color: z.string().trim().optional(),
  notes: z.string().trim().optional()
});

export async function createAsset(_: EntityActionState, formData: FormData): Promise<EntityActionState> {
  try {
    const context = await requireCompanyContext();
    requireAllowed(await can('assets.create', context));
    const parsed = assetSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message || 'Invalid asset.' };

    const payload = {
      ...parsed.data,
      customer_id: parsed.data.customer_id || null,
      year: parsed.data.year || null,
      hours: parsed.data.hours || null
    };

    const { data, error } = await context.supabase
      .from('assets')
      .insert(payload)
      .select('id')
      .single();

    if (error) return { ok: false, message: error.message };

    await context.supabase.rpc('record_activity', {
      activity_action: 'asset_created',
      activity_entity_type: 'asset',
      activity_entity_id: data.id,
      activity_metadata: { asset_type: payload.asset_type, manufacturer: payload.manufacturer }
    });
    revalidatePath('/assets');
    revalidatePath('/dashboard');
    return { ok: true, message: 'Asset created.' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Asset could not be created.' };
  }
}

export async function archiveAsset(formData: FormData) {
  const context = await requireCompanyContext();
  requireAllowed(await can('assets.archive', context));
  const id = z.string().uuid().parse(formData.get('id'));
  await context.supabase
    .from('assets')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);
  await context.supabase.rpc('record_activity', {
    activity_action: 'asset_archived',
    activity_entity_type: 'asset',
    activity_entity_id: id
  });
  revalidatePath('/assets');
  revalidatePath('/dashboard');
}
