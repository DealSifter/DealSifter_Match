-- R-1.3: additive audit metadata only. Existing rows are not backfilled.
alter table public.external_provider_usage
  add column request_id uuid null,
  add column report_id uuid null,
  add column origin text null check (origin in ('user','test','validation','system')),
  add column evidence_outcome text null check (evidence_outcome in ('ACCEPTED','IDENTITY_REJECTED','NOT_FOUND','EMPTY'));
alter table public.maxxis_provider_budget_usage
  add column request_id uuid null,
  add column report_id uuid null,
  add column origin text null check (origin in ('user','test','validation','system')),
  add column evidence_outcome text null check (evidence_outcome in ('ACCEPTED','IDENTITY_REJECTED','NOT_FOUND','EMPTY'));
-- Setting defaults afterwards leaves historical rows NULL.
alter table public.external_provider_usage alter column origin set default 'system';
alter table public.maxxis_provider_budget_usage alter column origin set default 'system';
create index external_provider_usage_report_id_idx on public.external_provider_usage (report_id) where report_id is not null;
create index maxxis_provider_budget_usage_report_id_idx on public.maxxis_provider_budget_usage (report_id) where report_id is not null;

create function public.ds_annotate_provider_attempt(
  p_usage_id uuid, p_budget_usage_id uuid, p_request_id uuid, p_report_id uuid,
  p_origin text, p_evidence_outcome text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if p_request_id is null or p_origin is null or p_origin not in ('user','test','validation','system')
    or p_evidence_outcome is not null and p_evidence_outcome not in ('ACCEPTED','IDENTITY_REJECTED','NOT_FOUND','EMPTY')
    then raise exception 'INVALID_PROVIDER_TRACE'; end if;
  if p_usage_id is not null then
    update public.external_provider_usage set
      origin = case when request_id is null then p_origin else origin end,
      request_id = coalesce(request_id,p_request_id), report_id = coalesce(report_id,p_report_id),
      evidence_outcome = coalesce(evidence_outcome,p_evidence_outcome)
    where id=p_usage_id and (request_id is null or request_id=p_request_id)
      and (report_id is null or report_id is not distinct from p_report_id);
    if not found then raise exception 'PROVIDER_TRACE_ATTEMPT_NOT_FOUND'; end if;
  end if;
  if p_budget_usage_id is not null then
    update public.maxxis_provider_budget_usage set
      origin = case when request_id is null then p_origin else origin end,
      request_id = coalesce(request_id,p_request_id), report_id = coalesce(report_id,p_report_id),
      evidence_outcome = coalesce(evidence_outcome,p_evidence_outcome)
    where id=p_budget_usage_id and (request_id is null or request_id=p_request_id)
      and (report_id is null or report_id is not distinct from p_report_id);
    if not found then raise exception 'PROVIDER_TRACE_BUDGET_NOT_FOUND'; end if;
  end if;
end;
$$;
revoke all on function public.ds_annotate_provider_attempt(uuid,uuid,uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.ds_annotate_provider_attempt(uuid,uuid,uuid,uuid,text,text) to service_role;
