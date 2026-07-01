'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { can, requireAllowed, requireCompanyContext } from '@/lib/auth/permissions';
import type { EntityActionState } from '@/actions/customers';

const settingsSchema = z.object({
  company_name: z.string().trim().min(2, 'Company name is required.'),
  logo_url: z.string().trim().url('Logo must be a valid URL.').optional().or(z.literal('')),
  tax_rate: z.coerce.number().min(0).max(100).default(0),
  currency: z.string().trim().min(3).max(3).default('USD'),
  language: z.string().trim().min(2).max(8).default('en'),
  timezone: z.string().trim().min(1).default('America/New_York')
});

export async function updateCompanySettings(_: EntityActionState, formData: FormData): Promise<EntityActionState> {
  try {
    const context = await requireCompanyContext();
    requireAllowed(await can('settings.manage', context));
    const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message || 'Invalid settings.' };

    const companyId = context.membership.company_id;
    const { company_name, ...settings } = parsed.data;
    const { error: companyError } = await context.supabase
      .from('companies')
      .update({ name: company_name })
      .eq('id', companyId);
    if (companyError) return { ok: false, message: companyError.message };

    const { error: settingsError } = await context.supabase
      .from('company_settings')
      .upsert({
        company_id: companyId,
        ...settings,
        logo_url: settings.logo_url || null,
        currency: settings.currency.toUpperCase()
      }, { onConflict: 'company_id' });
    if (settingsError) return { ok: false, message: settingsError.message };

    await context.supabase.rpc('record_activity', {
      activity_action: 'settings_updated',
      activity_entity_type: 'company',
      activity_entity_id: companyId,
      activity_metadata: { company_name }
    });
    revalidatePath('/settings');
    revalidatePath('/dashboard');
    return { ok: true, message: 'Settings saved.' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Settings could not be saved.' };
  }
}
