-- Additive, not applied by this phase. Service-role only. No provider calls.
create table if not exists public.property_evidence_leases (
  key text primary key check (key ~ '^[0-9a-f-]{36}$'),
  token uuid not null,
  created_at timestamptz not null default now()
);
alter table public.property_evidence_leases enable row level security;
revoke all on public.property_evidence_leases from public, anon, authenticated;

create or replace function public.ds_acquire_property_evidence_lease(p_key text, p_token uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare acquired integer;
begin
  insert into public.property_evidence_leases(key,token) values(p_key,p_token)
    on conflict (key) do nothing;
  get diagnostics acquired = row_count;
  return acquired = 1;
end;
$$;
create or replace function public.ds_release_property_evidence_lease(p_key text, p_token uuid)
returns void language sql security definer set search_path = public, pg_temp as $$
  delete from public.property_evidence_leases where key=p_key and token=p_token;
$$;
revoke all on function public.ds_acquire_property_evidence_lease(text,uuid) from public, anon, authenticated;
revoke all on function public.ds_release_property_evidence_lease(text,uuid) from public, anon, authenticated;
grant execute on function public.ds_acquire_property_evidence_lease(text,uuid) to service_role;
grant execute on function public.ds_release_property_evidence_lease(text,uuid) to service_role;
comment on table public.property_evidence_leases is
  'Single-flight locks. Failed/abandoned work requires explicit operator reconciliation; no automatic takeover may duplicate an uncertain provider request.';
