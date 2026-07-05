-- BCS Services Mobile v2.0 Migration: Robust Permissions Seeding
-- Safely creates permissions structures and seeds default values.

-- 1. Create public.roles table if it doesn't exist
create table if not exists public.roles (
  key text primary key,
  name text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

-- Enable RLS on roles
alter table public.roles enable row level security;

-- Create policy for roles
drop policy if exists roles_read_authenticated on public.roles;
create policy roles_read_authenticated on public.roles
  for select to authenticated
  using (true);

-- 2. Create permissions table if it doesn't exist
create table if not exists public.permissions (
  key text primary key,
  category text not null,
  description text not null,
  created_at timestamptz not null default now()
);

-- Enable RLS on permissions
alter table public.permissions enable row level security;

-- Create policy for permissions
drop policy if exists permissions_read_authenticated on public.permissions;
create policy permissions_read_authenticated on public.permissions
  for select to authenticated
  using (true);

-- 3. Create role_permissions table if it doesn't exist
create table if not exists public.role_permissions (
  role_key text not null references public.roles(key) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_key, permission_key)
);

-- Enable RLS on role_permissions
alter table public.role_permissions enable row level security;

-- Create policy for role_permissions
drop policy if exists role_permissions_read_authenticated on public.role_permissions;
create policy role_permissions_read_authenticated on public.role_permissions
  for select to authenticated
  using (true);

-- 4. Seed default roles
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

-- 5. Seed default permissions
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

-- 6. Seed default role permissions mappings
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
