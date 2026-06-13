create or replace function public.ds_get_property_unlock_quote(p_property_id uuid)
returns table (
  property_id uuid,
  owner_id uuid,
  base_cost integer,
  normal_unlock_count integer,
  exclusivity_kind text,
  exclusivity_cost integer,
  blocked boolean,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_base_cost integer := 1;
  v_normal_count integer := 0;
  v_exclusive public.property_unlocks%rowtype;
  v_kind text := 'regular';
  v_exclusivity_cost integer := 0;
  v_blocked boolean := false;
  v_expires_at timestamptz := null;
begin
  perform public.ds_prune_property_unlocks();

  select p.owner_id
    into v_owner_id
  from public.properties p
  where p.id = p_property_id
    and p.is_active = true
    and p.publish_to_showcase = true;

  if v_owner_id is null then
    raise exception 'property not available for unlock' using errcode = 'P0002';
  end if;

  select greatest(1, count(*)::integer)
    into v_base_cost
  from (
    select id from public.properties
    where owner_id = v_owner_id
      and is_active = true
      and publish_to_showcase = true
    union all
    select id from public.services
    where owner_id = v_owner_id
      and publish_to_connections = true
  ) portfolio_items;

  select count(*)
    into v_normal_count
  from public.property_unlocks
  where property_id = p_property_id
    and mode = 'normal';

  select *
    into v_exclusive
  from public.property_unlocks
  where property_id = p_property_id
    and mode in ('total', 'partial')
    and status = 'active'
    and expires_at > now()
  order by created_at desc
  limit 1;

  if v_exclusive.id is not null then
    v_kind := 'blocked';
    v_blocked := true;
    v_expires_at := v_exclusive.expires_at;
  elsif v_normal_count = 0 then
    v_kind := 'new';
    v_exclusivity_cost := 20;
  elsif v_normal_count <= 2 then
    v_kind := 'partial';
    v_exclusivity_cost := 18;
  end if;

  return query
  select
    p_property_id,
    v_owner_id,
    v_base_cost,
    v_normal_count,
    v_kind,
    v_exclusivity_cost,
    v_blocked,
    v_expires_at;
end;
$$;

grant execute on function public.ds_get_property_unlock_quote(uuid) to authenticated;
