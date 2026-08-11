-- Reusable Maxxis confirmation boundary. The first supported action type is a
-- conservative Investment Profile addition; no profile mutation occurs while
-- an action remains pending.

create table if not exists public.maxxis_pending_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  action_type text not null check (action_type = 'update_investment_profile'),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'executed', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  confirmed_at timestamptz,
  executed_at timestamptz,
  cancelled_at timestamptz,
  constraint maxxis_pending_actions_payload_size check (octet_length(payload::text) <= 2048)
);

create index if not exists idx_maxxis_pending_actions_user_status
  on public.maxxis_pending_actions(user_id, status, expires_at desc);

alter table public.maxxis_pending_actions enable row level security;

drop policy if exists maxxis_pending_actions_select_own on public.maxxis_pending_actions;
create policy maxxis_pending_actions_select_own
  on public.maxxis_pending_actions for select
  using (user_id = auth.uid());

drop policy if exists maxxis_pending_actions_no_direct_insert on public.maxxis_pending_actions;
create policy maxxis_pending_actions_no_direct_insert
  on public.maxxis_pending_actions for insert
  with check (false);

drop policy if exists maxxis_pending_actions_no_direct_update on public.maxxis_pending_actions;
create policy maxxis_pending_actions_no_direct_update
  on public.maxxis_pending_actions for update
  using (false)
  with check (false);

drop policy if exists maxxis_pending_actions_no_direct_delete on public.maxxis_pending_actions;
create policy maxxis_pending_actions_no_direct_delete
  on public.maxxis_pending_actions for delete
  using (false);

create or replace function public.ds_maxxis_state_code(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select case lower(trim(coalesce(p_value, '')))
    when 'alabama' then 'AL' when 'alaska' then 'AK' when 'arizona' then 'AZ' when 'arkansas' then 'AR'
    when 'california' then 'CA' when 'colorado' then 'CO' when 'connecticut' then 'CT' when 'delaware' then 'DE'
    when 'florida' then 'FL' when 'georgia' then 'GA' when 'hawaii' then 'HI' when 'idaho' then 'ID'
    when 'illinois' then 'IL' when 'indiana' then 'IN' when 'iowa' then 'IA' when 'kansas' then 'KS'
    when 'kentucky' then 'KY' when 'louisiana' then 'LA' when 'maine' then 'ME' when 'maryland' then 'MD'
    when 'massachusetts' then 'MA' when 'michigan' then 'MI' when 'minnesota' then 'MN' when 'mississippi' then 'MS'
    when 'missouri' then 'MO' when 'montana' then 'MT' when 'nebraska' then 'NE' when 'nevada' then 'NV'
    when 'new hampshire' then 'NH' when 'new jersey' then 'NJ' when 'new mexico' then 'NM' when 'new york' then 'NY'
    when 'north carolina' then 'NC' when 'north dakota' then 'ND' when 'ohio' then 'OH' when 'oklahoma' then 'OK'
    when 'oregon' then 'OR' when 'pennsylvania' then 'PA' when 'rhode island' then 'RI' when 'south carolina' then 'SC'
    when 'south dakota' then 'SD' when 'tennessee' then 'TN' when 'texas' then 'TX' when 'utah' then 'UT'
    when 'vermont' then 'VT' when 'virginia' then 'VA' when 'washington' then 'WA' when 'west virginia' then 'WV'
    when 'wisconsin' then 'WI' when 'wyoming' then 'WY' when 'district of columbia' then 'DC'
    else upper(trim(coalesce(p_value, '')))
  end;
$$;

create or replace function public.ds_validate_maxxis_profile_suggestion(
  p_operation text,
  p_dimension text,
  p_suggested_value text
)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_operation text := lower(trim(coalesce(p_operation, '')));
  v_dimension text := lower(trim(coalesce(p_dimension, '')));
  v_value text := trim(coalesce(p_suggested_value, ''));
  v_allowed text[];
begin
  if v_operation = 'add_market' then
    if v_dimension <> 'market' then
      raise exception 'profile suggestion dimension mismatch' using errcode = '22023';
    end if;
    v_value := public.ds_maxxis_state_code(v_value);
    if not (v_value = any(array['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'])) then
      raise exception 'profile suggestion value not allowed' using errcode = '22023';
    end if;
  elsif v_operation = 'add_property_type' then
    if v_dimension <> 'property_type' then
      raise exception 'profile suggestion dimension mismatch' using errcode = '22023';
    end if;
    v_allowed := array['Single Family','Multi-Family 2-4','Multi-Family 5+','Condo / Townhouse','Land','Commercial','Mixed-Use','Mobile / Manufactured'];
    select allowed.candidate into v_value
      from unnest(v_allowed) as allowed(candidate)
      where lower(allowed.candidate) = lower(v_value)
      limit 1;
    if v_value is null then raise exception 'profile suggestion value not allowed' using errcode = '22023'; end if;
  elsif v_operation = 'add_strategy' then
    if v_dimension <> 'strategy' then
      raise exception 'profile suggestion dimension mismatch' using errcode = '22023';
    end if;
    v_allowed := array['Buy & Hold','Fix & Flip','BRRRR','Wholesale','Wholetail','Short-Term Rental','Mid-Term Rental','Development','Value-Add','Creative Finance','Distressed Assets','Tax Strategies','Notes / Paper'];
    select allowed.candidate into v_value
      from unnest(v_allowed) as allowed(candidate)
      where lower(allowed.candidate) = lower(v_value)
      limit 1;
    if v_value is null then raise exception 'profile suggestion value not allowed' using errcode = '22023'; end if;
  else
    raise exception 'profile suggestion operation not allowed' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'operation', v_operation,
    'dimension', v_dimension,
    'suggestedValue', v_value
  );
end;
$$;

create or replace function public.ds_prepare_maxxis_profile_actions(p_suggestions jsonb)
returns table(action_id uuid, operation text, suggested_value text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_payload jsonb;
  v_action_id uuid;
  v_expires_at timestamptz;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if jsonb_typeof(p_suggestions) <> 'array' or jsonb_array_length(p_suggestions) > 3 or octet_length(p_suggestions::text) > 4096 then
    raise exception 'invalid profile suggestions' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('maxxis-profile-actions:' || v_user_id::text));
  update public.maxxis_pending_actions
    set status = 'expired'
    where user_id = v_user_id and status = 'pending' and expires_at <= now();

  for v_item in select value from jsonb_array_elements(p_suggestions)
  loop
    v_payload := public.ds_validate_maxxis_profile_suggestion(
      v_item->>'operation',
      v_item->>'dimension',
      v_item->>'suggestedValue'
    );

    select a.id, a.expires_at into v_action_id, v_expires_at
      from public.maxxis_pending_actions a
      where a.user_id = v_user_id
        and a.action_type = 'update_investment_profile'
        and a.status = 'pending'
        and a.expires_at > now()
        and a.payload->>'operation' = v_payload->>'operation'
        and lower(a.payload->>'suggestedValue') = lower(v_payload->>'suggestedValue')
      order by a.created_at desc
      limit 1;

    if v_action_id is null then
      v_expires_at := now() + interval '24 hours';
      insert into public.maxxis_pending_actions(user_id, action_type, payload, expires_at)
      values (v_user_id, 'update_investment_profile', v_payload, v_expires_at)
      returning id into v_action_id;
    end if;

    action_id := v_action_id;
    operation := v_payload->>'operation';
    suggested_value := v_payload->>'suggestedValue';
    expires_at := v_expires_at;
    return next;
    v_action_id := null;
    v_expires_at := null;
  end loop;
end;
$$;

create or replace function public.ds_confirm_maxxis_profile_action(p_action_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_action public.maxxis_pending_actions%rowtype;
  v_validated jsonb;
  v_operation text;
  v_value text;
  v_field text;
  v_payload jsonb;
  v_profiles jsonb;
  v_professional jsonb;
  v_legacy jsonb;
  v_legacy_professional jsonb;
  v_profile jsonb;
  v_values jsonb;
  v_exists boolean := false;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;

  select * into v_action
    from public.maxxis_pending_actions
    where id = p_action_id and user_id = v_user_id
    for update;
  if v_action.id is null then return jsonb_build_object('success', false, 'status', 'not_found'); end if;
  if v_action.status <> 'pending' then return jsonb_build_object('success', false, 'status', v_action.status); end if;
  if v_action.expires_at <= now() then
    update public.maxxis_pending_actions set status = 'expired' where id = v_action.id;
    return jsonb_build_object('success', false, 'status', 'expired');
  end if;

  v_validated := public.ds_validate_maxxis_profile_suggestion(
    v_action.payload->>'operation',
    v_action.payload->>'dimension',
    v_action.payload->>'suggestedValue'
  );
  v_operation := v_validated->>'operation';
  v_value := v_validated->>'suggestedValue';
  v_field := case v_operation when 'add_market' then 'targetMarkets' when 'add_property_type' then 'propertyTypes' else 'strategies' end;

  insert into public.professional_profiles(user_id, profile_payload)
  values (v_user_id, '{}'::jsonb)
  on conflict (user_id) do nothing;

  select coalesce(profile_payload, '{}'::jsonb) into v_payload
    from public.professional_profiles
    where user_id = v_user_id
    for update;

  v_profiles := case when jsonb_typeof(v_payload->'profiles') = 'object' then v_payload->'profiles' else '{}'::jsonb end;
  v_professional := case when jsonb_typeof(v_profiles->'professional') = 'object' then v_profiles->'professional' else '{}'::jsonb end;
  v_legacy := case when jsonb_typeof(v_payload->'legacy') = 'object' then v_payload->'legacy' else '{}'::jsonb end;
  v_legacy_professional := case when jsonb_typeof(v_legacy->'professionalProfile') = 'object' then v_legacy->'professionalProfile' else '{}'::jsonb end;
  v_profile := case
    when jsonb_typeof(v_professional->'investmentProfile') = 'object' then v_professional->'investmentProfile'
    when jsonb_typeof(v_legacy_professional->'investmentProfile') = 'object' then v_legacy_professional->'investmentProfile'
    when jsonb_typeof(v_payload->'investmentProfile') = 'object' then v_payload->'investmentProfile'
    else '{}'::jsonb
  end;
  v_profile := jsonb_build_object(
    'version', coalesce(v_profile->'version', '1'::jsonb),
    'status', coalesce(v_profile->'status', '"draft"'::jsonb)
  ) || v_profile;
  v_values := case when jsonb_typeof(v_profile->v_field) = 'array' then v_profile->v_field else '[]'::jsonb end;

  if v_operation = 'add_market' then
    select exists(select 1 from jsonb_array_elements_text(v_values) item where public.ds_maxxis_state_code(item) = v_value) into v_exists;
  else
    select exists(select 1 from jsonb_array_elements_text(v_values) item where lower(trim(item)) = lower(v_value)) into v_exists;
  end if;
  if not v_exists then v_values := v_values || jsonb_build_array(v_value); end if;
  v_profile := jsonb_set(v_profile, array[v_field], v_values, true);

  v_professional := jsonb_set(v_professional, '{investmentProfile}', v_profile, true);
  v_profiles := jsonb_set(v_profiles, '{professional}', v_professional, true);
  v_legacy_professional := jsonb_set(v_legacy_professional, '{investmentProfile}', v_profile, true);
  v_legacy := jsonb_set(v_legacy, '{professionalProfile}', v_legacy_professional, true);
  v_payload := jsonb_set(v_payload, '{profiles}', v_profiles, true);
  v_payload := jsonb_set(v_payload, '{legacy}', v_legacy, true);

  update public.professional_profiles set profile_payload = v_payload where user_id = v_user_id;
  update public.maxxis_pending_actions
    set status = 'executed', confirmed_at = now(), executed_at = now()
    where id = v_action.id;

  return jsonb_build_object(
    'success', true,
    'status', 'executed',
    'operation', v_operation,
    'suggestedValue', v_value,
    'valueAdded', not v_exists
  );
end;
$$;

create or replace function public.ds_cancel_maxxis_profile_action(p_action_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_action public.maxxis_pending_actions%rowtype;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  select * into v_action
    from public.maxxis_pending_actions
    where id = p_action_id and user_id = v_user_id
    for update;
  if v_action.id is null then return jsonb_build_object('success', false, 'status', 'not_found'); end if;
  if v_action.status = 'cancelled' then return jsonb_build_object('success', true, 'status', 'cancelled'); end if;
  if v_action.status <> 'pending' then return jsonb_build_object('success', false, 'status', v_action.status); end if;
  if v_action.expires_at <= now() then
    update public.maxxis_pending_actions set status = 'expired' where id = v_action.id;
    return jsonb_build_object('success', false, 'status', 'expired');
  end if;
  update public.maxxis_pending_actions set status = 'cancelled', cancelled_at = now() where id = v_action.id;
  return jsonb_build_object('success', true, 'status', 'cancelled', 'operation', v_action.payload->>'operation');
end;
$$;

revoke all on public.maxxis_pending_actions from anon, authenticated;
grant select on public.maxxis_pending_actions to authenticated;
revoke all on function public.ds_maxxis_state_code(text) from public;
revoke all on function public.ds_validate_maxxis_profile_suggestion(text, text, text) from public;
revoke all on function public.ds_prepare_maxxis_profile_actions(jsonb) from public;
revoke all on function public.ds_confirm_maxxis_profile_action(uuid) from public;
revoke all on function public.ds_cancel_maxxis_profile_action(uuid) from public;
grant execute on function public.ds_prepare_maxxis_profile_actions(jsonb) to authenticated;
grant execute on function public.ds_confirm_maxxis_profile_action(uuid) to authenticated;
grant execute on function public.ds_cancel_maxxis_profile_action(uuid) to authenticated;
