-- Enable realtime INSERT notifications for contact and property unlocks.
-- Duplicate additions are ignored for projects where a table is already in the publication.
do $$
begin
  alter publication supabase_realtime add table public.unlocks;
exception
  when duplicate_object then null;
  when undefined_table then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.property_unlocks;
exception
  when duplicate_object then null;
  when undefined_table then null;
end $$;

