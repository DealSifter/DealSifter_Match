-- Persist complete A/B/C scoped profile data for deterministic card rendering.
alter table if exists public.professional_profiles
  add column if not exists profile_payload jsonb not null default '{}'::jsonb;
