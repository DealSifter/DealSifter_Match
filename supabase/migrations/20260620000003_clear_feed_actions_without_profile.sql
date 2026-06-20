-- A user without any onboarding profile record must not hydrate previous
-- feed selections. This protects recreated/auth-only accounts from showing
-- stale favorites/unlocks before the first profile registration.

delete from public.user_feed_actions ufa
where not exists (
  select 1 from public.user_profiles up where up.user_id = ufa.user_id
)
and not exists (
  select 1 from public.professional_profiles pp where pp.user_id = ufa.user_id
);
