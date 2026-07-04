import { requireCompanyContext } from "@/lib/auth/permissions"
import EstimateForm from "./estimate-form"

export default async function NewEstimatePage() {
  const { membership } = await requireCompanyContext()

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">New Estimate</h1>
      <EstimateForm companyId={membership.company_id} />
    </div>
  )
}
