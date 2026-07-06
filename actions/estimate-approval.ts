'use server';

import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { requireCompanyContext } from '@/lib/auth/permissions';
import { sendEstimateEmail } from '@/lib/email/send-estimate';

/**
 * Sends an estimate to the customer. Generates approval token if missing,
 * triggers email sending, and updates the status to 'sent'.
 */
export async function sendEstimateToCustomer(estimateId: string, companyId: string) {
  try {
    const context = await requireCompanyContext();
    const supabase = context.supabase;

    // 1. Fetch estimate details
    const { data: estimate, error: fetchErr } = await supabase
      .from('estimates')
      .select('*')
      .eq('id', estimateId)
      .eq('company_id', companyId)
      .single();

    if (fetchErr || !estimate) {
      return { ok: false, message: fetchErr?.message || 'Estimate not found' };
    }

    // 2. Resolve token
    let token = estimate.approval_token;
    if (!token) {
      token = crypto.randomUUID();
    }

    // 3. Construct approval link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bestcoatingssolution.com';
    const approvalUrl = `${baseUrl}/approve-estimate/${token}`;

    // 4. Send email if customer has email address
    let emailStatus: { ok: boolean; error?: string } = { ok: false, error: 'no_email_provided' };
    
    // We fetch customer email from the customer or fallback to estimate.customer_name if it is formatted as email
    let customerEmail = estimate.customer_approved_email;
    if (!customerEmail) {
      const { data: customer } = await supabase
        .from('customers')
        .select('email')
        .eq('id', estimate.customer_id)
        .maybeSingle();
      customerEmail = customer?.email || '';
    }

    if (customerEmail && customerEmail.includes('@')) {
      emailStatus = await sendEstimateEmail({
        estimateNumber: estimate.estimate_number,
        customerEmail: customerEmail,
        total: estimate.total,
        approvalUrl: approvalUrl
      });
    }

    // 5. Update estimate status
    const { error: updateErr } = await supabase
      .from('estimates')
      .update({
        status: 'sent',
        approval_token: token,
        approval_sent_at: new Date().toISOString(),
        customer_approved_email: customerEmail || estimate.customer_approved_email
      })
      .eq('id', estimateId);

    if (updateErr) {
      return { ok: false, message: updateErr.message };
    }

    // 6. Record audit log entries
    await supabase.rpc('record_activity', {
      activity_action: 'estimate_sent',
      activity_entity_type: 'estimate',
      activity_entity_id: estimateId,
      activity_metadata: { token, approvalUrl }
    });

    if (emailStatus.ok) {
      await supabase.rpc('record_activity', {
        activity_action: 'estimate_email_sent',
        activity_entity_type: 'estimate',
        activity_entity_id: estimateId,
        activity_metadata: { recipient: customerEmail }
      });
    } else {
      await supabase.rpc('record_activity', {
        activity_action: 'estimate_email_failed',
        activity_entity_type: 'estimate',
        activity_entity_id: estimateId,
        activity_metadata: { reason: emailStatus.error || 'no_email_configured' }
      });
    }

    revalidatePath(`/estimates/${estimateId}`);
    return {
      ok: true,
      message: emailStatus.ok 
        ? 'Estimate sent to customer successfully.' 
        : 'Estimate marked as sent. Email was not sent (manually share the link below).',
      approvalUrl,
      emailSent: emailStatus.ok
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'An unexpected error occurred' };
  }
}

/**
 * Public action to approve an estimate via approval token.
 * Accesses Supabase via an anonymous client since the customer is not logged in.
 */
export async function approveEstimateByToken(
  token: string,
  customerName: string,
  customerEmail: string,
  signature: string,
  notes: string
) {
  try {
    if (!token) return { ok: false, message: 'Invalid approval token.' };
    if (!customerName.trim()) return { ok: false, message: 'Name is required to sign.' };
    if (!customerEmail.trim()) return { ok: false, message: 'Email is required.' };

    const supabase = await createClient();

    // Call public security definer RPC
    const { error } = await supabase.rpc('approve_estimate_by_token', {
      token,
      p_customer_name: customerName,
      p_customer_email: customerEmail,
      p_signature: signature,
      p_notes: notes
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    revalidatePath(`/approve-estimate/${token}`);
    return { ok: true, message: 'Estimate approved successfully.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to approve estimate' };
  }
}

/**
 * Public action to reject an estimate via approval token.
 * Accesses Supabase via an anonymous client since the customer is not logged in.
 */
export async function rejectEstimateByToken(
  token: string,
  customerName: string,
  customerEmail: string,
  notes: string
) {
  try {
    if (!token) return { ok: false, message: 'Invalid approval token.' };
    if (!customerName.trim()) return { ok: false, message: 'Name is required.' };
    if (!customerEmail.trim()) return { ok: false, message: 'Email is required.' };

    const supabase = await createClient();

    // Call public security definer RPC
    const { error } = await supabase.rpc('reject_estimate_by_token', {
      token,
      p_customer_name: customerName,
      p_customer_email: customerEmail,
      p_notes: notes
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    revalidatePath(`/approve-estimate/${token}`);
    return { ok: true, message: 'Estimate rejected successfully.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to reject estimate' };
  }
}
