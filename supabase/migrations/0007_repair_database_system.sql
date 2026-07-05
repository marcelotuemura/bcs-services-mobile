-- BCS Services Mobile v2.0 Migration: Database System Repair
-- Align enum types, restore permissions tables, seed roles/permissions, optimize has_permission, and bootstrap owner membership.

-- 1. Recreate public.member_role enum type transaction-safely
alter table public.company_members alter column role drop default;
alter table public.company_members alter column role type text;

drop type if exists public.member_role;

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

-- 2. Create roles, permissions, and role permissions tables if missing
create table if not exists public.roles (
  key text primary key,
  name text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.roles enable row level security;
drop policy if exists roles_read_authenticated on public.roles;
create policy roles_read_authenticated on public.roles for select to authenticated using (true);

create table if not exists public.permissions (
  key text primary key,
  category text not null,
  description text not null,
  created_at timestamptz not null default now()
);

alter table public.permissions enable row level security;
drop policy if exists permissions_read_authenticated on public.permissions;
create policy permissions_read_authenticated on public.permissions for select to authenticated using (true);

create table if not exists public.role_permissions (
  role_key text not null references public.roles(key) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_key, permission_key)
);

alter table public.role_permissions enable row level security;
drop policy if exists role_permissions_read_authenticated on public.role_permissions;
create policy role_permissions_read_authenticated on public.role_permissions for select to authenticated using (true);

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

alter table public.user_permissions enable row level security;
drop policy if exists user_permissions_read_own_company on public.user_permissions;
create policy user_permissions_read_own_company on public.user_permissions for select to authenticated using (public.is_company_member(company_id));

drop policy if exists user_permissions_manage_team on public.user_permissions;
create policy user_permissions_manage_team on public.user_permissions for all to authenticated 
using (public.is_company_member(company_id) and public.has_permission('team.manage'))
with check (public.is_company_member(company_id) and public.has_permission('team.manage'));

-- 3. Seed default roles
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

-- 4. Seed default permissions
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

-- 5. Seed role mapping
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

-- 6. Re-define helper functions with security improvements and short-circuits
create or replace function public.current_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select company_id from public.company_members where user_id = auth.uid() order by created_at asc limit 1;
$$;

create or replace function public.has_permission(requested_permission text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  selected_company_id uuid;
  selected_role text;
  override_allowed boolean;
begin
  -- Expose check to both public and authenticated contexts, returning false for guest/unconfirmed users safely
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

  -- FOOLPROOF SHORT-CIRCUITS for admin roles
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
grant execute on function public.has_permission(text) to public;

-- 7. Bootstrap marcelotuemura@gmail.com and Best Coatings Solution if user is in auth.users
do $$
declare
  target_user_id uuid;
  target_company_id uuid;
begin
  select id into target_user_id from auth.users where email = 'marcelotuemura@gmail.com' limit 1;
  
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
