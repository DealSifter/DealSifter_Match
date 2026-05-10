-- Add video column to properties table
alter table public.properties add column if not exists video text;

-- Showcase discovery: allow authenticated users to read active/published properties
drop policy if exists properties_select_showcase on public.properties;
create policy properties_select_showcase on public.properties
for select using (
  is_active = true
  and publish_to_showcase = true
);

-- Showcase: allow reading images of visible properties
drop policy if exists property_images_select_showcase on public.property_images;
create policy property_images_select_showcase on public.property_images
for select using (
  exists (
    select 1 from public.properties p
    where p.id = property_id
      and p.is_active = true
      and p.publish_to_showcase = true
  )
);

-- Showcase: allow reading published services
drop policy if exists services_select_showcase on public.services;
create policy services_select_showcase on public.services
for select using (
  publish_to_connections = true
);

-- Showcase: allow reading basic user profile info for published properties/services
drop policy if exists users_select_showcase on public.users;
create policy users_select_showcase on public.users
for select using (
  exists (
    select 1 from public.properties p
    where p.owner_id = id
      and p.is_active = true
      and p.publish_to_showcase = true
  )
);

drop policy if exists profile_select_showcase on public.user_profiles;
create policy profile_select_showcase on public.user_profiles
for select using (
  visibility = 'public'
);

drop policy if exists professional_profile_select_showcase on public.professional_profiles;
create policy professional_profile_select_showcase on public.professional_profiles
for select using (
  exists (
    select 1 from public.properties p
    where p.owner_id = user_id
      and p.is_active = true
      and p.publish_to_showcase = true
  )
);
