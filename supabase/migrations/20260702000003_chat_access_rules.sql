-- Chat access rules:
-- - normal/reference messages require sender and recipient plans with chat
-- - the recipient profile must include DealSifter chat as a desired contact method
-- - system messages remain allowed so the app can notify both sides about why chat is unavailable

create or replace function public.ds_plan_allows_chat(p_plan_id text, p_is_admin boolean default false)
returns boolean
language sql
stable
as $$
  select
    coalesce(p_is_admin, false)
    or lower(trim(coalesce(p_plan_id, 'free'))) in ('pro', 'professional', 'enterprise');
$$;

create or replace function public.ds_contact_methods_include_chat(p_methods jsonb)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from jsonb_array_elements_text(coalesce(p_methods, '[]'::jsonb)) as method(value)
    where lower(regexp_replace(trim(method.value), '[^a-z0-9]+', '', 'g')) in (
      'chat',
      'dealsifterchat',
      'dealsifter'
    )
  );
$$;

create or replace function public.ds_profile_contact_methods(
  p_owner_id uuid,
  p_primary_profile text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope text := lower(trim(coalesce(p_primary_profile, '')));
  v_payload jsonb := '{}'::jsonb;
  v_resolved jsonb := '{}'::jsonb;
  v_methods jsonb := '[]'::jsonb;
begin
  if v_scope not in ('personal', 'professional', 'fsbo') then
    v_scope := null;
  end if;

  select coalesce(pp.profile_payload, '{}'::jsonb)
    into v_payload
  from public.professional_profiles pp
  where pp.user_id = p_owner_id
  limit 1;

  v_resolved := coalesce(v_payload->'resolved', '{}'::jsonb);

  if v_scope is not null then
    v_methods := coalesce(v_resolved->v_scope->'contactMethods', '[]'::jsonb);
    if jsonb_array_length(v_methods) > 0 then
      return v_methods;
    end if;
  end if;

  -- Fallback for legacy/incomplete profile payloads. This is only used when
  -- the caller could not provide a precise scope or the scoped payload is old.
  return coalesce(
    nullif(v_resolved->'personal'->'contactMethods', '[]'::jsonb),
    nullif(v_resolved->'professional'->'contactMethods', '[]'::jsonb),
    nullif(v_resolved->'fsbo'->'contactMethods', '[]'::jsonb),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.ds_get_chat_contact_status(
  p_contact_owner_id uuid,
  p_primary_profile text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid := auth.uid();
  v_sender_plan text := 'free';
  v_sender_admin boolean := false;
  v_recipient_plan text := 'free';
  v_recipient_admin boolean := false;
  v_contact_methods jsonb := '[]'::jsonb;
  v_accepts_chat boolean := false;
  v_sender_can_chat boolean := false;
  v_recipient_can_chat boolean := false;
begin
  if v_sender_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select coalesce(u.plan_id, 'free'), coalesce(u.is_admin, false)
    into v_sender_plan, v_sender_admin
  from public.users u
  where u.id = v_sender_id;

  select coalesce(u.plan_id, 'free'), coalesce(u.is_admin, false)
    into v_recipient_plan, v_recipient_admin
  from public.users u
  where u.id = p_contact_owner_id;

  v_contact_methods := public.ds_profile_contact_methods(p_contact_owner_id, p_primary_profile);
  v_accepts_chat := public.ds_contact_methods_include_chat(v_contact_methods);
  v_sender_can_chat := public.ds_plan_allows_chat(v_sender_plan, v_sender_admin);
  v_recipient_can_chat := public.ds_plan_allows_chat(v_recipient_plan, v_recipient_admin);

  return jsonb_build_object(
    'ownerId', p_contact_owner_id,
    'primaryProfile', lower(trim(coalesce(p_primary_profile, ''))),
    'contactMethods', v_contact_methods,
    'acceptsChat', v_accepts_chat,
    'senderPlanId', coalesce(v_sender_plan, 'free'),
    'senderCanChat', v_sender_can_chat,
    'recipientPlanId', coalesce(v_recipient_plan, 'free'),
    'recipientCanChat', v_recipient_can_chat,
    'canChat', v_accepts_chat and v_sender_can_chat and v_recipient_can_chat
  );
end;
$$;

create or replace function public.trg_enforce_chat_message_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_plan text := 'free';
  v_sender_admin boolean := false;
  v_recipient_plan text := 'free';
  v_recipient_admin boolean := false;
  v_contact_methods jsonb := '[]'::jsonb;
  v_profile text := lower(trim(coalesce(NEW.metadata->>'contactPrimaryProfile', NEW.metadata->>'primaryProfile', '')));
begin
  if lower(trim(coalesce(NEW.message_type, 'text'))) in ('system', 'system_notice') then
    return NEW;
  end if;

  if auth.uid() is null or auth.uid() <> NEW.sender_id then
    raise exception 'chat sender not authorized' using errcode = '28000';
  end if;

  select coalesce(u.plan_id, 'free'), coalesce(u.is_admin, false)
    into v_sender_plan, v_sender_admin
  from public.users u
  where u.id = NEW.sender_id;

  select coalesce(u.plan_id, 'free'), coalesce(u.is_admin, false)
    into v_recipient_plan, v_recipient_admin
  from public.users u
  where u.id = NEW.recipient_id;

  if not public.ds_plan_allows_chat(v_sender_plan, v_sender_admin) then
    raise exception 'sender plan does not include chat' using errcode = '42501';
  end if;

  if not public.ds_plan_allows_chat(v_recipient_plan, v_recipient_admin) then
    raise exception 'recipient plan does not include chat' using errcode = '42501';
  end if;

  v_contact_methods := public.ds_profile_contact_methods(
    coalesce(NEW.contact_owner_id, NEW.recipient_id),
    v_profile
  );

  if not public.ds_contact_methods_include_chat(v_contact_methods) then
    raise exception 'recipient profile does not accept chat contact' using errcode = '42501';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enforce_chat_message_access on public.chat_messages;
create trigger trg_enforce_chat_message_access
before insert on public.chat_messages
for each row
execute function public.trg_enforce_chat_message_access();

grant execute on function public.ds_get_chat_contact_status(uuid, text) to authenticated;
