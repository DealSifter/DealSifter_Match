create or replace function public.ds_keepalive()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ok', true,
    'checked_at', now()
  );
$$;

grant execute on function public.ds_keepalive() to anon;
grant execute on function public.ds_keepalive() to authenticated;
