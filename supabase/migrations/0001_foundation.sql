-- BCS Services Mobile v1.0 Foundation (patched)
-- Run this once in your new Supabase project before creating users.
-- Patch: added indexes, activity_log NOT NULL, explicit deny RLS, ON CONFLICT slug handling.

create extension if not exists pgcrypto;

create type public.member_role as enum ('owner', 'general_manager', 'office', 'technician', 'viewer');

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text not null default 'starter',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique(company_id, user_id)
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  -- company_id is NOT NULL: every audit entry must belong to a company
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_companies_updated_at on public.companies;
create trigger trg_companies_updated_at
before update on public.companies
for each row execute function public.touch_updated_at();

create or replace function public.current_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select company_id from public.company_members where user_id = auth.uid() order by created_at asc limit 1;
$$;

create or replace function public.has_company_role(required_roles public.member_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_members
    where user_id = auth.uid()
      and role = any(required_roles)
  );
$$;

create or replace function public.bootstrap_company_for_current_user(company_name text, company_slug text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_company_id uuid;
  safe_slug text;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;

  safe_slug := lower(regexp_replace(company_slug, '[^a-z0-9-]+', '-', 'g'));
  safe_slug := trim(both '-' from safe_slug);
  if safe_slug = '' then
    safe_slug := 'company-' || substr(auth.uid()::text, 1, 8);
  end if;

  select company_id into new_company_id from public.company_members where user_id = auth.uid() limit 1;
  if new_company_id is not null then
    return new_company_id;
  end if;

  -- Generate a unique slug without mutating an existing company's row.
  -- Never use ON CONFLICT DO UPDATE here because that can return the existing
  -- company's id and accidentally attach a new user to the wrong company.
  for i in 0..20 loop
    begin
      insert into public.companies(name, slug)
      values (
        company_name,
        case
          when i = 0 then safe_slug
          else safe_slug || '-' || substr(auth.uid()::text, 1, 4) || '-' || i::text
        end
      )
      returning id into new_company_id;
      exit;
    exception when unique_violation then
      -- Try the next suffix.
      if i = 20 then
        raise exception 'could not generate unique company slug';
      end if;
    end;
  end loop;

  insert into public.company_members(company_id, user_id, role)
  values (new_company_id, auth.uid(), 'owner');

  insert into public.activity_log(company_id, user_id, action, entity_type, entity_id)
  values (new_company_id, auth.uid(), 'company_bootstrapped', 'company', new_company_id);

  return new_company_id;
end;
$$;

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.activity_log enable row level security;

-- -----------------------------------------------------------------------
-- Indexes: company_members.user_id is queried in every RLS policy.
-- Without these indexes Postgres performs sequential scans on every request.
-- -----------------------------------------------------------------------
create index if not exists idx_company_members_user_id
  on public.company_members(user_id);

create index if not exists idx_company_members_company_id
  on public.company_members(company_id);

create index if not exists idx_activity_log_company_id
  on public.activity_log(company_id);

drop policy if exists companies_read_own on public.companies;
create policy companies_read_own on public.companies
for select to authenticated
using (id in (select company_id from public.company_members where user_id = auth.uid()));

drop policy if exists companies_update_owner_manager on public.companies;
create policy companies_update_owner_manager on public.companies
for update to authenticated
using (id in (select company_id from public.company_members where user_id = auth.uid() and role in ('owner','general_manager')))
with check (id in (select company_id from public.company_members where user_id = auth.uid() and role in ('owner','general_manager')));

drop policy if exists members_read_own_company on public.company_members;
create policy members_read_own_company on public.company_members
for select to authenticated
using (company_id in (select company_id from public.company_members where user_id = auth.uid()));

drop policy if exists members_manage_owner_manager on public.company_members;
create policy members_manage_owner_manager on public.company_members
for all to authenticated
using (company_id in (select company_id from public.company_members where user_id = auth.uid() and role in ('owner','general_manager')))
with check (company_id in (select company_id from public.company_members where user_id = auth.uid() and role in ('owner','general_manager')));

drop policy if exists activity_read_own_company on public.activity_log;
create policy activity_read_own_company on public.activity_log
for select to authenticated
using (company_id in (select company_id from public.company_members where user_id = auth.uid()));

drop policy if exists activity_insert_own_company on public.activity_log;
create policy activity_insert_own_company on public.activity_log
for insert to authenticated
with check (company_id in (select company_id from public.company_members where user_id = auth.uid()));

-- Explicitly deny UPDATE and DELETE on activity_log for all roles.
-- Audit records must be immutable; only the service role (server-side) may delete.
drop policy if exists activity_no_update on public.activity_log;
create policy activity_no_update on public.activity_log
for update to authenticated
using (false);

drop policy if exists activity_no_delete on public.activity_log;
create policy activity_no_delete on public.activity_log
for delete to authenticated
using (false);
