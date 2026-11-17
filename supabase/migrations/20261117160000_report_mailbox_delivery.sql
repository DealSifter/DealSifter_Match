-- Gmail mailbox authorization and report delivery, matching the validated staging schema.
-- Private tables: browser roles have no privileges or RLS policies.
-- No mailbox tokens, QA fixtures or delivery records are copied between environments.

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

create table public.report_mail_deliveries (
  delivery_key text primary key check(length(delivery_key)=64),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid not null references public.maxxis_reports(id) on delete cascade,
  property_id uuid not null,
  report_fingerprint text not null,
  recipient_hash text not null,
  attachment_hashes jsonb not null,
  state text not null check(state in ('SENDING','ACCEPTED','FAILED','INDETERMINATE')),
  provider_message_id text,
  http_status integer,
  retry_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.report_mail_deliveries enable row level security;
revoke all on public.report_mail_deliveries from public,anon,authenticated;
grant select,insert,update on public.report_mail_deliveries to service_role;
-- No raw recipients, message bodies, PDF bytes, photos or OAuth tokens in this audit ledger.

alter table public.report_mail_deliveries add column artifact_type text not null default 'SAVED_REPORT';
alter table public.report_mail_deliveries alter column report_id drop not null;
alter table public.report_mail_deliveries add constraint report_mail_delivery_artifact_check check (
  (artifact_type='SAVED_REPORT' and report_id is not null) or
  (artifact_type='PROPERTY_RELEASE' and report_id is null)
);
