-- Let Maxxis reuse the same non-hidden location facts already visible on a
-- published property card. Hidden street addresses and exact coordinates stay
-- private unless the caller owns the property or is an administrator.

drop function if exists public.ds_get_public_property_details(uuid);

create function public.ds_get_public_property_details(p_property_id uuid)
returns table (
  id uuid,
  address text,
  type text,
  city text,
  state text,
  zip text,
  price numeric,
  beds integer,
  baths integer,
  sqft text,
  improvement text,
  lot text,
  deal_tag text,
  objective text,
  rehab numeric,
  cap_rate numeric,
  description text,
  source text,
  latitude double precision,
  longitude double precision,
  markets text[],
  is_active boolean,
  publish_to_showcase boolean,
  deal_closed boolean,
  images text[]
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    p.id,
    case
      when not coalesce(p.hide_street_address_on_card, false)
        or p.owner_id = auth.uid()
        or public.ds_is_current_user_admin()
      then public.ds_sanitize_public_property_text(coalesce(p.address, ''))
      else null
    end,
    p.type,
    p.city,
    p.state,
    p.zip,
    p.price,
    p.beds,
    p.baths,
    p.sqft,
    public.ds_sanitize_public_property_text(coalesce(p.improvement, '')),
    public.ds_sanitize_public_property_text(coalesce(p.lot, '')),
    public.ds_sanitize_public_property_text(coalesce(p.deal_tag, '')),
    public.ds_sanitize_public_property_text(coalesce(p.objective, '')),
    p.rehab,
    p.cap_rate,
    public.ds_sanitize_public_property_text(coalesce(p.description, '')),
    public.ds_sanitize_public_property_text(coalesce(p.source, '')),
    case
      when not coalesce(p.hide_street_address_on_card, false)
        or p.owner_id = auth.uid()
        or public.ds_is_current_user_admin()
      then p.lat
      else null
    end,
    case
      when not coalesce(p.hide_street_address_on_card, false)
        or p.owner_id = auth.uid()
        or public.ds_is_current_user_admin()
      then p.lng
      else null
    end,
    p.markets,
    p.is_active,
    p.publish_to_showcase,
    coalesce(p.deal_closed, false),
    coalesce((
      select array_agg(public_image.image_url order by public_image.sort_order, public_image.id)
      from (
        select pi.id, pi.image_url, pi.sort_order
        from public.property_images pi
        where pi.property_id = p.id
          and pi.image_url ~ '^https://'
          and pi.image_url !~* '/storage/v1/object/sign/'
          and pi.image_url !~* '[?&](token|signature|sig|expires|x-amz-|x-goog-)='
        order by pi.sort_order, pi.id
        limit 12
      ) public_image
    ), array[]::text[])
  from public.properties p
  where (
      auth.uid() is not null
      or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    )
    and p.id = p_property_id
    and coalesce(p.is_active, true) = true
    and coalesce(p.publish_to_showcase, true) = true
    and coalesce(p.deal_closed, false) = false
    and coalesce(p.source, '') <> 'demo_seed_mock';
$$;

alter function public.ds_get_public_property_details(uuid) owner to postgres;
revoke all on function public.ds_get_public_property_details(uuid) from public, anon;
grant execute on function public.ds_get_public_property_details(uuid) to authenticated, service_role;

comment on function public.ds_get_public_property_details(uuid) is
  'Authenticated sanitized lookup for one active, published, open property. Reuses visible location facts while retaining hidden-address privacy and omitting ownership, contact, entitlement, and administrative fields.';
