import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PublicInvoicePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. Fetch public invoice details
  const invoiceResult = await supabase
    .rpc("get_public_invoice_by_id", { target_id: id })
    .maybeSingle();

  const invoice = invoiceResult.data as any;
  const invError = invoiceResult.error;

  if (invError || !invoice) {
    console.error("[public-invoice] Fetch error:", invError);
    notFound();
  }

  // 2. Fetch public invoice items
  const { data: invoiceItems, error: itemsError } = await supabase
    .rpc("get_public_invoice_items_by_id", { target_id: id });

  if (itemsError) {
    console.error("[public-invoice] Fetch items error:", itemsError);
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-[#0B0F19]" style={{ color: "white" }}>
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Company Branding / Header */}
        <div className="flex justify-between items-end pb-6 border-b" style={{ borderColor: "var(--line)" }}>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">{invoice.company_name}</h1>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Professional Marine & Specialty Coatings</p>
          </div>
          <div className="text-right">
            {invoice.status !== "draft" && (
              <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                invoice.status === "paid" ? "bg-green-500/20 text-green-400 border border-green-500/30" :
                invoice.status === "overdue" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
              }`}>
                {invoice.status}
              </span>
            )}
          </div>
        </div>

        {/* Invoice Meta Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 card glass p-6" style={{ borderRadius: "18px", border: "1px solid var(--line)" }}>
          <div>
            <h2 className="text-gray-400 text-xs uppercase tracking-wider font-semibold mb-2">Invoice To:</h2>
            <p className="text-lg font-bold text-white">{invoice.customer_name || "Valued Customer"}</p>
          </div>
          <div className="md:text-right space-y-2">
            <div>
              <span className="text-gray-400 text-xs block uppercase tracking-wider font-semibold">Invoice Number</span>
              <strong className="text-lg text-white">#{invoice.invoice_number}</strong>
            </div>
            <div className="grid grid-cols-2 gap-4 md:block md:space-y-2">
              <div>
                <span className="text-gray-400 text-xs block uppercase tracking-wider font-semibold">Issue Date</span>
                <span className="text-white">{invoice.issue_date}</span>
              </div>
              <div>
                <span className="text-gray-400 text-xs block uppercase tracking-wider font-semibold">Due Date</span>
                <span className="text-white">{invoice.due_date}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Line Items Card */}
        <div className="card glass p-6 space-y-4" style={{ borderRadius: "18px", border: "1px solid var(--line)" }}>
          <h3 className="text-lg font-bold border-b pb-2 text-white" style={{ borderColor: "var(--line)" }}>Line Items</h3>
          
          <div className="space-y-4">
            {invoiceItems?.map((item: any) => (
              <div key={item.id} className="flex justify-between items-start pb-4 border-b last:border-0 last:pb-0" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <div>
                  <strong className="text-white block">{item.description}</strong>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    Qty: {item.quantity} · Price: ${parseFloat(item.unit_price).toFixed(2)}
                  </span>
                </div>
                <strong className="text-white">${parseFloat(item.total_price).toFixed(2)}</strong>
              </div>
            ))}
            {!invoiceItems?.length && (
              <p className="text-center py-6" style={{ color: "var(--muted)" }}>No line items listed.</p>
            )}
          </div>
        </div>

        {/* Financial Summary Box */}
        <div className="flex justify-end">
          <div className="w-full md:w-80 card glass p-6 space-y-3" style={{ borderRadius: "18px", border: "1px solid var(--line)" }}>
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--muted)" }}>Subtotal</span>
              <span>${parseFloat(invoice.subtotal || 0).toFixed(2)}</span>
            </div>
            {parseFloat(invoice.discount || 0) > 0 && (
              <div className="flex justify-between text-sm text-green-400">
                <span>Discount</span>
                <span>-${parseFloat(invoice.discount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--muted)" }}>Tax</span>
              <span>${parseFloat(invoice.tax || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-3" style={{ borderColor: "var(--line)", color: "white" }}>
              <span>Total</span>
              <span>${parseFloat(invoice.total || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm pt-2" style={{ color: "var(--muted)" }}>
              <span>Amount Paid</span>
              <span>${parseFloat(invoice.amount_paid || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-1" style={{ color: invoice.balance_due > 0 ? "#ff8080" : "#40ff40" }}>
              <span>Balance Due</span>
              <span>${parseFloat(invoice.balance_due || 0).toFixed(2)}</span>
            </div>
            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && invoice.payment_url && (
              <div className="pt-4">
                <a 
                  href={invoice.payment_url}
                  className="button block text-center w-full text-white font-bold py-2.5 px-4 rounded-lg transition-colors"
                  style={{ backgroundColor: '#2563eb', display: 'block', textAlign: 'center', color: 'white' }}
                >
                  Pay Invoice with Card
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Footer Notes */}
        {invoice.notes && (
          <div className="card glass p-6 text-sm" style={{ borderRadius: "18px", border: "1px solid var(--line)" }}>
            <h4 className="font-semibold text-gray-300 mb-2">Terms & Notes:</h4>
            <p className="whitespace-pre-line" style={{ color: "var(--muted)" }}>{invoice.notes}</p>
          </div>
        )}

        <div className="text-center text-xs py-8" style={{ color: "var(--muted)" }}>
          <p>This is a secure invoice link from Best Coatings Solution.</p>
          <p className="mt-1">Thank you for your business!</p>
        </div>

      </div>
    </div>
  );
}
