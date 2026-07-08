'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { sendInvoiceToCustomer, createInvoiceCheckoutSession } from '@/actions/invoices';

interface InvoiceActionsProps {
  invoiceId: string;
  companyId: string;
  status: string;
  paymentUrl?: string | null;
  total: number;
  payments: Array<{
    id: string;
    amount: number;
    payment_method: string;
    transaction_id?: string | null;
    created_at: string;
    notes?: string | null;
  }>;
}

export default function InvoiceActions({
  invoiceId,
  companyId,
  status,
  paymentUrl: initialPaymentUrl,
  total,
  payments
}: InvoiceActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedStripe, setCopiedStripe] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(initialPaymentUrl || null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://www.bestcoatingssolution.com';
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

  async function handleGenerateLink() {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const res = await createInvoiceCheckoutSession(invoiceId, companyId);

    if (res.ok && res.paymentUrl) {
      setPaymentUrl(res.paymentUrl);
      setSuccessMessage('Stripe Checkout Payment link generated successfully.');
      router.refresh();
    } else {
      setError(res.message || 'Failed to generate payment link.');
    }
    setLoading(false);
  }

  function handleCopyInvoiceLink() {
    navigator.clipboard.writeText(invoiceUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  function handleCopyStripeLink() {
    if (paymentUrl) {
      navigator.clipboard.writeText(paymentUrl);
      setCopiedStripe(true);
      setTimeout(() => setCopiedStripe(false), 2000);
    }
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
      
      {status !== 'paid' ? (
        <>
          <div className="flex gap-2 flex-wrap">
            <button 
              className="button" 
              onClick={handleSend} 
              disabled={loading}
            >
              Send to Customer
            </button>

            {!paymentUrl && total > 0 && (
              <button 
                className="button secondary" 
                onClick={handleGenerateLink} 
                disabled={loading}
              >
                Generate Payment Link
              </button>
            )}

            {paymentUrl && (
              <a 
                href={paymentUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="button secondary"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >
                Pay on Stripe
              </a>
            )}

            <button 
              className="button success" 
              onClick={() => updateStatus('paid')} 
              disabled={loading}
            >
              Mark as Paid
            </button>

            {status !== 'cancelled' && (
              <button 
                className="button secondary" 
                onClick={() => updateStatus('cancelled')} 
                disabled={loading}
              >
                Cancel
              </button>
            )}
          </div>

          <div className="border rounded-lg p-4 space-y-3 bg-gray-50/10" style={{ borderColor: 'var(--line)' }}>
            <h4 className="font-semibold text-sm">Invoice Link Sharing</h4>
            <p className="text-xs text-gray-400" style={{ color: 'var(--muted)', margin: '0 0 0.5rem' }}>
              If email delivery is pending or fails, copy and manually share the customer invoice page link:
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
                onClick={handleCopyInvoiceLink}
                style={{ whiteSpace: 'nowrap' }}
              >
                {copiedLink ? 'Copied!' : 'Copy Link'}
              </button>
            </div>

            {paymentUrl && (
              <div className="pt-2 border-t space-y-1" style={{ borderTopColor: 'var(--line)' }}>
                <p className="text-xs text-gray-400" style={{ color: 'var(--muted)', margin: '0 0 0.5rem' }}>
                  Direct Stripe Checkout payment page link:
                </p>
                <div className="flex gap-2">
                  <input 
                    className="input compact" 
                    value={paymentUrl} 
                    readOnly 
                    style={{ flexGrow: 1, fontFamily: 'monospace', fontSize: '0.8rem' }}
                  />
                  <button 
                    type="button" 
                    className="button secondary compact" 
                    onClick={handleCopyStripeLink}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {copiedStripe ? 'Copied!' : 'Copy Stripe Link'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={recordPayment} className="border rounded-lg p-4 space-y-2">
            <h3 className="font-bold">Record Payment Manually</h3>
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
        </>
      ) : (
        <div className="border rounded-lg p-4 space-y-3 bg-green-50/5" style={{ borderColor: '#10b981' }}>
          <h3 className="font-bold text-green-500" style={{ margin: 0 }}>Payment Information</h3>
          {payments.length > 0 ? (
            <div className="space-y-4 pt-1">
              {payments.map((p) => (
                <div key={p.id} className="text-sm space-y-1 pb-3 last:pb-0 last:border-0" style={{ borderBottom: '1px solid var(--line)' }}>
                  <div className="flex justify-between">
                    <span><strong>Amount Paid:</strong></span>
                    <span>${p.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span><strong>Method:</strong></span>
                    <span className="uppercase">{p.payment_method}</span>
                  </div>
                  {p.transaction_id && (
                    <div className="flex justify-between">
                      <span><strong>Transaction ID:</strong></span>
                      <code className="text-xs">{p.transaction_id}</code>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span><strong>Transaction Date:</strong></span>
                    <span>{new Date(p.created_at).toLocaleString()}</span>
                  </div>
                  {p.notes && (
                    <div className="text-xs text-gray-400 pt-1" style={{ color: 'var(--muted)' }}>
                      <strong>Notes:</strong> {p.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400" style={{ color: 'var(--muted)', margin: 0 }}>
              No detailed payment transactions recorded. Marked paid manually.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
