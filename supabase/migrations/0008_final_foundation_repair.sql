-- BCS Services Mobile v2.0 Migration: Final Foundation Repair
-- Creates core helper functions at the very top, seeds roles/permissions, enables RLS, and bootstraps company workspace.

-- ==========================================
-- PHASE 1: Helper Functions & Public Grants
-- ==========================================

create or replace function public.current_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select company_id from public.company_members where user_id = auth.uid() order by created_at asc limit 1;
$$;

create or replace function public.is_company_member(target_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_members
    where company_id = target_company_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.has_permission(requested_permission text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  selected_company_id uuid;
  selected_role text;
  override_allowed boolean;
begin
  selected_company_id := public.current_company_id();
  if selected_company_id is null or auth.uid() is null then
    return false;
  end if;

  select role::text into selected_role
  from public.company_members
  where company_id = selected_company_id
    and user_id = auth.uid()
  order by created_at asc
  limit 1;

  if selected_role is null then
    return false;
  end if;

  -- Bypasses checks for administrative owner/GM roles
  if selected_role = 'owner' or selected_role = 'general_manager' then
    return true;
  end if;

  select allowed into override_allowed
  from public.user_permissions
  where company_id = selected_company_id
    and user_id = auth.uid()
    and permission_key = requested_permission
  limit 1;

  if override_allowed is not null then
    return override_allowed;
  end if;

  return exists (
    select 1
    from public.role_permissions
    where role_key = selected_role
      and permission_key = requested_permission
  );
end;
$$;

grant execute on function public.current_company_id() to public;
grant execute on function public.is_company_member(uuid) to public;
grant execute on function public.has_permission(text) to public;


-- ==========================================
-- PHASE 2: Recreate member_role Enum safely
-- ==========================================

alter table public.company_members alter column role drop default;
alter table public.company_members alter column role type text;

drop type if exists public.member_role cascade;

create type public.member_role as enum (
  'owner',
  'general_manager',
  'office',
  'office_manager',
  'service_advisor',
  'technician',
  'accounting',
  'invoice_clerk',
  'viewer'
);

alter table public.company_members alter column role type public.member_role using role::public.member_role;
alter table public.company_members alter column role set default 'viewer'::public.member_role;


-- ==========================================
-- PHASE 3: Missing Business Tables
-- ==========================================

-- Create Enums Safely
do $$
begin
  create type public.customer_status as enum ('active', 'lead', 'inactive', 'archived');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.asset_type as enum ('boat', 'engine', 'trailer', 'jet_ski', 'rv', 'car', 'equipment');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.work_order_status as enum ('draft', 'scheduled', 'checked_in', 'in_progress', 'waiting_parts', 'waiting_approval', 'completed', 'delivered', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.work_order_priority as enum ('low', 'normal', 'high', 'urgent');
exception when duplicate_object then null;
end $$;

-- Create tables in dependency order
create table if not exists public.roles (
  key text primary key,
  name text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.permissions (
  key text primary key,
  category text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_key text not null references public.roles(key) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_key, permission_key)
);

create table if not exists public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  allowed boolean not null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id, permission_key)
);

create table if not exists public.company_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  logo_url text,
  tax_rate numeric(7,4) not null default 0,
  currency text not null default 'USD',
  language text not null default 'en',
  timezone text not null default 'America/New_York',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  company_name text,
  email text,
  phone text,
  mobile text,
  address text,
  city text,
  state text,
  zip text,
  country text not null default 'US',
  tax_id text,
  notes text,
  tags text[] not null default '{}'::text[],
  status public.customer_status not null default 'active',
  archived_at timestamptz
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  asset_type public.asset_type not null,
  manufacturer text,
  model text,
  year integer,
  vin text,
  hin text,
  registration text,
  engine text,
  serial_number text,
  hours numeric(10,2),
  color text,
  notes text,
  photo_urls text[] not null default '{}'::text[],
  document_urls text[] not null default '{}'::text[],
  archived_at timestamptz
);

create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  technician_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  status public.work_order_status not null default 'draft',
  priority public.work_order_priority not null default 'normal',
  scheduled_for timestamptz,
  estimated_hours numeric(10,2),
  labor_notes text,
  parts jsonb not null default '[]'::jsonb,
  photo_urls text[] not null default '{}'::text[],
  checklist jsonb not null default '[]'::jsonb,
  internal_notes text,
  customer_notes text,
  digital_signature text,
  completed_at timestamptz,
  labor_cost numeric(12,2) not null default 0,
  parts_cost numeric(12,2) not null default 0
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  estimate_number text not null unique,
  status text not null default 'draft',
  issue_date date not null default current_date,
  expiration_date date,
  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  customer_name text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.estimate_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  line_number integer not null,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  total_price numeric(12,2) not null default 0,
  item_type text not null default 'part',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  invoice_number text not null unique,
  status text not null default 'draft',
  issue_date date not null default current_date,
  due_date date,
  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  balance_due numeric(12,2) not null default 0,
  customer_name text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  line_number integer not null,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  total_price numeric(12,2) not null default 0,
  item_type text not null default 'part',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(12,2) not null,
  payment_method text not null,
  payment_date timestamptz not null default now(),
  transaction_reference text,
  notes text,
  created_at timestamptz not null default now()
);


-- ==========================================
-- PHASE 4: Security (RLS) Policies
-- ==========================================

alter table public.roles enable row level security;
drop policy if exists roles_read_authenticated on public.roles;
create policy roles_read_authenticated on public.roles for select to authenticated using (true);

alter table public.permissions enable row level security;
drop policy if exists permissions_read_authenticated on public.permissions;
create policy permissions_read_authenticated on public.permissions for select to authenticated using (true);

alter table public.role_permissions enable row level security;
drop policy if exists role_permissions_read_authenticated on public.role_permissions;
create policy role_permissions_read_authenticated on public.role_permissions for select to authenticated using (true);

alter table public.user_permissions enable row level security;
drop policy if exists user_permissions_read_own_company on public.user_permissions;
create policy user_permissions_read_own_company on public.user_permissions for select to authenticated using (public.is_company_member(company_id));

alter table public.company_settings enable row level security;
drop policy if exists company_settings_read on public.company_settings;
create policy company_settings_read on public.company_settings for select to authenticated using (public.is_company_member(company_id));

drop policy if exists company_settings_manage on public.company_settings;
create policy company_settings_manage on public.company_settings for all to authenticated using (public.is_company_member(company_id));

alter table public.customers enable row level security;
drop policy if exists customers_read on public.customers;
create policy customers_read on public.customers for select to authenticated using (public.is_company_member(company_id));

drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers for insert to authenticated with check (company_id = public.current_company_id());

drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers for update to authenticated using (public.is_company_member(company_id));

alter table public.assets enable row level security;
drop policy if exists assets_read on public.assets;
create policy assets_read on public.assets for select to authenticated using (public.is_company_member(company_id));

drop policy if exists assets_insert on public.assets;
create policy assets_insert on public.assets for insert to authenticated with check (company_id = public.current_company_id());

drop policy if exists assets_update on public.assets;
create policy assets_update on public.assets for update to authenticated using (public.is_company_member(company_id));

alter table public.work_orders enable row level security;
drop policy if exists work_orders_read on public.work_orders;
create policy work_orders_read on public.work_orders for select to authenticated using (public.is_company_member(company_id));

drop policy if exists work_orders_insert on public.work_orders;
create policy work_orders_insert on public.work_orders for insert to authenticated with check (company_id = public.current_company_id());

drop policy if exists work_orders_update on public.work_orders;
create policy work_orders_update on public.work_orders for update to authenticated using (public.is_company_member(company_id));

alter table public.audit_log enable row level security;
drop policy if exists audit_log_read on public.audit_log;
create policy audit_log_read on public.audit_log for select to authenticated using (public.is_company_member(company_id));

drop policy if exists audit_log_insert on public.audit_log;
create policy audit_log_insert on public.audit_log for insert to authenticated with check (company_id = public.current_company_id());

alter table public.estimates enable row level security;
drop policy if exists estimates_read on public.estimates;
create policy estimates_read on public.estimates for select to authenticated using (public.is_company_member(company_id));

drop policy if exists estimates_insert on public.estimates;
create policy estimates_insert on public.estimates for insert to authenticated with check (company_id = public.current_company_id());

drop policy if exists estimates_update on public.estimates;
create policy estimates_update on public.estimates for update to authenticated using (public.is_company_member(company_id));

alter table public.estimate_items enable row level security;
drop policy if exists estimate_items_read on public.estimate_items;
create policy estimate_items_read on public.estimate_items for select to authenticated using (exists (select 1 from public.estimates e where e.id = estimate_id and public.is_company_member(e.company_id)));

drop policy if exists estimate_items_insert on public.estimate_items;
create policy estimate_items_insert on public.estimate_items for insert to authenticated with check (exists (select 1 from public.estimates e where e.id = estimate_id and e.company_id = public.current_company_id()));

alter table public.invoices enable row level security;
drop policy if exists invoices_read on public.invoices;
create policy invoices_read on public.invoices for select to authenticated using (public.is_company_member(company_id));

drop policy if exists invoices_insert on public.invoices;
create policy invoices_insert on public.invoices for insert to authenticated with check (company_id = public.current_company_id());

drop policy if exists invoices_update on public.invoices;
create policy invoices_update on public.invoices for update to authenticated using (public.is_company_member(company_id));

alter table public.invoice_items enable row level security;
drop policy if exists invoice_items_read on public.invoice_items;
create policy invoice_items_read on public.invoice_items for select to authenticated using (exists (select 1 from public.invoices i where i.id = invoice_id and public.is_company_member(i.company_id)));

drop policy if exists invoice_items_insert on public.invoice_items;
create policy invoice_items_insert on public.invoice_items for insert to authenticated with check (exists (select 1 from public.invoices i where i.id = invoice_id and i.company_id = public.current_company_id()));

alter table public.payments enable row level security;
drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select to authenticated using (exists (select 1 from public.invoices i where i.id = invoice_id and public.is_company_member(i.company_id)));

drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments for insert to authenticated with check (exists (select 1 from public.invoices i where i.id = invoice_id and i.company_id = public.current_company_id()));


-- ==========================================
-- PHASE 5: Seed Default Data
-- ==========================================

insert into public.roles(key, name, description) values
  ('owner', 'Owner', 'Full access to the company workspace.'),
  ('general_manager', 'General Manager', 'Company-wide operational access.'),
  ('office', 'Office Manager', 'Legacy office role with operational access.'),
  ('office_manager', 'Office Manager', 'Operational access without company settings.'),
  ('service_advisor', 'Service Advisor', 'Customer and work-order coordination.'),
  ('technician', 'Technician', 'Assigned work orders and service updates.'),
  ('accounting', 'Accounting', 'Financial operations and reporting.'),
  ('invoice_clerk', 'Invoice Clerk', 'Invoice creation and own-invoice edits.'),
  ('viewer', 'Viewer', 'Read-only access.')
on conflict (key) do update set name = excluded.name, description = excluded.description;

insert into public.permissions(key, category, description) values
  ('dashboard.view', 'dashboard', 'View dashboard KPIs and activity.'),
  ('search.use', 'search', 'Use global search.'),
  ('activity.view', 'audit', 'View activity feed.'),
  ('audit.view', 'audit', 'View audit log.'),
  ('customers.view', 'customers', 'View customers.'),
  ('customers.create', 'customers', 'Create customers.'),
  ('customers.edit', 'customers', 'Edit customers.'),
  ('customers.archive', 'customers', 'Archive customers.'),
  ('customers.restore', 'customers', 'Restore customers.'),
  ('customers.delete', 'customers', 'Delete customers.'),
  ('assets.view', 'assets', 'View assets.'),
  ('assets.create', 'assets', 'Create assets.'),
  ('assets.edit', 'assets', 'Edit assets.'),
  ('assets.archive', 'assets', 'Archive assets.'),
  ('assets.delete', 'assets', 'Delete assets.'),
  ('workorders.view_all', 'workorders', 'View all work orders.'),
  ('workorders.view_assigned', 'workorders', 'View assigned work orders.'),
  ('workorders.create', 'workorders', 'Create work orders.'),
  ('workorders.edit_all', 'workorders', 'Edit all work orders.'),
  ('workorders.edit_assigned', 'workorders', 'Edit assigned work orders.'),
  ('workorders.assign', 'workorders', 'Assign work orders.'),
  ('workorders.complete', 'workorders', 'Complete work orders.'),
  ('workorders.upload_files', 'workorders', 'Upload work order files.'),
  ('settings.view', 'settings', 'View company settings.'),
  ('settings.manage', 'settings', 'Manage company settings.'),
  ('team.manage', 'team', 'Manage team and permissions.'),
  ('estimates.create', 'estimates', 'Create estimates.'),
  ('estimates.approve', 'estimates', 'Approve estimates.'),
  ('estimates.convert', 'estimates', 'Convert estimates.'),
  ('invoices.view_own', 'invoices', 'View own invoices.'),
  ('invoices.view_all', 'invoices', 'View all invoices.'),
  ('invoices.create', 'invoices', 'Create invoices.'),
  ('invoices.edit_own', 'invoices', 'Edit own invoices.'),
  ('invoices.edit_all', 'invoices', 'Edit all invoices.'),
  ('invoices.delete', 'invoices', 'Delete invoices.'),
  ('payments.receive', 'payments', 'Receive payments.'),
  ('payments.refund', 'payments', 'Refund payments.'),
  ('reports.financial', 'reports', 'View financial reports.')
on conflict (key) do update set category = excluded.category, description = excluded.description;

insert into public.role_permissions(role_key, permission_key)
select 'owner', key from public.permissions
on conflict do nothing;

insert into public.role_permissions(role_key, permission_key)
select 'general_manager', key from public.permissions
on conflict do nothing;


-- ==========================================
-- PHASE 6: Audit / Activity Log Functions
-- ==========================================

create or replace function public.record_activity(
  activity_action text,
  activity_entity_type text,
  activity_entity_id uuid default null,
  activity_metadata jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = public as $$
declare
  selected_company_id uuid;
begin
  selected_company_id := public.current_company_id();
  if selected_company_id is null then
    return;
  end if;

  insert into public.audit_log(company_id, user_id, action, entity_type, entity_id, metadata)
  values (selected_company_id, auth.uid(), activity_action, activity_entity_type, activity_entity_id, coalesce(activity_metadata, '{}'::jsonb));
end;
$$;

grant execute on function public.record_activity(text, text, uuid, jsonb) to authenticated;


-- ==========================================
-- PHASE 7: Bootstrap target user and company
-- ==========================================

do $$
declare
  target_user_id uuid;
  target_company_id uuid;
begin
  -- 7a. Try to find by email
  select id into target_user_id from auth.users where email = 'marcelotuemura@gmail.com' limit 1;
  
  -- 7b. Fallback to the first registered user if not found by email
  if target_user_id is null then
    select id into target_user_id from auth.users order by created_at asc limit 1;
  end if;
  
  if target_user_id is not null then
    insert into public.companies(name, slug)
    values ('Best Coatings Solution', 'best-coatings-solution')
    on conflict (slug) do update set name = excluded.name
    returning id into target_company_id;
    
    insert into public.company_members(company_id, user_id, role)
    values (target_company_id, target_user_id, 'owner')
    on conflict (company_id, user_id) do update set role = 'owner';
    
    insert into public.company_settings(company_id, currency)
    values (target_company_id, 'USD')
    on conflict (company_id) do nothing;
  end if;
end $$;
