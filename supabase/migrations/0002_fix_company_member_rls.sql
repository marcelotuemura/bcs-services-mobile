-- Fix company membership lookups blocked by recursive company_members RLS.
-- This migration preserves the table schema and keeps all access enforced by RLS.

create or replace function public.is_company_member(target_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_members
    where company_id = target_company_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.has_company_role(target_company_id uuid, required_roles public.member_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_members
    where company_id = target_company_id
      and user_id = auth.uid()
      and role = any(required_roles)
  );
$$;

grant execute on function public.is_company_member(uuid) to authenticated;
grant execute on function public.has_company_role(uuid, public.member_role[]) to authenticated;

drop policy if exists companies_read_own on public.companies;
create policy companies_read_own on public.companies
for select to authenticated
using (public.is_company_member(id));

drop policy if exists companies_update_owner_manager on public.companies;
create policy companies_update_owner_manager on public.companies
for update to authenticated
using (public.has_company_role(id, array['owner','general_manager']::public.member_role[]))
with check (public.has_company_role(id, array['owner','general_manager']::public.member_role[]));

drop policy if exists members_read_own_company on public.company_members;
create policy members_read_own_company on public.company_members
for select to authenticated
using (public.is_company_member(company_id));

drop policy if exists members_manage_owner_manager on public.company_members;
create policy members_manage_owner_manager on public.company_members
for all to authenticated
using (public.has_company_role(company_id, array['owner','general_manager']::public.member_role[]))
with check (public.has_company_role(company_id, array['owner','general_manager']::public.member_role[]));

drop policy if exists activity_read_own_company on public.activity_log;
create policy activity_read_own_company on public.activity_log
for select to authenticated
using (public.is_company_member(company_id));

drop policy if exists activity_insert_own_company on public.activity_log;
create policy activity_insert_own_company on public.activity_log
for insert to authenticated
with check (public.is_company_member(company_id));
