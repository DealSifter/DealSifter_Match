create or replace function public.ds_purchase_card_spotlights(p_items jsonb)
returns table (
  spotlight_id uuid,
  card_kind text,
  card_id text,
  remaining_nuggets integer,
  total_cost integer,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_items jsonb := coalesce(p_items, '[]'::jsonb);
  v_count integer := 0;
  v_total_cost integer := 0;
  v_remaining integer := 0;
  v_item jsonb;
  v_kind text;
  v_card_id text;
  v_scope text;
  v_owner_id uuid;
  v_property_owner uuid;
  v_service_owner uuid;
  v_spotlight_id uuid;
  v_expires_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if jsonb_typeof(v_items) <> 'array' then
    raise exception 'invalid spotlight items' using errcode = '22023';
  end if;

  v_count := jsonb_array_length(v_items);
  if v_count <= 0 then
    raise exception 'select at least one card' using errcode = '22023';
  end if;
  if v_count > 12 then
    raise exception 'too many cards selected' using errcode = '22023';
  end if;

  v_total_cost := v_count * 10;

  update public.users u
     set nuggets = coalesce(u.nuggets, 0) - v_total_cost
   where u.id = v_user_id
     and coalesce(u.nuggets, 0) >= v_total_cost
  returning u.nuggets into v_remaining;

  if v_remaining is null then
    raise exception 'not enough nuggets' using errcode = '22003';
  end if;

  for v_item in select * from jsonb_array_elements(v_items)
  loop
    v_kind := lower(trim(v_item->>'cardKind'));
    v_card_id := trim(v_item->>'cardId');
    v_scope := nullif(trim(v_item->>'scope'), '');
    v_owner_id := coalesce(nullif(v_item->>'ownerId', '')::uuid, v_user_id);

    if v_kind not in ('profile', 'property', 'service') or length(v_card_id) < 3 then
      raise exception 'invalid spotlight item' using errcode = '22023';
    end if;

    if v_kind = 'property' then
      select p.owner_id into v_property_owner
        from public.properties p
       where p.id::text = v_card_id
         and p.owner_id = v_user_id
         and p.is_active = true
         and p.publish_to_showcase = true
         and coalesce(p.deal_closed, false) = false;

      if v_property_owner is null then
        raise exception 'property is not eligible for spotlight' using errcode = '42501';
      end if;
      v_owner_id := v_property_owner;
    elsif v_kind = 'service' then
      select s.owner_id into v_service_owner
        from public.services s
       where s.id::text = v_card_id
         and s.owner_id = v_user_id
         and s.publish_to_connections = true;

      if v_service_owner is null then
        raise exception 'service is not eligible for spotlight' using errcode = '42501';
      end if;
      v_owner_id := v_service_owner;
    else
      if v_owner_id <> v_user_id or v_card_id not like ('profile:%:' || v_user_id::text) then
        raise exception 'profile is not eligible for spotlight' using errcode = '42501';
      end if;
    end if;

    insert into public.card_spotlights(user_id, owner_id, card_kind, card_id, scope, nuggets_spent, starts_at, expires_at, metadata)
    values (v_user_id, v_owner_id, v_kind, v_card_id, v_scope, 10, now(), now() + interval '30 days', coalesce(v_item->'metadata', '{}'::jsonb))
    returning public.card_spotlights.id, public.card_spotlights.expires_at into v_spotlight_id, v_expires_at;

    begin
      insert into public.app_events(user_id, event_type, entity_type, entity_id, value_nuggets, metadata)
      values (
        v_user_id,
        'highlight_purchased',
        v_kind,
        left(v_card_id, 96),
        10,
        jsonb_build_object('scope', v_scope, 'ownerId', v_owner_id, 'spotlightId', v_spotlight_id)
      );
    exception when others then
      -- KPI tracking must never rollback the paid spotlight purchase.
      null;
    end;

    spotlight_id := v_spotlight_id;
    card_kind := v_kind;
    card_id := v_card_id;
    remaining_nuggets := v_remaining;
    total_cost := v_total_cost;
    expires_at := v_expires_at;
    return next;
  end loop;
end;
$$;

grant execute on function public.ds_purchase_card_spotlights(jsonb) to authenticated;
