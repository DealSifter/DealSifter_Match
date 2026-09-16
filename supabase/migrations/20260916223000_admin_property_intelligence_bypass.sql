-- Administrator accounts are operational users and must not be blocked by the
-- per-property commercial entitlement used for regular customers.
create or replace function public.ds_has_property_intelligence_entitlement(
  p_property_id uuid,
  p_unlock_type text default 'property_record'
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and p_property_id is not null
    and p_unlock_type = 'property_record'
    and (
      exists (
        select 1
          from public.users app_user
         where app_user.id = auth.uid()
           and coalesce(app_user.is_admin, false) = true
      )
      or exists (
        select 1
          from public.property_intelligence_entitlements entitlement
         where entitlement.user_id = auth.uid()
           and entitlement.property_id = p_property_id
           and entitlement.unlock_type = p_unlock_type
      )
    );
$$;

revoke all on function public.ds_has_property_intelligence_entitlement(uuid, text)
  from public, anon;
grant execute on function public.ds_has_property_intelligence_entitlement(uuid, text)
  to authenticated, service_role;
