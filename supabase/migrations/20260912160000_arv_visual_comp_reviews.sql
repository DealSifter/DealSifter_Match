create table if not exists public.property_arv_review_contexts (
  subject_property_id uuid not null references public.properties(id) on delete cascade,
  reviewer_user_id uuid not null references auth.users(id) on delete cascade,
  target_condition text not null,
  evidence_status text not null default 'USER_PROVIDED',
  policy_version text not null default 'ARV_VISUAL_COMP_REVIEW_V1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (subject_property_id, reviewer_user_id),
  constraint property_arv_review_target_condition_check check (target_condition in (
    'AS_IS','LIGHT_REHAB','STANDARD_RENOVATION','FULL_RENOVATION',
    'HIGH_END','TURN_KEY','NEW_CONSTRUCTION','UNKNOWN'
  )),
  constraint property_arv_review_context_evidence_check check (evidence_status = 'USER_PROVIDED')
);

create table if not exists public.property_comp_condition_reviews (
  id uuid primary key default gen_random_uuid(),
  subject_property_id uuid not null references public.properties(id) on delete cascade,
  reviewer_user_id uuid not null references auth.users(id) on delete cascade,
  comp_identifier text not null,
  target_condition text not null,
  observed_condition text not null,
  condition_compatibility text not null,
  notes text null,
  evidence_status text not null default 'USER_PROVIDED',
  reviewed_at timestamptz not null default now(),
  policy_version text not null default 'ARV_VISUAL_COMP_REVIEW_V1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_comp_review_identifier_check check (length(btrim(comp_identifier)) between 1 and 500),
  constraint property_comp_review_target_condition_check check (target_condition in (
    'AS_IS','LIGHT_REHAB','STANDARD_RENOVATION','FULL_RENOVATION',
    'HIGH_END','TURN_KEY','NEW_CONSTRUCTION','UNKNOWN'
  )),
  constraint property_comp_review_observed_condition_check check (observed_condition in (
    'AS_IS','LIGHT_REHAB','STANDARD_RENOVATION','FULL_RENOVATION',
    'HIGH_END','TURN_KEY','NEW_CONSTRUCTION','UNKNOWN'
  )),
  constraint property_comp_review_compatibility_check check (condition_compatibility in (
    'MATCHES_TARGET','PARTIAL_MATCH','SUPERIOR_TO_TARGET','INFERIOR_TO_TARGET',
    'DIFFERENT_PRODUCT_CLASS','NOT_COMPARABLE','UNKNOWN'
  )),
  constraint property_comp_review_notes_check check (notes is null or length(notes) <= 1000),
  constraint property_comp_review_evidence_check check (evidence_status = 'USER_PROVIDED'),
  constraint property_comp_review_unique unique (subject_property_id, reviewer_user_id, comp_identifier)
);

alter table public.property_arv_review_contexts enable row level security;
alter table public.property_comp_condition_reviews enable row level security;

create index if not exists idx_property_comp_reviews_subject_reviewer
  on public.property_comp_condition_reviews(subject_property_id, reviewer_user_id);

drop policy if exists property_arv_review_contexts_select_own on public.property_arv_review_contexts;
create policy property_arv_review_contexts_select_own on public.property_arv_review_contexts
  for select to authenticated
  using (reviewer_user_id = auth.uid()
    and public.ds_has_property_intelligence_entitlement(subject_property_id, 'property_record'));
drop policy if exists property_arv_review_contexts_insert_own on public.property_arv_review_contexts;
create policy property_arv_review_contexts_insert_own on public.property_arv_review_contexts
  for insert to authenticated
  with check (reviewer_user_id = auth.uid()
    and public.ds_has_property_intelligence_entitlement(subject_property_id, 'property_record'));
drop policy if exists property_arv_review_contexts_update_own on public.property_arv_review_contexts;
create policy property_arv_review_contexts_update_own on public.property_arv_review_contexts
  for update to authenticated
  using (reviewer_user_id = auth.uid()
    and public.ds_has_property_intelligence_entitlement(subject_property_id, 'property_record'))
  with check (reviewer_user_id = auth.uid()
    and public.ds_has_property_intelligence_entitlement(subject_property_id, 'property_record'));

drop policy if exists property_comp_condition_reviews_select_own on public.property_comp_condition_reviews;
create policy property_comp_condition_reviews_select_own on public.property_comp_condition_reviews
  for select to authenticated
  using (reviewer_user_id = auth.uid()
    and public.ds_has_property_intelligence_entitlement(subject_property_id, 'property_record'));
drop policy if exists property_comp_condition_reviews_insert_own on public.property_comp_condition_reviews;
create policy property_comp_condition_reviews_insert_own on public.property_comp_condition_reviews
  for insert to authenticated
  with check (reviewer_user_id = auth.uid()
    and public.ds_has_property_intelligence_entitlement(subject_property_id, 'property_record'));
drop policy if exists property_comp_condition_reviews_update_own on public.property_comp_condition_reviews;
create policy property_comp_condition_reviews_update_own on public.property_comp_condition_reviews
  for update to authenticated
  using (reviewer_user_id = auth.uid()
    and public.ds_has_property_intelligence_entitlement(subject_property_id, 'property_record'))
  with check (reviewer_user_id = auth.uid()
    and public.ds_has_property_intelligence_entitlement(subject_property_id, 'property_record'));

grant select, insert, update on public.property_arv_review_contexts to authenticated;
grant select, insert, update on public.property_comp_condition_reviews to authenticated;
revoke all on public.property_arv_review_contexts from anon;
revoke all on public.property_comp_condition_reviews from anon;

do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.property_arv_review_contexts'::regclass
    and tgname = 'trg_property_arv_review_contexts_updated_at' and not tgisinternal) then
    create trigger trg_property_arv_review_contexts_updated_at before update on public.property_arv_review_contexts
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.property_comp_condition_reviews'::regclass
    and tgname = 'trg_property_comp_condition_reviews_updated_at' and not tgisinternal) then
    create trigger trg_property_comp_condition_reviews_updated_at before update on public.property_comp_condition_reviews
      for each row execute function public.set_updated_at();
  end if;
end;
$$;

comment on table public.property_arv_review_contexts is
  'User-provided target condition for visual comp review; never a calculated valuation.';
comment on table public.property_comp_condition_reviews is
  'Idempotent USER_PROVIDED visual condition reviews for stable external sold-comp identifiers.';
