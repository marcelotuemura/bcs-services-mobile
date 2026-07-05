'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface EstimateActionsProps {
  estimateId: string;
  companyId: string;
  status: string;
  workOrderId?: string | null;
}

export default function EstimateActions({ estimateId, companyId, status, workOrderId }: EstimateActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(newStatus: 'approved' | 'rejected') {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { error: updateError } = await supabase
      .from('estimates')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', estimateId)
      .eq('company_id', companyId);

    if (updateError) {
      setError(updateError.message);
    } else {
      router.refresh();
    }
    setLoading(false);
  }

  async function convertToWorkOrder() {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    // 1. Fetch estimate details to copy
    const { data: estimate, error: estError } = await supabase
      .from('estimates')
      .select('*')
      .eq('id', estimateId)
      .eq('company_id', companyId)
      .single();

    if (estError || !estimate) {
      setError(estError?.message || 'Estimate not found');
      setLoading(false);
      return;
    }

    // 2. Create a new work order
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
      setError(woError?.message || 'Failed to create work order');
      setLoading(false);
      return;
    }

    // 3. Link estimate to the new work order
    const { error: updateError } = await supabase
      .from('estimates')
      .update({ work_order_id: workOrder.id })
      .eq('id', estimateId);

    if (updateError) {
      setError(updateError.message);
    } else {
      router.push('/work-orders');
      router.refresh();
    }
    setLoading(false);
  }

  const isPending = status === 'draft' || status === 'sent';
  const isApproved = status === 'approved';

  return (
    <div className="space-y-4">
      {error && <div className="notice error">{error}</div>}
      
      <div className="flex gap-2">
        {isPending && (
          <>
            <button 
              className="button success" 
              onClick={() => updateStatus('approved')} 
              disabled={loading}
            >
              {loading ? 'Please wait...' : 'Approve Estimate'}
            </button>
            <button 
              className="button secondary" 
              onClick={() => updateStatus('rejected')} 
              disabled={loading}
            >
              {loading ? 'Please wait...' : 'Reject Estimate'}
            </button>
          </>
        )}

        {isApproved && !workOrderId && (
          <button 
            className="button" 
            onClick={convertToWorkOrder} 
            disabled={loading}
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
          >
            {loading ? 'Converting...' : 'Convert to Work Order'}
          </button>
        )}

        {isApproved && workOrderId && (
          <div className="notice success" style={{ width: '100%' }}>
            Converted to Work Order successfully.
          </div>
        )}
      </div>
    </div>
  );
}
