-- Persist authoritative property coordinates and geocode metadata.
alter table public.properties add column if not exists lat double precision;
alter table public.properties add column if not exists lng double precision;
alter table public.properties add column if not exists geocode_status text;
alter table public.properties add column if not exists geocode_source text;
alter table public.properties add column if not exists geocode_confidence numeric(5,2);
alter table public.properties add column if not exists geocode_input text;
alter table public.properties add column if not exists geocoded_at timestamptz;

alter table public.properties alter column geocode_status set default 'pending';

update public.properties
set geocode_status = case
  when coalesce(nullif(trim(geocode_status), ''), '') in ('pending', 'resolved', 'failed', 'manual') then trim(geocode_status)
  when lat is not null and lng is not null then 'resolved'
  else 'pending'
end
where geocode_status is null
   or trim(geocode_status) = ''
   or trim(geocode_status) not in ('pending', 'resolved', 'failed', 'manual');

alter table public.properties alter column geocode_status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'properties_geocode_status_check'
      and conrelid = 'public.properties'::regclass
  ) then
    alter table public.properties
      add constraint properties_geocode_status_check
      check (geocode_status in ('pending', 'resolved', 'failed', 'manual'));
  end if;
end
$$;

create index if not exists idx_properties_geocode_status on public.properties(geocode_status);
create index if not exists idx_properties_lat_lng on public.properties(lat, lng);
