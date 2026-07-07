-- 1. Create function to retrieve invoice details publicly
create or replace function public.get_public_invoice_by_id(target_id uuid)
returns table (
  id uuid,
  company_id uuid,
  company_name text,
  customer_id uuid,
  invoice_number text,
  status text,
  issue_date date,
  due_date date,
  subtotal numeric(12,2),
  discount numeric(12,2),
  tax numeric(12,2),
  total numeric(12,2),
  amount_paid numeric(12,2),
  balance_due numeric(12,2),
  customer_name text,
  notes text,
  vessel_id text,
  created_at timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  return query
  select
    i.id,
    i.company_id,
    c.name as company_name,
    i.customer_id,
    i.invoice_number,
    i.status,
    i.issue_date,
    i.due_date,
    i.subtotal,
    i.discount,
    i.tax,
    i.total,
    i.amount_paid,
    i.balance_due,
    i.customer_name,
    i.notes,
    i.vessel_id,
    i.created_at
  from public.invoices i
  join public.companies c on c.id = i.company_id
  where i.id = target_id;
end;
$$;

-- 2. Create function to retrieve invoice items publicly
create or replace function public.get_public_invoice_items_by_id(target_id uuid)
returns table (
  id uuid,
  invoice_id uuid,
  line_number integer,
  description text,
  quantity numeric(12,2),
  unit_price numeric(12,2),
  total_price numeric(12,2),
  item_type text
) language plpgsql security definer set search_path = public as $$
begin
  return query
  select
    ii.id,
    ii.invoice_id,
    ii.line_number,
    ii.description,
    ii.quantity,
    ii.unit_price,
    ii.total_price,
    ii.item_type
  from public.invoice_items ii
  join public.invoices i on i.id = ii.invoice_id
  where ii.invoice_id = target_id
  order by ii.line_number asc;
end;
$$;

-- 3. Grant execute permissions on functions to public
grant execute on function public.get_public_invoice_by_id(uuid) to public;
grant execute on function public.get_public_invoice_items_by_id(uuid) to public;
grant execute on function public.get_public_invoice_by_id(uuid) to authenticated;
grant execute on function public.get_public_invoice_items_by_id(uuid) to authenticated;
