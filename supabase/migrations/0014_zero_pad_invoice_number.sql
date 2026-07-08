-- 1. Restart invoice_number_seq at 172 (so the next nextval() call returns 172)
alter sequence if exists public.invoice_number_seq restart with 172;

-- 2. Update generate_invoice_number function to use 6-digit zero-padding (e.g. INV000172)
create or replace function public.generate_invoice_number()
returns text language plpgsql as $$
begin
  return 'INV' || lpad(nextval('public.invoice_number_seq')::text, 6, '0');
end;
$$;
