import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ApprovalForm from './approval-form';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PublicEstimatePage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();

  // 1. Fetch estimate by token using public security definer RPC
  const estimateResult = await supabase
    .rpc('get_public_estimate_by_token', { token })
    .maybeSingle();

  const estimate = estimateResult.data as any;
  const estError = estimateResult.error;

  if (estError || !estimate) {
    console.error('[public-estimate] Fetch error:', estError);
    notFound();
  }

  // 2. Only allow access if status is sent, approved, rejected, or expired
  const allowedStatuses = ['sent', 'approved', 'rejected', 'expired'];
  if (!allowedStatuses.includes(estimate.status)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#0B0F19]" style={{ color: 'white' }}>
        <div className="card glass p-8 text-center max-w-md" style={{ borderRadius: '18px', border: '1px solid var(--line)' }}>
          <h2 className="text-2xl font-bold mb-4">Estimate Pending</h2>
          <p className="text-gray-400">This estimate is not yet ready for customer review.</p>
        </div>
      </div>
    );
  }

  // 3. Fetch estimate items using public security-definer RPC
  const { data: itemsData, error: itemsError } = await supabase
    .rpc('get_public_estimate_items_by_token', { token });

  const items = itemsData as any[] | null;

  if (itemsError) {
    console.error('[public-estimate] Fetch items error:', itemsError);
  }

  const subtotal = (estimate.labor_total || 0) + (estimate.parts_total || 0) + (estimate.supplies_total || 0);

  return (
    <div className="min-h-screen p-4 md:p-8 bg-[#0B0F19]" style={{ color: 'white' }}>
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Company Branding / Header */}
        <div className="flex justify-between items-end pb-6 border-b" style={{ borderColor: 'var(--line)' }}>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">{estimate.company_name}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Professional Marine & Specialty Coatings</p>
          </div>
          <div className="text-right">
            <span className="text-sm font-semibold block" style={{ color: 'var(--muted)' }}>ESTIMATE</span>
            <span className="text-lg font-bold">#{estimate.estimate_number}</span>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 card glass" style={{ borderRadius: '18px', border: '1px solid var(--line)', background: 'rgba(255,255,255,0.01)' }}>
          <div>
            <h3 style={{ margin: '0 0 0.5rem', color: 'var(--muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Prepared For</h3>
            <strong className="text-lg text-white block">{estimate.customer_name || 'Valued Client'}</strong>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="block text-xs" style={{ color: 'var(--muted)' }}>Issue Date</span>
              <strong className="text-sm">{new Date(estimate.issue_date).toLocaleDateString()}</strong>
            </div>
            <div>
              <span className="block text-xs" style={{ color: 'var(--muted)' }}>Valid Until</span>
              <strong className="text-sm">{new Date(estimate.expiry_date).toLocaleDateString()}</strong>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="card glass p-6" style={{ borderRadius: '18px', border: '1px solid var(--line)', background: 'rgba(255,255,255,0.01)' }}>
          <h3 className="text-lg font-bold mb-4">Services & Materials</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--line)' }}>
                  <th className="pb-3 text-sm font-semibold" style={{ color: 'var(--muted)' }}>Description</th>
                  <th className="pb-3 text-sm font-semibold text-center" style={{ color: 'var(--muted)' }}>Qty</th>
                  <th className="pb-3 text-sm font-semibold text-right" style={{ color: 'var(--muted)' }}>Unit Price</th>
                  <th className="pb-3 text-sm font-semibold text-right" style={{ color: 'var(--muted)' }}>Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {items?.map((item: any) => (
                  <tr key={item.id}>
                    <td className="py-4 text-sm">
                      <span className="font-semibold block text-white">{item.description}</span>
                      <span className="text-xs uppercase px-1.5 py-0.5 rounded" style={{ color: 'var(--muted)', background: 'rgba(255,255,255,0.04)', fontSize: '0.7rem' }}>
                        {item.item_type}
                      </span>
                    </td>
                    <td className="py-4 text-sm text-center">{Number(item.quantity)}</td>
                    <td className="py-4 text-sm text-right">${Number(item.unit_price).toFixed(2)}</td>
                    <td className="py-4 text-sm text-right font-bold">${Number(item.total_price).toFixed(2)}</td>
                  </tr>
                ))}
                {!items?.length && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-sm" style={{ color: 'var(--muted)' }}>
                      No items specified.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals Section */}
        <div className="flex justify-between items-start">
          <div className="max-w-md text-sm italic" style={{ color: 'var(--muted)' }}>
            {estimate.notes && (
              <div className="p-4 rounded-lg card glass" style={{ border: '1px solid var(--line)' }}>
                <span className="font-semibold block not-italic mb-1" style={{ color: 'white' }}>Notes:</span>
                {estimate.notes}
              </div>
            )}
          </div>
          <div className="w-64 space-y-3 p-4 rounded-lg card glass border" style={{ borderColor: 'var(--line)', background: 'rgba(255,255,255,0.02)' }}>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--muted)' }}>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {Number(estimate.discount) > 0 && (
              <div className="flex justify-between text-sm text-red-400">
                <span>Discount</span>
                <span>-${Number(estimate.discount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--muted)' }}>Tax</span>
              <span>${Number(estimate.tax).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2" style={{ borderTop: '1px solid var(--line)' }}>
              <span>Total</span>
              <span style={{ color: 'var(--accent)' }}>${Number(estimate.total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Interactive Approval Form */}
        <ApprovalForm
          token={token}
          customerName={estimate.customer_name}
          customerEmail={estimate.customer_approved_email}
          status={estimate.status}
          approvedAt={estimate.approved_at}
          rejectedAt={estimate.rejected_at}
          approvedName={estimate.customer_approved_name}
          approvedEmail={estimate.customer_approved_email}
          signature={estimate.customer_signature}
          notes={estimate.customer_response_notes}
        />
        
      </div>
    </div>
  );
}
