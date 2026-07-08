-- 1. Drop existing global unique constraints on estimate_number and invoice_number
alter table public.estimates drop constraint if exists estimates_estimate_number_key;
alter table public.invoices drop constraint if exists invoices_invoice_number_key;

-- 2. Add composite unique constraints per company_id to allow same numbers across different companies
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'estimates_company_id_estimate_number_key') then
    alter table public.estimates add constraint estimates_company_id_estimate_number_key unique (company_id, estimate_number);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'invoices_company_id_invoice_number_key') then
    alter table public.invoices add constraint invoices_company_id_invoice_number_key unique (company_id, invoice_number);
  end if;
end;
$$;

-- 3. Adjust sequence start values to ensure correct next generation
do $$
declare
  max_est int;
  max_inv int;
begin
  -- Estimates sequence: next must be EST130 if no higher estimates exist
  select coalesce(max(substring(estimate_number from '[0-9]+')::int), 129) into max_est from public.estimates;
  if max_est < 129 then
    max_est := 129;
  end if;
  execute 'alter sequence if exists public.estimate_number_seq restart with ' || (max_est + 1);

  -- Invoices sequence: next must be INV170 if no higher invoices exist
  select coalesce(max(substring(invoice_number from '[0-9]+')::int), 169) into max_inv from public.invoices;
  if max_inv < 169 then
    max_inv := 169;
  end if;
  execute 'alter sequence if exists public.invoice_number_seq restart with ' || (max_inv + 1);
end;
$$;

-- 4. Update trigger functions to assign numbers if they are NULL or empty string
create or replace function public.trg_assign_estimate_number()
returns trigger language plpgsql as $$
begin
  if new.estimate_number is null or new.estimate_number = '' then
    new.estimate_number := public.generate_estimate_number();
  end if;
  return new;
end;
$$;

create or replace function public.trg_assign_invoice_number()
returns trigger language plpgsql as $$
begin
  if new.invoice_number is null or new.invoice_number = '' then
    new.invoice_number := public.generate_invoice_number();
  end if;
  return new;
end;
$$;
