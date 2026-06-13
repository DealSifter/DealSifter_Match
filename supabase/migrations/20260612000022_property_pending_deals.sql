alter table public.properties
  add column if not exists deal_closed boolean not null default false;

alter table public.properties
  add column if not exists pending_deal boolean not null default false;

alter table public.properties
  add column if not exists pending_deal_started_at timestamptz;

alter table public.properties
  add column if not exists pending_deal_expires_at timestamptz;

create index if not exists idx_properties_owner_deal_closed
  on public.properties(owner_id, deal_closed);

create index if not exists idx_properties_pending_deal_expires
  on public.properties(owner_id, pending_deal, pending_deal_expires_at);
