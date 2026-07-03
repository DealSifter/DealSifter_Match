-- Runtime support for planUsageService. Nuggets are debited only through a
-- server-side locked RPC so localStorage/UI state cannot authorize spending.

create or replace function public.ds_deduct_nuggets(
  p_amount integer,
  p_reason text default 'manual'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_amount integer := greatest(0, coalesce(p_amount, 0));
  v_reason text := left(coalesce(nullif(trim(p_reason), ''), 'manual'), 80);
  v_balance integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if v_amount <= 0 then
    select coalesce(u.nuggets, 0)
      into v_balance
    from public.users u
    where u.id = v_user_id;
    return jsonb_build_object('newBalance', coalesce(v_balance, 0), 'amount', 0, 'reason', v_reason);
  end if;

  perform pg_advisory_xact_lock(hashtext('nuggets:' || v_user_id::text));

  select coalesce(u.nuggets, 0)
    into v_balance
  from public.users u
  where u.id = v_user_id
  for update;

  if v_balance is null then
    raise exception 'user profile not found' using errcode = 'P0002';
  end if;

  if v_balance < v_amount then
    raise exception 'insufficient_nuggets' using errcode = 'P0001';
  end if;

  update public.users
  set nuggets = nuggets - v_amount,
      updated_at = now()
  where id = v_user_id
  returning nuggets into v_balance;

  return jsonb_build_object('newBalance', v_balance, 'amount', v_amount, 'reason', v_reason);
end;
$$;

grant execute on function public.ds_deduct_nuggets(integer, text) to authenticated;
