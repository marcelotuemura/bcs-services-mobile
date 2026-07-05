-- BCS Services Mobile v2.0 Migration: Estimates, Invoices, and Payments
-- Declares the schemas and Row Level Security policies for estimates, invoices, and payments.

-- 1. Estimates Table
create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade default public.current_company_id(),
  customer_id uuid references public.customers(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  estimate_number text not null,
  status text not null default 'draft', -- draft, sent, approved, rejected, expired
  issue_date date not null default current_date,
  expiry_date date not null,
  labor_total numeric(12,2) not null default 0,
  parts_total numeric(12,2) not null default 0,
  supplies_total numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  customer_name text,
  notes text,
  vessel_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Estimate Items Table
create table if not exists public.estimate_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  line_number integer not null,
  description text not null,
  quantity numeric(10,2) not null,
  unit_price numeric(12,2) not null,
  total_price numeric(12,2) not null,
  item_type text not null, -- 'labor', 'part', 'supply'
  created_at timestamptz not null default now()
);

-- 3. Invoices Table
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade default public.current_company_id(),
  customer_id uuid references public.customers(id) on delete set null,
  estimate_id uuid references public.estimates(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  invoice_number text not null,
  status text not null default 'draft', -- draft, sent, paid, partially_paid, due, overdue, cancelled
  issue_date date not null default current_date,
  due_date date not null,
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  balance_due numeric(12,2) not null default 0,
  customer_name text,
  notes text,
  vessel_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Invoice Items Table
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  line_number integer not null,
  description text not null,
  quantity numeric(10,2) not null,
  unit_price numeric(12,2) not null,
  total_price numeric(12,2) not null,
  item_type text not null, -- 'labor', 'part', 'supply'
  created_at timestamptz not null default now()
);

-- 5. Payments Table
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(12,2) not null,
  payment_method text not null, -- 'cash', 'credit_card', 'ach', 'check', 'stripe'
  transaction_id text,
  notes text,
  created_at timestamptz not null default now()
);

-- Enable RLS on all tables
alter table public.estimates enable row level security;
alter table public.estimate_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;

-- Drop existing policies if any
drop policy if exists estimates_read on public.estimates;
drop policy if exists estimates_insert on public.estimates;
drop policy if exists estimates_update on public.estimates;
drop policy if exists estimate_items_read on public.estimate_items;
drop policy if exists estimate_items_insert on public.estimate_items;
drop policy if exists invoices_read on public.invoices;
drop policy if exists invoices_insert on public.invoices;
drop policy if exists invoices_update on public.invoices;
drop policy if exists invoice_items_read on public.invoice_items;
drop policy if exists invoice_items_insert on public.invoice_items;
drop policy if exists payments_read on public.payments;
drop policy if exists payments_insert on public.payments;

-- Create Security Policies (authenticated select, insert, and updates isolated by company)
create policy estimates_read on public.estimates
  for select to authenticated
  using (public.is_company_member(company_id));

create policy estimates_insert on public.estimates
  for insert to authenticated
  with check (company_id = public.current_company_id());

create policy estimates_update on public.estimates
  for update to authenticated
  using (public.is_company_member(company_id))
  with check (company_id = public.current_company_id());

create policy estimate_items_read on public.estimate_items
  for select to authenticated
  using (exists (
    select 1 from public.estimates e
    where e.id = estimate_id
      and public.is_company_member(e.company_id)
  ));

create policy estimate_items_insert on public.estimate_items
  for insert to authenticated
  with check (exists (
    select 1 from public.estimates e
    where e.id = estimate_id
      and e.company_id = public.current_company_id()
  ));

create policy invoices_read on public.invoices
  for select to authenticated
  using (public.is_company_member(company_id));

create policy invoices_insert on public.invoices
  for insert to authenticated
  with check (company_id = public.current_company_id());

create policy invoices_update on public.invoices
  for update to authenticated
  using (public.is_company_member(company_id))
  with check (company_id = public.current_company_id());

create policy invoice_items_read on public.invoice_items
  for select to authenticated
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_id
      and public.is_company_member(i.company_id)
  ));

create policy invoice_items_insert on public.invoice_items
  for insert to authenticated
  with check (exists (
    select 1 from public.invoices i
    where i.id = invoice_id
      and i.company_id = public.current_company_id()
  ));

create policy payments_read on public.payments
  for select to authenticated
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_id
      and public.is_company_member(i.company_id)
  ));

create policy payments_insert on public.payments
  for insert to authenticated
  with check (exists (
    select 1 from public.invoices i
    where i.id = invoice_id
      and i.company_id = public.current_company_id()
  ));
