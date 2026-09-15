-- Saved report artifacts are removable without revoking their commercial entitlement.
alter table public.maxxis_reports
  add column if not exists deleted_at timestamptz;

create index if not exists idx_maxxis_reports_owner_active
  on public.maxxis_reports(user_id, created_at desc) where deleted_at is null;

create or replace function public.ds_delete_maxxis_report_artifact(p_report_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user_id uuid := auth.uid(); v_report_id uuid;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  update public.maxxis_reports set deleted_at = now()
   where id = p_report_id and user_id = v_user_id and deleted_at is null
   returning id into v_report_id;
  if v_report_id is null then raise exception 'report artifact not found' using errcode = 'P0002'; end if;
  return v_report_id;
end;
$$;
revoke all on function public.ds_delete_maxxis_report_artifact(uuid) from public;
grant execute on function public.ds_delete_maxxis_report_artifact(uuid) to authenticated;

create or replace function public.ds_save_maxxis_report_payload(
  p_property_id uuid, p_capability text, p_report_version text, p_report_payload jsonb
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user_id uuid := auth.uid(); v_capability text := upper(trim(coalesce(p_capability, ''))); v_report_id uuid;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from public.maxxis_report_entitlements e where e.user_id=v_user_id and e.property_id=p_property_id and e.capability=v_capability)
    then raise exception 'report ownership required' using errcode = '42501'; end if;
  insert into public.maxxis_reports(user_id,property_id,capability,access_source,report_version,report_payload,deleted_at)
  select v_user_id,p_property_id,v_capability,e.access_source,coalesce(nullif(trim(p_report_version),''),'1'),p_report_payload,null
    from public.maxxis_report_entitlements e where e.user_id=v_user_id and e.property_id=p_property_id and e.capability=v_capability
  on conflict (user_id,property_id,capability,report_version) do update
    set report_payload=excluded.report_payload, deleted_at=null
  returning id into v_report_id;
  return v_report_id;
end;
$$;
revoke all on function public.ds_save_maxxis_report_payload(uuid,text,text,jsonb) from public;
grant execute on function public.ds_save_maxxis_report_payload(uuid,text,text,jsonb) to authenticated;
