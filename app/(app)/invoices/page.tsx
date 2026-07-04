"use client";

import "@/styles/bcs-invoice.css";


import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  vessel_id: string;
  date: string;
  due_date: string;
  status: "pending" | "paid" | "overdue" | "draft";
  tax_rate: number;
  notes: string;
  total: number;
  customers: { name: string };
  vessels: { name: string };
}

export default function InvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchInvoices();
  }, [user]);

  async function fetchInvoices() {
    setLoading(true);
    const { data, error } = await supabase
      .from("invoices")
      .select(`
        *,
        customers(name),
        vessels(name)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching invoices:", error);
    } else {
      setInvoices(data || []);
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
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <section>
        <p className="kicker">BCS Services Mobile</p>
        <h1 className="page-title">Invoices</h1>
        <div className="loading">Loading invoices...</div>
      </section>
    );
  }

  return (
    <section>
      <p className="kicker">BCS Services Mobile</p>
      <h1 className="page-title">Invoices</h1>

      <div className="bcs-header-actions">
        <Link href="/invoices/new" className="bcs-btn-primary">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          New Invoice
        </Link>
      </div>

      {invoices.length === 0 ? (
        <div className="bcs-empty-state">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <rect x="8" y="12" width="48" height="40" rx="4" stroke="#c7c7cc" strokeWidth="2"/>
            <path d="M16 24h32M16 32h24M16 40h16" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <h3>No Invoices Yet</h3>
          <p>Create your first invoice to get started</p>
          <Link href="/invoices/new" className="bcs-btn-primary">
            Create Invoice
          </Link>
        </div>
      ) : (
        <div className="bcs-invoice-list">
          {invoices.map((inv) => (
            <Link
              key={inv.id}
              href={`/invoices/${inv.id}`}
              className="bcs-invoice-card"
            >
              <div className="bcs-invoice-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="bcs-invoice-info">
                <div className="bcs-invoice-number">{inv.invoice_number}</div>
                <div className="bcs-invoice-customer">
                  {inv.customers?.name || "Unknown Customer"}
                </div>
                <div className="bcs-invoice-date">{formatDate(inv.date)}</div>
              </div>
              <div className="bcs-invoice-meta">
                <div className="bcs-invoice-amount">${formatMoney(inv.total)}</div>
                <span className={`bcs-status-badge bcs-status-${inv.status}`}>
                  {inv.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
