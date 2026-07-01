-- BCS Services Mobile v2.0 Phase 1: core business foundation.
-- Adds permission-based access control, customers, assets, work orders,
-- company settings, audit logging, and global search.

create extension if not exists pgcrypto;

alter type public.member_role add value if not exists 'office_manager';
alter type public.member_role add value if not exists 'service_advisor';
alter type public.member_role add value if not exists 'accounting';
alter type public.member_role add value if not exists 'invoice_clerk';

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
  create type public.work_order_status as enum (
    'draft',
    'scheduled',
    'checked_in',
    'in_progress',
    'waiting_parts',
    'waiting_approval',
    'completed',
    'delivered',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.work_order_priority as enum ('low', 'normal', 'high', 'urgent');
exception when duplicate_object then null;
end $$;

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
  company_id uuid not null references public.companies(id) on delete cascade default public.current_company_id(),
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
  company_id uuid not null references public.companies(id) on delete cascade default public.current_company_id(),
  customer_id uuid references public.customers(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  asset_type public.asset_type not null,
  manufacturer text,
  model text,
  year integer check (year is null or (year >= 1900 and year <= 2100)),
  vin text,
  hin text,
  registration text,
  engine text,
  serial_number text,
  hours numeric(10,2) check (hours is null or hours >= 0),
  color text,
  notes text,
  photo_urls text[] not null default '{}'::text[],
  document_urls text[] not null default '{}'::text[],
  archived_at timestamptz
);

create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade default public.current_company_id(),
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
  estimated_hours numeric(10,2) check (estimated_hours is null or estimated_hours >= 0),
  labor_notes text,
  parts jsonb not null default '[]'::jsonb,
  photo_urls text[] not null default '{}'::text[],
  checklist jsonb not null default '[]'::jsonb,
  internal_notes text,
  customer_notes text,
  digital_signature text,
  completed_at timestamptz
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

create or replace function public.stamp_updated_metadata()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists trg_user_permissions_updated on public.user_permissions;
create trigger trg_user_permissions_updated
before update on public.user_permissions
for each row execute function public.stamp_updated_metadata();

drop trigger if exists trg_company_settings_updated on public.company_settings;
create trigger trg_company_settings_updated
before update on public.company_settings
for each row execute function public.stamp_updated_metadata();

drop trigger if exists trg_customers_updated on public.customers;
create trigger trg_customers_updated
before update on public.customers
for each row execute function public.stamp_updated_metadata();

drop trigger if exists trg_assets_updated on public.assets;
create trigger trg_assets_updated
before update on public.assets
for each row execute function public.stamp_updated_metadata();

drop trigger if exists trg_work_orders_updated on public.work_orders;
create trigger trg_work_orders_updated
before update on public.work_orders
for each row execute function public.stamp_updated_metadata();

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
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description;

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
on conflict (key) do update set
  category = excluded.category,
  description = excluded.description;

insert into public.role_permissions(role_key, permission_key)
select 'owner', key from public.permissions
on conflict do nothing;

insert into public.role_permissions(role_key, permission_key)
select 'general_manager', key from public.permissions
on conflict do nothing;

insert into public.role_permissions(role_key, permission_key)
select role_key, permission_key
from (
  values
    ('office', 'dashboard.view'),
    ('office', 'search.use'),
    ('office', 'activity.view'),
    ('office', 'customers.view'),
    ('office', 'customers.create'),
    ('office', 'customers.edit'),
    ('office', 'customers.archive'),
    ('office', 'customers.restore'),
    ('office', 'assets.view'),
    ('office', 'assets.create'),
    ('office', 'assets.edit'),
    ('office', 'workorders.view_all'),
    ('office', 'workorders.create'),
    ('office', 'workorders.edit_all'),
    ('office', 'workorders.assign'),
    ('office', 'settings.view'),
    ('office_manager', 'dashboard.view'),
    ('office_manager', 'search.use'),
    ('office_manager', 'activity.view'),
    ('office_manager', 'customers.view'),
    ('office_manager', 'customers.create'),
    ('office_manager', 'customers.edit'),
    ('office_manager', 'customers.archive'),
    ('office_manager', 'customers.restore'),
    ('office_manager', 'assets.view'),
    ('office_manager', 'assets.create'),
    ('office_manager', 'assets.edit'),
    ('office_manager', 'workorders.view_all'),
    ('office_manager', 'workorders.create'),
    ('office_manager', 'workorders.edit_all'),
    ('office_manager', 'workorders.assign'),
    ('office_manager', 'settings.view'),
    ('service_advisor', 'dashboard.view'),
    ('service_advisor', 'search.use'),
    ('service_advisor', 'activity.view'),
    ('service_advisor', 'customers.view'),
    ('service_advisor', 'customers.create'),
    ('service_advisor', 'customers.edit'),
    ('service_advisor', 'assets.view'),
    ('service_advisor', 'assets.create'),
    ('service_advisor', 'assets.edit'),
    ('service_advisor', 'workorders.view_all'),
    ('service_advisor', 'workorders.create'),
    ('service_advisor', 'workorders.edit_all'),
    ('service_advisor', 'workorders.assign'),
    ('technician', 'dashboard.view'),
    ('technician', 'search.use'),
    ('technician', 'customers.view'),
    ('technician', 'assets.view'),
    ('technician', 'workorders.view_assigned'),
    ('technician', 'workorders.edit_assigned'),
    ('technician', 'workorders.complete'),
    ('technician', 'workorders.upload_files'),
    ('accounting', 'dashboard.view'),
    ('accounting', 'search.use'),
    ('accounting', 'customers.view'),
    ('accounting', 'workorders.view_all'),
    ('accounting', 'invoices.view_all'),
    ('accounting', 'payments.receive'),
    ('accounting', 'payments.refund'),
    ('accounting', 'reports.financial'),
    ('invoice_clerk', 'dashboard.view'),
    ('invoice_clerk', 'search.use'),
    ('invoice_clerk', 'customers.view'),
    ('invoice_clerk', 'invoices.view_own'),
    ('invoice_clerk', 'invoices.create'),
    ('invoice_clerk', 'invoices.edit_own'),
    ('viewer', 'dashboard.view'),
    ('viewer', 'search.use'),
    ('viewer', 'customers.view'),
    ('viewer', 'assets.view'),
    ('viewer', 'workorders.view_all'),
    ('viewer', 'settings.view')
) as grants(role_key, permission_key)
on conflict do nothing;

create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = public as $$
  select role::text
  from public.company_members
  where company_id = public.current_company_id()
    and user_id = auth.uid()
  order by created_at asc
  limit 1;
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

create or replace function public.can_view_work_order(target_work_order_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  selected_order public.work_orders%rowtype;
begin
  select * into selected_order
  from public.work_orders
  where id = target_work_order_id
    and company_id = public.current_company_id();

  if not found then
    return false;
  end if;

  if public.has_permission('workorders.view_all') then
    return true;
  end if;

  return public.has_permission('workorders.view_assigned')
    and selected_order.technician_id = auth.uid();
end;
$$;

create or replace function public.can_edit_work_order(target_work_order_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  selected_order public.work_orders%rowtype;
begin
  select * into selected_order
  from public.work_orders
  where id = target_work_order_id
    and company_id = public.current_company_id();

  if not found then
    return false;
  end if;

  if public.has_permission('workorders.edit_all') then
    return true;
  end if;

  return public.has_permission('workorders.edit_assigned')
    and selected_order.technician_id = auth.uid();
end;
$$;

create or replace function public.can_view_invoice(target_invoice_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_permission('invoices.view_all') or public.has_permission('invoices.view_own');
$$;

create or replace function public.can_edit_invoice(target_invoice_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_permission('invoices.edit_all') or public.has_permission('invoices.edit_own');
$$;

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

  insert into public.activity_log(company_id, user_id, action, entity_type, entity_id, metadata)
  values (selected_company_id, auth.uid(), activity_action, activity_entity_type, activity_entity_id, coalesce(activity_metadata, '{}'::jsonb));

  insert into public.audit_log(company_id, user_id, action, entity_type, entity_id, metadata)
  values (selected_company_id, auth.uid(), activity_action, activity_entity_type, activity_entity_id, coalesce(activity_metadata, '{}'::jsonb));
end;
$$;

create or replace function public.search_company_records(search_term text default '', result_limit integer default 20)
returns table (
  entity_type text,
  entity_id uuid,
  title text,
  subtitle text,
  href text,
  updated_at timestamptz
) language sql stable security definer set search_path = public as $$
  with params as (
    select
      lower(coalesce(search_term, '')) as q,
      least(greatest(coalesce(result_limit, 20), 1), 50) as max_rows
  ),
  customer_results as (
    select
      'customer'::text as entity_type,
      c.id as entity_id,
      c.name as title,
      coalesce(c.company_name, c.email, c.phone, c.mobile, 'Customer') as subtitle,
      '/customers'::text as href,
      c.updated_at
    from public.customers c, params p
    where c.company_id = public.current_company_id()
      and c.archived_at is null
      and public.has_permission('customers.view')
      and (
        p.q = ''
        or lower(c.name) like '%' || p.q || '%'
        or lower(coalesce(c.company_name, '')) like '%' || p.q || '%'
        or lower(coalesce(c.email, '')) like '%' || p.q || '%'
        or lower(coalesce(c.phone, '')) like '%' || p.q || '%'
        or lower(coalesce(c.mobile, '')) like '%' || p.q || '%'
      )
  ),
  asset_results as (
    select
      'asset'::text as entity_type,
      a.id as entity_id,
      concat_ws(' ', initcap(replace(a.asset_type::text, '_', ' ')), a.manufacturer, a.model) as title,
      coalesce(a.registration, a.vin, a.hin, a.serial_number, 'Asset') as subtitle,
      '/assets'::text as href,
      a.updated_at
    from public.assets a, params p
    where a.company_id = public.current_company_id()
      and a.archived_at is null
      and public.has_permission('assets.view')
      and (
        p.q = ''
        or lower(coalesce(a.manufacturer, '')) like '%' || p.q || '%'
        or lower(coalesce(a.model, '')) like '%' || p.q || '%'
        or lower(coalesce(a.vin, '')) like '%' || p.q || '%'
        or lower(coalesce(a.hin, '')) like '%' || p.q || '%'
        or lower(coalesce(a.registration, '')) like '%' || p.q || '%'
      )
  ),
  work_order_results as (
    select
      'work_order'::text as entity_type,
      w.id as entity_id,
      w.title as title,
      concat_ws(' · ', initcap(replace(w.status::text, '_', ' ')), initcap(w.priority::text)) as subtitle,
      '/work-orders'::text as href,
      w.updated_at
    from public.work_orders w, params p
    where w.company_id = public.current_company_id()
      and public.can_view_work_order(w.id)
      and (
        p.q = ''
        or lower(w.title) like '%' || p.q || '%'
        or lower(coalesce(w.customer_notes, '')) like '%' || p.q || '%'
        or lower(coalesce(w.internal_notes, '')) like '%' || p.q || '%'
      )
  )
  select *
  from (
    select * from customer_results
    union all
    select * from asset_results
    union all
    select * from work_order_results
  ) results, params p
  order by results.updated_at desc
  limit (select max_rows from params);
$$;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.can_view_invoice(uuid) to authenticated;
grant execute on function public.can_edit_invoice(uuid) to authenticated;
grant execute on function public.can_view_work_order(uuid) to authenticated;
grant execute on function public.can_edit_work_order(uuid) to authenticated;
grant execute on function public.record_activity(text, text, uuid, jsonb) to authenticated;
grant execute on function public.search_company_records(text, integer) to authenticated;

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_permissions enable row level security;
alter table public.company_settings enable row level security;
alter table public.customers enable row level security;
alter table public.assets enable row level security;
alter table public.work_orders enable row level security;
alter table public.audit_log enable row level security;

create index if not exists idx_user_permissions_company_user on public.user_permissions(company_id, user_id);
create index if not exists idx_customers_company_status on public.customers(company_id, status);
create index if not exists idx_customers_company_name on public.customers(company_id, name);
create index if not exists idx_assets_company_customer on public.assets(company_id, customer_id);
create index if not exists idx_assets_company_type on public.assets(company_id, asset_type);
create index if not exists idx_work_orders_company_status on public.work_orders(company_id, status);
create index if not exists idx_work_orders_company_technician on public.work_orders(company_id, technician_id);
create index if not exists idx_work_orders_company_schedule on public.work_orders(company_id, scheduled_for);
create index if not exists idx_audit_log_company_created on public.audit_log(company_id, created_at desc);

drop policy if exists roles_read_authenticated on public.roles;
create policy roles_read_authenticated on public.roles
for select to authenticated
using (true);

drop policy if exists permissions_read_authenticated on public.permissions;
create policy permissions_read_authenticated on public.permissions
for select to authenticated
using (true);

drop policy if exists role_permissions_read_authenticated on public.role_permissions;
create policy role_permissions_read_authenticated on public.role_permissions
for select to authenticated
using (true);

drop policy if exists user_permissions_read_own_company on public.user_permissions;
create policy user_permissions_read_own_company on public.user_permissions
for select to authenticated
using (public.is_company_member(company_id));

drop policy if exists user_permissions_manage_team on public.user_permissions;
create policy user_permissions_manage_team on public.user_permissions
for all to authenticated
using (public.is_company_member(company_id) and public.has_permission('team.manage'))
with check (public.is_company_member(company_id) and public.has_permission('team.manage'));

drop policy if exists company_settings_read on public.company_settings;
create policy company_settings_read on public.company_settings
for select to authenticated
using (public.is_company_member(company_id) and public.has_permission('settings.view'));

drop policy if exists company_settings_manage on public.company_settings;
create policy company_settings_manage on public.company_settings
for all to authenticated
using (public.is_company_member(company_id) and public.has_permission('settings.manage'))
with check (company_id = public.current_company_id() and public.has_permission('settings.manage'));

drop policy if exists customers_read on public.customers;
create policy customers_read on public.customers
for select to authenticated
using (public.is_company_member(company_id) and public.has_permission('customers.view'));

drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers
for insert to authenticated
with check (company_id = public.current_company_id() and public.has_permission('customers.create'));

drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers
for update to authenticated
using (public.is_company_member(company_id) and public.has_permission('customers.edit'))
with check (company_id = public.current_company_id() and public.has_permission('customers.edit'));

drop policy if exists customers_delete on public.customers;
create policy customers_delete on public.customers
for delete to authenticated
using (public.is_company_member(company_id) and public.has_permission('customers.delete'));

drop policy if exists assets_read on public.assets;
create policy assets_read on public.assets
for select to authenticated
using (public.is_company_member(company_id) and public.has_permission('assets.view'));

drop policy if exists assets_insert on public.assets;
create policy assets_insert on public.assets
for insert to authenticated
with check (company_id = public.current_company_id() and public.has_permission('assets.create'));

drop policy if exists assets_update on public.assets;
create policy assets_update on public.assets
for update to authenticated
using (public.is_company_member(company_id) and public.has_permission('assets.edit'))
with check (company_id = public.current_company_id() and public.has_permission('assets.edit'));

drop policy if exists assets_delete on public.assets;
create policy assets_delete on public.assets
for delete to authenticated
using (public.is_company_member(company_id) and public.has_permission('assets.delete'));

drop policy if exists work_orders_read on public.work_orders;
create policy work_orders_read on public.work_orders
for select to authenticated
using (public.can_view_work_order(id));

drop policy if exists work_orders_insert on public.work_orders;
create policy work_orders_insert on public.work_orders
for insert to authenticated
with check (company_id = public.current_company_id() and public.has_permission('workorders.create'));

drop policy if exists work_orders_update on public.work_orders;
create policy work_orders_update on public.work_orders
for update to authenticated
using (public.can_edit_work_order(id))
with check (company_id = public.current_company_id() and public.can_edit_work_order(id));

drop policy if exists work_orders_delete on public.work_orders;
create policy work_orders_delete on public.work_orders
for delete to authenticated
using (public.is_company_member(company_id) and public.has_permission('workorders.edit_all'));

drop policy if exists audit_log_read on public.audit_log;
create policy audit_log_read on public.audit_log
for select to authenticated
using (public.is_company_member(company_id) and public.has_permission('audit.view'));

drop policy if exists audit_log_insert on public.audit_log;
create policy audit_log_insert on public.audit_log
for insert to authenticated
with check (company_id = public.current_company_id());

drop policy if exists audit_log_no_update on public.audit_log;
create policy audit_log_no_update on public.audit_log
for update to authenticated
using (false);

drop policy if exists audit_log_no_delete on public.audit_log;
create policy audit_log_no_delete on public.audit_log
for delete to authenticated
using (false);
