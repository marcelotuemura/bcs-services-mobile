-- BCS Services Mobile v2.0 Migration: Estimate Customer Approval Workflow
-- Adds fields for public estimate tracking, verification tokens, and security-definer RPCs.

-- ==========================================
-- PHASE 1: Add New Columns & Check Constraints
-- ==========================================

alter table public.estimates 
  add column if not exists approval_token text unique,
  add column if not exists approval_sent_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists customer_approved_name text,
  add column if not exists customer_approved_email text,
  add column if not exists customer_signature text,
  add column if not exists customer_response_notes text,
  add column if not exists public_view_count integer not null default 0,
  add column if not exists last_public_viewed_at timestamptz;

-- Add check constraint for allowed status values
alter table public.estimates drop constraint if exists estimates_status_check;
alter table public.estimates add constraint estimates_status_check check (status in ('draft', 'sent', 'approved', 'rejected', 'expired'));


-- ==========================================
-- PHASE 2: Security Definer Helper Functions (Created before RLS reference)
-- ==========================================

create or replace function public.get_public_estimate_by_token(token text)
returns table (
  id uuid,
  company_id uuid,
  company_name text,
  customer_id uuid,
  estimate_number text,
  status text,
  issue_date date,
  expiry_date date,
  labor_total numeric(12,2),
  parts_total numeric(12,2),
  supplies_total numeric(12,2),
  discount numeric(12,2),
  tax numeric(12,2),
  total numeric(12,2),
  customer_name text,
  notes text,
  vessel_id text,
  created_at timestamptz,
  updated_at timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  -- Record public view when queried
  update public.estimates est
  set public_view_count = est.public_view_count + 1,
      last_public_viewed_at = now()
  where est.approval_token = token;

  -- Record view in audit log
  insert into public.audit_log(company_id, user_id, action, entity_type, entity_id, metadata)
  select est.company_id, null, 'estimate_viewed_public', 'estimate', est.id, jsonb_build_object('view_count', est.public_view_count)
  from public.estimates est
  where est.approval_token = token;

  return query
  select
    e.id,
    e.company_id,
    c.name as company_name,
    e.customer_id,
    e.estimate_number,
    e.status,
    e.issue_date,
    e.expiry_date,
    e.labor_total,
    e.parts_total,
    e.supplies_total,
    e.discount,
    e.tax,
    e.total,
    e.customer_name,
    e.notes,
    e.vessel_id,
    e.created_at,
    e.updated_at
  from public.estimates e
  left join public.companies c on c.id = e.company_id
  where e.approval_token = token;
end;
$$;

create or replace function public.get_public_estimate_items_by_token(token text)
returns setof public.estimate_items language sql stable security definer set search_path = public as $$
  select ei.*
  from public.estimate_items ei
  join public.estimates e on e.id = ei.estimate_id
  where e.approval_token = token
  order by ei.line_number asc;
$$;

create or replace function public.approve_estimate_by_token(
  token text,
  p_customer_name text,
  p_customer_email text,
  p_signature text,
  p_notes text
)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  target_est_id uuid;
  target_comp_id uuid;
  current_status text;
begin
  select id, company_id, status into target_est_id, target_comp_id, current_status
  from public.estimates
  where approval_token = token;

  if target_est_id is null then
    raise exception 'Estimate not found';
  end if;

  if current_status != 'sent' then
    raise exception 'Estimate is not in sent status';
  end if;

  update public.estimates
  set status = 'approved',
      approved_at = now(),
      customer_approved_name = p_customer_name,
      customer_approved_email = p_customer_email,
      customer_signature = p_signature,
      customer_response_notes = p_notes,
      updated_at = now()
  where id = target_est_id;

  -- Insert audit log
  insert into public.audit_log(company_id, user_id, action, entity_type, entity_id, metadata)
  values (
    target_comp_id,
    null, -- Null user since it is a public customer action
    'estimate_approved_by_customer',
    'estimate',
    target_est_id,
    jsonb_build_object(
      'customer_name', p_customer_name,
      'customer_email', p_customer_email,
      'notes', p_notes
    )
  );

  return true;
end;
$$;

create or replace function public.reject_estimate_by_token(
  token text,
  p_customer_name text,
  p_customer_email text,
  p_notes text
)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  target_est_id uuid;
  target_comp_id uuid;
  current_status text;
begin
  select id, company_id, status into target_est_id, target_comp_id, current_status
  from public.estimates
  where approval_token = token;

  if target_est_id is null then
    raise exception 'Estimate not found';
  end if;

  if current_status != 'sent' then
    raise exception 'Estimate is not in sent status';
  end if;

  update public.estimates
  set status = 'rejected',
      rejected_at = now(),
      customer_approved_name = p_customer_name,
      customer_approved_email = p_customer_email,
      customer_response_notes = p_notes,
      updated_at = now()
  where id = target_est_id;

  -- Insert audit log
  insert into public.audit_log(company_id, user_id, action, entity_type, entity_id, metadata)
  values (
    target_comp_id,
    null, -- Null user since it is a public customer action
    'estimate_rejected_by_customer',
    'estimate',
    target_est_id,
    jsonb_build_object(
      'customer_name', p_customer_name,
      'customer_email', p_customer_email,
      'notes', p_notes
    )
  );

  return true;
end;
$$;


-- ==========================================
-- PHASE 3: Grants & Public Permissions
-- ==========================================

grant execute on function public.get_public_estimate_by_token(text) to public;
grant execute on function public.get_public_estimate_items_by_token(text) to public;
grant execute on function public.approve_estimate_by_token(text, text, text, text, text) to public;
grant execute on function public.reject_estimate_by_token(text, text, text, text) to public;
