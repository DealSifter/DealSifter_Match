-- Persist Settings/Profile sections server-side so preferences survive device/session changes.
alter table if exists public.users
  add column if not exists settings_payload jsonb not null default '{}'::jsonb;

