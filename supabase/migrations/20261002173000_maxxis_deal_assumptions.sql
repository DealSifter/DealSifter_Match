alter table public.property_arv_review_contexts
  add column if not exists deal_assumptions jsonb not null default '{}'::jsonb;

alter table public.property_arv_review_contexts
  drop constraint if exists property_arv_review_deal_assumptions_check;
alter table public.property_arv_review_contexts
  add constraint property_arv_review_deal_assumptions_check
  check (jsonb_typeof(deal_assumptions) = 'object' and pg_column_size(deal_assumptions) <= 8192);

comment on column public.property_arv_review_contexts.deal_assumptions is
  'Strategy-specific USER_PROVIDED deal assumptions. Keys are allowlisted by maxxis-analysis-inputs; provider evidence must never be stored here.';
