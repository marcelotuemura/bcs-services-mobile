'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { sendInvoiceToCustomer } from '@/actions/invoices';

interface InvoiceActionsProps {
  invoiceId: string;
  companyId: string;
}

export default function InvoiceActions({ invoiceId, companyId }: InvoiceActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://bestcoatingssolution.com';
  const invoiceUrl = `${baseUrl}/view-invoice/${invoiceId}`;

  async function updateStatus(newStatus: string) {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    const supabase = createClient();

    const { error: updateError } = await supabase
      .from('invoices')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', invoiceId)
      .eq('company_id', companyId);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccessMessage(`Invoice marked as ${newStatus} successfully.`);
      router.refresh();
    }
    setLoading(false);
  }

  async function handleSend() {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const res = await sendInvoiceToCustomer(invoiceId, companyId);

    if (res.ok) {
      setSuccessMessage(res.message);
      router.refresh();
    } else {
      setError(res.message);
    }
    setLoading(false);
  }

  function handleCopy() {
    navigator.clipboard.writeText(invoiceUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function recordPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    const formData = new FormData(e.currentTarget);
    const amount = parseFloat(formData.get('amount') as string);
    const method = formData.get('method') as string;
    
    const supabase = createClient();
    
    const { data: invoice } = await supabase
      .from('invoices')
      .select('total, amount_paid')
      .eq('id', invoiceId)
      .eq('company_id', companyId)
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
      .eq('id', invoiceId)
      .eq('company_id', companyId);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccessMessage(`Recorded payment of $${amount.toFixed(2)} successfully.`);
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      {error && <div className="notice error">{error}</div>}
      {successMessage && <div className="notice success">{successMessage}</div>}
      
      <div className="flex gap-2 flex-wrap">
        <button 
          className="button" 
          onClick={handleSend} 
          disabled={loading}
        >
          Send to Customer
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

      <div className="border rounded-lg p-4 space-y-3 bg-gray-50/10" style={{ borderColor: 'var(--line)' }}>
        <h4 className="font-semibold text-sm">Invoice Link Sharing</h4>
        <p className="text-xs text-gray-400" style={{ color: 'var(--muted)', margin: '0 0 0.5rem' }}>
          If email delivery is pending or fails, copy and manually share the link below:
        </p>
        <div className="flex gap-2">
          <input 
            className="input compact" 
            value={invoiceUrl} 
            readOnly 
            style={{ flexGrow: 1, fontFamily: 'monospace', fontSize: '0.8rem' }}
          />
          <button 
            type="button" 
            className="button secondary compact" 
            onClick={handleCopy}
            style={{ whiteSpace: 'nowrap' }}
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
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
