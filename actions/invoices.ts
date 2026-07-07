'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireCompanyContext } from '@/lib/auth/permissions';
import { sendInvoiceEmail } from '@/lib/email/send-invoice';

/**
 * Sends an invoice notification email to the customer, updates the invoice status to 'sent',
 * and records the event in the audit logs.
 */
export async function sendInvoiceToCustomer(invoiceId: string, companyId: string) {
  try {
    const context = await requireCompanyContext();
    const supabase = context.supabase;

    // 1. Fetch invoice
    const { data: invoice, error: fetchErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('company_id', companyId)
      .single();

    if (fetchErr || !invoice) {
      return { ok: false, message: fetchErr?.message || 'Invoice not found' };
    }

    // 2. Resolve customer email
    let customerEmail = '';
    const { data: customer } = await supabase
      .from('customers')
      .select('email')
      .eq('id', invoice.customer_id)
      .maybeSingle();
    customerEmail = customer?.email || '';

    if (!customerEmail || !customerEmail.includes('@')) {
      return { ok: false, message: 'Customer does not have a valid email address.' };
    }

    // 3. Construct invoice URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bestcoatingssolution.com';
    const invoiceUrl = `${baseUrl}/view-invoice/${invoiceId}`;

    // 4. Send email via Resend
    const emailStatus = await sendInvoiceEmail({
      invoiceNumber: invoice.invoice_number || invoice.id.slice(0, 8),
      customerEmail: customerEmail,
      total: invoice.total,
      invoiceUrl: invoiceUrl
    });

    // 5. Update invoice status to 'sent'
    const { error: updateErr } = await supabase
      .from('invoices')
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .eq('id', invoiceId);

    if (updateErr) {
      return { ok: false, message: updateErr.message };
    }

    // 6. Record activity log
    await supabase.rpc('record_activity', {
      activity_action: 'invoice_sent',
      activity_entity_type: 'invoice',
      activity_entity_id: invoiceId,
      activity_metadata: { recipient: customerEmail, url: invoiceUrl }
    });

    revalidatePath(`/invoices/${invoiceId}`);
    return {
      ok: true,
      message: emailStatus.ok 
        ? 'Invoice sent to customer successfully.' 
        : 'Invoice marked as sent. Email was not sent (manually share the link below).',
      emailSent: emailStatus.ok
    };
  } catch (err) {
    console.error('[sendInvoiceToCustomer] Error:', err);
    return { ok: false, message: err instanceof Error ? err.message : 'Unknown error' };
  }
}
