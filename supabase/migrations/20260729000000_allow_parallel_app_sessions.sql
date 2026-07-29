-- Multi-device usage is supported. Session heartbeats are observational only and
-- must never invalidate another browser tab or device for the same user.
create or replace function public.ds_touch_app_session(
  p_session_token text,
  p_page text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  update public.user_active_app_sessions
     set last_seen_at = now(),
         last_page = coalesce(nullif(left(trim(p_page), 64), ''), last_page)
   where user_id = v_user_id
     and session_token = nullif(trim(p_session_token), '');

  -- A token mismatch means another device registered more recently. It is valid
  -- and must not trigger a sign-out in an older deployed frontend.
  return jsonb_build_object(
    'ok', true,
    'multi_session', true,
    'token_registered', found
  );
end;
$$;

revoke all on function public.ds_touch_app_session(text, text) from public;
grant execute on function public.ds_touch_app_session(text, text) to authenticated;
