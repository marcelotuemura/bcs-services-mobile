-- 1. Alter invoices table to add Stripe checkout and delivery fields
alter table public.invoices add column if not exists stripe_checkout_session_id text;
alter table public.invoices add column if not exists stripe_payment_intent_id text;
alter table public.invoices add column if not exists payment_url text;
alter table public.invoices add column if not exists sent_at timestamptz;
alter table public.invoices add column if not exists paid_at timestamptz;

-- 2. Alter payments table to add Stripe details
alter table public.payments add column if not exists stripe_payment_intent_id text;
alter table public.payments add column if not exists stripe_checkout_session_id text;
alter table public.payments add column if not exists status text;
alter table public.payments add column if not exists raw_event jsonb;

-- 2.5 Redefine public.get_public_invoice_by_id to expose payment_url for customer payment trigger
drop function if exists public.get_public_invoice_by_id(uuid);
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
  created_at timestamptz,
  payment_url text
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
    i.created_at,
    i.payment_url
  from public.invoices i
  join public.companies c on c.id = i.company_id
  where i.id = target_id;
end;
$$;

grant execute on function public.get_public_invoice_by_id(uuid) to public;
grant execute on function public.get_public_invoice_by_id(uuid) to anon;
grant execute on function public.get_public_invoice_by_id(uuid) to authenticated;

-- 3. Create security definer function to mark invoices paid via Stripe webhooks bypassing RLS
create or replace function public.mark_invoice_paid_by_stripe(
  target_invoice_id uuid,
  target_amount numeric,
  target_session_id text,
  target_payment_intent_id text,
  target_event jsonb
)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  existing_payment uuid;
  selected_invoice public.invoices%rowtype;
begin
  -- 1. Webhook Idempotency Check: verify if checkout session has already been processed
  select id into existing_payment
  from public.payments
  where stripe_checkout_session_id = target_session_id
  limit 1;

  if existing_payment is not null then
    return true; -- Already processed successfully
  end if;

  -- 2. Fetch invoice details
  select * into selected_invoice
  from public.invoices
  where id = target_invoice_id;

  if not found then
    return false; -- Invoice not found
  end if;

  -- 3. Update invoice details
  update public.invoices
  set status = 'paid',
      amount_paid = selected_invoice.total,
      balance_due = 0,
      paid_at = now(),
      stripe_checkout_session_id = target_session_id,
      stripe_payment_intent_id = target_payment_intent_id
  where id = target_invoice_id;

  -- 4. Log payment record
  insert into public.payments (
    invoice_id,
    amount,
    payment_method,
    transaction_id,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    status,
    notes,
    raw_event
  ) values (
    target_invoice_id,
    selected_invoice.total,
    'stripe',
    target_payment_intent_id,
    target_session_id,
    target_payment_intent_id,
    'succeeded',
    'Stripe Checkout Payment completed.',
    target_event
  );

  -- 5. Write audit log event
  insert into public.audit_log(company_id, user_id, action, entity_type, entity_id, metadata)
  values (
    selected_invoice.company_id,
    null, -- System webhook action
    'invoice_paid',
    'invoice',
    target_invoice_id,
    jsonb_build_object(
      'invoice_number', selected_invoice.invoice_number,
      'amount', selected_invoice.total,
      'session_id', target_session_id
    )
  );

  return true;
end;
$$;

-- 4. Grant execute permissions on RPC to public and system users
grant execute on function public.mark_invoice_paid_by_stripe(uuid, numeric, text, text, jsonb) to public;
grant execute on function public.mark_invoice_paid_by_stripe(uuid, numeric, text, text, jsonb) to anon;
grant execute on function public.mark_invoice_paid_by_stripe(uuid, numeric, text, text, jsonb) to authenticated;
