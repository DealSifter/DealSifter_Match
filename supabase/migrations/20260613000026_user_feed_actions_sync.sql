create table if not exists public.user_feed_actions (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, action, entity_type, entity_id),
  constraint user_feed_actions_action_check check (action in ('matched', 'interested', 'unlocked')),
  constraint user_feed_actions_entity_type_check check (entity_type in ('person', 'property')),
  constraint user_feed_actions_entity_id_check check (length(trim(entity_id)) between 1 and 128),
  constraint user_feed_actions_payload_size check (octet_length(payload::text) <= 4096)
);

create index if not exists idx_user_feed_actions_user_updated
  on public.user_feed_actions(user_id, updated_at desc);

alter table public.user_feed_actions enable row level security;

drop policy if exists user_feed_actions_select_own on public.user_feed_actions;
create policy user_feed_actions_select_own
  on public.user_feed_actions for select
  using (auth.uid() = user_id);

drop policy if exists user_feed_actions_insert_own on public.user_feed_actions;
create policy user_feed_actions_insert_own
  on public.user_feed_actions for insert
  with check (auth.uid() = user_id);

drop policy if exists user_feed_actions_update_own on public.user_feed_actions;
create policy user_feed_actions_update_own
  on public.user_feed_actions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists user_feed_actions_delete_own on public.user_feed_actions;
create policy user_feed_actions_delete_own
  on public.user_feed_actions for delete
  using (auth.uid() = user_id);

create or replace function public.ds_touch_user_feed_actions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_feed_actions_updated_at on public.user_feed_actions;
create trigger trg_user_feed_actions_updated_at
before update on public.user_feed_actions
for each row execute function public.ds_touch_user_feed_actions_updated_at();

create or replace function public.ds_upsert_user_feed_actions(p_actions jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row jsonb;
  v_count integer := 0;
  v_action text;
  v_entity_type text;
  v_entity_id text;
  v_payload jsonb;
begin
  if v_user_id is null then
    return 0;
  end if;

  if jsonb_typeof(coalesce(p_actions, '[]'::jsonb)) <> 'array' then
    return 0;
  end if;

  for v_row in select value from jsonb_array_elements(p_actions)
  loop
    v_action := lower(trim(coalesce(v_row->>'action', '')));
    v_entity_type := lower(trim(coalesce(v_row->>'entity_type', '')));
    v_entity_id := left(trim(coalesce(v_row->>'entity_id', '')), 128);
    v_payload := coalesce(v_row->'payload', '{}'::jsonb);

    if v_action not in ('matched', 'interested', 'unlocked') then
      continue;
    end if;
    if v_entity_type not in ('person', 'property') then
      continue;
    end if;
    if length(v_entity_id) = 0 then
      continue;
    end if;
    if octet_length(v_payload::text) > 4096 then
      v_payload := '{}'::jsonb;
    end if;

    insert into public.user_feed_actions(user_id, action, entity_type, entity_id, payload)
    values (v_user_id, v_action, v_entity_type, v_entity_id, v_payload)
    on conflict (user_id, action, entity_type, entity_id)
    do update set payload = excluded.payload;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.ds_delete_user_feed_action(
  p_action text,
  p_entity_type text,
  p_entity_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  delete from public.user_feed_actions
  where user_id = auth.uid()
    and action = lower(trim(coalesce(p_action, '')))
    and entity_type = lower(trim(coalesce(p_entity_type, '')))
    and entity_id = left(trim(coalesce(p_entity_id, '')), 128);
end;
$$;

grant execute on function public.ds_upsert_user_feed_actions(jsonb) to authenticated;
grant execute on function public.ds_delete_user_feed_action(text, text, text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.user_feed_actions;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
