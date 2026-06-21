-- Fix remaining ambiguity in ds_purchase_property_unlock caused by the
-- RETURNS TABLE column buyer_id conflicting with ON CONFLICT column inference.

create or replace function public.ds_purchase_property_unlock(
  p_property_id uuid,
  p_mode text default 'normal',
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  unlock_id uuid,
  property_id uuid,
  owner_id uuid,
  buyer_id uuid,
  mode text,
  base_cost integer,
  exclusivity_cost integer,
  total_cost integer,
  expires_at timestamptz,
  remaining_nuggets integer,
  normal_unlock_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid := auth.uid();
  v_owner_id uuid;
  v_mode text := lower(trim(coalesce(p_mode, 'normal')));
  v_base_cost integer := 1;
  v_exclusivity_cost integer := 0;
  v_total_cost integer := 0;
  v_normal_count integer := 0;
  v_active_exclusive_id uuid;
  v_expires_at timestamptz := null;
  v_remaining integer;
  v_unlock_id uuid;
begin
  if v_buyer_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if v_mode not in ('normal', 'total', 'partial') then
    raise exception 'invalid unlock mode' using errcode = '22023';
  end if;

  if p_metadata is not null
     and (
       octet_length(p_metadata::text) > 1024
       or public.ds_redact_inline_media_jsonb(p_metadata) <> p_metadata
     ) then
    raise exception 'metadata too large or unsafe' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('property-unlock:' || p_property_id::text));
  perform public.ds_prune_property_unlocks();

  select p.owner_id
    into v_owner_id
  from public.properties p
  where p.id = p_property_id
    and p.is_active = true
    and coalesce(p.deal_closed, false) = false;

  if v_owner_id is null then
    raise exception 'property not available for unlock' using errcode = 'P0002';
  end if;

  if v_owner_id = v_buyer_id then
    raise exception 'cannot unlock own property' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('contact-unlock:' || v_buyer_id::text || ':' || v_owner_id::text));

  select greatest(1, count(*)::integer)
    into v_base_cost
  from (
    select p2.id
    from public.properties p2
    where p2.owner_id = v_owner_id
      and p2.is_active = true
      and coalesce(p2.deal_closed, false) = false
    union all
    select s2.id
    from public.services s2
    where s2.owner_id = v_owner_id
      and s2.publish_to_connections = true
  ) portfolio_items;

  select count(*)
    into v_normal_count
  from public.property_unlocks pu
  where pu.property_id = p_property_id
    and pu.mode = 'normal';

  select pu.id
    into v_active_exclusive_id
  from public.property_unlocks pu
  where pu.property_id = p_property_id
    and pu.mode in ('total', 'partial')
    and pu.status = 'active'
    and pu.expires_at > now()
  order by pu.created_at desc
  limit 1;

  if v_active_exclusive_id is not null then
    raise exception 'property is under active exclusivity' using errcode = '55000';
  end if;

  if v_mode = 'total' then
    if v_normal_count <> 0 then
      raise exception 'total exclusivity requires zero previous normal unlocks' using errcode = '55000';
    end if;
    v_exclusivity_cost := 20;
    v_expires_at := now() + interval '7 days';
  elsif v_mode = 'partial' then
    if v_normal_count < 1 or v_normal_count > 2 then
      raise exception 'partial exclusivity requires one or two previous normal unlocks' using errcode = '55000';
    end if;
    v_exclusivity_cost := 18;
    v_expires_at := now() + interval '7 days';
  end if;

  v_total_cost := v_base_cost + v_exclusivity_cost;

  update public.users u
  set nuggets = coalesce(u.nuggets, 0) - v_total_cost,
      updated_at = now()
  where u.id = v_buyer_id
    and coalesce(u.nuggets, 0) >= v_total_cost
  returning u.nuggets into v_remaining;

  if v_remaining is null then
    raise exception 'not enough nuggets' using errcode = '22003';
  end if;

  insert into public.property_unlocks(
    property_id,
    owner_id,
    buyer_id,
    mode,
    base_cost,
    exclusivity_cost,
    total_cost,
    normal_unlock_count_at_purchase,
    metadata,
    expires_at
  )
  values (
    p_property_id,
    v_owner_id,
    v_buyer_id,
    v_mode,
    v_base_cost,
    v_exclusivity_cost,
    v_total_cost,
    v_normal_count,
    coalesce(p_metadata, '{}'::jsonb),
    v_expires_at
  )
  returning id into v_unlock_id;

  update public.unlocks ul
  set nuggets_spent = coalesce(ul.nuggets_spent, 0) + v_total_cost
  where ul.buyer_id = v_buyer_id
    and ul.seller_id = v_owner_id;

  if not found then
    insert into public.unlocks(buyer_id, seller_id, nuggets_spent)
    select v_buyer_id, v_owner_id, v_total_cost
    where not exists (
      select 1
      from public.unlocks ul2
      where ul2.buyer_id = v_buyer_id
        and ul2.seller_id = v_owner_id
    );
  end if;

  insert into public.app_events(user_id, event_type, entity_type, entity_id, value_nuggets, metadata)
  values (
    v_buyer_id,
    case when v_mode = 'normal' then 'property_unlock_normal' else 'exclusive_contact_purchased' end,
    'property',
    p_property_id::text,
    v_total_cost,
    jsonb_build_object(
      'mode', v_mode,
      'ownerId', v_owner_id,
      'baseCost', v_base_cost,
      'exclusivityCost', v_exclusivity_cost,
      'normalUnlockCount', v_normal_count
    )
  );

  return query
  select
    v_unlock_id,
    p_property_id,
    v_owner_id,
    v_buyer_id,
    v_mode,
    v_base_cost,
    v_exclusivity_cost,
    v_total_cost,
    v_expires_at,
    v_remaining,
    v_normal_count;
end;
$$;

grant execute on function public.ds_purchase_property_unlock(uuid, text, jsonb) to authenticated;
