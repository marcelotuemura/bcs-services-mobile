import { notFound } from "next/navigation"
import { requireCompanyContext } from "@/lib/auth/permissions"
import { createClient } from "@/lib/supabase/server"
import InvoiceActions from "./invoice-actions"

interface Props {
  params: Promise<{ id: string }>
}

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params
  const { membership } = await requireCompanyContext()
  const supabase = await createClient()

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("company_id", membership.company_id)
    .single()

  if (!invoice) {
    notFound()
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Invoice #{invoice.invoice_number || invoice.id.slice(0, 8)}</h1>
          <p className="text-gray-600 mt-1">{invoice.customer_name || "No customer"}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          invoice.status === "paid" ? "bg-green-100 text-green-800" :
          invoice.status === "overdue" ? "bg-red-100 text-red-800" :
          "bg-yellow-100 text-yellow-800"
        }`}>
          {invoice.status}
        </span>
      </div>

      <div className="border rounded-lg p-4 mb-6 space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-600">Subtotal</span>
          <span>${invoice.subtotal || 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Tax</span>
          <span>${invoice.tax || 0}</span>
        </div>
        <div className="flex justify-between font-bold text-lg border-t pt-2">
          <span>Total</span>
          <span>${invoice.total || 0}</span>
        </div>
      </div>

      {invoice.status !== "paid" && (
        <InvoiceActions invoiceId={invoice.id} companyId={membership.company_id} />
      )}
    </div>
  )
}
