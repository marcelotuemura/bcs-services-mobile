'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { sendEstimateToCustomer } from '@/actions/estimate-approval';

interface EstimateActionsProps {
  estimateId: string;
  companyId: string;
  status: string;
  workOrderId?: string | null;
  approvalToken?: string | null;
  approvalSentAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  customerApprovedName?: string | null;
  customerApprovedEmail?: string | null;
  customerSignature?: string | null;
  customerResponseNotes?: string | null;
}

export default function EstimateActions({
  estimateId,
  companyId,
  status,
  workOrderId,
  approvalToken,
  approvalSentAt,
  approvedAt,
  rejectedAt,
  customerApprovedName,
  customerApprovedEmail,
  customerSignature,
  customerResponseNotes
}: EstimateActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://bestcoatingssolution.com';
  const approvalUrl = approvalToken ? `${baseUrl}/approve-estimate/${approvalToken}` : '';

  async function updateStatus(newStatus: 'approved' | 'rejected') {
    setLoading(true);
    setMessage(null);
    const supabase = createClient();

    const { error: updateError } = await supabase
      .from('estimates')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', estimateId)
      .eq('company_id', companyId);

    if (updateError) {
      setMessage({ type: 'error', text: updateError.message });
    } else {
      setMessage({ type: 'success', text: `Estimate marked as ${newStatus} internally.` });
      router.refresh();
    }
    setLoading(false);
  }

  async function handleSend() {
    setLoading(true);
    setMessage(null);

    const res = await sendEstimateToCustomer(estimateId, companyId);

    if (res.ok) {
      setMessage({ type: 'success', text: res.message });
      router.refresh();
    } else {
      setMessage({ type: 'error', text: res.message || 'Failed to send estimate.' });
    }
    setLoading(false);
  }

  async function resetToDraft() {
    setLoading(true);
    setMessage(null);
    const supabase = createClient();

    const { error: updateError } = await supabase
      .from('estimates')
      .update({ 
        status: 'draft', 
        approved_at: null, 
        rejected_at: null,
        updated_at: new Date().toISOString() 
      })
      .eq('id', estimateId)
      .eq('company_id', companyId);

    if (updateError) {
      setMessage({ type: 'error', text: updateError.message });
    } else {
      setMessage({ type: 'success', text: 'Estimate reset to Draft.' });
      router.refresh();
    }
    setLoading(false);
  }

  function handleCopy() {
    if (!approvalUrl) return;
    navigator.clipboard.writeText(approvalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function convertToWorkOrder() {
    setLoading(true);
    setMessage(null);
    const supabase = createClient();

    const { data: estimate, error: estError } = await supabase
      .from('estimates')
      .select('*')
      .eq('id', estimateId)
      .eq('company_id', companyId)
      .single();

    if (estError || !estimate) {
      setMessage({ type: 'error', text: estError?.message || 'Estimate not found' });
      setLoading(false);
      return;
    }

    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .insert({
        company_id: companyId,
        customer_id: estimate.customer_id,
        title: `Work Order for Estimate #${estimate.estimate_number}`,
        status: 'draft',
        priority: 'normal',
        customer_notes: estimate.notes || '',
        labor_cost: estimate.labor_total,
        parts_cost: estimate.parts_total + estimate.supplies_total
      })
      .select('id')
      .single();

    if (woError || !workOrder) {
      setMessage({ type: 'error', text: woError?.message || 'Failed to create work order' });
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('estimates')
      .update({ work_order_id: workOrder.id })
      .eq('id', estimateId);

    if (updateError) {
      setMessage({ type: 'error', text: updateError.message });
    } else {
      router.push('/work-orders');
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`notice ${message.type === 'success' ? 'success' : 'error'}`}>
          {message.text}
        </div>
      )}

      {/* Draft Actions */}
      {status === 'draft' && (
        <div className="card glass p-4 space-y-4" style={{ borderRadius: '14px', border: '1px solid var(--line)' }}>
          <h4 className="font-semibold text-sm text-gray-400 uppercase tracking-wider">Prepare & Send Workflow</h4>
          <div className="flex flex-col sm:flex-row gap-2">
            <button 
              className="button flex-1" 
              onClick={handleSend} 
              disabled={loading}
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
            >
              {loading ? 'Sending...' : 'Send to Customer'}
            </button>
            {approvalToken && (
              <button 
                className="button secondary" 
                onClick={handleCopy}
                disabled={loading}
              >
                {copied ? 'Copied Link!' : 'Copy Approval Link'}
              </button>
            )}
          </div>
          <div className="pt-2 border-t" style={{ borderColor: 'var(--line)' }}>
            <span className="text-xs text-gray-500 block mb-2">Administrative overrides (Bypass customer workflow):</span>
            <div className="flex gap-2">
              <button 
                className="button success py-1 px-3 text-xs" 
                onClick={() => updateStatus('approved')} 
                disabled={loading}
              >
                Approve Internally
              </button>
              <button 
                className="button secondary py-1 px-3 text-xs" 
                style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}
                onClick={() => updateStatus('rejected')} 
                disabled={loading}
              >
                Reject Internally
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sent Actions */}
      {status === 'sent' && (
        <div className="card glass p-4 space-y-4" style={{ borderRadius: '14px', border: '1px solid var(--line)' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[#f59e0b] flex items-center gap-1.5">
              ● Waiting for customer approval
            </span>
            {approvalSentAt && (
              <span className="text-xs text-gray-500">
                Sent: {new Date(approvalSentAt).toLocaleDateString()}
              </span>
            )}
          </div>
          
          {approvalUrl && (
            <div className="p-3 rounded bg-black/20 text-xs border" style={{ borderColor: 'var(--line)' }}>
              <span className="text-gray-400 block mb-1">Customer Link:</span>
              <a href={approvalUrl} target="_blank" rel="noreferrer" className="text-blue-400 break-all block underline">
                {approvalUrl}
              </a>
            </div>
          )}

          <div className="flex gap-2">
            <button 
              className="button secondary flex-1" 
              onClick={handleSend} 
              disabled={loading}
            >
              {loading ? 'Resending...' : 'Resend Email'}
            </button>
            <button 
              className="button secondary flex-1" 
              onClick={handleCopy}
              disabled={loading}
            >
              {copied ? 'Copied Link!' : 'Copy Approval Link'}
            </button>
          </div>

          <div className="pt-2 border-t" style={{ borderColor: 'var(--line)' }}>
            <span className="text-xs text-gray-500 block mb-2">Administrative overrides:</span>
            <div className="flex gap-2">
              <button 
                className="button success py-1 px-3 text-xs" 
                onClick={() => updateStatus('approved')} 
                disabled={loading}
              >
                Approve Internally
              </button>
              <button 
                className="button secondary py-1 px-3 text-xs" 
                style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}
                onClick={() => updateStatus('rejected')} 
                disabled={loading}
              >
                Reject Internally
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approved Actions */}
      {status === 'approved' && (
        <div className="space-y-4">
          <div className="card glass p-4 border-l-4" style={{ borderColor: 'var(--success)', borderRadius: '14px', background: 'rgba(34, 197, 94, 0.03)' }}>
            <span className="text-sm font-bold text-green-500 block mb-1">✓ Approved by Customer</span>
            <p className="text-xs text-gray-400" style={{ margin: 0 }}>
              Name: <strong>{customerApprovedName || 'N/A'}</strong> ({customerApprovedEmail || 'N/A'})
              {approvedAt && ` on ${new Date(approvedAt).toLocaleDateString()}`}
            </p>
            {customerSignature && (
              <div className="mt-2.5">
                <span className="text-xs text-gray-500 block">Signature:</span>
                <span style={{ fontFamily: 'cursive', fontSize: '1.25rem', color: 'var(--success)' }}>
                  {customerSignature}
                </span>
              </div>
            )}
            {customerResponseNotes && (
              <div className="mt-2 p-2 rounded bg-black/10 text-xs italic">
                &ldquo;{customerResponseNotes}&rdquo;
              </div>
            )}
          </div>

          {!workOrderId ? (
            <button 
              className="button w-full" 
              onClick={convertToWorkOrder} 
              disabled={loading}
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
            >
              {loading ? 'Converting...' : 'Convert to Work Order'}
            </button>
          ) : (
            <div className="notice success">
              Converted to Work Order successfully.
            </div>
          )}
        </div>
      )}

      {/* Rejected Actions */}
      {status === 'rejected' && (
        <div className="space-y-4">
          <div className="card glass p-4 border-l-4" style={{ borderColor: 'var(--error)', borderRadius: '14px', background: 'rgba(239, 68, 68, 0.03)' }}>
            <span className="text-sm font-bold text-red-500 block mb-1">✗ Rejected by Customer</span>
            <p className="text-xs text-gray-400" style={{ margin: 0 }}>
              Declined by: <strong>{customerApprovedName || 'N/A'}</strong> ({customerApprovedEmail || 'N/A'})
              {rejectedAt && ` on ${new Date(rejectedAt).toLocaleDateString()}`}
            </p>
            {customerResponseNotes && (
              <div className="mt-2 p-2 rounded bg-black/10 text-xs italic">
                Reason: &ldquo;{customerResponseNotes}&rdquo;
              </div>
            )}
          </div>
          <button 
            className="button secondary w-full" 
            onClick={resetToDraft} 
            disabled={loading}
          >
            {loading ? 'Resetting...' : 'Reset to Draft (Revise Estimate)'}
          </button>
        </div>
      )}
    </div>
  );
}

