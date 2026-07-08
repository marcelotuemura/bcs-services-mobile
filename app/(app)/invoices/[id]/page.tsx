import { notFound, redirect } from "next/navigation"
import { getPermissions, requireCompanyContext } from "@/lib/auth/permissions"
import InvoiceActions from "./invoice-actions"

interface Props {
  params: Promise<{ id: string }>
}

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params
  const context = await requireCompanyContext()
  const { supabase, user, membership } = context

  const permissions = await getPermissions([
    'invoices.view_all',
    'invoices.view_own'
  ], context)

  const [invoiceResult, invoiceItemsResult, paymentsResult] = await Promise.all([
    supabase
      .from("invoices")
      .select("*")
      .eq("id", id)
      .eq("company_id", membership.company_id)
      .single(),
    supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", id)
      .order("line_number", { ascending: true }),
    supabase
      .from("payments")
      .select("*")
      .eq("invoice_id", id)
      .order("created_at", { ascending: false })
  ])

  const invoice = invoiceResult.data
  const invoiceItems = invoiceItemsResult.data
  const payments = paymentsResult.data || []

  if (!invoice) {
    notFound()
  }

  // Enforce access control boundaries for own-only invoice viewing
  if (!permissions['invoices.view_all']) {
    if (permissions['invoices.view_own']) {
      // Must be the creator of the invoice
      if (invoice.created_by !== user.id) {
        redirect('/invoices')
      }
    } else {
      // No permissions at all
      redirect('/invoices')
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Invoice #{invoice.invoice_number || invoice.id.slice(0, 8)}</h1>
          <p className="text-gray-600 mt-1" style={{ color: 'var(--muted)' }}>{invoice.customer_name || "No customer"}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          invoice.status === "paid" ? "bg-green-100 text-green-800" :
          invoice.status === "overdue" ? "bg-red-100 text-red-800" :
          "bg-yellow-100 text-yellow-800"
        }`}>
          {invoice.status}
        </span>
      </div>

      <div className="card glass mb-6" style={{ padding: '1.25rem', borderRadius: '18px', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem', color: 'var(--muted)', fontSize: '1rem', fontWeight: 650 }}>Line Items</h3>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {invoiceItems?.map((item) => (
            <div key={item.id} className="flex justify-between items-center pb-2 last:border-0 last:pb-0" style={{ borderBottom: '1px solid var(--line)' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '0.95rem' }}>{item.description}</strong>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                  Qty: {item.quantity} · Price: ${item.unit_price}
                </span>
              </div>
              <strong style={{ fontSize: '1rem' }}>${item.total_price}</strong>
            </div>
          ))}
          {!invoiceItems?.length && <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>No line items found.</p>}
        </div>
      </div>

      <div className="border rounded-lg p-4 mb-6 space-y-2" style={{ borderColor: 'var(--line)', background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex justify-between">
          <span style={{ color: 'var(--muted)' }}>Subtotal</span>
          <span>${invoice.subtotal || 0}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--muted)' }}>Tax</span>
          <span>${invoice.tax || 0}</span>
        </div>
        <div className="flex justify-between font-bold text-lg border-t pt-2" style={{ borderTop: '1px solid var(--line)' }}>
          <span>Total</span>
          <span>${invoice.total || 0}</span>
        </div>
      </div>

      <InvoiceActions 
        invoiceId={invoice.id} 
        companyId={membership.company_id} 
        status={invoice.status}
        paymentUrl={invoice.payment_url}
        total={Number(invoice.total || 0)}
        payments={payments}
      />
    </div>
  )
}
