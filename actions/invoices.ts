'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireCompanyContext } from '@/lib/auth/permissions';
import { sendInvoiceEmail } from '@/lib/email/send-invoice';
import Stripe from 'stripe';

/**
 * Creates a Stripe Checkout Session for an invoice, saves the payment URL and session ID,
 * and returns the payment URL.
 */
export async function createInvoiceCheckoutSession(invoiceId: string, companyId: string) {
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

    if (invoice.total <= 0) {
      return { ok: false, message: 'Invoice total must be greater than zero to receive payments.' };
    }

    // 2. Fetch currency from company settings
    const { data: settings } = await supabase
      .from('company_settings')
      .select('currency')
      .eq('company_id', companyId)
      .maybeSingle();

    const currency = settings?.currency || 'usd';

    // 3. Initialize Stripe
    if (!process.env.STRIPE_SECRET_KEY) {
      return { ok: false, message: 'Stripe API is not configured on this server.' };
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // 4. Construct base APP URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.bestcoatingssolution.com';

    // 5. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: `Invoice #${invoice.invoice_number}`,
            },
            unit_amount: Math.round(invoice.total * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/invoices/${invoiceId}?payment=success`,
      cancel_url: `${baseUrl}/invoices/${invoiceId}?payment=cancelled`,
      metadata: {
        invoice_id: invoiceId,
        company_id: companyId,
        invoice_number: invoice.invoice_number || invoice.id.slice(0, 8)
      }
    });

    if (!session.url) {
      return { ok: false, message: 'Stripe failed to return a checkout URL.' };
    }

    // 6. Update database record with session details
    const { error: updateErr } = await supabase
      .from('invoices')
      .update({
        stripe_checkout_session_id: session.id,
        payment_url: session.url
      })
      .eq('id', invoiceId);

    if (updateErr) {
      return { ok: false, message: `Database error: ${updateErr.message}` };
    }

    revalidatePath(`/invoices/${invoiceId}`);
    return { ok: true, paymentUrl: session.url };
  } catch (err) {
    console.error('[createInvoiceCheckoutSession] Error:', err);
    return { ok: false, message: err instanceof Error ? err.message : 'Unknown error' };
  }
}

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

    // 3. Ensure payment link exists if Stripe is configured and amount > 0
    let paymentUrl = invoice.payment_url;
    if (!paymentUrl && invoice.total > 0 && process.env.STRIPE_SECRET_KEY) {
      const sessionResult = await createInvoiceCheckoutSession(invoiceId, companyId);
      if (sessionResult.ok && sessionResult.paymentUrl) {
        paymentUrl = sessionResult.paymentUrl;
      }
    }

    // 4. Construct invoice URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.bestcoatingssolution.com';
    const invoiceUrl = `${baseUrl}/view-invoice/${invoiceId}`;

    // 5. Send email via Resend
    const emailStatus = await sendInvoiceEmail({
      invoiceNumber: invoice.invoice_number || invoice.id.slice(0, 8),
      customerEmail: customerEmail,
      total: invoice.total,
      invoiceUrl: invoiceUrl
    });

    // 6. Update invoice status to 'sent' and record delivery timestamp
    const { error: updateErr } = await supabase
      .from('invoices')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', invoiceId);

    if (updateErr) {
      return { ok: false, message: updateErr.message };
    }

    // 7. Record activity log
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
