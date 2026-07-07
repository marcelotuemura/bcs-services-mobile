import Link from "next/link"
import { requireCompanyContext, verifyPageAccess } from "@/lib/auth/permissions"

export default async function EstimatesPage() {
  const context = await requireCompanyContext()
  await verifyPageAccess('estimates.create', context)
  const { supabase, membership } = context

  const { data: estimates } = await supabase
    .from("estimates")
    .select("*")
    .eq("company_id", membership.company_id)
    .order("created_at", { ascending: false })

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Estimates</h1>
        <Link
          href="/estimates/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          New Estimate
        </Link>
      </div>
      {estimates && estimates.length > 0 ? (
        <div className="space-y-3">
          {estimates.map((estimate) => (
            <Link
              key={estimate.id}
              href={`/estimates/${estimate.id}`}
              className="block p-4 border rounded-lg hover:bg-gray-50"
            >
              <div className="flex justify-between">
                <span className="font-medium">Estimate #{estimate.estimate_number || estimate.id.slice(0, 8)}</span>
                <span className={`px-2 py-1 rounded text-sm ${
                  estimate.status === "approved" ? "bg-green-100 text-green-800" :
                  estimate.status === "rejected" ? "bg-red-100 text-red-800" :
                  "bg-blue-100 text-blue-800"
                }`}>
                  {estimate.status}
                </span>
              </div>
              <div className="text-gray-600 mt-1">
                ${estimate.total} · {estimate.customer_name || "No customer"}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-center py-12">No estimates yet.</p>
      )}
    </div>
  )
}
