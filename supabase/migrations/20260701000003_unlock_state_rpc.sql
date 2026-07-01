create or replace function public.ds_get_user_unlock_state(p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := coalesce(p_user_id, auth.uid());
  v_is_service boolean := coalesce((auth.jwt() ->> 'role') = 'service_role', false);
  v_contact_snapshots jsonb := '[]'::jsonb;
  v_unlocks jsonb := '[]'::jsonb;
  v_property_unlocks jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required'
      using errcode = '28000';
  end if;

  if not v_is_service and v_user_id is distinct from auth.uid() then
    raise exception 'unauthorized'
      using errcode = '28000';
  end if;

  begin
    select coalesce(jsonb_agg(to_jsonb(snapshot_row)), '[]'::jsonb)
      into v_contact_snapshots
    from public.ds_get_unlocked_contact_snapshots() as snapshot_row;
  exception
    when undefined_function then
      v_contact_snapshots := '[]'::jsonb;
  end;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'seller_id', unlock_row.seller_id,
        'nuggets_spent', unlock_row.nuggets_spent,
        'created_at', unlock_row.created_at
      )
      order by unlock_row.created_at desc
    ),
    '[]'::jsonb
  )
    into v_unlocks
  from (
    select u.seller_id, u.nuggets_spent, u.created_at
    from public.unlocks u
    where u.buyer_id = v_user_id
    order by u.created_at desc
    limit 500
  ) unlock_row;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', property_unlock_row.id,
        'property_id', property_unlock_row.property_id,
        'owner_id', property_unlock_row.owner_id,
        'buyer_id', property_unlock_row.buyer_id,
        'mode', property_unlock_row.mode,
        'total_cost', property_unlock_row.total_cost,
        'created_at', property_unlock_row.created_at,
        'expires_at', property_unlock_row.expires_at,
        'status', property_unlock_row.status
      )
      order by property_unlock_row.created_at desc
    ),
    '[]'::jsonb
  )
    into v_property_unlocks
  from (
    select pu.id, pu.property_id, pu.owner_id, pu.buyer_id, pu.mode, pu.total_cost, pu.created_at, pu.expires_at, pu.status
    from public.property_unlocks pu
    where pu.buyer_id = v_user_id
       or pu.owner_id = v_user_id
    order by pu.created_at desc
    limit 500
  ) property_unlock_row;

  return jsonb_build_object(
    'contact_snapshots', v_contact_snapshots,
    'unlocks', v_unlocks,
    'property_unlocks', v_property_unlocks
  );
end;
$$;

grant execute on function public.ds_get_user_unlock_state(uuid) to authenticated, service_role;
