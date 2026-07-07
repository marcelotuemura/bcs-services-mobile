-- 1. Add columns to work_orders, customers, and assets if they don't exist
alter table public.work_orders add column if not exists work_order_number text;
alter table public.customers add column if not exists customer_number text;
alter table public.assets add column if not exists asset_number text;

-- 2. Create sequences with start values dynamic to existing records
do $$
declare
  max_est int;
  max_inv int;
  max_wo int;
  max_cus int;
  max_ast int;
begin
  -- Estimates sequence (EST)
  select coalesce(max(substring(estimate_number from '[0-9]+')::int), 129) into max_est from public.estimates;
  if not exists (select 1 from pg_class where relkind = 'S' and relname = 'estimate_number_seq') then
    execute 'create sequence public.estimate_number_seq start with ' || (max_est + 1);
  end if;

  -- Invoices sequence (INV)
  select coalesce(max(substring(invoice_number from '[0-9]+')::int), 170) into max_inv from public.invoices;
  if not exists (select 1 from pg_class where relkind = 'S' and relname = 'invoice_number_seq') then
    execute 'create sequence public.invoice_number_seq start with ' || (max_inv + 1);
  end if;

  -- Work Orders sequence (WO)
  select coalesce(max(substring(work_order_number from '[0-9]+')::int), 5000) into max_wo from public.work_orders;
  if not exists (select 1 from pg_class where relkind = 'S' and relname = 'work_order_number_seq') then
    execute 'create sequence public.work_order_number_seq start with ' || (max_wo + 1);
  end if;

  -- Customers sequence (CUS)
  select coalesce(max(substring(customer_number from '[0-9]+')::int), 1000) into max_cus from public.customers;
  if not exists (select 1 from pg_class where relkind = 'S' and relname = 'customer_number_seq') then
    execute 'create sequence public.customer_number_seq start with ' || (max_cus + 1);
  end if;

  -- Assets sequence (AST)
  select coalesce(max(substring(asset_number from '[0-9]+')::int), 1000) into max_ast from public.assets;
  if not exists (select 1 from pg_class where relkind = 'S' and relname = 'asset_number_seq') then
    execute 'create sequence public.asset_number_seq start with ' || (max_ast + 1);
  end if;
end;
$$;

-- 3. Define numbering generator helper functions
create or replace function public.generate_estimate_number()
returns text language plpgsql as $$
begin
  return 'EST' || nextval('public.estimate_number_seq');
end;
$$;

create or replace function public.generate_invoice_number()
returns text language plpgsql as $$
begin
  return 'INV' || nextval('public.invoice_number_seq');
end;
$$;

create or replace function public.generate_work_order_number()
returns text language plpgsql as $$
begin
  return 'WO' || nextval('public.work_order_number_seq');
end;
$$;

create or replace function public.generate_customer_number()
returns text language plpgsql as $$
begin
  return 'CUS' || nextval('public.customer_number_seq');
end;
$$;

create or replace function public.generate_asset_number()
returns text language plpgsql as $$
begin
  return 'AST' || nextval('public.asset_number_seq');
end;
$$;

-- 4. Backfill any existing records with missing numbers
update public.estimates
set estimate_number = public.generate_estimate_number()
where estimate_number is null;

update public.invoices
set invoice_number = public.generate_invoice_number()
where invoice_number is null;

update public.work_orders
set work_order_number = public.generate_work_order_number()
where work_order_number is null;

update public.customers
set customer_number = public.generate_customer_number()
where customer_number is null;

update public.assets
set asset_number = public.generate_asset_number()
where asset_number is null;

-- 5. Add unique constraints now that columns are populated
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'work_orders_work_order_number_key') then
    alter table public.work_orders add constraint work_orders_work_order_number_key unique (work_order_number);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'customers_customer_number_key') then
    alter table public.customers add constraint customers_customer_number_key unique (customer_number);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'assets_asset_number_key') then
    alter table public.assets add constraint assets_asset_number_key unique (asset_number);
  end if;
end;
$$;

-- 6. Trigger definitions to assign sequence numbers on INSERT
-- Estimates Trigger
create or replace function public.trg_assign_estimate_number()
returns trigger language plpgsql as $$
begin
  if new.estimate_number is null then
    new.estimate_number := public.generate_estimate_number();
  end if;
  return new;
end;
$$;

drop trigger if exists assign_estimate_number_trigger on public.estimates;
create trigger assign_estimate_number_trigger
before insert on public.estimates
for each row
execute function public.trg_assign_estimate_number();

-- Invoices Trigger
create or replace function public.trg_assign_invoice_number()
returns trigger language plpgsql as $$
begin
  if new.invoice_number is null then
    new.invoice_number := public.generate_invoice_number();
  end if;
  return new;
end;
$$;

drop trigger if exists assign_invoice_number_trigger on public.invoices;
create trigger assign_invoice_number_trigger
before insert on public.invoices
for each row
execute function public.trg_assign_invoice_number();

-- Work Orders Trigger
create or replace function public.trg_assign_work_order_number()
returns trigger language plpgsql as $$
begin
  if new.work_order_number is null then
    new.work_order_number := public.generate_work_order_number();
  end if;
  return new;
end;
$$;

drop trigger if exists assign_work_order_number_trigger on public.work_orders;
create trigger assign_work_order_number_trigger
before insert on public.work_orders
for each row
execute function public.trg_assign_work_order_number();

-- Customers Trigger
create or replace function public.trg_assign_customer_number()
returns trigger language plpgsql as $$
begin
  if new.customer_number is null then
    new.customer_number := public.generate_customer_number();
  end if;
  return new;
end;
$$;

drop trigger if exists assign_customer_number_trigger on public.customers;
create trigger assign_customer_number_trigger
before insert on public.customers
for each row
execute function public.trg_assign_customer_number();

-- Assets Trigger
create or replace function public.trg_assign_asset_number()
returns trigger language plpgsql as $$
begin
  if new.asset_number is null then
    new.asset_number := public.generate_asset_number();
  end if;
  return new;
end;
$$;

drop trigger if exists assign_asset_number_trigger on public.assets;
create trigger assign_asset_number_trigger
before insert on public.assets
for each row
execute function public.trg_assign_asset_number();


-- 6.5 Recreate missing can_view_work_order function if not exists
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

grant execute on function public.can_view_work_order(uuid) to authenticated;


-- 7. Update search_company_records RPC function to include numbers
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
      concat_ws(' ', '[' || coalesce(c.customer_number, '') || ']', c.name) as title,
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
        or lower(coalesce(c.customer_number, '')) like '%' || p.q || '%'
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
      concat_ws(' ', '[' || coalesce(a.asset_number, '') || ']', initcap(replace(a.asset_type::text, '_', ' ')), a.manufacturer, a.model) as title,
      coalesce(a.registration, a.vin, a.hin, a.serial_number, 'Asset') as subtitle,
      '/assets'::text as href,
      a.updated_at
    from public.assets a, params p
    where a.company_id = public.current_company_id()
      and a.archived_at is null
      and public.has_permission('assets.view')
      and (
        p.q = ''
        or lower(coalesce(a.asset_number, '')) like '%' || p.q || '%'
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
      concat_ws(' ', '[' || coalesce(w.work_order_number, '') || ']', w.title) as title,
      concat_ws(' · ', initcap(replace(w.status::text, '_', ' ')), initcap(w.priority::text)) as subtitle,
      '/work-orders'::text as href,
      w.updated_at
    from public.work_orders w, params p
    where w.company_id = public.current_company_id()
      and public.can_view_work_order(w.id)
      and (
        p.q = ''
        or lower(coalesce(w.work_order_number, '')) like '%' || p.q || '%'
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
  ) combined
  order by updated_at desc
  limit (select max_rows from params);
$$;

grant execute on function public.search_company_records(text, integer) to authenticated;

