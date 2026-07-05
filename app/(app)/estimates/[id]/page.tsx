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

  const { data: estimate } = await supabase
    .from("estimates")
    .select("*")
    .eq("id", id)
    .eq("company_id", membership.company_id)
    .single()

  if (!estimate) {
    notFound()
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Estimate #{estimate.estimate_number || estimate.id.slice(0, 8)}</h1>
          <p className="text-gray-600 mt-1">{estimate.customer_name || "No customer"}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          estimate.status === "approved" ? "bg-green-100 text-green-800" :
          estimate.status === "rejected" ? "bg-red-100 text-red-800" :
          "bg-blue-100 text-blue-800"
        }`}>
          {estimate.status}
        </span>
      </div>

      <div className="border rounded-lg p-4 mb-6 space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-600">Subtotal</span>
          <span>${estimate.subtotal || 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Tax</span>
          <span>${estimate.tax || 0}</span>
        </div>
        <div className="flex justify-between font-bold text-lg border-t pt-2">
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
