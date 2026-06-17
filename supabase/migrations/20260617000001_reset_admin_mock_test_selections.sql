-- One-time cleanup requested for production testing:
-- reset feed/mock selections made by admin accounts as buyers/testers.
-- This intentionally does not delete cards, portfolios, nugget purchases,
-- or unlocks made by non-admin users against admin-owned cards.

with admin_users as (
  select id
  from public.users
  where coalesce(is_admin, false) = true
)
delete from public.user_feed_actions ufa
using admin_users au
where ufa.user_id = au.id;

with admin_users as (
  select id
  from public.users
  where coalesce(is_admin, false) = true
)
delete from public.property_unlocks pu
using admin_users au
where pu.buyer_id = au.id;

with admin_users as (
  select id
  from public.users
  where coalesce(is_admin, false) = true
)
delete from public.unlocks u
using admin_users au
where u.buyer_id = au.id;

with admin_users as (
  select id
  from public.users
  where coalesce(is_admin, false) = true
)
delete from public.matches m
using admin_users au
where m.buyer_id = au.id;
