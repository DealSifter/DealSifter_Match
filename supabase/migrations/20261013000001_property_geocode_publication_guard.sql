begin;

create or replace function public.ds_property_geocode_valid(
  p_lat double precision, p_lng double precision, p_status text, p_source text, p_at timestamptz
) returns boolean language sql immutable set search_path = public as $$
  select coalesce(p_lat between -85 and 85 and p_lng between -180 and 180
    and p_lat <> 0 and p_lng <> 0
    and lower(trim(p_status)) in ('resolved','manual')
    and nullif(trim(p_source),'') is not null and p_at is not null and isfinite(p_at), false);
$$;

-- Fail rather than silently remove an existing published property. Repair known
-- pending records first and inspect the preflight before applying this migration.
do $$ begin
  if exists (select 1 from public.properties where publish_to_showcase and not
    public.ds_property_geocode_valid(lat,lng,geocode_status,geocode_source,geocoded_at)) then
    raise exception 'Published properties require repair before installing the geocode guard';
  end if;
end $$;

create or replace function public.ds_invalidate_changed_property_address()
returns trigger language plpgsql set search_path = public as $$
declare expected_input text;
begin
  if (new.address,new.city,new.state,new.zip) is distinct from (old.address,old.city,old.state,old.zip) then
    expected_input := lower(regexp_replace(trim(concat_ws(', ',
      nullif(trim(new.address),''),nullif(trim(new.city),''),nullif(trim(new.state),''),nullif(trim(new.zip),''),'USA')), '\s+', ' ', 'g'));
    if not (public.ds_property_geocode_valid(new.lat,new.lng,new.geocode_status,new.geocode_source,new.geocoded_at)
      and new.geocoded_at is distinct from old.geocoded_at
      and lower(regexp_replace(trim(coalesce(new.geocode_input,'')), '\s+', ' ', 'g')) = expected_input) then
      new.lat := null; new.lng := null; new.geocode_status := 'pending';
      new.geocode_source := null; new.geocode_confidence := null;
      new.geocode_input := null; new.geocoded_at := null;
      new.publish_to_showcase := false; new.is_active := false;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists properties_invalidate_changed_address on public.properties;
create trigger properties_invalidate_changed_address before update on public.properties
for each row execute function public.ds_invalidate_changed_property_address();

alter table public.properties add constraint properties_published_geocode_valid
check (not coalesce(publish_to_showcase,false)
  or public.ds_property_geocode_valid(lat,lng,geocode_status,geocode_source,geocoded_at));

-- Preserve the deployed inventory's entire privacy/auth/identity projection.
-- Only add a safe validity attestation; never return hidden coordinates or input.
do $$
declare definition text; marker text := '      p.geocode_status,';
begin
  definition := pg_get_functiondef('public.ds_get_global_feed_inventory()'::regprocedure);
  if position(marker in definition) = 0
    or position('case when p.hide_street_address_on_card then null else p.lat end as lat' in definition) = 0
    or position('null::text as geocode_input' in definition) = 0 then
    raise exception 'Unexpected public inventory definition; manual reconciliation required';
  end if;
  execute replace(definition, marker,
    '      public.ds_property_geocode_valid(p.lat,p.lng,p.geocode_status,p.geocode_source,p.geocoded_at) as geocode_valid,' || chr(10) || marker);
end $$;

comment on constraint properties_published_geocode_valid on public.properties is
'Published property cards require validated geocoding. Address privacy still suppresses exact PINs.';

commit;
