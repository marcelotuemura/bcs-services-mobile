import Link from "next/link"
import { redirect } from "next/navigation"
import { getPermissions, requireCompanyContext } from "@/lib/auth/permissions"

export default async function InvoicesPage() {
  const context = await requireCompanyContext()
  const { supabase, user, membership } = context

  const permissions = await getPermissions([
    'invoices.view_all',
    'invoices.view_own',
    'invoices.create'
  ], context)

  if (!permissions['invoices.view_all'] && !permissions['invoices.view_own']) {
    redirect('/')
  }

  let query = supabase
    .from("invoices")
    .select("*")
    .eq("company_id", membership.company_id)

  // Filter based on role permissions
  if (!permissions['invoices.view_all'] && permissions['invoices.view_own']) {
    query = query.eq('created_by', user.id)
  } else if (!permissions['invoices.view_all'] && !permissions['invoices.view_own']) {
    // If they have no read access at all, return empty
    query = query.eq('id', '00000000-0000-0000-0000-000000000000')
  }

  const { data: invoices } = await query.order("created_at", { ascending: false })

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Invoices</h1>
        {permissions['invoices.create'] && (
          <Link
            href="/invoices/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            New Invoice
          </Link>
        )}
      </div>
      {invoices && invoices.length > 0 ? (
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <Link
              key={invoice.id}
              href={`/invoices/${invoice.id}`}
              className="block p-4 border rounded-lg hover:bg-gray-50"
            >
              <div className="flex justify-between">
                <span className="font-medium">Invoice #{invoice.invoice_number || invoice.id.slice(0, 8)}</span>
                <span className={`px-2 py-1 rounded text-sm ${
                  invoice.status === "paid" ? "bg-green-100 text-green-800" :
                  invoice.status === "overdue" ? "bg-red-100 text-red-800" :
                  "bg-yellow-100 text-yellow-800"
                }`}>
                  {invoice.status}
                </span>
              </div>
              <div className="text-gray-600 mt-1">
                ${invoice.total} · {invoice.customer_name || "No customer"}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-center py-12">No invoices yet.</p>
      )}
    </div>
  )
}
