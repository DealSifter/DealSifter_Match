import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  buildCorsHeaders,
  isRequestOriginAllowed,
  parseAllowedOrigins,
  resolveTrustedReturnUrl,
} from '../_shared/httpSecurity.ts';
import { createRequestId, logOperationalEvent, withRequestId } from '../_shared/observability.ts';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey =
  Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const configuredAppUrl = Deno.env.get('APP_URL') ?? 'https://dealsifter.com';
const appOrigin = parseAllowedOrigins('', [configuredAppUrl])[0] || 'https://dealsifter.com';
const allowedOrigins = parseAllowedOrigins(
  Deno.env.get('APP_ALLOWED_ORIGINS') ?? '',
  [appOrigin, Deno.env.get('VITE_APP_URL') ?? ''],
);

if (!stripeSecretKey) throw new Error('Missing STRIPE_SECRET_KEY');
if (!supabaseUrl) throw new Error('Missing SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing SUPABASE_ANON_KEY');
if (!supabaseServiceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-04-10',
});

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

const PACK_PRICE_ENV: Record<string, string> = {
  p5: 'STRIPE_PRICE_P5',
  p15: 'STRIPE_PRICE_P15',
  p40: 'STRIPE_PRICE_P40',
  p100: 'STRIPE_PRICE_P100',
};

const PLAN_PRICE_ENV: Record<string, Record<string, string>> = {
  monthly: {
    pro: 'STRIPE_PRICE_PLAN_PRO',
    enterprise: 'STRIPE_PRICE_PLAN_ENTERPRISE',
  },
  annual: {
    pro: 'STRIPE_PRICE_PLAN_PRO_YEAR',
    enterprise: 'STRIPE_PRICE_PLAN_ENTERPRISE_YEAR',
  },
};

function normalizeBillingCycle(value: unknown) {
  return String(value ?? '').trim().toLowerCase() === 'annual' ? 'annual' : 'monthly';
}

function getAllowedPriceId(kind: 'pack' | 'plan', id: string, billingCycle = 'monthly') {
  const envName = kind === 'pack' ? PACK_PRICE_ENV[id] : PLAN_PRICE_ENV[billingCycle]?.[id];
  return envName ? Deno.env.get(envName) ?? '' : '';
}

async function getAuthenticatedUser(authHeader: string) {
  const accessToken = String(authHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) {
    return { user: null, error: 'Missing bearer token' };
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) return { user: null, error: String(error?.message || 'Invalid user session') };
  return { user, error: null };
}

async function ensureStripeCustomer(user: { id: string; email?: string | null }, requestId: string) {
  const { data: existingSub, error: readError } = await supabaseAdmin
    .from('subscriptions')
    .select('id, stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (readError) {
    logOperationalEvent({ functionName: 'create-checkout-session', operation: 'customer_cache_read', requestId, userId: user.id, success: false, errorCode: readError.code || 'CUSTOMER_CACHE_READ_FAILED', status: 500, provider: 'supabase', severity: 'WARNING' });
  }
  if (existingSub?.stripe_customer_id) return existingSub.stripe_customer_id;

  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    metadata: { supabase_user_id: user.id },
  });

  if (existingSub?.id) {
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update({ stripe_customer_id: customer.id, updated_at: new Date().toISOString() })
      .eq('id', existingSub.id);
    if (error) {
      logOperationalEvent({ functionName: 'create-checkout-session', operation: 'customer_cache_update', requestId, userId: user.id, success: false, errorCode: error.code || 'CUSTOMER_CACHE_UPDATE_FAILED', status: 500, provider: 'supabase', severity: 'WARNING' });
    }
  } else {
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .insert({ user_id: user.id, stripe_customer_id: customer.id });
    if (error) {
      logOperationalEvent({ functionName: 'create-checkout-session', operation: 'customer_cache_insert', requestId, userId: user.id, success: false, errorCode: error.code || 'CUSTOMER_CACHE_INSERT_FAILED', status: 500, provider: 'supabase', severity: 'WARNING' });
    }
  }

  return customer.id;
}

Deno.serve(async (req) => {
  const requestId = createRequestId(req);
  const startedAt = Date.now();
  let userId = '';
  const requestOrigin = req.headers.get('Origin') ?? '';
  const corsHeaders = buildCorsHeaders(requestOrigin, allowedOrigins);
  const respond = (body: Record<string, unknown>, status: number) => withRequestId(new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  }), requestId);
  if (!isRequestOriginAllowed(requestOrigin, allowedOrigins)) {
    logOperationalEvent({ functionName: 'create-checkout-session', operation: 'origin_check', requestId, durationMs: Date.now() - startedAt, success: false, errorCode: 'ORIGIN_NOT_ALLOWED', status: 403, provider: 'stripe' });
    return respond({ error: 'Origin not allowed', requestId }, 403);
  }
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      logOperationalEvent({ functionName: 'create-checkout-session', operation: 'authenticate', requestId, durationMs: Date.now() - startedAt, success: false, errorCode: 'UNAUTHORIZED', status: 401, provider: 'supabase' });
      return respond({ error: 'Unauthorized', requestId }, 401);
    }

    const { user } = await getAuthenticatedUser(authHeader);
    if (!user) {
      logOperationalEvent({ functionName: 'create-checkout-session', operation: 'authenticate', requestId, durationMs: Date.now() - startedAt, success: false, errorCode: 'UNAUTHORIZED', status: 401, provider: 'supabase' });
      return respond({ error: 'Unauthorized', requestId }, 401);
    }
    userId = user.id;

    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === 'subscription' ? 'subscription' : 'payment';
    const packId = String(body?.pack_id ?? '').trim();
    const planId = String(body?.plan_id ?? '').trim();
    const billingCycle = normalizeBillingCycle(body?.billing_cycle);
    const isEmbedded = body?.ui_mode === 'embedded' || body?.embedded === true;
    const successFallback = `${appOrigin}/?checkout=success`;
    const cancelFallback = `${appOrigin}/?checkout=cancelled`;
    const successUrl = resolveTrustedReturnUrl(body?.success_url, successFallback, allowedOrigins);
    const cancelUrl = resolveTrustedReturnUrl(body?.cancel_url, cancelFallback, allowedOrigins);
    const returnUrl = resolveTrustedReturnUrl(body?.return_url, successUrl, allowedOrigins);

    const itemId = mode === 'subscription' ? planId : packId;
    const expectedPriceId = getAllowedPriceId(mode === 'subscription' ? 'plan' : 'pack', itemId, billingCycle);

    if (!itemId || !expectedPriceId) {
      logOperationalEvent({ functionName: 'create-checkout-session', operation: 'validate_price', requestId, userId, durationMs: Date.now() - startedAt, success: false, errorCode: 'STRIPE_PRICE_NOT_CONFIGURED', status: 400, provider: 'stripe' });
      return respond({ error: 'Stripe price is not configured for this item.', requestId }, 400);
    }

    // Ignore any client-supplied price id and trust server-side mapping only.

    const metadata: Record<string, string> = {
      user_id: user.id,
      mode,
    };
    if (mode === 'subscription') {
      metadata.plan_id = planId;
      metadata.billing_cycle = billingCycle;
    }
    else metadata.pack_id = packId;
    if (body?.terms_accepted === true) {
      metadata.terms_accepted = 'true';
      metadata.terms_accepted_at = String(body?.terms_accepted_at ?? new Date().toISOString());
      metadata.terms_version = String(body?.terms_version ?? 'checkout-v1');
    }

    const customerId = await ensureStripeCustomer(user, requestId);

    const session = await stripe.checkout.sessions.create({
      mode,
      customer: customerId,
      line_items: [{ price: expectedPriceId, quantity: 1 }],
      ui_mode: isEmbedded ? 'embedded' : 'hosted',
      success_url: isEmbedded ? undefined : successUrl,
      cancel_url: isEmbedded ? undefined : cancelUrl,
      return_url: isEmbedded ? returnUrl : undefined,
      metadata,
      subscription_data: mode === 'subscription' ? { metadata } : undefined,
      payment_intent_data: mode === 'payment' ? { metadata, setup_future_usage: 'off_session' } : undefined,
    });

    logOperationalEvent({ functionName: 'create-checkout-session', operation: 'create_session', requestId, userId, durationMs: Date.now() - startedAt, success: true, status: 200, provider: 'stripe', metrics: { mode, billing_cycle: billingCycle, embedded: isEmbedded } });
    return respond(isEmbedded
      ? { id: session.id, client_secret: session.client_secret }
      : { id: session.id, url: session.url }, 200);
  } catch (err) {
    logOperationalEvent({ functionName: 'create-checkout-session', operation: 'create_session', requestId, userId, durationMs: Date.now() - startedAt, success: false, errorCode: 'STRIPE_CHECKOUT_FAILED', status: 500, provider: 'stripe' });
    return respond({ error: 'Internal error', requestId }, 500);
  }
});
