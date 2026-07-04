"use client";

import "@/styles/bcs-invoice.css";


import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

interface LineItem {
  id: string;
  description: string;
  details: string;
  qty: number;
  unit: string;
  price: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  vessel_id: string;
  date: string;
  due_date: string;
  status: string;
  tax_rate: number;
  notes: string;
  total: number;
  subtotal: number;
  tax_amount: number;
  items: LineItem[];
  customers: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  vessels: {
    name: string;
    type: string;
    length: number;
    location: string;
  };
}

const serviceIcons = [
  "M3 12l2-2 4 4 8-8 2 2-10 10z",
  "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
  "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z",
  "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
];

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !id) return;
    fetchInvoice();
  }, [user, id]);

  async function fetchInvoice() {
    setLoading(true);
    const { data, error } = await supabase
      .from("invoices")
      .select(`
        *,
        items:invoice_items(*),
        customers(name, address, city, state, zip, country),
        vessels(name, type, length, location)
      `)
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching invoice:", error);
    } else {
      setInvoice(data);
    }
    setLoading(false);
  }

  function formatMoney(amount: number) {
    return amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  async function markAsPaid() {
    const { error } = await supabase
      .from("invoices")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("Error marking as paid:", error);
    } else {
      fetchInvoice();
    }
  }

  if (loading) {
    return <div className="loading">Loading invoice...</div>;
  }

  if (!invoice) {
    return <div className="empty">Invoice not found</div>;
  }

  const customer = invoice.customers;
  const vessel = invoice.vessels;

  return (
    <section className="bcs-invoice-detail">
      {/* Header Actions */}
      <div className="bcs-detail-header">
        <button onClick={() => router.back()} className="bcs-back-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
        <div className="bcs-detail-actions">
          <button onClick={() => window.print()} className="bcs-icon-btn" title="Print">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
              <path d="M6 14h12v8H6z"/>
            </svg>
          </button>
          {invoice.status === "pending" && (
            <button onClick={markAsPaid} className="bcs-btn-success">
              Mark Paid
            </button>
          )}
        </div>
      </div>

      {/* Invoice Paper */}
      <div className="bcs-invoice-paper">
        {/* Brand Header */}
        <div className="bcs-paper-header">
          <div className="bcs-brand">
            <svg className="bcs-logo" viewBox="0 0 120 80" fill="none">
              <path d="M10 55 Q25 30 50 35 Q75 40 95 20" stroke="#1a73e8" strokeWidth="6" fill="none" strokeLinecap="round"/>
              <path d="M5 65 Q30 40 55 45 Q80 50 100 30" stroke="#00c853" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.6"/>
              <path d="M45 20 L75 20 L60 5 Z" fill="#1a73e8"/>
            </svg>
            <div className="bcs-brand-name">BEST COATINGS SOLUTION</div>
            <div className="bcs-brand-abbr">(BCS)</div>
          </div>
          <div className="bcs-invoice-type-box">
            <div className="bcs-invoice-type">INVOICE</div>
            <div className="bcs-invoice-number"># {invoice.invoice_number}</div>
            <div className="bcs-date-box">
              <div className="bcs-date-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div className="bcs-date-info">
                <div className="bcs-date-label">Invoice Date</div>
                <div className="bcs-date-value">{formatDate(invoice.date)}</div>
              </div>
            </div>
            <div className="bcs-due-date">
              <span className="bcs-due-label">Due Date</span>
              <span className="bcs-due-value">{formatDate(invoice.due_date)}</span>
            </div>
          </div>
        </div>

        {/* Service Banner */}
        <div className="bcs-service-banner">
          <div className="bcs-service-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 20a2 2 0 01-2-2V6a2 2 0 012-2h20a2 2 0 012 2v12a2 2 0 01-2 2H2z"/>
              <path d="M6 8h.01M6 16h.01M10 8h.01M10 16h.01M14 8h.01M14 16h.01M18 8h.01M18 16h.01"/>
            </svg>
          </div>
          <span className="bcs-service-text">Premium Marine Coatings & Restoration Services</span>
        </div>

        {/* Info Grid */}
        <div className="bcs-info-grid">
          <div className="bcs-info-box">
            <div className="bcs-info-header">
              <div className="bcs-info-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <span className="bcs-info-title">BILL TO</span>
            </div>
            <div className="bcs-info-content">
              <strong>{customer?.name || "Unknown"}</strong>
              {customer && (
                <>
                  <br />{customer.address}
                  <br />{customer.city}, {customer.state} {customer.zip}
                  <br />{customer.country}
                </>
              )}
            </div>
          </div>
          <div className="bcs-info-box">
            <div className="bcs-info-header" style={{ opacity: 0 }}>
              <div className="bcs-info-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>
              <span className="bcs-info-title">VESSEL</span>
            </div>
            <div className="bcs-info-content">
              {vessel ? (
                <>
                  <div className="bcs-info-row"><span className="bcs-info-label">Vessel Name</span><span className="bcs-info-value">{vessel.name}</span></div>
                  <div className="bcs-info-row"><span className="bcs-info-label">Vessel Type</span><span className="bcs-info-value">{vessel.type}</span></div>
                  <div className="bcs-info-row"><span className="bcs-info-label">Vessel Length</span><span className="bcs-info-value">{vessel.length} ft</span></div>
                  <div className="bcs-info-row"><span className="bcs-info-label">Work Location</span><span className="bcs-info-value">{vessel.location}</span></div>
                </>
              ) : (
                <div className="bcs-info-row"><span className="bcs-info-label">No vessel assigned</span></div>
              )}
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="bcs-line-items">
          <div className="bcs-line-items-header">
            <span>#</span>
            <span>Description</span>
            <span style={{ textAlign: "right" }}>Qty</span>
            <span style={{ textAlign: "right" }}>Unit</span>
            <span style={{ textAlign: "right" }}>Unit Price</span>
            <span style={{ textAlign: "right" }}>Total</span>
          </div>
          {invoice.items?.map((item, idx) => (
            <div className="bcs-line-item" key={item.id}>
              <span className="bcs-line-number">{idx + 1}</span>
              <div className="bcs-line-desc">
                <div className="bcs-line-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d={serviceIcons[idx % serviceIcons.length]}/>
                  </svg>
                </div>
                <div className="bcs-line-text">
                  <strong>{item.description}</strong>
                  <span>{item.details}</span>
                </div>
              </div>
              <span className="bcs-line-qty">{item.qty}</span>
              <span className="bcs-line-unit">{item.unit}</span>
              <span className="bcs-line-price">${formatMoney(item.price)}</span>
              <span className="bcs-line-total">${formatMoney(item.qty * item.price)}</span>
            </div>
          ))}
        </div>

        {/* Totals Section */}
        <div className="bcs-totals-section">
          <div className="bcs-notes-box">
            <div className="bcs-notes-header">
              <div className="bcs-notes-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </div>
              <span className="bcs-notes-title">NOTES</span>
            </div>
            <div className="bcs-notes-text">{invoice.notes}</div>
            <div className="bcs-thank-you">Thank You!</div>
          </div>
          <div className="bcs-totals-box">
            <div className="bcs-total-row">
              <span>Subtotal</span>
              <span>${formatMoney(invoice.subtotal || 0)}</span>
            </div>
            <div className="bcs-total-row">
              <span>Tax ({invoice.tax_rate}%)</span>
              <span>${formatMoney(invoice.tax_amount || 0)}</span>
            </div>
            <div className="bcs-total-row bcs-grand-total">
              <span>TOTAL DUE</span>
              <span>${formatMoney(invoice.total || 0)}</span>
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bcs-payment-box">
          <div className="bcs-payment-header">
            <div className="bcs-payment-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                <line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
            </div>
            <span className="bcs-payment-title">PAYMENT METHODS</span>
          </div>
          <div className="bcs-payment-methods">
            <strong>Bank Transfer</strong> &bull; <strong>Credit Card</strong> &bull; <strong>Check</strong><br />
            <strong>Zelle</strong> &bull; <strong>Wire Transfer</strong>
          </div>
          <div className="bcs-payment-secure">
            <span className="bcs-payment-secure-text">For secure payments, contact us directly.</span>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
        </div>

        {/* Footer */}
        <div className="bcs-invoice-footer">
          <div className="bcs-footer-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
            </svg>
            954-123-4567
          </div>
          <div className="bcs-footer-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            info@bestcoatingssolution.com
          </div>
          <div className="bcs-footer-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
            </svg>
            bestcoatingssolution.com
          </div>
          <div className="bcs-footer-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            Fort Lauderdale, FL United States
          </div>
        </div>
      </div>
    </section>
  );
}
