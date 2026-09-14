-- Maxxis report ownership reuses the canonical users.nuggets balance.
create table if not exists public.maxxis_report_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  capability text not null check (capability in ('MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE')),
  access_source text not null check (access_source in ('SUBSCRIPTION_INCLUDED', 'ONE_TIME_UNLOCK')),
  created_at timestamptz not null default now(),
  unique (user_id, property_id, capability)
);

create table if not exists public.maxxis_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  capability text not null check (capability in ('MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE')),
  access_source text not null check (access_source in ('SUBSCRIPTION_INCLUDED', 'ONE_TIME_UNLOCK')),
  report_version text not null default '1',
  report_payload jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, property_id, capability, report_version)
);

alter table public.maxxis_report_entitlements enable row level security;
alter table public.maxxis_reports enable row level security;

create policy maxxis_report_entitlements_owner_select on public.maxxis_report_entitlements
  for select to authenticated using (user_id = auth.uid());
create policy maxxis_reports_owner_select on public.maxxis_reports
  for select to authenticated using (user_id = auth.uid());

create or replace function public.ds_unlock_maxxis_report(
  p_property_id uuid,
  p_capability text,
  p_report_version text default '1',
  p_report_payload jsonb default null
) returns table(
  report_id uuid,
  entitlement_id uuid,
  capability text,
  access_source text,
  charged_nuggets integer,
  remaining_nuggets integer,
  already_owned boolean
) language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user_id uuid := auth.uid();
  v_capability text := upper(trim(coalesce(p_capability, '')));
  v_plan text := 'free';
  v_source text;
  v_cost integer;
  v_balance integer;
  v_entitlement_id uuid;
  v_report_id uuid;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if v_capability not in ('MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE') then raise exception 'unsupported capability' using errcode = '22023'; end if;
  if not exists (select 1 from public.properties p where p.id = p_property_id) then raise exception 'property not found' using errcode = 'P0002'; end if;

  select e.id, e.access_source into v_entitlement_id, v_source from public.maxxis_report_entitlements e
   where e.user_id = v_user_id and e.property_id = p_property_id and e.capability = v_capability;
  if v_entitlement_id is not null then
    select r.id into v_report_id from public.maxxis_reports r
     where r.user_id = v_user_id and r.property_id = p_property_id and r.capability = v_capability
     order by r.created_at desc limit 1;
    select u.nuggets into v_balance from public.users u where u.id = v_user_id;
    return query select v_report_id, v_entitlement_id, v_capability, v_source, 0, coalesce(v_balance, 0), true;
    return;
  end if;

  select lower(coalesce(s.plan_id, 'free')) into v_plan from public.subscriptions s
   where s.user_id = v_user_id and lower(coalesce(s.status, '')) in ('active', 'trialing')
   order by s.updated_at desc limit 1;
  v_plan := coalesce(v_plan, 'free');
  v_source := case when v_plan in ('enterprise', 'admin') or (v_plan in ('pro', 'professional') and v_capability = 'MAXXIS_ANALYSIS')
    then 'SUBSCRIPTION_INCLUDED' else 'ONE_TIME_UNLOCK' end;
  v_cost := case when v_source = 'SUBSCRIPTION_INCLUDED' then 0 when v_capability = 'MAXXIS_ANALYSIS' then 3 else 5 end;

  select u.nuggets into v_balance from public.users u where u.id = v_user_id for update;
  if v_balance is null then raise exception 'user balance not found' using errcode = 'P0002'; end if;
  if v_balance < v_cost then raise exception 'not enough nuggets' using errcode = '22003'; end if;

  insert into public.maxxis_report_entitlements(user_id, property_id, capability, access_source)
  values (v_user_id, p_property_id, v_capability, v_source)
  on conflict (user_id, property_id, capability) do nothing
  returning id into v_entitlement_id;
  if v_entitlement_id is null then
    select e.id into v_entitlement_id from public.maxxis_report_entitlements e
     where e.user_id = v_user_id and e.property_id = p_property_id and e.capability = v_capability;
    return query select null::uuid, v_entitlement_id, v_capability, v_source, 0, v_balance, true;
    return;
  end if;

  if v_cost > 0 then
    update public.users set nuggets = nuggets - v_cost, updated_at = now() where id = v_user_id returning nuggets into v_balance;
  end if;
  insert into public.maxxis_reports(user_id, property_id, capability, access_source, report_version, report_payload)
  values (v_user_id, p_property_id, v_capability, v_source, coalesce(nullif(trim(p_report_version), ''), '1'), p_report_payload)
  returning id into v_report_id;
  insert into public.app_events(user_id, event_type, entity_type, entity_id, value_nuggets, metadata)
  values (v_user_id, 'maxxis_report_unlocked', 'property', p_property_id, v_cost,
    jsonb_build_object('report_id', v_report_id, 'capability', v_capability, 'access_source', v_source));
  return query select v_report_id, v_entitlement_id, v_capability, v_source, v_cost, v_balance, false;
end;
$$;

revoke all on function public.ds_unlock_maxxis_report(uuid, text, text, jsonb) from public;
grant execute on function public.ds_unlock_maxxis_report(uuid, text, text, jsonb) to authenticated;

create or replace function public.ds_save_maxxis_report_payload(
  p_property_id uuid,
  p_capability text,
  p_report_version text,
  p_report_payload jsonb
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user_id uuid := auth.uid();
  v_capability text := upper(trim(coalesce(p_capability, '')));
  v_report_id uuid;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.maxxis_report_entitlements e
    where e.user_id = v_user_id and e.property_id = p_property_id and e.capability = v_capability
  ) then raise exception 'report ownership required' using errcode = '42501'; end if;
  update public.maxxis_reports r set report_payload = p_report_payload
   where r.user_id = v_user_id and r.property_id = p_property_id and r.capability = v_capability
     and r.report_version = coalesce(nullif(trim(p_report_version), ''), '1')
   returning r.id into v_report_id;
  if v_report_id is null then raise exception 'report record not found' using errcode = 'P0002'; end if;
  return v_report_id;
end;
$$;

revoke all on function public.ds_save_maxxis_report_payload(uuid, text, text, jsonb) from public;
grant execute on function public.ds_save_maxxis_report_payload(uuid, text, text, jsonb) to authenticated;
