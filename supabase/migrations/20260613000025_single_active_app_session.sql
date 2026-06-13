-- Enforce one active app session per non-admin user.
-- Admin users are intentionally exempt so DealSifter can be tested across
-- devices/tabs during production debugging.

create table if not exists public.user_active_app_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_token text not null,
  device_label text,
  last_page text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.user_active_app_sessions enable row level security;

drop policy if exists "Users can read own active app session" on public.user_active_app_sessions;
create policy "Users can read own active app session"
  on public.user_active_app_sessions
  for select
  using (auth.uid() = user_id);

create or replace function public.ds_register_app_session(
  p_session_token text,
  p_device_label text default null,
  p_page text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_admin boolean := false;
  v_token text := nullif(trim(coalesce(p_session_token, '')), '');
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select coalesce(u.is_admin, false)
    into v_is_admin
    from public.users u
   where u.id = v_user_id;

  if coalesce(v_is_admin, false) then
    return jsonb_build_object('ok', true, 'adminBypass', true);
  end if;

  if v_token is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_session_token');
  end if;

  insert into public.user_active_app_sessions (
    user_id,
    session_token,
    device_label,
    last_page,
    created_at,
    last_seen_at
  )
  values (
    v_user_id,
    v_token,
    nullif(left(coalesce(p_device_label, ''), 180), ''),
    nullif(left(coalesce(p_page, ''), 64), ''),
    now(),
    now()
  )
  on conflict (user_id) do update
    set session_token = excluded.session_token,
        device_label = excluded.device_label,
        last_page = excluded.last_page,
        created_at = now(),
        last_seen_at = now();

  return jsonb_build_object('ok', true, 'adminBypass', false);
end;
$$;

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
  v_is_admin boolean := false;
  v_token text := nullif(trim(coalesce(p_session_token, '')), '');
  v_active text;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select coalesce(u.is_admin, false)
    into v_is_admin
    from public.users u
   where u.id = v_user_id;

  if coalesce(v_is_admin, false) then
    return jsonb_build_object('ok', true, 'adminBypass', true);
  end if;

  if v_token is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_session_token');
  end if;

  select s.session_token
    into v_active
    from public.user_active_app_sessions s
   where s.user_id = v_user_id;

  if v_active is null then
    perform public.ds_register_app_session(v_token, null, p_page);
    return jsonb_build_object('ok', true, 'registered', true);
  end if;

  if v_active <> v_token then
    return jsonb_build_object('ok', false, 'reason', 'session_replaced');
  end if;

  update public.user_active_app_sessions
     set last_seen_at = now(),
         last_page = nullif(left(coalesce(p_page, ''), 64), '')
   where user_id = v_user_id;

  return jsonb_build_object('ok', true, 'adminBypass', false);
end;
$$;

grant execute on function public.ds_register_app_session(text, text, text) to authenticated;
grant execute on function public.ds_touch_app_session(text, text) to authenticated;
