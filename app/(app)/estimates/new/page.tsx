import { requireCompanyContext, verifyPageAccess } from "@/lib/auth/permissions"
import EstimateForm from "./estimate-form"

export default async function NewEstimatePage() {
  const context = await requireCompanyContext()
  await verifyPageAccess('estimates.create', context)
  const { supabase, membership } = context

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name")
    .eq("company_id", membership.company_id)
    .neq("status", "archived")
    .order("name", { ascending: true })

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">New Estimate</h1>
      <EstimateForm companyId={membership.company_id} customers={customers || []} />
    </div>
  )
}
