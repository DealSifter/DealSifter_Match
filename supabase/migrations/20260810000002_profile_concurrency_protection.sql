-- Phase 2G: optimistic concurrency control for professional profile writes.
-- All interactive writes go through ds_save_professional_profile so stale
-- onboarding state cannot silently replace a newer Investment Profile.

alter table public.professional_profiles
  add column if not exists profile_version bigint not null default 1;

create or replace function public.ds_bump_professional_profile_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.profile_version := old.profile_version + 1;
  return new;
end;
$$;

drop trigger if exists trg_professional_profiles_profile_version on public.professional_profiles;
create trigger trg_professional_profiles_profile_version
before update on public.professional_profiles
for each row execute function public.ds_bump_professional_profile_version();

create or replace function public.ds_merge_professional_profile_payload(
  p_current jsonb,
  p_incoming jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_current jsonb := case when jsonb_typeof(p_current) = 'object' then p_current else '{}'::jsonb end;
  v_incoming jsonb := case when jsonb_typeof(p_incoming) = 'object' then p_incoming else '{}'::jsonb end;
  v_result jsonb;
  v_profiles jsonb;
  v_incoming_profiles jsonb;
  v_resolved jsonb;
  v_incoming_resolved jsonb;
  v_legacy jsonb;
  v_incoming_legacy jsonb;
  v_current_branch jsonb;
  v_incoming_branch jsonb;
  v_existing_investment_profile jsonb;
  v_investment_profile jsonb;
begin
  v_result := v_current;

  if jsonb_typeof(v_incoming->'version') = 'number' then
    v_result := jsonb_set(v_result, '{version}', v_incoming->'version', true);
  end if;
  if jsonb_typeof(v_incoming->'accountType') = 'string' then
    v_result := jsonb_set(v_result, '{accountType}', v_incoming->'accountType', true);
  end if;

  v_profiles := case when jsonb_typeof(v_current->'profiles') = 'object' then v_current->'profiles' else '{}'::jsonb end;
  v_incoming_profiles := case when jsonb_typeof(v_incoming->'profiles') = 'object' then v_incoming->'profiles' else '{}'::jsonb end;
  v_existing_investment_profile := case
    when jsonb_typeof(v_profiles->'professional'->'investmentProfile') = 'object'
      then v_profiles->'professional'->'investmentProfile'
    when jsonb_typeof(v_current->'legacy'->'professionalProfile'->'investmentProfile') = 'object'
      then v_current->'legacy'->'professionalProfile'->'investmentProfile'
    else '{}'::jsonb
  end;
  v_current_branch := case when jsonb_typeof(v_profiles->'personal') = 'object' then v_profiles->'personal' else '{}'::jsonb end;
  v_incoming_branch := v_incoming_profiles->'personal';
  if jsonb_typeof(v_incoming_branch) = 'object' then
    v_profiles := jsonb_set(v_profiles, '{personal}', v_current_branch || v_incoming_branch, true);
  end if;
  v_current_branch := case when jsonb_typeof(v_profiles->'professional') = 'object' then v_profiles->'professional' else '{}'::jsonb end;
  v_incoming_branch := v_incoming_profiles->'professional';
  if jsonb_typeof(v_incoming_branch) = 'object' then
    v_profiles := jsonb_set(v_profiles, '{professional}', v_current_branch || v_incoming_branch, true);
  end if;
  v_current_branch := case when jsonb_typeof(v_profiles->'fsbo') = 'object' then v_profiles->'fsbo' else '{}'::jsonb end;
  v_incoming_branch := v_incoming_profiles->'fsbo';
  if jsonb_typeof(v_incoming_branch) = 'object' then
    v_profiles := jsonb_set(v_profiles, '{fsbo}', v_current_branch || v_incoming_branch, true);
  end if;

  v_resolved := case when jsonb_typeof(v_current->'resolved') = 'object' then v_current->'resolved' else '{}'::jsonb end;
  v_incoming_resolved := case when jsonb_typeof(v_incoming->'resolved') = 'object' then v_incoming->'resolved' else '{}'::jsonb end;
  v_current_branch := case when jsonb_typeof(v_resolved->'personal') = 'object' then v_resolved->'personal' else '{}'::jsonb end;
  v_incoming_branch := v_incoming_resolved->'personal';
  if jsonb_typeof(v_incoming_branch) = 'object' then v_resolved := jsonb_set(v_resolved, '{personal}', v_current_branch || v_incoming_branch, true); end if;
  v_current_branch := case when jsonb_typeof(v_resolved->'professional') = 'object' then v_resolved->'professional' else '{}'::jsonb end;
  v_incoming_branch := v_incoming_resolved->'professional';
  if jsonb_typeof(v_incoming_branch) = 'object' then v_resolved := jsonb_set(v_resolved, '{professional}', v_current_branch || v_incoming_branch, true); end if;
  v_current_branch := case when jsonb_typeof(v_resolved->'fsbo') = 'object' then v_resolved->'fsbo' else '{}'::jsonb end;
  v_incoming_branch := v_incoming_resolved->'fsbo';
  if jsonb_typeof(v_incoming_branch) = 'object' then v_resolved := jsonb_set(v_resolved, '{fsbo}', v_current_branch || v_incoming_branch, true); end if;

  v_legacy := case when jsonb_typeof(v_current->'legacy') = 'object' then v_current->'legacy' else '{}'::jsonb end;
  v_incoming_legacy := case when jsonb_typeof(v_incoming->'legacy') = 'object' then v_incoming->'legacy' else '{}'::jsonb end;
  v_current_branch := case when jsonb_typeof(v_legacy->'personalProfile') = 'object' then v_legacy->'personalProfile' else '{}'::jsonb end;
  v_incoming_branch := v_incoming_legacy->'personalProfile';
  if jsonb_typeof(v_incoming_branch) = 'object' then v_legacy := jsonb_set(v_legacy, '{personalProfile}', v_current_branch || v_incoming_branch, true); end if;
  v_current_branch := case when jsonb_typeof(v_legacy->'professionalProfile') = 'object' then v_legacy->'professionalProfile' else '{}'::jsonb end;
  v_incoming_branch := v_incoming_legacy->'professionalProfile';
  if jsonb_typeof(v_incoming_branch) = 'object' then v_legacy := jsonb_set(v_legacy, '{professionalProfile}', v_current_branch || v_incoming_branch, true); end if;

  v_investment_profile := case
    when jsonb_typeof(v_incoming_profiles->'professional'->'investmentProfile') = 'object'
      then v_existing_investment_profile || (v_incoming_profiles->'professional'->'investmentProfile')
    when jsonb_typeof(v_incoming_legacy->'professionalProfile'->'investmentProfile') = 'object'
      then v_existing_investment_profile || (v_incoming_legacy->'professionalProfile'->'investmentProfile')
    else null
  end;
  if v_investment_profile is not null then
    v_current_branch := case when jsonb_typeof(v_profiles->'professional') = 'object' then v_profiles->'professional' else '{}'::jsonb end;
    v_profiles := jsonb_set(v_profiles, '{professional}', jsonb_set(v_current_branch, '{investmentProfile}', v_investment_profile, true), true);
    v_current_branch := case when jsonb_typeof(v_legacy->'professionalProfile') = 'object' then v_legacy->'professionalProfile' else '{}'::jsonb end;
    v_legacy := jsonb_set(v_legacy, '{professionalProfile}', jsonb_set(v_current_branch, '{investmentProfile}', v_investment_profile, true), true);
  end if;

  v_result := jsonb_set(v_result, '{profiles}', v_profiles, true);
  v_result := jsonb_set(v_result, '{resolved}', v_resolved, true);
  v_result := jsonb_set(v_result, '{legacy}', v_legacy, true);
  return v_result;
end;
$$;

create or replace function public.ds_save_professional_profile(
  p_expected_version bigint,
  p_profile_payload jsonb,
  p_category text,
  p_subcategory text,
  p_markets text[],
  p_skills text[],
  p_services text[],
  p_pitch text,
  p_primary_category text,
  p_category_b text,
  p_primary_category_b text,
  p_update_photo_b_url boolean,
  p_photo_b_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_current public.professional_profiles%rowtype;
  v_merged_payload jsonb;
  v_next_version bigint;
  v_updated_at timestamptz;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_expected_version is null or p_expected_version < 0 then raise exception 'invalid expected profile version' using errcode = '22023'; end if;
  if p_profile_payload is null or jsonb_typeof(p_profile_payload) <> 'object' or octet_length(p_profile_payload::text) > 65536 then
    raise exception 'invalid profile payload' using errcode = '22023';
  end if;

  select * into v_current
    from public.professional_profiles
    where user_id = v_user_id
    for update;

  if found then
    if v_current.profile_version <> p_expected_version then
      return jsonb_build_object(
        'success', false,
        'code', 'PROFILE_CONFLICT',
        'message', 'Your profile was updated elsewhere.',
        'currentVersion', v_current.profile_version
      );
    end if;

    v_merged_payload := public.ds_merge_professional_profile_payload(v_current.profile_payload, p_profile_payload);
    update public.professional_profiles
      set category = p_category,
          subcategory = p_subcategory,
          markets = coalesce(p_markets, '{}'::text[]),
          skills = coalesce(p_skills, '{}'::text[]),
          services = coalesce(p_services, '{}'::text[]),
          pitch = p_pitch,
          primary_category = p_primary_category,
          category_b = p_category_b,
          primary_category_b = p_primary_category_b,
          photo_b_url = case when p_update_photo_b_url then p_photo_b_url else photo_b_url end,
          profile_payload = v_merged_payload
      where user_id = v_user_id and profile_version = p_expected_version
      returning profile_version, updated_at into v_next_version, v_updated_at;

    if not found then
      return jsonb_build_object('success', false, 'code', 'PROFILE_CONFLICT', 'message', 'Your profile was updated elsewhere.');
    end if;
    return jsonb_build_object('success', true, 'profileVersion', v_next_version, 'updatedAt', v_updated_at);
  end if;

  if p_expected_version <> 0 then
    return jsonb_build_object('success', false, 'code', 'PROFILE_CONFLICT', 'message', 'Your profile was updated elsewhere.', 'currentVersion', 0);
  end if;

  v_merged_payload := public.ds_merge_professional_profile_payload('{}'::jsonb, p_profile_payload);
  insert into public.professional_profiles(
    user_id, category, subcategory, markets, skills, services, pitch,
    primary_category, category_b, primary_category_b, photo_b_url, profile_payload
  ) values (
    v_user_id, p_category, p_subcategory, coalesce(p_markets, '{}'::text[]),
    coalesce(p_skills, '{}'::text[]), coalesce(p_services, '{}'::text[]), p_pitch,
    p_primary_category, p_category_b, p_primary_category_b,
    case when p_update_photo_b_url then p_photo_b_url else null end, v_merged_payload
  )
  on conflict (user_id) do nothing
  returning profile_version, updated_at into v_next_version, v_updated_at;

  if not found then
    return jsonb_build_object('success', false, 'code', 'PROFILE_CONFLICT', 'message', 'Your profile was updated elsewhere.');
  end if;
  return jsonb_build_object('success', true, 'profileVersion', v_next_version, 'updatedAt', v_updated_at);
end;
$$;

-- Reads remain governed by the existing RLS policies. Interactive writes are
-- forced through the authenticated conditional RPC; security-definer callers
-- still bind ownership exclusively from auth.uid().
revoke insert, update on table public.professional_profiles from public, anon, authenticated;
revoke all on function public.ds_bump_professional_profile_version() from public, anon, authenticated;
revoke all on function public.ds_merge_professional_profile_payload(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.ds_save_professional_profile(bigint, jsonb, text, text, text[], text[], text[], text, text, text, text, boolean, text) from public, anon;
grant execute on function public.ds_save_professional_profile(bigint, jsonb, text, text, text[], text[], text[], text, text, text, text, boolean, text) to authenticated;

-- Manual rollback, if required:
--   grant insert, update on public.professional_profiles to authenticated;
--   drop function public.ds_save_professional_profile(bigint, jsonb, text, text, text[], text[], text[], text, text, text, text, boolean, text);
--   drop function public.ds_merge_professional_profile_payload(jsonb, jsonb);
--   drop trigger trg_professional_profiles_profile_version on public.professional_profiles;
--   drop function public.ds_bump_professional_profile_version();
--   alter table public.professional_profiles drop column profile_version;
