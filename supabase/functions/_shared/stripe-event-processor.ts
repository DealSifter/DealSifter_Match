import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
if (!stripeSecretKey) throw new Error('Missing STRIPE_SECRET_KEY');

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-04-10',
});

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const PACK_CREDITS: Record<string, { qty: number; bonus: number; price_cents: number }> = {
  p5: { qty: 5, bonus: 0, price_cents: 900 },
  p15: { qty: 15, bonus: 2, price_cents: 1900 },
  p40: { qty: 40, bonus: 8, price_cents: 3900 },
  p100: { qty: 100, bonus: 25, price_cents: 7900 },
};

const PLAN_NAMES: Record<string, string> = {
  pro: 'Professional',
  enterprise: 'Enterprise',
};

const PLAN_BASE_NUGGETS: Record<string, number> = {
  pro: 20,
  enterprise: 60,
};

const PLAN_FIRST_MONTH_BONUS: Record<string, number> = {
  pro: 3,
  enterprise: 20,
};

const WEBHOOK_PROCESSING_STALE_MS = 5 * 60 * 1000;
const DELETE_REPROCESS_DELAY_SECONDS = 30;
const MAX_REPROCESS_ATTEMPTS = 3;

type ProcessingResult = {
  processed: boolean;
  skipReason?: string | null;
};

type QueueRow = {
  stripe_event_id: string;
  event_type: string;
  raw_event: Stripe.Event | null;
  attempts: number;
  scheduled_for?: string | null;
};

function normalizeBillingCycle(value?: string | null) {
  return String(value ?? '').trim().toLowerCase() === 'annual' ? 'annual' : 'monthly';
}

function planNameWithCycle(planId: string, billingCycle?: string | null) {
  const baseName = PLAN_NAMES[planId] ?? planId;
  return normalizeBillingCycle(billingCycle) === 'annual' ? `${baseName} Annual` : baseName;
}

function toIso(tsSeconds?: number | null) {
  return tsSeconds ? new Date(tsSeconds * 1000).toISOString() : null;
}

function normalizeSubscriptionStatus(status?: string | null) {
  if (!status) return 'active';
  if (status === 'incomplete_expired') return 'canceled';
  return status;
}

function safeMessage(err: unknown) {
  return String((err as Error)?.message ?? err ?? 'Unknown Stripe processing error').slice(0, 2000);
}

async function logStripeEventReceived(event: Stripe.Event) {
  const { data, error } = await supabaseAdmin
    .from('stripe_events_log')
    .insert({
      event_id: event.id,
      event_type: event.type,
      received_at: new Date().toISOString(),
      processed: false,
    })
    .select('id')
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

async function logStripeQueueError(eventId: string, eventType: string, message: string) {
  const { error } = await supabaseAdmin
    .from('stripe_events_log')
    .insert({
      event_id: eventId,
      event_type: eventType || 'stripe.event',
      received_at: new Date().toISOString(),
      processed: false,
      skip_reason: message.slice(0, 2000),
    });
  if (error) throw error;
}

async function finishStripeEventLog(logId: number | null, processed: boolean, skipReason?: string | null) {
  if (!logId) return;
  const { error } = await supabaseAdmin
    .from('stripe_events_log')
    .update({
      processed,
      skip_reason: skipReason ?? null,
    })
    .eq('id', logId);
  if (error) throw error;
}

async function claimStripeEventForProcessing(event: Stripe.Event) {
  const { data, error } = await supabaseAdmin
    .from('stripe_events_processed')
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
      first_received_at: new Date().toISOString(),
      status: 'claimed',
      updated_at: new Date().toISOString(),
    })
    .select('stripe_event_id')
    .maybeSingle();

  if (!error && data?.stripe_event_id) {
    await claimLegacyStripeEvent(event);
    return true;
  }

  if (error?.code === '23505') return false;
  if (error) throw error;
  return false;
}

async function claimLegacyStripeEvent(event: Stripe.Event) {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - WEBHOOK_PROCESSING_STALE_MS).toISOString();

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('stripe_webhook_events')
    .insert({
      event_id: event.id,
      event_type: event.type,
      status: 'processing',
      attempts: 1,
      received_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .select('event_id')
    .maybeSingle();

  if (!insertError && inserted?.event_id) return true;
  if (insertError && insertError.code !== '23505') throw insertError;

  const { data: existing, error: readError } = await supabaseAdmin
    .from('stripe_webhook_events')
    .select('status, updated_at')
    .eq('event_id', event.id)
    .maybeSingle();

  if (readError) throw readError;
  if (!existing) return false;
  if (existing.status === 'processed') return false;

  const isFailed = existing.status === 'failed';
  const isStaleProcessing = existing.status === 'processing'
    && String(existing.updated_at || '') < staleBefore;

  if (!isFailed && !isStaleProcessing) return false;

  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('stripe_webhook_events')
    .update({
      status: 'processing',
      last_error: null,
      updated_at: now.toISOString(),
    })
    .eq('event_id', event.id)
    .neq('status', 'processed')
    .select('event_id')
    .maybeSingle();

  if (claimError) throw claimError;
  if (!claimed?.event_id) return false;

  await supabaseAdmin
    .rpc('increment_stripe_webhook_attempts', { p_event_id: event.id })
    .then(() => null)
    .catch(() => null);
  return true;
}

export async function markStripeEventFailed(eventId: string, message: string) {
  if (!eventId) return;
  await supabaseAdmin
    .from('stripe_events_processed')
    .update({
      status: 'failed',
      skip_reason: message.slice(0, 2000),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_event_id', eventId);

  await supabaseAdmin
    .from('stripe_webhook_events')
    .update({
      status: 'failed',
      last_error: message.slice(0, 2000),
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId);
}

async function markStripeEventProcessed(eventId: string, result: ProcessingResult = { processed: true }) {
  const status = result.processed ? 'processed' : (result.skipReason === 'subscription_delete_queued' ? 'queued' : 'skipped');
  const { error: processedError } = await supabaseAdmin
    .from('stripe_events_processed')
    .update({
      status,
      processed_at: result.processed ? new Date().toISOString() : null,
      skip_reason: result.skipReason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_event_id', eventId);
  if (processedError) throw processedError;

  const { error } = await supabaseAdmin
    .from('stripe_webhook_events')
    .update({
      status: 'processed',
      processed_at: result.processed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
      last_error: result.skipReason ?? null,
    })
    .eq('event_id', eventId);
  if (error) throw error;
}

async function processStripeEvent(event: Stripe.Event, options: { fromQueue?: boolean } = {}): Promise<ProcessingResult> {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      return { processed: true };

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      return await syncSubscription(event.data.object as Stripe.Subscription);

    case 'customer.subscription.deleted':
      return await markSubscriptionCanceled(event.data.object as Stripe.Subscription, event, Boolean(options.fromQueue));

    default:
      return { processed: false, skipReason: 'unsupported_event_type' };
  }
}

async function queueSubscriptionDelete(event: Stripe.Event) {
  const scheduledFor = new Date(Date.now() + DELETE_REPROCESS_DELAY_SECONDS * 1000).toISOString();
  const { error } = await supabaseAdmin
    .from('stripe_event_reprocess_queue')
    .upsert({
      stripe_event_id: event.id,
      event_type: event.type,
      raw_event: event,
      available_at: scheduledFor,
      scheduled_for: scheduledFor,
      status: 'pending',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'stripe_event_id' });

  if (error) throw error;
}

async function markQueuedEventDone(eventId: string, status: 'processed' | 'skipped', reason?: string | null) {
  const { error } = await supabaseAdmin
    .from('stripe_event_reprocess_queue')
    .update({
      status,
      last_error: reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_event_id', eventId);
  if (error) throw error;

  await supabaseAdmin
    .from('stripe_events_processed')
    .update({
      status,
      processed_at: status === 'processed' ? new Date().toISOString() : null,
      skip_reason: reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_event_id', eventId);

  await supabaseAdmin
    .from('stripe_events_log')
    .update({
      processed: status === 'processed',
      skip_reason: status === 'processed' ? null : reason ?? null,
    })
    .eq('event_id', eventId);
}

async function markQueuedEventRetryOrFailed(row: QueueRow, message: string) {
  const finalFailure = Number(row.attempts || 0) >= MAX_REPROCESS_ATTEMPTS;
  const nextScheduledFor = new Date(Date.now() + DELETE_REPROCESS_DELAY_SECONDS * 1000).toISOString();
  const { error } = await supabaseAdmin
    .from('stripe_event_reprocess_queue')
    .update({
      status: finalFailure ? 'failed' : 'pending',
      last_error: message.slice(0, 2000),
      scheduled_for: finalFailure ? row.scheduled_for ?? new Date().toISOString() : nextScheduledFor,
      available_at: finalFailure ? row.scheduled_for ?? new Date().toISOString() : nextScheduledFor,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_event_id', row.stripe_event_id);
  if (error) throw error;

  await supabaseAdmin
    .from('stripe_events_processed')
    .update({
      status: finalFailure ? 'failed' : 'queued',
      skip_reason: message.slice(0, 2000),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_event_id', row.stripe_event_id);

  await logStripeQueueError(row.stripe_event_id, row.event_type, message);
}

export async function processQueuedStripeEvents(limit = 10) {
  const { data, error } = await supabaseAdmin.rpc('claim_stripe_reprocess_queue', {
    p_limit: limit,
  });
  if (error) throw error;

  const rows = (Array.isArray(data) ? data : []) as QueueRow[];
  const summary = {
    claimed: rows.length,
    processed: 0,
    failed: 0,
    retried: 0,
    skipped: 0,
    errors: [] as Array<{ eventId: string; message: string }>,
  };

  for (const row of rows) {
    try {
      const event = row.raw_event as Stripe.Event | null;
      if (!event?.id || !event.type) {
        await markQueuedEventRetryOrFailed(row, 'Queued Stripe event payload is missing or invalid');
        if (Number(row.attempts || 0) >= MAX_REPROCESS_ATTEMPTS) summary.failed += 1;
        else summary.retried += 1;
        continue;
      }

      const result = await processStripeEvent(event, { fromQueue: true });
      if (result.processed) {
        await markQueuedEventDone(row.stripe_event_id, 'processed', null);
        summary.processed += 1;
      } else if (result.skipReason === 'unsupported_event_type' || result.skipReason === 'out_of_order_subscription_delete') {
        await markQueuedEventDone(row.stripe_event_id, 'skipped', result.skipReason);
        summary.skipped += 1;
      } else {
        const message = result.skipReason || 'Queued Stripe event could not be processed yet';
        await markQueuedEventRetryOrFailed(row, message);
        if (Number(row.attempts || 0) >= MAX_REPROCESS_ATTEMPTS) summary.failed += 1;
        else summary.retried += 1;
      }
    } catch (err) {
      const message = safeMessage(err);
      await markQueuedEventRetryOrFailed(row, message);
      summary.errors.push({ eventId: row.stripe_event_id, message });
      if (Number(row.attempts || 0) >= MAX_REPROCESS_ATTEMPTS) summary.failed += 1;
      else summary.retried += 1;
    }
  }

  return summary;
}

export async function processVerifiedStripeWebhookEvent(event: Stripe.Event) {
  const logId = await logStripeEventReceived(event);
  const shouldProcess = await claimStripeEventForProcessing(event);
  if (!shouldProcess) {
    await finishStripeEventLog(logId, false, 'duplicate_event');
    return { processed: false, skipReason: 'duplicate_event' };
  }

  await processQueuedStripeEvents(5);
  const result = await processStripeEvent(event);
  await finishStripeEventLog(logId, result.processed, result.skipReason ?? null);
  await markStripeEventProcessed(event.id, result);
  return result;
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  const packId = session.metadata?.pack_id;
  const planId = session.metadata?.plan_id;

  if (!userId) {
    console.warn('Missing user_id metadata in checkout session:', session.id);
    return;
  }

  if (planId) {
    const billingCycle = normalizeBillingCycle(session.metadata?.billing_cycle);
    const subscription =
      typeof session.subscription === 'string'
        ? await stripe.subscriptions.retrieve(session.subscription)
        : null;

    await upsertSubscription({
      userId,
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
      stripeSubId: typeof session.subscription === 'string' ? session.subscription : null,
      planId,
      planName: planNameWithCycle(planId, billingCycle),
      priceCents: session.amount_total ?? 0,
      status: normalizeSubscriptionStatus(subscription?.status ?? 'active'),
      currentPeriodStart: toIso(subscription?.current_period_start),
      currentPeriodEnd: toIso(subscription?.current_period_end),
    });

    await updateUserPlan(userId, planId);
    await creditPlanNuggetsOnce(userId, planId, session.id);
    return;
  }

  if (packId) {
    await recordNuggetPurchase(session, userId, packId);
  }
}

async function recordNuggetPurchase(session: Stripe.Checkout.Session, userId: string, packId: string) {
  const pack = PACK_CREDITS[packId];
  if (!pack) {
    console.warn('Unknown pack_id:', packId);
    return;
  }

  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;

  const { error: insertErr } = await supabaseAdmin
    .from('nugget_purchases')
    .insert({
      user_id: userId,
      stripe_payment_id: paymentIntentId ?? session.id,
      stripe_checkout_session_id: session.id,
      pack_id: packId,
      qty: pack.qty,
      bonus: pack.bonus,
      price_cents: pack.price_cents,
      status: 'completed',
    });

  if (insertErr) {
    if (insertErr.code === '23505') return;
    throw insertErr;
  }

  const { error: creditErr } = await supabaseAdmin.rpc('credit_nuggets', {
    p_user_id: userId,
    p_amount: pack.qty + pack.bonus,
  });

  if (creditErr) throw creditErr;
}

async function syncSubscription(subscription: Stripe.Subscription): Promise<ProcessingResult> {
  const userId = subscription.metadata?.user_id;
  const planId = subscription.metadata?.plan_id;
  const currentPeriodStart = toIso(subscription.current_period_start);
  const billingCycle = normalizeBillingCycle(
    subscription.metadata?.billing_cycle
      ?? (subscription.items.data[0]?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly'),
  );

  if (!userId || !planId) {
    console.warn('Subscription missing app metadata:', subscription.id);
    return { processed: false, skipReason: 'subscription_missing_metadata' };
  }

  const ordering = await getSubscriptionOrderingState(subscription.id, userId);
  if (isOlderSubscriptionEvent(currentPeriodStart, ordering.currentPeriodStart)) {
    return { processed: false, skipReason: 'out_of_order_subscription_event' };
  }

  await upsertSubscription({
    userId,
    stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : null,
    stripeSubId: subscription.id,
    planId,
    planName: planNameWithCycle(planId, billingCycle),
    priceCents: subscription.items.data[0]?.price?.unit_amount ?? 0,
    status: normalizeSubscriptionStatus(subscription.status),
    currentPeriodStart,
    currentPeriodEnd: toIso(subscription.current_period_end),
  });

  await updateUserPlan(userId, subscription.status === 'canceled' ? 'free' : planId);
  return { processed: true };
}

async function markSubscriptionCanceled(
  subscription: Stripe.Subscription,
  event?: Stripe.Event,
  fromQueue = false,
): Promise<ProcessingResult> {
  const userId = subscription.metadata?.user_id;
  const currentPeriodStart = toIso(subscription.current_period_start);
  const ordering = await getSubscriptionOrderingState(subscription.id, userId ?? null);

  if (isOlderSubscriptionEvent(currentPeriodStart, ordering.currentPeriodStart)) {
    return { processed: false, skipReason: 'out_of_order_subscription_delete' };
  }

  if (!ordering.hasActiveSubscription) {
    if (!fromQueue && event) {
      await queueSubscriptionDelete(event);
      return { processed: false, skipReason: 'subscription_delete_queued' };
    }
    return { processed: false, skipReason: 'subscription_delete_without_created' };
  }

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'canceled',
      plan_id: 'free',
      plan_name: 'Free',
      current_period_start: currentPeriodStart,
      current_period_end: toIso(subscription.current_period_end),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_sub_id', subscription.id);

  if (error) throw error;
  if (userId) await updateUserPlan(userId, 'free');
  return { processed: true };
}

async function getSubscriptionOrderingState(stripeSubId: string, userId?: string | null) {
  let { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('id, status, current_period_start')
    .eq('stripe_sub_id', stripeSubId)
    .maybeSingle();

  if (error) throw error;

  if (!data && userId) {
    const fallback = await supabaseAdmin
      .from('subscriptions')
      .select('id, status, current_period_start')
      .eq('user_id', userId)
      .maybeSingle();
    if (fallback.error) throw fallback.error;
    data = fallback.data;
  }

  return {
    currentPeriodStart: data?.current_period_start ?? null,
    hasActiveSubscription: ['active', 'trialing', 'past_due', 'incomplete', 'unpaid', 'paused'].includes(String(data?.status || '')),
  };
}

function isOlderSubscriptionEvent(incomingStart: string | null, savedStart: string | null) {
  if (!incomingStart || !savedStart) return false;
  return new Date(incomingStart).getTime() < new Date(savedStart).getTime();
}

async function upsertSubscription(input: {
  userId: string;
  stripeCustomerId: string | null;
  stripeSubId: string | null;
  planId: string;
  planName: string;
  priceCents: number;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
}) {
  const { data: existingSub, error: readError } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('user_id', input.userId)
    .maybeSingle();

  if (readError) throw readError;

  if (existingSub?.id) {
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update({
        stripe_customer_id: input.stripeCustomerId,
        stripe_sub_id: input.stripeSubId,
        plan_id: input.planId,
        plan_name: input.planName,
        price_cents: input.priceCents,
        status: input.status,
        current_period_start: input.currentPeriodStart,
        current_period_end: input.currentPeriodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingSub.id);

    if (error) throw error;
    return;
  }

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .insert({
      user_id: input.userId,
      stripe_customer_id: input.stripeCustomerId,
      stripe_sub_id: input.stripeSubId,
      plan_id: input.planId,
      plan_name: input.planName,
      price_cents: input.priceCents,
      status: input.status,
      current_period_start: input.currentPeriodStart,
      current_period_end: input.currentPeriodEnd,
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;
}

async function updateUserPlan(userId: string, planId: string) {
  const { error } = await supabaseAdmin
    .from('users')
    .update({ plan_id: planId })
    .eq('id', userId);

  if (error) throw error;
}

async function creditPlanNuggetsOnce(userId: string, planId: string, checkoutSessionId: string) {
  const baseAmount = PLAN_BASE_NUGGETS[planId] ?? 0;
  const bonusAmount = PLAN_FIRST_MONTH_BONUS[planId] ?? 0;
  const amount = baseAmount + bonusAmount;
  if (!amount) return;

  const { error: insertErr } = await supabaseAdmin
    .from('nugget_purchases')
    .insert({
      user_id: userId,
      stripe_payment_id: checkoutSessionId,
      stripe_checkout_session_id: `plan:${checkoutSessionId}`,
      pack_id: `plan:${planId}`,
      qty: baseAmount,
      bonus: bonusAmount,
      price_cents: 0,
      status: 'completed',
    });

  if (insertErr) {
    if (insertErr.code === '23505') return;
    throw insertErr;
  }

  const { error: creditErr } = await supabaseAdmin.rpc('credit_nuggets', {
    p_user_id: userId,
    p_amount: amount,
  });

  if (creditErr) throw creditErr;
}
