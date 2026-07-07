-- Add created_by column to invoices table if not exists
alter table public.invoices 
add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid();

-- Remove dashboard, search, and customer viewing permissions from invoice_clerk
delete from public.role_permissions 
where role_key = 'invoice_clerk' 
  and permission_key in ('dashboard.view', 'search.use', 'customers.view');
