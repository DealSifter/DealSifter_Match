create table if not exists public.geocode_cache (
  address_hash text primary key,
  normalized_address text not null,
  lat double precision,
  lng double precision,
  provider_used text,
  status text not null default 'pending',
  confidence numeric(5,2),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.geocode_cache enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'geocode_cache_status_check'
      and conrelid = 'public.geocode_cache'::regclass
  ) then
    alter table public.geocode_cache
      add constraint geocode_cache_status_check
      check (status in ('success', 'pending', 'failed'));
  end if;
end
$$;

create index if not exists idx_geocode_cache_status_created
  on public.geocode_cache(status, created_at desc);

drop trigger if exists trg_geocode_cache_updated_at on public.geocode_cache;
create trigger trg_geocode_cache_updated_at
before update on public.geocode_cache
for each row execute function public.set_updated_at();

drop policy if exists geocode_cache_no_client_select on public.geocode_cache;
create policy geocode_cache_no_client_select on public.geocode_cache
for select using (false);

drop policy if exists geocode_cache_no_client_insert on public.geocode_cache;
create policy geocode_cache_no_client_insert on public.geocode_cache
for insert with check (false);

drop policy if exists geocode_cache_no_client_update on public.geocode_cache;
create policy geocode_cache_no_client_update on public.geocode_cache
for update using (false);

drop policy if exists geocode_cache_no_client_delete on public.geocode_cache;
create policy geocode_cache_no_client_delete on public.geocode_cache
for delete using (false);
