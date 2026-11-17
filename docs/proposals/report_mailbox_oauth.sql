-- REVIEW ONLY: not in supabase/migrations, not applied, no automatic deployment.
-- Target for a future authorized transactional dry-run: staging oqdcnjupquhybwdbeeew.
-- Revised scope: Gmail only. No Azure/Microsoft registration or billing.
begin;
create table public.report_mailbox_oauth_states (
  state_hash text primary key check (length(state_hash) = 43),
  user_id uuid not null references auth.users(id) on delete cascade,
  verifier_encrypted text not null,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
create index report_mailbox_oauth_states_user_idx on public.report_mailbox_oauth_states(user_id);
create table public.report_mailbox_connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider = 'google'),
  mailbox_email text not null,
  provider_subject text not null,
  granted_scopes text[] not null,
  token_encrypted text not null,
  connected_at timestamptz not null,
  expires_at timestamptz not null,
  primary key (user_id, provider)
);
alter table public.report_mailbox_oauth_states enable row level security;
alter table public.report_mailbox_connections enable row level security;
-- Intentionally no browser RLS policies. Only the authenticated Edge endpoint
-- can return selected metadata; neither anon nor authenticated can read tokens.
revoke all on public.report_mailbox_oauth_states from public, anon, authenticated;
revoke all on public.report_mailbox_connections from public, anon, authenticated;
grant select, insert, update, delete on public.report_mailbox_oauth_states to service_role;
grant select, insert, update, delete on public.report_mailbox_connections to service_role;
-- Completing a cancelled/replaced authorization is prohibited, including a callback
-- already waiting on Microsoft when the user disconnects. Atomic state consumption
-- and connection persistence serialize against DELETE used by disconnect/start.
create function public.ds_complete_mailbox_connection(p_state_hash text, p_connection jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_user_id uuid;
begin
  delete from public.report_mailbox_oauth_states
    where state_hash = p_state_hash and claimed_at is not null and expires_at > now()
      and user_id = (p_connection->>'user_id')::uuid
    returning user_id into v_user_id;
  if v_user_id is null then raise exception 'CONSENT_CANCELLED'; end if;
  insert into public.report_mailbox_connections
    (user_id, provider, mailbox_email, provider_subject, granted_scopes, token_encrypted, connected_at, expires_at)
  values (v_user_id, 'google', p_connection->>'mailbox_email', p_connection->>'provider_subject',
    array['openid', 'email', 'https://www.googleapis.com/auth/gmail.send'], p_connection->>'token_encrypted',
    (p_connection->>'connected_at')::timestamptz, (p_connection->>'expires_at')::timestamptz)
  on conflict (user_id, provider) do update set
    mailbox_email = excluded.mailbox_email, provider_subject = excluded.provider_subject,
    granted_scopes = excluded.granted_scopes, token_encrypted = excluded.token_encrypted,
    connected_at = excluded.connected_at, expires_at = excluded.expires_at;
end;
$$;
revoke all on function public.ds_complete_mailbox_connection(text, jsonb) from public, anon, authenticated;
grant execute on function public.ds_complete_mailbox_connection(text, jsonb) to service_role;
-- Dry-run must end with ROLLBACK. Change only upon specific staging approval.
rollback;
