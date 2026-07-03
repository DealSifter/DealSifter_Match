create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('unlock', 'exclusive', 'spotlight_expired')),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_unread_created
  on public.notifications(user_id, created_at desc)
  where read_at is null;

create index if not exists idx_notifications_user_created
  on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists notifications_update_own_read_at on public.notifications;
create policy notifications_update_own_read_at
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists notifications_no_direct_insert on public.notifications;
create policy notifications_no_direct_insert
  on public.notifications for insert
  with check (false);

drop policy if exists notifications_no_direct_delete on public.notifications;
create policy notifications_no_direct_delete
  on public.notifications for delete
  using (false);

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

create or replace function public.ds_notify_contact_unlock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.seller_id is null or new.buyer_id is null or new.seller_id = new.buyer_id then
    return new;
  end if;

  -- Property unlocks insert into property_unlocks first and may also create an
  -- unlocks row. Avoid sending a duplicate generic contact notification.
  if exists (
    select 1
    from public.property_unlocks pu
    where pu.owner_id = new.seller_id
      and pu.buyer_id = new.buyer_id
      and pu.created_at >= now() - interval '10 seconds'
  ) then
    return new;
  end if;

  insert into public.notifications(user_id, type, payload)
  values (
    new.seller_id,
    'unlock',
    jsonb_build_object(
      'unlocker_id', new.buyer_id,
      'card_id', new.seller_id,
      'property_id', null,
      'nuggets_spent', coalesce(new.nuggets_spent, 0),
      'unlock_id', new.id
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_contact_unlock on public.unlocks;
create trigger trg_notify_contact_unlock
after insert on public.unlocks
for each row execute function public.ds_notify_contact_unlock();

create or replace function public.ds_notify_property_unlock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is null or new.buyer_id is null or new.owner_id = new.buyer_id then
    return new;
  end if;

  insert into public.notifications(user_id, type, payload)
  values (
    new.owner_id,
    case when new.mode in ('total', 'partial') then 'exclusive' else 'unlock' end,
    jsonb_build_object(
      'unlocker_id', new.buyer_id,
      'card_id', new.owner_id,
      'property_id', new.property_id,
      'nuggets_spent', coalesce(new.total_cost, 0),
      'base_cost', coalesce(new.base_cost, 0),
      'exclusivity_cost', coalesce(new.exclusivity_cost, 0),
      'mode', new.mode,
      'unlock_id', new.id
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_property_unlock on public.property_unlocks;
create trigger trg_notify_property_unlock
after insert on public.property_unlocks
for each row execute function public.ds_notify_property_unlock();
