alter table public.property_arv_review_contexts
  add column if not exists rehab_source text null;

alter table public.property_arv_review_contexts
  drop constraint if exists property_arv_review_rehab_source_check;
alter table public.property_arv_review_contexts
  add constraint property_arv_review_rehab_source_check
  check (rehab_source is null or rehab_source in (
    'USER_PROVIDED', 'PROPERTY_APP_VALUE', 'USER_CURATED_REHAB_BENCHMARK_2026'
  ));

comment on column public.property_arv_review_contexts.rehab_source is
  'Provenance of the active deterministic rehab assumption. Benchmark values remain ESTIMATED/LOW confidence.';
