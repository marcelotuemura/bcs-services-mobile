'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface InvoiceFormProps {
  companyId: string;
}

export default function InvoiceForm({ companyId }: InvoiceFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Array<{ description: string; quantity: number; unit_price: number }>>([
    { description: '', quantity: 1, unit_price: 0 }
  ]);

  // Stable default values computed once via useMemo
  const defaultValues = useMemo(() => {
    const today = new Date();
    const due = new Date(today);
    due.setDate(today.getDate() + 15);
    return {
      vessel_id: '',
      date: today.toISOString().split('T')[0],
      due_date: due.toISOString().split('T')[0],
      tax_rate: 7,
      notes: 'Thank you for choosing Best Coatings Solution (BCS). We appreciate your business and trust in our team. All work is performed to the highest industry standards using premium materials.',
    };
  }, []);

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0 }]);
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const tax = subtotal * 0.08;
    return { subtotal, tax, total: subtotal + tax };
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    const { subtotal, tax, total } = calculateTotals();

    const invoiceData = {
      company_id: companyId,
      customer_id: formData.get('customer_id') as string,
      work_order_id: formData.get('work_order_id') as string || null,
      invoice_number: formData.get('invoice_number') as string,
      status: 'draft',
      issue_date: formData.get('date') as string || defaultValues.date,
      due_date: formData.get('due_date') as string || defaultValues.due_date,
      subtotal,
      tax,
      total,
      amount_paid: 0,
      balance_due: total,
      customer_name: formData.get('customer_name') as string,
      notes: formData.get('notes') as string || defaultValues.notes
    };

    const { data: invoice, error: insertError } = await supabase
      .from('invoices')
      .insert(invoiceData)
      .select('id')
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    const lineItems = items.map((item, index) => ({
      invoice_id: invoice.id,
      line_number: index + 1,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.quantity * item.unit_price,
      item_type: 'labor'
    }));

    const { error: itemsError } = await supabase.from('invoice_items').insert(lineItems);

    if (itemsError) {
      setError(itemsError.message);
      setLoading(false);
      return;
    }

    router.push(`/invoices/${invoice.id}`);
    router.refresh();
  }

  const { subtotal, tax, total } = calculateTotals();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="notice error">{error}</div>}

      <div className="form-section">
        <label className="label" htmlFor="customer_id">Customer ID</label>
        <input className="input" id="customer_id" name="customer_id" required />
        
        <label className="label" htmlFor="customer_name">Customer Name</label>
        <input className="input" id="customer_name" name="customer_name" required />

        <label className="label" htmlFor="invoice_number">Invoice Number</label>
        <input className="input" id="invoice_number" name="invoice_number" required />

        <label className="label" htmlFor="date">Issue Date</label>
        <input className="input" id="date" name="date" type="date" defaultValue={defaultValues.date} />

        <label className="label" htmlFor="due_date">Due Date</label>
        <input className="input" id="due_date" name="due_date" type="date" defaultValue={defaultValues.due_date} required />

        <label className="label" htmlFor="work_order_id">Work Order ID (optional)</label>
        <input className="input" id="work_order_id" name="work_order_id" />

        <label className="label" htmlFor="vessel_id">Vessel ID</label>
        <input className="input" id="vessel_id" name="vessel_id" defaultValue={defaultValues.vessel_id} />

        <label className="label" htmlFor="tax_rate">Tax Rate (%)</label>
        <input className="input" id="tax_rate" name="tax_rate" type="number" defaultValue={defaultValues.tax_rate} />
      </div>

      <div className="form-section">
        <h3>Line Items</h3>
        {items.map((item, index) => (
          <div key={index} className="flex gap-2 mb-2">
            <input
              className="input"
              placeholder="Description"
              value={item.description}
              onChange={(e) => updateItem(index, 'description', e.target.value)}
            />
            <input
              className="input compact"
              type="number"
              placeholder="Qty"
              value={item.quantity}
              onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
            />
            <input
              className="input compact"
              type="number"
              step="0.01"
              placeholder="Price"
              value={item.unit_price}
              onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
            />
            <button type="button" className="button secondary" onClick={() => removeItem(index)}>Remove</button>
          </div>
        ))}
        <button type="button" className="button secondary" onClick={addItem}>Add Item</button>
      </div>

      <div className="border rounded-lg p-4 space-y-2">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Tax (8%)</span>
          <span>${tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-lg border-t pt-2">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>

      <div className="form-section">
        <label className="label" htmlFor="notes">Notes</label>
        <textarea className="input" id="notes" name="notes" rows={3} defaultValue={defaultValues.notes} />
      </div>

      <button className="button" type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Invoice'}
      </button>
    </form>
  );
}
