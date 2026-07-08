import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Construct Stripe instance
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

export async function POST(req: Request) {
  const payload = await req.text();
  const sig = req.headers.get('stripe-signature') || '';

  let event: Stripe.Event;

  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured on this server.');
    }
    event = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error(`[stripe-webhook] Signature verification failed:`, err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // 1. Initialize anonymous Supabase client
  // Using anonymous client is safe because we route operations through a security-definer RPC function.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 2. Handle checkout session completion
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const { invoice_id, company_id } = session.metadata || {};

    if (!invoice_id) {
      console.warn(`[stripe-webhook] Missing invoice_id in session metadata.`);
      return NextResponse.json({ received: true });
    }

    try {
      // Invoke security definer RPC function to process payment and log audit activity
      const { data: success, error: rpcErr } = await supabase.rpc('mark_invoice_paid_by_stripe', {
        target_invoice_id: invoice_id,
        target_amount: session.amount_total ? session.amount_total / 100 : 0,
        target_session_id: session.id,
        target_payment_intent_id: (session.payment_intent as string) || '',
        target_event: event
      });

      if (rpcErr || !success) {
        console.error(`[stripe-webhook] Failed to mark invoice paid via RPC:`, rpcErr?.message);
        return NextResponse.json({ error: rpcErr?.message || 'RPC execution returned false.' }, { status: 500 });
      }

      console.log(`[stripe-webhook] Invoice ${invoice_id} successfully marked as PAID.`);
    } catch (err: any) {
      console.error(`[stripe-webhook] Exception processing RPC call:`, err.message);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
