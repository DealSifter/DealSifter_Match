-- Persist reports already included by a server-verified plan without inventing
-- a per-property unlock. One-time purchases still require their real entitlement.
create or replace function public.ds_save_maxxis_report_payload(
  p_property_id uuid, p_capability text, p_report_version text, p_report_payload jsonb
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user_id uuid := auth.uid();
  v_capability text := upper(trim(coalesce(p_capability, '')));
  v_report_id uuid;
  v_source text;
  v_plan text;
  v_is_admin boolean := false;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if v_capability not in ('MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE')
    then raise exception 'unsupported capability' using errcode = '22023'; end if;
  if p_report_payload is null or jsonb_typeof(p_report_payload) <> 'object'
    then raise exception 'report payload required' using errcode = '22023'; end if;

  select e.access_source into v_source
    from public.maxxis_report_entitlements e
   where e.user_id = v_user_id and e.property_id = p_property_id and e.capability = v_capability;

  if v_source is null then
    select coalesce(u.is_admin, false), lower(coalesce(u.plan_id, 'free'))
      into v_is_admin, v_plan from public.users u where u.id = v_user_id;
    if v_is_admin then
      v_plan := 'admin';
    else
      select lower(s.plan_id) into v_plan
        from public.subscriptions s
       where s.user_id = v_user_id and lower(coalesce(s.status, '')) in ('active', 'trialing')
       order by s.updated_at desc limit 1;
      if v_plan is null then
        select lower(coalesce(u.plan_id, 'free')) into v_plan
          from public.users u where u.id = v_user_id;
      end if;
    end if;
    if not (v_plan in ('enterprise', 'admin')
      or (v_plan in ('pro', 'professional') and v_capability = 'MAXXIS_ANALYSIS'))
      then raise exception 'report ownership required' using errcode = '42501'; end if;
    v_source := 'SUBSCRIPTION_INCLUDED';
  end if;

  insert into public.maxxis_reports(
    user_id, property_id, capability, access_source, report_version, report_payload, deleted_at
  ) values (
    v_user_id, p_property_id, v_capability, v_source,
    coalesce(nullif(trim(p_report_version), ''), '1'), p_report_payload, null
  )
  on conflict (user_id, property_id, capability, report_version) do update
    set report_payload = excluded.report_payload, deleted_at = null
  returning id into v_report_id;
  return v_report_id;
end;
$$;
revoke all on function public.ds_save_maxxis_report_payload(uuid,text,text,jsonb) from public;
grant execute on function public.ds_save_maxxis_report_payload(uuid,text,text,jsonb) to authenticated;
