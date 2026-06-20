-- If an auth user was deleted from public.users before the newer cleanup
-- function existed, then later re-created with the same auth.uid, newer tables
-- such as user_feed_actions/property_unlocks may still contain rows created
-- before the new public.users row. Those rows belong to the previous account
-- lifecycle and must not hydrate into the recreated account.

delete from public.user_feed_actions ufa
using public.users u
where ufa.user_id = u.id
  and ufa.created_at < u.created_at;

delete from public.property_unlocks pu
using public.users u
where pu.buyer_id = u.id
  and pu.created_at < u.created_at;

delete from public.property_unlocks pu
using public.users u
where pu.owner_id = u.id
  and pu.created_at < u.created_at;

delete from public.matches m
using public.users u
where m.buyer_id = u.id
  and m.created_at < u.created_at;

delete from public.matches m
using public.users u
where m.seller_id = u.id
  and m.created_at < u.created_at;

delete from public.unlocks ul
using public.users u
where ul.buyer_id = u.id
  and ul.created_at < u.created_at;

delete from public.unlocks ul
using public.users u
where ul.seller_id = u.id
  and ul.created_at < u.created_at;

delete from public.card_spotlights cs
using public.users u
where cs.user_id = u.id
  and cs.starts_at < u.created_at;

delete from public.card_spotlights cs
using public.users u
where cs.owner_id = u.id
  and cs.starts_at < u.created_at;
