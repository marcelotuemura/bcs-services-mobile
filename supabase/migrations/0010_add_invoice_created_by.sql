-- 1. Add created_by column to invoices table if not exists
alter table public.invoices 
add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid();

-- 2. Seed invoice_clerk role permissions in the database
insert into public.role_permissions (role_key, permission_key)
values 
  ('invoice_clerk', 'invoices.view_own'),
  ('invoice_clerk', 'invoices.create'),
  ('invoice_clerk', 'invoices.edit_own')
on conflict (role_key, permission_key) do nothing;

-- 3. Clean up any accidental browse permissions for invoice_clerk
delete from public.role_permissions 
where role_key = 'invoice_clerk' 
  and permission_key in ('dashboard.view', 'search.use', 'customers.view');
