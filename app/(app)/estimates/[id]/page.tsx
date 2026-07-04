"use client";

import "@/styles/bcs-invoice.css";

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

interface Estimate {
  id: string;
  estimate_number: string;
  customer_id: string;
  vessel_id: string;
  date: string;
  valid_date: string;
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

export default function EstimateDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !id) return;
    fetchEstimate();
  }, [user, id]);

  async function fetchEstimate() {
    setLoading(true);
    const { data, error } = await supabase
      .from("estimates")
      .select(`
        *,
        items:estimate_items(*),
        customers(name, address, city, state, zip, country),
        vessels(name, type, length, location)
      `)
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching estimate:", error);
    } else {
      setEstimate(data);
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

  async function convertToInvoice() {
    if (!estimate || !user) return;

    const today = new Date();
    const invoiceNumber = `BCS-${today.getFullYear().toString().slice(2)}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}-${String(Math.floor(Math.random() * 900) + 100)}`;

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        company_id: user.id,
        customer_id: estimate.customer_id,
        vessel_id: estimate.vessel_id,
        date: today.toISOString().split("T")[0],
        due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: "pending",
        tax_rate: estimate.tax_rate,
        notes: estimate.notes,
        subtotal: estimate.subtotal,
        tax_amount: estimate.tax_amount,
        total: estimate.total,
      })
      .select()
      .single();

    if (invoiceError) {
      console.error("Error converting to invoice:", invoiceError);
      return;
    }

    // Copy line items
    const itemsToInsert = estimate.items?.map((item, idx) => ({
      invoice_id: invoice.id,
      line_number: idx + 1,
      description: item.description,
      details: item.details,
      qty: item.qty,
      unit: item.unit,
      price: item.price,
      total: item.qty * item.price,
    }));

    if (itemsToInsert) {
      await supabase.from("invoice_items").insert(itemsToInsert);
    }

    // Update estimate status
    await supabase.from("estimates").update({ status: "converted" }).eq("id", id);

    router.push(`/invoices/${invoice.id}`);
  }

  if (loading) {
    return <div className="loading">Loading estimate...</div>;
  }

  if (!estimate) {
    return <div className="empty">Estimate not found</div>;
  }

  const customer = estimate.customers;
  const vessel = estimate.vessels;

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
          {estimate.status === "pending" && (
            <button onClick={convertToInvoice} className="bcs-btn-success" title="Convert to Invoice">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              Convert to Invoice
            </button>
          )}
        </div>
      </div>

      {/* Estimate Paper */}
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
            <div className="bcs-invoice-type" style={{ fontSize: "22px" }}>ESTIMATE</div>
            <div className="bcs-invoice-number"># {estimate.estimate_number}</div>
            <div className="bcs-estimate-badge">
              Valid Until: {formatDate(estimate.valid_date)}
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
          {estimate.items?.map((item, idx) => (
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
            <div className="bcs-notes-text">{estimate.notes}</div>
            <div className="bcs-thank-you">Thank You!</div>
          </div>
          <div className="bcs-totals-box">
            <div className="bcs-total-row">
              <span>Subtotal</span>
              <span>${formatMoney(estimate.subtotal || 0)}</span>
            </div>
            <div className="bcs-total-row">
              <span>Tax ({estimate.tax_rate}%)</span>
              <span>${formatMoney(estimate.tax_amount || 0)}</span>
            </div>
            <div className="bcs-total-row bcs-grand-total">
              <span>ESTIMATED TOTAL</span>
              <span>${formatMoney(estimate.total || 0)}</span>
            </div>
          </div>
        </div>

        {/* Estimate Terms */}
        <div className="bcs-payment-box">
          <div className="bcs-payment-header">
            <div className="bcs-payment-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
            </div>
            <span className="bcs-payment-title">ESTIMATE TERMS</span>
          </div>
          <div className="bcs-payment-methods">
            This is an estimate only. Final pricing may vary based on actual scope of work.<br />
            Please contact us to schedule a detailed inspection and final quote.<br />
            <strong>Valid until {formatDate(estimate.valid_date)}</strong>
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
