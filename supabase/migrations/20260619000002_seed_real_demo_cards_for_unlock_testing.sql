-- Temporary real demo cards derived from mock showcase data.
-- Purpose: allow production-like testing of unlock/exclusivity/KPI flows with real UUID rows.
-- Guardrails:
-- - No inline media, only external image URLs.
-- - No fake operational events, purchases, or unlocks are inserted here.
-- - Demo rows are clearly marked with source = 'demo_seed_mock'.
-- - Idempotent upserts by deterministic UUID.

with owner_a as (
  select id from public.users where email = 'tarso.canto71@gmail.com' limit 1
), owner_b as (
  select id from public.users where email = 'flavio@vieira.email' limit 1
), demo_properties as (
  select * from (values
    ('10000000-0000-4000-8000-000000000101'::uuid, (select id from owner_a), 'SFR', '1847 S 48th St', 'Phoenix', 'AZ', '85001', 185000::numeric, 3, 2, '1,320', '1,320', '5,500', 'Opportunity', 'Fix&Flip', 45000::numeric, 8.5::numeric, 'Demo seed based on the original mock card. Real DB row for unlock/exclusivity testing.', 33.4124::double precision, -111.9770::double precision, 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=600&q=80'),
    ('10000000-0000-4000-8000-000000000102'::uuid, (select id from owner_a), 'Commercial', '4210 W Thomas Rd', 'Phoenix', 'AZ', '85001', 450000::numeric, 0, 0, '4,800', '4,800', '8,200', 'Seller Financing', 'BRRRR', 120000::numeric, 7.2::numeric, 'Demo commercial card for portfolio-size unlock testing.', 33.4802::double precision, -112.1539::double precision, 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80'),
    ('10000000-0000-4000-8000-000000000103'::uuid, (select id from owner_a), 'Office', '101 Central Ave', 'Phoenix', 'AZ', '85001', 640000::numeric, 0, 2, '5,400', '5,400', '8,800', 'BRRRR', 'BRRRR', 40000::numeric, 7.1::numeric, 'Demo office card to validate linked contact portfolio costs.', 33.4484::double precision, -112.0740::double precision, 'https://images.unsplash.com/photo-1505842465776-3d7b3bf5f5b3?auto=format&fit=crop&w=800&q=80'),
    ('10000000-0000-4000-8000-000000000104'::uuid, (select id from owner_a), 'SFR', '9821 N 7th Ave', 'Phoenix', 'AZ', '85001', 195000::numeric, 3, 1, '1,100', '1,100', '6,200', 'Opportunity', 'Fix&Flip', 55000::numeric, 9.2::numeric, 'Demo SFR card for exclusive contact tests.', 33.5663::double precision, -112.0832::double precision, 'https://images.unsplash.com/photo-1480074568708-e7b720bb3f09?auto=format&fit=crop&w=600&q=80'),
    ('10000000-0000-4000-8000-000000000201'::uuid, (select id from owner_b), 'Multifamily', '2805 Elm Street', 'Dallas', 'TX', '75201', 890000::numeric, 12, 8, '8,500', '8,500', '12,000', 'FSBO', 'Multifamily', 25000::numeric, 9.1::numeric, 'Demo multifamily row owned by a second real user.', 32.7835::double precision, -96.8071::double precision, 'https://images.unsplash.com/photo-1545324418-cc4dc20c7474?auto=format&fit=crop&w=600&q=80'),
    ('10000000-0000-4000-8000-000000000202'::uuid, (select id from owner_b), 'Office', '3701 McKinney Ave', 'Dallas', 'TX', '75201', 650000::numeric, 0, 0, '5,600', '5,600', '9,400', 'Seller Financing', 'BRRRR', 35000::numeric, 7.8::numeric, 'Demo office portfolio card for second-owner tests.', 32.8126::double precision, -96.7878::double precision, 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=600&q=80'),
    ('10000000-0000-4000-8000-000000000203'::uuid, (select id from owner_b), 'SFR', '88 Desert Bloom Rd', 'Phoenix', 'AZ', '85001', 175000::numeric, 3, 1, '1,100', '1,100', '6,000', 'Opportunity', 'Fix&Flip', 35000::numeric, 9.0::numeric, 'Demo quick flip near downtown with good comps.', 33.4484::double precision, -112.0740::double precision, 'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=800&q=80'),
    ('10000000-0000-4000-8000-000000000204'::uuid, (select id from owner_b), 'Land', 'LOT 4, Industrial Park', 'Las Vegas', 'NV', '89101', 380000::numeric, 0, 0, '2.5 ac', '0', '2.5 ac', 'FSBO', 'SUB-TO', 0::numeric, 12.1::numeric, 'Demo industrial land card with owner financing assumptions.', 36.1216::double precision, -115.1739::double precision, 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=600&q=80')
  ) as v(id, owner_id, type, address, city, state, zip, price, beds, baths, sqft, improvement, lot, deal_tag, objective, rehab, cap_rate, description, lat, lng, image_url)
  where owner_id is not null
), upserted as (
  insert into public.properties (
    id, owner_id, type, address, city, state, zip, price, beds, baths, sqft,
    improvement, lot, deal_tag, objective, rehab, cap_rate, description, markets,
    is_active, publish_to_showcase, include_in_preview, source, owner_account_type,
    primary_profile, lat, lng, geocode_status, geocode_source, geocode_confidence,
    geocode_input, geocoded_at, updated_at
  )
  select
    id, owner_id, type, address, city, state, zip, price, beds, baths, sqft,
    improvement, lot, deal_tag, objective, rehab, cap_rate, description, array[state],
    true, true, true, 'demo_seed_mock', 'professional',
    'professional', lat, lng, 'resolved', 'demo_seed', 1.0,
    concat_ws(', ', address, city, state, zip), now(), now()
  from demo_properties
  on conflict (id) do update set
    owner_id = excluded.owner_id,
    type = excluded.type,
    address = excluded.address,
    city = excluded.city,
    state = excluded.state,
    zip = excluded.zip,
    price = excluded.price,
    beds = excluded.beds,
    baths = excluded.baths,
    sqft = excluded.sqft,
    improvement = excluded.improvement,
    lot = excluded.lot,
    deal_tag = excluded.deal_tag,
    objective = excluded.objective,
    rehab = excluded.rehab,
    cap_rate = excluded.cap_rate,
    description = excluded.description,
    markets = excluded.markets,
    is_active = true,
    publish_to_showcase = true,
    include_in_preview = true,
    source = 'demo_seed_mock',
    lat = excluded.lat,
    lng = excluded.lng,
    geocode_status = excluded.geocode_status,
    geocode_source = excluded.geocode_source,
    geocode_confidence = excluded.geocode_confidence,
    geocode_input = excluded.geocode_input,
    geocoded_at = excluded.geocoded_at,
    updated_at = now()
  returning id
)
insert into public.property_images (property_id, image_url, sort_order)
select p.id, p.image_url, 0
from demo_properties p
where not exists (
  select 1 from public.property_images pi
  where pi.property_id = p.id
    and pi.image_url = p.image_url
);

insert into public.user_profiles (user_id, full_name, bio, visibility)
select u.id, coalesce(u.full_name, 'Demo Seller'), 'Demo seller profile for DealSifter production-flow testing.', 'public'
from public.users u
where u.email in ('tarso.canto71@gmail.com', 'flavio@vieira.email')
on conflict (user_id) do nothing;

insert into public.professional_profiles (user_id, category, subcategory, markets, skills, services, pitch, primary_category)
select u.id, 'investor', null, array['AZ','TX','NV'], array['Off-Market','Fix & Flip','BRRRR'], array[]::text[], 'Demo professional card for DealSifter production-flow testing.', 'investor'
from public.users u
where u.email in ('tarso.canto71@gmail.com', 'flavio@vieira.email')
on conflict (user_id) do nothing;
