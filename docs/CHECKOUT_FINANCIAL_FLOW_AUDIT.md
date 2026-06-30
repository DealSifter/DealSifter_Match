# Checkout Financial Flow Audit

Last reviewed: 2026-06-30

## Rule

Stripe is the financial source of truth. The browser may start checkout and show optimistic UI, but it must not credit nuggets, update paid plans, or mark paid revenue as completed.

## Flow

1. User clicks a plan or nugget pack in `src/pages/Pricing.jsx`.
2. `src/hooks/useCheckoutFlow.js` stores the pending checkout intent and opens the checkout modal.
3. After terms acceptance, `src/lib/stripeClient.js` calls the `create-checkout-session` Edge Function.
4. `supabase/functions/create-checkout-session/index.ts` validates the authenticated user and maps the selected pack/plan to server-side Stripe price IDs.
5. Stripe hosts the checkout.
6. Browser return only clears pending UI state and triggers profile hydration.
7. `supabase/functions/stripe-webhook/index.ts` processes Stripe events and writes financial state to Supabase.

## Financial Writes

| Operation | Current writer | Classification | Notes |
| --- | --- | --- | --- |
| Nugget pack purchase row in `nugget_purchases` | Stripe webhook | Correct | `checkout.session.completed` with `pack_id`. |
| User nugget balance credit via `credit_nuggets` | Stripe webhook | Correct | Executed only after purchase row insert succeeds. |
| Subscription row in `subscriptions` | Stripe webhook | Correct | `checkout.session.completed` and subscription lifecycle events. |
| User plan update in `users.plan_id` | Stripe webhook | Correct | Browser only rehydrates after return. |
| First-month plan nuggets | Stripe webhook | Correct | Stored as `nugget_purchases` with `pack_id = plan:{planId}`. |
| Checkout started/opened/terms/cancel events in `app_events` | Frontend | Acceptable analytics only | These are behavioral events, not proof of payment or revenue. |
| Checkout completed KPI | DB aggregates | Correct | Paid counts/revenue come from `nugget_purchases` and `subscriptions`, not frontend `checkout_success`. |

## Fixed Risk

`src/App.jsx` had a local `handleSubscriptionChanged` path that could add plan bonus nuggets in the browser if reconnected. It was removed. Plan bonus nuggets now remain webhook-only.

## Idempotency

`stripe_webhook_events` stores each Stripe `event.id`.

Processing rules:

- New event: insert as `processing`, execute financial writes, mark `processed`.
- Duplicate processed event: return `ok` without touching financial state.
- Failed event: mark `failed` and return 500 so Stripe can retry.
- Retry of failed or stale processing event: reclaim and process again.

This prevents duplicate credits or plan updates from repeated webhook deliveries.

## Do Not Reintroduce

Do not call these from frontend checkout return handlers:

- `credit_nuggets`
- direct writes to `nugget_purchases`
- direct writes to paid `subscriptions`
- direct writes to `users.plan_id`
- any revenue KPI that claims payment completion

The frontend should only read fresh state after Stripe returns.

