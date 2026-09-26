alter table public.property_arv_review_contexts
  alter column target_condition drop not null;

alter table public.property_arv_review_contexts
  add column if not exists rehab_budget numeric null,
  add column if not exists renovation_scope text null,
  add column if not exists declined_inputs text[] not null default '{}'::text[];

alter table public.property_arv_review_contexts
  drop constraint if exists property_arv_review_rehab_budget_check;
alter table public.property_arv_review_contexts
  add constraint property_arv_review_rehab_budget_check
  check (rehab_budget is null or (rehab_budget >= 0 and rehab_budget <= 1000000000));

alter table public.property_arv_review_contexts
  drop constraint if exists property_arv_review_scope_check;
alter table public.property_arv_review_contexts
  add constraint property_arv_review_scope_check
  check (renovation_scope is null or length(btrim(renovation_scope)) between 1 and 1000);

alter table public.property_arv_review_contexts
  drop constraint if exists property_arv_review_declined_inputs_check;
alter table public.property_arv_review_contexts
  add constraint property_arv_review_declined_inputs_check
  check (declined_inputs <@ array['rehab_budget','target_condition','renovation_scope']::text[]);

comment on column public.property_arv_review_contexts.rehab_budget is
  'Explicit USER_PROVIDED rehabilitation budget used by deterministic Maxxis calculations.';
comment on column public.property_arv_review_contexts.renovation_scope is
  'Explicit USER_PROVIDED renovation scope used as analytical context.';
comment on column public.property_arv_review_contexts.declined_inputs is
  'Inputs the user explicitly declined to provide; prevents repeated report-gate questions.';
