"use client";

import "@/styles/bcs-invoice.css";

import "@/styles/bcs-invoice.css";


import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

interface Customer {
  id: string;
  name: string;
}

interface Vessel {
  id: string;
  name: string;
  type: string;
}

interface LineItem {
  description: string;
  details: string;
  qty: number;
  unit: string;
  price: number;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [loading, setLoading] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", details: "", qty: 1, unit: "Job", price: 0 },
  ]);

  const [formData, setFormData] = useState({
    customer_id: "",
    vessel_id: "",
    date: new Date().toISOString().split("T")[0],
    due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    tax_rate: 7,
    notes: "Thank you for choosing Best Coatings Solution (BCS). We appreciate your business and trust in our team. All work is performed to the highest industry standards using premium materials.",
  });

  useEffect(() => {
    if (!user) return;
    fetchCustomers();
    fetchVessels();
  }, [user]);

  async function fetchCustomers() {
    const { data } = await supabase.from("customers").select("id, name").order("name");
    setCustomers(data || []);
  }

  async function fetchVessels() {
    const { data } = await supabase.from("vessels").select("id, name, type").order("name");
    setVessels(data || []);
  }

  function addLineItem() {
    setLineItems([...lineItems, { description: "", details: "", qty: 1, unit: "Job", price: 0 }]);
  }

  function removeLineItem(index: number) {
    setLineItems(lineItems.filter((_, i) => i !== index));
  }

  function updateLineItem(index: number, field: keyof LineItem, value: string | number) {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  }

  function calculateTotals() {
    const subtotal = lineItems.reduce((sum, item) => sum + item.qty * item.price, 0);
    const tax = subtotal * (formData.tax_rate / 100);
    const total = subtotal + tax;
    return { subtotal, tax, total };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    const { subtotal, tax, total } = calculateTotals();

    // Generate invoice number
    const today = new Date();
    const invoiceNumber = `BCS-${today.getFullYear().toString().slice(2)}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}-${String(Math.floor(Math.random() * 900) + 100)}`;

    // Insert invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        company_id: user.id,
        customer_id: formData.customer_id,
        vessel_id: formData.vessel_id || null,
        date: formData.date,
        due_date: formData.due_date,
        status: "pending",
        tax_rate: formData.tax_rate,
        notes: formData.notes,
        subtotal,
        tax_amount: tax,
        total,
      })
      .select()
      .single();

    if (invoiceError) {
      console.error("Error creating invoice:", invoiceError);
      setLoading(false);
      return;
    }

    // Insert line items
    const itemsToInsert = lineItems.map((item, idx) => ({
      invoice_id: invoice.id,
      line_number: idx + 1,
      description: item.description,
      details: item.details,
      qty: item.qty,
      unit: item.unit,
      price: item.price,
      total: item.qty * item.price,
    }));

    const { error: itemsError } = await supabase.from("invoice_items").insert(itemsToInsert);

    if (itemsError) {
      console.error("Error creating line items:", itemsError);
    }

    setLoading(false);
    router.push(`/invoices/${invoice.id}`);
  }

  return (
    <section>
      <div className="bcs-form-header">
        <button onClick={() => router.back()} className="bcs-back-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
        <h1 className="page-title">Create Invoice</h1>
      </div>

      <form onSubmit={handleSubmit} className="bcs-form">
        <div className="bcs-form-group">
          <label className="bcs-form-label">Customer</label>
          <select
            className="bcs-form-select"
            value={formData.customer_id}
            onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
            required
          >
            <option value="">Select Customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="bcs-form-row">
          <div className="bcs-form-group">
            <label className="bcs-form-label">Invoice Date</label>
            <input
              type="date"
              className="bcs-form-input"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>
          <div className="bcs-form-group">
            <label className="bcs-form-label">Due Date</label>
            <input
              type="date"
              className="bcs-form-input"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="bcs-form-group">
          <label className="bcs-form-label">Vessel</label>
          <select
            className="bcs-form-select"
            value={formData.vessel_id}
            onChange={(e) => setFormData({ ...formData, vessel_id: e.target.value })}
          >
            <option value="">Select Vessel</option>
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>{v.name} ({v.type})</option>
            ))}
          </select>
        </div>

        <div className="bcs-section-title">Line Items</div>
        {lineItems.map((item, index) => (
          <div className="bcs-line-item-form" key={index}>
            <div className="bcs-line-item-header">
              <span>Item #{index + 1}</span>
              {lineItems.length > 1 && (
                <button type="button" className="bcs-remove-btn" onClick={() => removeLineItem(index)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                  </svg>
                </button>
              )}
            </div>
            <div className="bcs-form-group">
              <label className="bcs-form-label">Description</label>
              <input
                type="text"
                className="bcs-form-input"
                value={item.description}
                onChange={(e) => updateLineItem(index, "description", e.target.value)}
                placeholder="Service description"
                required
              />
            </div>
            <div className="bcs-form-group">
              <label className="bcs-form-label">Details</label>
              <input
                type="text"
                className="bcs-form-input"
                value={item.details}
                onChange={(e) => updateLineItem(index, "details", e.target.value)}
                placeholder="Additional details"
              />
            </div>
            <div className="bcs-form-row">
              <div className="bcs-form-group">
                <label className="bcs-form-label">Qty</label>
                <input
                  type="number"
                  className="bcs-form-input"
                  value={item.qty}
                  onChange={(e) => updateLineItem(index, "qty", parseFloat(e.target.value) || 0)}
                  min="1"
                  required
                />
              </div>
              <div className="bcs-form-group">
                <label className="bcs-form-label">Unit</label>
                <select
                  className="bcs-form-select"
                  value={item.unit}
                  onChange={(e) => updateLineItem(index, "unit", e.target.value)}
                >
                  <option>Job</option>
                  <option>Hour</option>
                  <option>Ft</option>
                  <option>Each</option>
                </select>
              </div>
              <div className="bcs-form-group">
                <label className="bcs-form-label">Unit Price</label>
                <input
                  type="number"
                  className="bcs-form-input"
                  value={item.price || ""}
                  onChange={(e) => updateLineItem(index, "price", parseFloat(e.target.value) || 0)}
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
          </div>
        ))}

        <button type="button" className="bcs-add-line-btn" onClick={addLineItem}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Add Line Item
        </button>

        <div className="bcs-form-group">
          <label className="bcs-form-label">Tax Rate (%)</label>
          <input
            type="number"
            className="bcs-form-input"
            value={formData.tax_rate}
            onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 0 })}
            min="0"
            max="100"
            step="0.01"
          />
        </div>

        <div className="bcs-form-group">
          <label className="bcs-form-label">Notes</label>
          <textarea
            className="bcs-form-textarea"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={4}
          />
        </div>

        <div className="bcs-total-preview">
          <div className="bcs-total-preview-row">
            <span>Subtotal</span>
            <span>${calculateTotals().subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="bcs-total-preview-row">
            <span>Tax ({formData.tax_rate}%)</span>
            <span>${calculateTotals().tax.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="bcs-total-preview-row bcs-total-preview-grand">
            <span>Total</span>
            <span>${calculateTotals().total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <button type="submit" className="bcs-btn-primary" disabled={loading}>
          {loading ? "Saving..." : "Save Invoice"}
        </button>
      </form>
    </section>
  );
}
