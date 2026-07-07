import { requireCompanyContext, verifyPageAccess } from "@/lib/auth/permissions"
import InvoiceForm from "./invoice-form"

export default async function NewInvoicePage() {
  const context = await requireCompanyContext()
  await verifyPageAccess('invoices.create', context)
  const { supabase, membership } = context

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name")
    .eq("company_id", membership.company_id)
    .neq("status", "archived")
    .order("name", { ascending: true })

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">New Invoice</h1>
      <InvoiceForm companyId={membership.company_id} customers={customers || []} />
    </div>
  )
}
