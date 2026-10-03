-- Allow the strategy-aware evidence families through the existing atomic 45-call usage guard.
-- This changes only the operation allowlist; reservation/finalization and the hard cap remain unchanged.
alter table public.external_provider_usage
  drop constraint if exists external_provider_usage_operation_check;

alter table public.external_provider_usage
  add constraint external_provider_usage_operation_check
  check (operation in (
    'property_lookup',
    'property_value_avm',
    'property_sold_search',
    'sale_listings',
    'rent_estimate',
    'rental_listings',
    'market_data'
  ));
