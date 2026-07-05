-- Keep plan/nugget access in sync immediately after paid or admin-granted upgrades.
do $$
begin
  alter publication supabase_realtime add table public.users;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
