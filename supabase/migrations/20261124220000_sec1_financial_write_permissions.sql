-- SEC-01/SEC-02: authorization records are written by trusted backend/RPCs only.
-- No data, prices, purchase routines or SELECT permissions are changed.
revoke insert on public.unlocks from public, anon, authenticated;
revoke insert, update on public.subscriptions from public, anon, authenticated;

-- Explicit column grants survive a table-level REVOKE; remove those too.
do $$
declare
  v_columns text;
begin
  select string_agg(quote_ident(attname), ', ' order by attnum) into v_columns
  from pg_attribute where attrelid = 'public.unlocks'::regclass and attnum > 0 and not attisdropped;
  execute format('revoke insert (%s) on public.unlocks from public, anon, authenticated', v_columns);
  select string_agg(quote_ident(attname), ', ' order by attnum) into v_columns
  from pg_attribute where attrelid = 'public.subscriptions'::regclass and attnum > 0 and not attisdropped;
  execute format('revoke insert (%s), update (%s) on public.subscriptions from public, anon, authenticated', v_columns, v_columns);
end;
$$;

drop policy if exists unlocks_insert_own on public.unlocks;
drop policy if exists "Users can insert own subscription" on public.subscriptions;
drop policy if exists "Users can update own subscription" on public.subscriptions;

do $$
begin
  if has_any_column_privilege('authenticated', 'public.unlocks', 'INSERT')
    or has_any_column_privilege('anon', 'public.unlocks', 'INSERT')
    or has_any_column_privilege('authenticated', 'public.subscriptions', 'INSERT,UPDATE')
    or has_any_column_privilege('anon', 'public.subscriptions', 'INSERT,UPDATE') then
    raise exception 'SEC-1 financial permissions remain writable through inherited grants';
  end if;
end;
$$;
