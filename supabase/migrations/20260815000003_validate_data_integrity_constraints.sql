-- Phase 5D staging validation: no data rewrite. This intentionally fails closed if
-- a future target has legacy violations; run ds_data_integrity_audit() before promotion.

alter table public.users validate constraint users_nuggets_nonnegative_check;
alter table public.properties validate constraint properties_nonnegative_values_check;
alter table public.properties validate constraint properties_primary_profile_check;
alter table public.properties validate constraint properties_coordinates_check;
alter table public.services validate constraint services_price_nonnegative_check;
alter table public.services validate constraint services_primary_profile_check;
alter table public.matches validate constraint matches_distinct_parties_check;
alter table public.chat_messages validate constraint chat_messages_distinct_parties_check;
alter table public.nugget_purchases validate constraint nugget_purchases_values_check;
alter table public.unlocks validate constraint unlocks_values_check;
alter table public.unlock_intents validate constraint unlock_intents_distinct_parties_check;
alter table public.property_unlocks validate constraint property_unlocks_distinct_parties_check;
alter table public.maxxis_pending_actions validate constraint maxxis_pending_actions_terminal_timestamps_check;
alter table public.deal_workflow_items validate constraint deal_workflow_completed_timestamp_check;
alter table public.subscriptions validate constraint subscriptions_price_nonnegative_check;
