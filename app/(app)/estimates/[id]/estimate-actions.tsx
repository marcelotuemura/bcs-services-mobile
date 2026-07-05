'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface EstimateActionsProps {
  estimateId: string;
  companyId: string;
}

export default function EstimateActions({ estimateId, companyId }: EstimateActionsProps) {
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

  return (
    <div className="space-y-4">
      {error && <div className="notice error">{error}</div>}
      
      <div className="flex gap-2">
        <button 
          className="button success" 
          onClick={() => updateStatus('approved')} 
          disabled={loading}
        >
          Approve Estimate
        </button>
        <button 
          className="button secondary" 
          onClick={() => updateStatus('rejected')} 
          disabled={loading}
        >
          Reject Estimate
        </button>
      </div>
    </div>
  );
}
