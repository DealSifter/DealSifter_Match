-- user_feed_actions is UI state only. Contact entitlement data must come from
-- ds_get_unlocked_contact_cards(), never from cached feed payloads.

update public.user_feed_actions
set payload = coalesce(payload, '{}'::jsonb)
  - 'email'
  - 'ownerEmail'
  - 'contactEmail'
  - 'phone'
  - 'ownerPhone'
  - 'primaryPhone'
  - 'secondaryPhone'
  - 'tertiaryPhone'
  - 'phonePrimary'
  - 'phoneSecondary'
  - 'phone_primary'
  - 'phone_secondary'
  - 'whatsapp'
  - 'ownerWhatsapp'
  - 'contactMethods'
  - 'contact_methods'
where payload is not null;

alter table public.user_feed_actions
  drop constraint if exists user_feed_actions_payload_no_sensitive_contact;

alter table public.user_feed_actions
  add constraint user_feed_actions_payload_no_sensitive_contact
  check (
    not (
      coalesce(payload, '{}'::jsonb) ?| array[
        'email',
        'ownerEmail',
        'contactEmail',
        'phone',
        'ownerPhone',
        'primaryPhone',
        'secondaryPhone',
        'tertiaryPhone',
        'phonePrimary',
        'phoneSecondary',
        'phone_primary',
        'phone_secondary',
        'whatsapp',
        'ownerWhatsapp',
        'contactMethods',
        'contact_methods'
      ]
    )
  );

comment on column public.user_feed_actions.payload is
  'UI-only cache. Must not contain sensitive contact fields such as email, phone, whatsapp or contact methods. Canonical unlocked contact data comes from ds_get_unlocked_contact_cards().';

create or replace function public.ds_sanitize_user_feed_action_payload(p_payload jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(p_payload, '{}'::jsonb)
    - 'email'
    - 'ownerEmail'
    - 'contactEmail'
    - 'phone'
    - 'ownerPhone'
    - 'primaryPhone'
    - 'secondaryPhone'
    - 'tertiaryPhone'
    - 'phonePrimary'
    - 'phoneSecondary'
    - 'phone_primary'
    - 'phone_secondary'
    - 'whatsapp'
    - 'ownerWhatsapp'
    - 'contactMethods'
    - 'contact_methods';
$$;

grant execute on function public.ds_sanitize_user_feed_action_payload(jsonb) to authenticated, service_role;

create or replace function public.ds_upsert_user_feed_actions(p_actions jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row jsonb;
  v_count integer := 0;
  v_action text;
  v_entity_type text;
  v_entity_id text;
  v_payload jsonb;
begin
  if v_user_id is null then
    return 0;
  end if;

  if jsonb_typeof(coalesce(p_actions, '[]'::jsonb)) <> 'array' then
    return 0;
  end if;

  for v_row in select value from jsonb_array_elements(p_actions)
  loop
    v_action := lower(trim(coalesce(v_row->>'action', '')));
    v_entity_type := lower(trim(coalesce(v_row->>'entity_type', '')));
    v_entity_id := left(trim(coalesce(v_row->>'entity_id', '')), 128);
    v_payload := public.ds_sanitize_user_feed_action_payload(coalesce(v_row->'payload', '{}'::jsonb));

    if v_action not in ('matched', 'interested', 'unlocked') then
      continue;
    end if;
    if v_entity_type not in ('person', 'property') then
      continue;
    end if;
    if length(v_entity_id) = 0 then
      continue;
    end if;
    if octet_length(v_payload::text) > 4096 then
      v_payload := '{}'::jsonb;
    end if;

    insert into public.user_feed_actions(user_id, action, entity_type, entity_id, payload)
    values (v_user_id, v_action, v_entity_type, v_entity_id, v_payload)
    on conflict (user_id, action, entity_type, entity_id)
    do update set payload = excluded.payload;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.ds_upsert_user_feed_actions(jsonb) to authenticated;
