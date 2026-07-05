import { notFound } from "next/navigation"
import { requireCompanyContext } from "@/lib/auth/permissions"
import { createClient } from "@/lib/supabase/server"
import EstimateActions from "./estimate-actions"

interface Props {
  params: Promise<{ id: string }>
}

export default async function EstimateDetailPage({ params }: Props) {
  const { id } = await params
  const { membership } = await requireCompanyContext()
  const supabase = await createClient()

  const [estimateResult, estimateItemsResult] = await Promise.all([
    supabase
      .from("estimates")
      .select("*")
      .eq("id", id)
      .eq("company_id", membership.company_id)
      .single(),
    supabase
      .from("estimate_items")
      .select("*")
      .eq("estimate_id", id)
      .order("line_number", { ascending: true })
  ])

  const estimate = estimateResult.data
  const estimateItems = estimateItemsResult.data

  if (!estimate) {
    notFound()
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Estimate #{estimate.estimate_number || estimate.id.slice(0, 8)}</h1>
          <p className="text-gray-600 mt-1" style={{ color: 'var(--muted)' }}>{estimate.customer_name || "No customer"}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          estimate.status === "approved" ? "bg-green-100 text-green-800" :
          estimate.status === "rejected" ? "bg-red-100 text-red-800" :
          "bg-blue-100 text-blue-800"
        }`}>
          {estimate.status}
        </span>
      </div>

      <div className="card glass mb-6" style={{ padding: '1.25rem', borderRadius: '18px', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem', color: 'var(--muted)', fontSize: '1rem', fontWeight: 650 }}>Line Items</h3>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {estimateItems?.map((item) => (
            <div key={item.id} className="flex justify-between items-center pb-2 last:border-0 last:pb-0" style={{ borderBottom: '1px solid var(--line)' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '0.95rem' }}>{item.description}</strong>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                  Type: {item.item_type} · Qty: {item.quantity} · Price: ${item.unit_price}
                </span>
              </div>
              <strong style={{ fontSize: '1rem' }}>${item.total_price}</strong>
            </div>
          ))}
          {!estimateItems?.length && <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>No line items found.</p>}
        </div>
      </div>

      <div className="border rounded-lg p-4 mb-6 space-y-2" style={{ borderColor: 'var(--line)', background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex justify-between">
          <span style={{ color: 'var(--muted)' }}>Subtotal</span>
          <span>${estimate.subtotal || 0}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--muted)' }}>Tax</span>
          <span>${estimate.tax || 0}</span>
        </div>
        <div className="flex justify-between font-bold text-lg border-t pt-2" style={{ borderTop: '1px solid var(--line)' }}>
          <span>Total</span>
          <span>${estimate.total || 0}</span>
        </div>
      </div>

      {(estimate.status === "draft" || estimate.status === "sent") && (
        <EstimateActions estimateId={estimate.id} companyId={membership.company_id} />
      )}
    </div>
  )
}
