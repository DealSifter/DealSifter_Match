create or replace function public.ds_get_active_exclusivities(p_user_id uuid default null)
returns table (
  id uuid,
  property_id uuid,
  owner_id uuid,
  buyer_id uuid,
  mode text,
  base_cost integer,
  exclusivity_cost integer,
  total_cost integer,
  created_at timestamptz,
  expires_at timestamptz,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := coalesce(p_user_id, auth.uid());
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if v_user_id is distinct from auth.uid() and current_setting('role', true) <> 'service_role' then
    raise exception 'Unauthorized' using errcode = '28000';
  end if;

  return query
  select
    pu.id,
    pu.property_id,
    pu.owner_id,
    pu.buyer_id,
    pu.mode,
    pu.base_cost,
    pu.exclusivity_cost,
    pu.total_cost,
    pu.created_at,
    pu.expires_at,
    pu.status
  from public.property_unlocks pu
  where (pu.buyer_id = v_user_id or pu.owner_id = v_user_id)
    and pu.mode in ('total', 'partial')
    and pu.status = 'active'
    and pu.expires_at is not null
    and pu.expires_at > now()
  order by pu.expires_at asc;
end;
$$;

grant execute on function public.ds_get_active_exclusivities(uuid) to authenticated;

create or replace function public.ds_check_is_unlocked(p_contact_id uuid, p_user_id uuid default null)
returns table (
  is_unlocked boolean,
  unlock_id uuid,
  seller_id uuid,
  nuggets_spent integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := coalesce(p_user_id, auth.uid());
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if v_user_id is distinct from auth.uid() and current_setting('role', true) <> 'service_role' then
    raise exception 'Unauthorized' using errcode = '28000';
  end if;

  return query
  select
    true as is_unlocked,
    u.id as unlock_id,
    u.seller_id,
    u.nuggets_spent,
    u.created_at
  from public.unlocks u
  where u.buyer_id = v_user_id
    and u.seller_id = p_contact_id
  order by u.created_at desc
  limit 1;

  if not found then
    return query select false, null::uuid, p_contact_id, 0, null::timestamptz;
  end if;
end;
$$;

grant execute on function public.ds_check_is_unlocked(uuid, uuid) to authenticated;

create or replace function public.ds_purchase_exclusivity_unlock(
  p_property_id uuid,
  p_seller_id uuid,
  p_intent_token uuid,
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
  remaining_nuggets integer,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select ui.mode
    into v_mode
  from public.unlock_intents ui
  where ui.id = p_intent_token
    and ui.buyer_id = auth.uid()
    and ui.seller_id = p_seller_id
    and ui.property_id = p_property_id
    and ui.scope = 'property'
  limit 1;

  if v_mode is null then
    raise exception 'unlock intent invalid' using errcode = '22023';
  end if;
  if v_mode not in ('total', 'partial') then
    raise exception 'invalid exclusivity intent' using errcode = '22023';
  end if;

  return query
  select
    r.unlock_id,
    r.property_id,
    r.owner_id,
    r.buyer_id,
    r.mode,
    r.base_cost,
    r.exclusivity_cost,
    r.total_cost,
    r.remaining_nuggets,
    r.expires_at
  from public.ds_purchase_property_unlock(p_property_id, v_mode, p_metadata, p_intent_token) r;
end;
$$;

grant execute on function public.ds_purchase_exclusivity_unlock(uuid, uuid, uuid, jsonb) to authenticated;
