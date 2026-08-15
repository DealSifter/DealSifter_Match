-- Phase 5D: enforce new-write invariants without rewriting legacy rows and expose
-- a service-role-only, aggregate, read-only consistency audit.

alter table public.users
  add constraint users_nuggets_nonnegative_check check (nuggets >= 0) not valid;

alter table public.properties
  add constraint properties_nonnegative_values_check
    check (price >= 0 and rehab >= 0 and beds >= 0 and baths >= 0) not valid,
  add constraint properties_primary_profile_check
    check (primary_profile in ('personal', 'professional', 'fsbo')) not valid,
  add constraint properties_coordinates_check
    check (
      (lat is null and lng is null)
      or (lat between -85 and 85 and lng between -180 and 180)
    ) not valid;

alter table public.services
  add constraint services_price_nonnegative_check check (price is null or price >= 0) not valid,
  add constraint services_primary_profile_check
    check (primary_profile in ('personal', 'professional', 'fsbo')) not valid;

alter table public.matches
  add constraint matches_distinct_parties_check check (buyer_id <> seller_id) not valid;

alter table public.chat_messages
  add constraint chat_messages_distinct_parties_check check (sender_id <> recipient_id) not valid;

alter table public.nugget_purchases
  add constraint nugget_purchases_values_check
    check (qty > 0 and bonus >= 0 and price_cents >= 0) not valid;

alter table public.unlocks
  add constraint unlocks_values_check
    check (nuggets_spent >= 0 and buyer_id <> seller_id) not valid;

alter table public.unlock_intents
  add constraint unlock_intents_distinct_parties_check check (buyer_id <> seller_id) not valid;

alter table public.property_unlocks
  add constraint property_unlocks_distinct_parties_check check (buyer_id <> owner_id) not valid;

alter table public.maxxis_pending_actions
  add constraint maxxis_pending_actions_terminal_timestamps_check
    check (
      (status <> 'executed' or (executed_at is not null and cancelled_at is null))
      and (status <> 'cancelled' or (cancelled_at is not null and executed_at is null))
    ) not valid;

alter table public.deal_workflow_items
  add constraint deal_workflow_completed_timestamp_check
    check (status <> 'completed' or completed_at is not null) not valid;

alter table public.subscriptions
  add constraint subscriptions_price_nonnegative_check check (price_cents >= 0) not valid;

create or replace function public.ds_data_integrity_audit()
returns table (
  check_code text,
  severity text,
  issue_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select 'negative_nugget_balance', 'CRITICAL', count(*) from public.users where nuggets < 0
  union all
  select 'invalid_nugget_purchase_values', 'CRITICAL', count(*) from public.nugget_purchases
    where qty <= 0 or bonus < 0 or price_cents < 0
  union all
  select 'completed_purchase_without_stripe_reference', 'HIGH', count(*) from public.nugget_purchases
    where status = 'completed' and stripe_payment_id is null and stripe_checkout_session_id is null
  union all
  select 'invalid_unlock_values', 'CRITICAL', count(*) from public.unlocks
    where nuggets_spent < 0 or buyer_id = seller_id
  union all
  select 'invalid_unlock_intent_parties', 'HIGH', count(*) from public.unlock_intents
    where buyer_id = seller_id
  union all
  select 'unlock_intent_property_owner_mismatch', 'CRITICAL', count(*)
    from public.unlock_intents ui join public.properties p on p.id = ui.property_id
    where ui.property_id is not null and ui.seller_id <> p.owner_id
  union all
  select 'invalid_property_unlock_parties', 'CRITICAL', count(*) from public.property_unlocks
    where buyer_id = owner_id
  union all
  select 'property_unlock_owner_mismatch', 'CRITICAL', count(*)
    from public.property_unlocks pu join public.properties p on p.id = pu.property_id
    where pu.owner_id <> p.owner_id
  union all
  select 'chat_sender_recipient_mismatch', 'HIGH', count(*) from public.chat_messages
    where sender_id = recipient_id
       or (contact_owner_id is not null and contact_owner_id <> recipient_id)
  union all
  select 'pending_action_terminal_timestamp_mismatch', 'HIGH', count(*)
    from public.maxxis_pending_actions
    where (status = 'executed' and (executed_at is null or cancelled_at is not null))
       or (status = 'cancelled' and (cancelled_at is null or executed_at is not null))
  union all
  select 'expired_pending_action', 'WARNING', count(*) from public.maxxis_pending_actions
    where status = 'pending' and expires_at <= now()
  union all
  select 'executed_message_without_result', 'HIGH', count(*) from public.maxxis_pending_actions
    where action_type = 'send_provider_message' and status = 'executed'
      and nullif(payload->>'messageId', '') is null
  union all
  select 'workflow_completion_timestamp_mismatch', 'HIGH', count(*) from public.deal_workflow_items
    where (status = 'completed' and completed_at is null)
       or (status <> 'completed' and completed_at is not null)
  union all
  select 'invalid_property_values', 'HIGH', count(*) from public.properties
    where price < 0 or rehab < 0 or beds < 0 or baths < 0
       or primary_profile not in ('personal', 'professional', 'fsbo')
  union all
  select 'invalid_property_coordinates', 'HIGH', count(*) from public.properties
    where (lat is null) <> (lng is null)
       or lat not between -85 and 85 or lng not between -180 and 180
  union all
  select 'closed_property_public_flags', 'HIGH', count(*) from public.properties
    where deal_closed and is_active and (publish_to_showcase or include_in_preview)
  union all
  select 'invalid_service_values', 'HIGH', count(*) from public.services
    where price < 0 or primary_profile not in ('personal', 'professional', 'fsbo')
  union all
  select 'invalid_match_parties', 'HIGH', count(*) from public.matches where buyer_id = seller_id
  union all
  select 'invalid_profile_version', 'HIGH', count(*) from public.professional_profiles where profile_version < 1
  union all
  select 'invalid_subscription_price', 'HIGH', count(*) from public.subscriptions where price_cents < 0
  union all
  select 'processed_stripe_event_without_timestamp', 'HIGH', count(*) from public.stripe_events_processed
    where status = 'processed' and processed_at is null
  union all
  select 'processed_webhook_without_timestamp', 'HIGH', count(*) from public.stripe_webhook_events
    where status = 'processed' and processed_at is null
  union all
  select 'orphan_property_owner', 'CRITICAL', count(*) from public.properties p
    left join public.users u on u.id = p.owner_id where u.id is null
  union all
  select 'orphan_property_image', 'HIGH', count(*) from public.property_images pi
    left join public.properties p on p.id = pi.property_id where p.id is null
  union all
  select 'orphan_service_owner', 'CRITICAL', count(*) from public.services s
    left join public.users u on u.id = s.owner_id where u.id is null
  union all
  select 'orphan_workflow_reference', 'HIGH', count(*) from public.deal_workflow_items d
    left join public.users u on u.id = d.user_id
    left join public.properties p on p.id = d.property_id
    where u.id is null or p.id is null
  union all
  select 'orphan_chat_reference', 'CRITICAL', count(*) from public.chat_messages c
    left join public.users sender on sender.id = c.sender_id
    left join public.users recipient on recipient.id = c.recipient_id
    where sender.id is null or recipient.id is null
  union all
  select 'orphan_unlock_reference', 'CRITICAL', count(*) from public.unlocks x
    left join public.users buyer on buyer.id = x.buyer_id
    left join public.users seller on seller.id = x.seller_id
    where buyer.id is null or seller.id is null
  order by 2 desc, 1;
$$;

revoke all on function public.ds_data_integrity_audit() from public, anon, authenticated;
grant execute on function public.ds_data_integrity_audit() to service_role;

comment on function public.ds_data_integrity_audit() is
  'Read-only aggregate integrity audit. Returns no PII or row payloads; service-role only.';
