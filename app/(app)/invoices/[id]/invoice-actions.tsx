'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface InvoiceActionsProps {
  invoiceId: string;
}

export default function InvoiceActions({ invoiceId }: InvoiceActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(newStatus: string) {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { error: updateError } = await supabase
      .from('invoices')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', invoiceId);

    if (updateError) {
      setError(updateError.message);
    } else {
      router.refresh();
    }
    setLoading(false);
  }

  async function recordPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const formData = new FormData(e.currentTarget);
    const amount = parseFloat(formData.get('amount') as string);
    const method = formData.get('method') as string;
    
    const supabase = createClient();
    
    const { data: invoice } = await supabase
      .from('invoices')
      .select('total, amount_paid')
      .eq('id', invoiceId)
      .single();

    if (!invoice) {
      setError('Invoice not found');
      setLoading(false);
      return;
    }

    const newAmountPaid = (invoice.amount_paid || 0) + amount;
    const newStatus = newAmountPaid >= invoice.total ? 'paid' : 'partially_paid';

    const { error: paymentError } = await supabase.from('payments').insert({
      invoice_id: invoiceId,
      amount,
      payment_method: method,
      notes: formData.get('notes') as string
    });

    if (paymentError) {
      setError(paymentError.message);
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('invoices')
      .update({ 
        amount_paid: newAmountPaid, 
        balance_due: invoice.total - newAmountPaid,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', invoiceId);

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
          className="button" 
          onClick={() => updateStatus('sent')} 
          disabled={loading}
        >
          Mark as Sent
        </button>
        <button 
          className="button success" 
          onClick={() => updateStatus('paid')} 
          disabled={loading}
        >
          Mark as Paid
        </button>
        <button 
          className="button secondary" 
          onClick={() => updateStatus('cancelled')} 
          disabled={loading}
        >
          Cancel
        </button>
      </div>

      <form onSubmit={recordPayment} className="border rounded-lg p-4 space-y-2">
        <h3 className="font-bold">Record Payment</h3>
        <div className="flex gap-2">
          <input 
            className="input compact" 
            name="amount" 
            type="number" 
            step="0.01" 
            placeholder="Amount" 
            required 
          />
          <select className="input compact" name="method" required>
            <option value="cash">Cash</option>
            <option value="credit_card">Credit Card</option>
            <option value="ach">ACH</option>
            <option value="check">Check</option>
          </select>
        </div>
        <input className="input" name="notes" placeholder="Payment notes" />
        <button className="button" type="submit" disabled={loading}>
          Record Payment
        </button>
      </form>
    </div>
  );
}
