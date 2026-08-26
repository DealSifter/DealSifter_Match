-- Phase 3K: Confirmed Provider Message Send.
-- Reuses public.chat_messages as the only human messaging system. Maxxis Deal AI only
-- prepares a pending action; the real chat row is inserted after explicit
-- confirmation and with the authenticated user as sender.

alter table public.maxxis_pending_actions
  drop constraint if exists maxxis_pending_actions_action_type_check;

alter table public.maxxis_pending_actions
  add constraint maxxis_pending_actions_action_type_check
  check (action_type in ('update_investment_profile', 'send_provider_message'));

alter table public.maxxis_pending_actions
  drop constraint if exists maxxis_pending_actions_payload_size;

alter table public.maxxis_pending_actions
  add constraint maxxis_pending_actions_payload_size
  check (octet_length(payload::text) <= 8192);

create or replace function public.ds_normalize_maxxis_provider_message(p_message text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_message text := trim(regexp_replace(coalesce(p_message, ''), '[[:cntrl:]]+', ' ', 'g'));
begin
  v_message := regexp_replace(v_message, '\s+', ' ', 'g');
  if char_length(v_message) < 1 then
    raise exception 'message required' using errcode = '22023';
  end if;
  if char_length(v_message) > 1800 then
    raise exception 'message too long' using errcode = '22023';
  end if;
  return v_message;
end;
$$;

create or replace function public.ds_prepare_maxxis_provider_message(
  p_service_id uuid,
  p_property_id uuid,
  p_message text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_message text;
  v_idempotency_key text := left(trim(coalesce(p_idempotency_key, '')), 120);
  v_service record;
  v_property record;
  v_access record;
  v_chat_status jsonb;
  v_action public.maxxis_pending_actions%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_service_id is null then
    raise exception 'service required' using errcode = '22023';
  end if;
  if p_property_id is null then
    raise exception 'property context required' using errcode = '22023';
  end if;

  v_message := public.ds_normalize_maxxis_provider_message(p_message);

  select
    s.id,
    s.owner_id,
    public.ds_normalize_profile_scope(s.primary_profile) as profile_scope,
    coalesce(s.title, s.category, 'Provider') as service_title,
    coalesce(s.category, '') as service_type
  into v_service
  from public.services s
  where s.id = p_service_id
    and coalesce(s.publish_to_connections, false) = true;

  if v_service.id is null or v_service.owner_id is null or v_service.owner_id = v_user_id then
    return jsonb_build_object('success', false, 'status', 'provider_unavailable');
  end if;

  select
    p.id,
    coalesce(p.city, '') as city,
    upper(coalesce(p.state, '')) as state,
    coalesce(p.type, '') as property_type
  into v_property
  from public.properties p
  where p.id = p_property_id
    and coalesce(p.is_active, false) = true
    and coalesce(p.publish_to_showcase, false) = true
    and coalesce(p.deal_closed, false) = false;

  if v_property.id is null then
    return jsonb_build_object('success', false, 'status', 'property_unavailable');
  end if;

  select * into v_access
  from public.ds_get_provider_contact_access(array[p_service_id])
  limit 1;

  if coalesce(v_access.status, '') <> 'already_unlocked' then
    return jsonb_build_object(
      'success', false,
      'status', 'provider_contact_locked',
      'contactAccess', jsonb_build_object(
        'status', coalesce(v_access.status, 'unavailable'),
        'cost', v_access.cost,
        'currency', coalesce(v_access.currency, 'nuggets'),
        'profileScope', coalesce(v_access.profile_scope, v_service.profile_scope),
        'reason', v_access.reason
      )
    );
  end if;

  v_chat_status := public.ds_get_chat_contact_status(v_service.owner_id, coalesce(v_access.profile_scope, v_service.profile_scope));
  if coalesce((v_chat_status->>'canChat')::boolean, false) is not true then
    return jsonb_build_object('success', false, 'status', 'chat_unavailable', 'chatStatus', v_chat_status);
  end if;

  update public.maxxis_pending_actions
    set status = 'expired'
  where user_id = v_user_id
    and action_type = 'send_provider_message'
    and status = 'pending'
    and expires_at <= now();

  if v_idempotency_key <> '' then
    select * into v_action
    from public.maxxis_pending_actions a
    where a.user_id = v_user_id
      and a.action_type = 'send_provider_message'
      and a.status = 'pending'
      and a.expires_at > now()
      and a.payload->>'idempotencyKey' = v_idempotency_key
    order by a.created_at desc
    limit 1;
  end if;

  if v_action.id is null then
    insert into public.maxxis_pending_actions(user_id, action_type, payload, expires_at)
    values (
      v_user_id,
      'send_provider_message',
      jsonb_build_object(
        'actionType', 'send_provider_message',
        'serviceId', p_service_id,
        'propertyId', p_property_id,
        'providerId', v_service.owner_id,
        'profileScope', coalesce(v_access.profile_scope, v_service.profile_scope),
        'serviceTitle', v_service.service_title,
        'serviceType', v_service.service_type,
        'message', v_message,
        'idempotencyKey', nullif(v_idempotency_key, ''),
        'property', jsonb_build_object(
          'id', v_property.id,
          'city', v_property.city,
          'state', v_property.state,
          'type', v_property.property_type
        )
      ),
      now() + interval '30 minutes'
    )
    returning * into v_action;
  end if;

  return jsonb_build_object(
    'success', true,
    'status', 'pending',
    'actionId', v_action.id,
    'expiresAt', v_action.expires_at,
    'serviceId', p_service_id,
    'propertyId', p_property_id,
    'providerId', v_service.owner_id,
    'serviceTitle', v_service.service_title
  );
end;
$$;

create or replace function public.ds_confirm_maxxis_provider_message(p_action_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_action public.maxxis_pending_actions%rowtype;
  v_service_id uuid;
  v_property_id uuid;
  v_provider_id uuid;
  v_profile_scope text;
  v_message text;
  v_service record;
  v_property record;
  v_access record;
  v_chat_status jsonb;
  v_message_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_action_id is null then
    raise exception 'action required' using errcode = '22023';
  end if;

  select * into v_action
  from public.maxxis_pending_actions
  where id = p_action_id
    and user_id = v_user_id
    and action_type = 'send_provider_message'
  for update;

  if v_action.id is null then
    return jsonb_build_object('success', false, 'status', 'not_found');
  end if;
  if v_action.status = 'executed' then
    return jsonb_build_object(
      'success', true,
      'status', 'sent',
      'messageId', v_action.payload->>'messageId',
      'serviceId', v_action.payload->>'serviceId',
      'propertyId', v_action.payload->>'propertyId'
    );
  end if;
  if v_action.status = 'cancelled' then
    return jsonb_build_object('success', false, 'status', 'cancelled');
  end if;
  if v_action.status <> 'pending' then
    return jsonb_build_object('success', false, 'status', v_action.status);
  end if;
  if v_action.expires_at <= now() then
    update public.maxxis_pending_actions set status = 'expired' where id = v_action.id;
    return jsonb_build_object('success', false, 'status', 'expired');
  end if;

  v_service_id := (v_action.payload->>'serviceId')::uuid;
  v_property_id := (v_action.payload->>'propertyId')::uuid;
  v_provider_id := (v_action.payload->>'providerId')::uuid;
  v_profile_scope := coalesce(v_action.payload->>'profileScope', 'personal');
  v_message := public.ds_normalize_maxxis_provider_message(v_action.payload->>'message');

  select
    s.id,
    s.owner_id,
    public.ds_normalize_profile_scope(s.primary_profile) as profile_scope,
    coalesce(s.title, s.category, 'Provider') as service_title,
    coalesce(s.category, '') as service_type
  into v_service
  from public.services s
  where s.id = v_service_id
    and coalesce(s.publish_to_connections, false) = true;

  if v_service.id is null or v_service.owner_id is null or v_service.owner_id <> v_provider_id or v_service.owner_id = v_user_id then
    return jsonb_build_object('success', false, 'status', 'provider_unavailable');
  end if;

  select
    p.id,
    coalesce(p.city, '') as city,
    upper(coalesce(p.state, '')) as state,
    coalesce(p.type, '') as property_type
  into v_property
  from public.properties p
  where p.id = v_property_id
    and coalesce(p.is_active, false) = true
    and coalesce(p.publish_to_showcase, false) = true
    and coalesce(p.deal_closed, false) = false;

  if v_property.id is null then
    return jsonb_build_object('success', false, 'status', 'property_unavailable');
  end if;

  select * into v_access
  from public.ds_get_provider_contact_access(array[v_service_id])
  limit 1;

  if coalesce(v_access.status, '') <> 'already_unlocked' then
    return jsonb_build_object('success', false, 'status', 'provider_contact_locked');
  end if;

  v_profile_scope := coalesce(v_access.profile_scope, v_profile_scope, v_service.profile_scope);
  v_chat_status := public.ds_get_chat_contact_status(v_service.owner_id, v_profile_scope);
  if coalesce((v_chat_status->>'canChat')::boolean, false) is not true then
    return jsonb_build_object('success', false, 'status', 'chat_unavailable', 'chatStatus', v_chat_status);
  end if;

  insert into public.chat_messages(
    sender_id,
    recipient_id,
    contact_owner_id,
    body,
    message_type,
    message_code,
    message_params,
    metadata
  )
  values (
    v_user_id,
    v_service.owner_id,
    v_service.owner_id,
    v_message,
    'text',
    null,
    '{}'::jsonb,
    jsonb_build_object(
      'source', 'maxxis_provider_message_send',
      'actionId', v_action.id,
      'serviceId', v_service_id,
      'propertyId', v_property_id,
      'contactPrimaryProfile', v_profile_scope,
      'originalText', v_message,
      'originalLang', '',
      'translatedLang', '',
      'refData', jsonb_build_object(
        'type', 'property',
        'propertyId', v_property_id,
        'city', v_property.city,
        'state', v_property.state,
        'propertyType', v_property.property_type,
        'serviceId', v_service_id,
        'serviceTitle', v_service.service_title
      )
    )
  )
  returning id into v_message_id;

  update public.maxxis_pending_actions
    set status = 'executed',
        confirmed_at = now(),
        executed_at = now(),
        payload = v_action.payload || jsonb_build_object('messageId', v_message_id)
  where id = v_action.id;

  return jsonb_build_object(
    'success', true,
    'status', 'sent',
    'messageId', v_message_id,
    'serviceId', v_service_id,
    'propertyId', v_property_id
  );
end;
$$;

create or replace function public.ds_cancel_maxxis_provider_message(p_action_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_action public.maxxis_pending_actions%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_action_id is null then
    raise exception 'action required' using errcode = '22023';
  end if;

  select * into v_action
  from public.maxxis_pending_actions
  where id = p_action_id
    and user_id = v_user_id
    and action_type = 'send_provider_message'
  for update;

  if v_action.id is null then
    return jsonb_build_object('success', false, 'status', 'not_found');
  end if;
  if v_action.status = 'cancelled' then
    return jsonb_build_object('success', true, 'status', 'cancelled');
  end if;
  if v_action.status = 'executed' then
    return jsonb_build_object('success', false, 'status', 'sent', 'messageId', v_action.payload->>'messageId');
  end if;
  if v_action.status <> 'pending' then
    return jsonb_build_object('success', false, 'status', v_action.status);
  end if;
  if v_action.expires_at <= now() then
    update public.maxxis_pending_actions set status = 'expired' where id = v_action.id;
    return jsonb_build_object('success', false, 'status', 'expired');
  end if;

  update public.maxxis_pending_actions
    set status = 'cancelled',
        cancelled_at = now()
  where id = v_action.id;

  return jsonb_build_object('success', true, 'status', 'cancelled');
end;
$$;

revoke all on function public.ds_normalize_maxxis_provider_message(text) from public;
revoke all on function public.ds_prepare_maxxis_provider_message(uuid, uuid, text, text) from public;
revoke all on function public.ds_confirm_maxxis_provider_message(uuid) from public;
revoke all on function public.ds_cancel_maxxis_provider_message(uuid) from public;
grant execute on function public.ds_prepare_maxxis_provider_message(uuid, uuid, text, text) to authenticated;
grant execute on function public.ds_confirm_maxxis_provider_message(uuid) to authenticated;
grant execute on function public.ds_cancel_maxxis_provider_message(uuid) to authenticated;

-- Rollback:
-- revoke all on function public.ds_prepare_maxxis_provider_message(uuid, uuid, text, text) from public;
-- revoke all on function public.ds_confirm_maxxis_provider_message(uuid) from public;
-- revoke all on function public.ds_cancel_maxxis_provider_message(uuid) from public;
-- drop function if exists public.ds_prepare_maxxis_provider_message(uuid, uuid, text, text);
-- drop function if exists public.ds_confirm_maxxis_provider_message(uuid);
-- drop function if exists public.ds_cancel_maxxis_provider_message(uuid);
-- drop function if exists public.ds_normalize_maxxis_provider_message(text);
-- alter table public.maxxis_pending_actions drop constraint if exists maxxis_pending_actions_action_type_check;
-- alter table public.maxxis_pending_actions add constraint maxxis_pending_actions_action_type_check check (action_type = 'update_investment_profile');
-- alter table public.maxxis_pending_actions drop constraint if exists maxxis_pending_actions_payload_size;
-- alter table public.maxxis_pending_actions add constraint maxxis_pending_actions_payload_size check (octet_length(payload::text) <= 2048);
