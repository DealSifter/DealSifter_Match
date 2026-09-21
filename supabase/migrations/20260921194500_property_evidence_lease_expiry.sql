-- A settled attempt is released by the Edge runtime. Recover only leases from
-- interrupted isolates after a window far longer than the 30-second provider
-- timeout; the conflict update is atomic and preserves single-owner semantics.
create or replace function public.ds_acquire_property_evidence_lease(p_key text, p_token uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare acquired integer;
begin
  insert into public.property_evidence_leases(key, token) values (p_key, p_token)
    on conflict (key) do update
      set token = excluded.token, created_at = now()
      where public.property_evidence_leases.created_at < now() - interval '15 minutes';
  get diagnostics acquired = row_count;
  return acquired = 1;
end;
$$;

revoke all on function public.ds_acquire_property_evidence_lease(text, uuid) from public, anon, authenticated;
grant execute on function public.ds_acquire_property_evidence_lease(text, uuid) to service_role;
comment on table public.property_evidence_leases is
  'Single-flight locks. Settled attempts release their token; abandoned leases can be atomically reclaimed after 15 minutes.';
