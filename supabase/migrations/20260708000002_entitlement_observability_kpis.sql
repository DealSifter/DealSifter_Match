do $$
begin
  if to_regprocedure('public.admin_get_dashboard_snapshot_base_20260708_entitlement_alerts()') is null
     and to_regprocedure('public.admin_get_dashboard_snapshot()') is not null then
    alter function public.admin_get_dashboard_snapshot() rename to admin_get_dashboard_snapshot_base_20260708_entitlement_alerts;
  end if;
end $$;

create or replace function public.admin_get_dashboard_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base jsonb := '{}'::jsonb;
  v_empty integer := 0;
  v_rpc_failed integer := 0;
  v_missing_data integer := 0;
  v_paywall integer := 0;
begin
  if not public.ds_is_current_user_admin() then
    raise exception 'admin access required';
  end if;

  if to_regprocedure('public.admin_get_dashboard_snapshot_base_20260708_entitlement_alerts()') is not null then
    v_base := public.admin_get_dashboard_snapshot_base_20260708_entitlement_alerts();
  end if;

  select count(*) into v_empty
  from public.app_events
  where event_type = 'entitlement_unlocked_contacts_empty'
    and created_at >= now() - interval '24 hours';

  select count(*) into v_rpc_failed
  from public.app_events
  where event_type = 'entitlement_unlocked_contacts_rpc_failed'
    and created_at >= now() - interval '24 hours';

  select count(*) into v_missing_data
  from public.app_events
  where event_type = 'entitlement_unlocked_contact_missing_data'
    and created_at >= now() - interval '24 hours';

  select count(*) into v_paywall
  from public.app_events
  where event_type = 'entitlement_property_paywall_on_unlocked_owner'
    and created_at >= now() - interval '24 hours';

  return v_base || jsonb_build_object(
    'entitlementAlerts24h', jsonb_build_object(
      'unlocked_contacts_empty', v_empty,
      'unlocked_contacts_rpc_failed', v_rpc_failed,
      'unlocked_contact_missing_data', v_missing_data,
      'property_paywall_on_unlocked_owner', v_paywall,
      'total', v_empty + v_rpc_failed + v_missing_data + v_paywall
    )
  );
end;
$$;

grant execute on function public.admin_get_dashboard_snapshot() to authenticated;
