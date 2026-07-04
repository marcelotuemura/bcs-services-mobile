import { requireCompanyContext } from "@/lib/auth/permissions"
import InvoiceForm from "./invoice-form"

export default async function NewInvoicePage() {
  const { membership } = await requireCompanyContext()

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">New Invoice</h1>
      <InvoiceForm companyId={membership.company_id} />
    </div>
  )
}
