-- Analysis assumptions belong to the authenticated user's purchased/included
-- Maxxis capability. They must not depend exclusively on the older raw
-- Property Intelligence entitlement.
create or replace function public.ds_has_maxxis_analysis_context_access(
  p_property_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with current_user_access as (
    select
      coalesce(u.is_admin, false) as is_admin,
      lower(coalesce(u.plan_id, 'free')) as fallback_plan,
      (
        select lower(s.plan_id)
          from public.subscriptions s
         where s.user_id = auth.uid()
           and lower(coalesce(s.status, '')) in ('active', 'trialing')
         order by s.updated_at desc
         limit 1
      ) as active_plan
      from public.users u
     where u.id = auth.uid()
  )
  select auth.uid() is not null
    and p_property_id is not null
    and exists (select 1 from public.properties p where p.id = p_property_id)
    and (
      exists (
        select 1
          from current_user_access access
         where access.is_admin
            or coalesce(access.active_plan, access.fallback_plan) in ('pro', 'professional', 'enterprise', 'admin')
      )
      or exists (
        select 1
          from public.maxxis_report_entitlements entitlement
         where entitlement.user_id = auth.uid()
           and entitlement.property_id = p_property_id
           and entitlement.capability in ('MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE')
      )
      or exists (
        select 1
          from public.maxxis_reports report
         where report.user_id = auth.uid()
           and report.property_id = p_property_id
           and report.capability in ('MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE')
           and report.deleted_at is null
      )
      or exists (
        select 1
          from public.property_intelligence_entitlements legacy
         where legacy.user_id = auth.uid()
           and legacy.property_id = p_property_id
           and legacy.unlock_type = 'property_record'
      )
    );
$$;

revoke all on function public.ds_has_maxxis_analysis_context_access(uuid) from public, anon;
grant execute on function public.ds_has_maxxis_analysis_context_access(uuid) to authenticated, service_role;

drop policy if exists property_arv_review_contexts_select_own on public.property_arv_review_contexts;
create policy property_arv_review_contexts_select_own on public.property_arv_review_contexts
  for select to authenticated
  using (reviewer_user_id = auth.uid()
    and public.ds_has_maxxis_analysis_context_access(subject_property_id));

drop policy if exists property_arv_review_contexts_insert_own on public.property_arv_review_contexts;
create policy property_arv_review_contexts_insert_own on public.property_arv_review_contexts
  for insert to authenticated
  with check (reviewer_user_id = auth.uid()
    and public.ds_has_maxxis_analysis_context_access(subject_property_id));

drop policy if exists property_arv_review_contexts_update_own on public.property_arv_review_contexts;
create policy property_arv_review_contexts_update_own on public.property_arv_review_contexts
  for update to authenticated
  using (reviewer_user_id = auth.uid()
    and public.ds_has_maxxis_analysis_context_access(subject_property_id))
  with check (reviewer_user_id = auth.uid()
    and public.ds_has_maxxis_analysis_context_access(subject_property_id));

drop policy if exists property_comp_condition_reviews_select_own on public.property_comp_condition_reviews;
create policy property_comp_condition_reviews_select_own on public.property_comp_condition_reviews
  for select to authenticated
  using (reviewer_user_id = auth.uid()
    and public.ds_has_maxxis_analysis_context_access(subject_property_id));

drop policy if exists property_comp_condition_reviews_insert_own on public.property_comp_condition_reviews;
create policy property_comp_condition_reviews_insert_own on public.property_comp_condition_reviews
  for insert to authenticated
  with check (reviewer_user_id = auth.uid()
    and public.ds_has_maxxis_analysis_context_access(subject_property_id));

drop policy if exists property_comp_condition_reviews_update_own on public.property_comp_condition_reviews;
create policy property_comp_condition_reviews_update_own on public.property_comp_condition_reviews
  for update to authenticated
  using (reviewer_user_id = auth.uid()
    and public.ds_has_maxxis_analysis_context_access(subject_property_id))
  with check (reviewer_user_id = auth.uid()
    and public.ds_has_maxxis_analysis_context_access(subject_property_id));

comment on function public.ds_has_maxxis_analysis_context_access(uuid) is
  'Authorizes user-scoped Maxxis assumptions for plan-included, one-time-unlocked, admin, or legacy property-intelligence access.';
