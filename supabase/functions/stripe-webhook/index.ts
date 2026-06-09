import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const webhookSecret =
  Deno.env.get('STRIPE_WEBHOOK_SECRET')
  ?? Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET')
  ?? '';

if (!stripeSecretKey) throw new Error('Missing STRIPE_SECRET_KEY');
if (!webhookSecret) throw new Error('Missing STRIPE_WEBHOOK_SECRET');

const stripe = new Stripe(stripeSecretKey, {
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

function toIso(tsSeconds?: number | null) {
  return tsSeconds ? new Date(tsSeconds * 1000).toISOString() : null;
}

function normalizeSubscriptionStatus(status?: string | null) {
  if (!status) return 'active';
  if (status === 'incomplete_expired') return 'canceled';
  return status;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature ?? '', webhookSecret);
  } catch (err) {
    console.error('Stripe signature verification failed:', err);
    return new Response('Webhook signature invalid', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await markSubscriptionCanceled(event.data.object as Stripe.Subscription);
        break;

      default:
        break;
    }

    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('stripe-webhook processing failed:', err);
    return new Response('Webhook processing failed', { status: 500 });
  }
});

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  const packId = session.metadata?.pack_id;
  const planId = session.metadata?.plan_id;

  if (!userId) {
    console.warn('Missing user_id metadata in checkout session:', session.id);
    return;
  }

  if (planId) {
    const subscription =
      typeof session.subscription === 'string'
        ? await stripe.subscriptions.retrieve(session.subscription)
        : null;

    await upsertSubscription({
      userId,
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
      stripeSubId: typeof session.subscription === 'string' ? session.subscription : null,
      planId,
      planName: PLAN_NAMES[planId] ?? planId,
      priceCents: session.amount_total ?? 0,
      status: normalizeSubscriptionStatus(subscription?.status ?? 'active'),
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

async function syncSubscription(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.user_id;
  const planId = subscription.metadata?.plan_id;

  if (!userId || !planId) {
    console.warn('Subscription missing app metadata:', subscription.id);
    return;
  }

  await upsertSubscription({
    userId,
    stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : null,
    stripeSubId: subscription.id,
    planId,
    planName: PLAN_NAMES[planId] ?? planId,
    priceCents: subscription.items.data[0]?.price?.unit_amount ?? 0,
    status: normalizeSubscriptionStatus(subscription.status),
    currentPeriodEnd: toIso(subscription.current_period_end),
  });

  await updateUserPlan(userId, subscription.status === 'canceled' ? 'free' : planId);
}

async function markSubscriptionCanceled(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.user_id;
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'canceled',
      plan_id: 'free',
      plan_name: 'Free',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_sub_id', subscription.id);

  if (error) throw error;
  if (userId) await updateUserPlan(userId, 'free');
}

async function upsertSubscription(input: {
  userId: string;
  stripeCustomerId: string | null;
  stripeSubId: string | null;
  planId: string;
  planName: string;
  priceCents: number;
  status: string;
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
