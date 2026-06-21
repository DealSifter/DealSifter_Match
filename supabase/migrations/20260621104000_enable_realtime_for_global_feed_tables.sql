-- Keep global Feed/Map views fresh across accounts without polling loops.
-- Duplicate additions are ignored for projects where a table is already in the publication.

do $$
begin
  alter publication supabase_realtime add table public.properties;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.property_images;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.services;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.user_profiles;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.professional_profiles;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.card_spotlights;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
