-- Ensure every authenticated user has a public.users mirror row.
-- Older Auth users can predate the trigger or miss it after provider changes.

insert into public.users (id, email, full_name)
select
  au.id,
  coalesce(nullif(au.email, ''), concat(au.id::text, '@auth.local')) as email,
  coalesce(
    nullif(au.raw_user_meta_data->>'full_name', ''),
    nullif(au.raw_user_meta_data->>'name', ''),
    ''
  ) as full_name
from auth.users au
where not exists (
  select 1
  from public.users pu
  where pu.id = au.id
)
on conflict (id) do nothing;

drop policy if exists users_insert_own on public.users;
create policy users_insert_own on public.users
for insert
with check (id = auth.uid());

