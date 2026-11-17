-- R-3 additive candidate. Do not apply remotely without explicit authorization.
-- Existing RLS and context entitlement policies remain authoritative.
alter table public.property_arv_review_contexts
  add column if not exists analysis_revision bigint not null default 0;

create or replace function public.ds_bump_analysis_revision()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.analysis_revision := case when tg_op = 'INSERT' then 1 else old.analysis_revision + 1 end;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
create trigger ds_analysis_revision_before_write
before insert or update on public.property_arv_review_contexts
for each row execute function public.ds_bump_analysis_revision();

create or replace function public.ds_save_analysis_context_cas(
  p_property_id uuid, p_expected_revision bigint, p_context jsonb
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_row public.property_arv_review_contexts%rowtype;
begin
  if v_user is null or not public.ds_has_maxxis_analysis_context_access(p_property_id) then
    raise exception 'NOT_ENTITLED' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 or jsonb_typeof(p_context) <> 'object'
    or octet_length(p_context::text) > 65536 then
    raise exception 'INVALID_ANALYSIS_CONTEXT' using errcode = '22023';
  end if;
  -- Serialize creation as well as updates for this exact authenticated user/property.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_property_id::text, 0));
  select * into v_row from public.property_arv_review_contexts
    where subject_property_id = p_property_id and reviewer_user_id = v_user for update;
  if coalesce(v_row.analysis_revision, 0) <> p_expected_revision then
    -- A stale application revision is not a transient serialization failure.
    -- PT409 returns immediately; 40001 can trigger PostgREST transaction retries.
    raise exception 'ANALYSIS_REVISION_CONFLICT' using errcode = 'PT409';
  end if;
  insert into public.property_arv_review_contexts
    (subject_property_id, reviewer_user_id, target_condition, rehab_budget, renovation_scope,
     rehab_source, declined_inputs, deal_assumptions, evidence_status, policy_version)
  values
    (p_property_id, v_user, p_context->>'target_condition', (p_context->>'rehab_budget')::numeric,
     p_context->>'renovation_scope', p_context->>'rehab_source',
     array(select jsonb_array_elements_text(coalesce(p_context->'declined_inputs', '[]'::jsonb))),
     coalesce(p_context->'deal_assumptions', '{}'::jsonb), 'USER_PROVIDED', 'MAXXIS_ANALYSIS_INPUTS_V2')
  on conflict (subject_property_id, reviewer_user_id) do update set
    target_condition = excluded.target_condition, rehab_budget = excluded.rehab_budget,
    renovation_scope = excluded.renovation_scope, rehab_source = excluded.rehab_source,
    declined_inputs = excluded.declined_inputs, deal_assumptions = excluded.deal_assumptions,
    evidence_status = excluded.evidence_status, policy_version = excluded.policy_version
  returning * into v_row;
  return to_jsonb(v_row);
end;
$$;
revoke all on function public.ds_save_analysis_context_cas(uuid, bigint, jsonb) from public, anon;
grant execute on function public.ds_save_analysis_context_cas(uuid, bigint, jsonb) to authenticated;
