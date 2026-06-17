import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey =
  Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (!stripeSecretKey) throw new Error('Missing STRIPE_SECRET_KEY');
if (!supabaseUrl) throw new Error('Missing SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing SUPABASE_ANON_KEY');
if (!supabaseServiceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-04-10',
});

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

async function ensureStripeCustomer(user: { id: string; email?: string | null }) {
  const { data: existingSub, error: readError } = await supabaseAdmin
    .from('subscriptions')
    .select('id, stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (readError) {
    console.warn('Could not read existing subscription row; continuing without local customer cache.', readError);
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
      console.warn('Could not update subscription customer cache; checkout will continue.', error);
    }
  } else {
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .insert({ user_id: user.id, stripe_customer_id: customer.id });
    if (error) {
      console.warn('Could not insert subscription customer cache; checkout will continue.', error);
    }
  }

  return customer.id;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { user, error: authReason } = await getAuthenticatedUser(authHeader);
    if (!user) {
      return new Response(JSON.stringify({ error: `Unauthorized: ${authReason || 'invalid session'}` }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === 'subscription' ? 'subscription' : 'payment';
    const packId = String(body?.pack_id ?? '').trim();
    const planId = String(body?.plan_id ?? '').trim();
    const billingCycle = normalizeBillingCycle(body?.billing_cycle);
    const appUrl = Deno.env.get('APP_URL') ?? 'https://dealsifter.com';
    const isEmbedded = body?.ui_mode === 'embedded' || body?.embedded === true;
    const successUrl = String(body?.success_url ?? `${appUrl}/?checkout=success`).trim();
    const cancelUrl = String(body?.cancel_url ?? `${appUrl}/?checkout=cancelled`).trim();
    const returnUrl = String(body?.return_url ?? successUrl).trim();

    const itemId = mode === 'subscription' ? planId : packId;
    const expectedPriceId = getAllowedPriceId(mode === 'subscription' ? 'plan' : 'pack', itemId, billingCycle);

    if (!itemId || !expectedPriceId) {
      return new Response(JSON.stringify({ error: 'Stripe price is not configured for this item.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    const customerId = await ensureStripeCustomer(user);

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

    return new Response(JSON.stringify(isEmbedded
      ? { id: session.id, client_secret: session.client_secret }
      : { id: session.id, url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('create-checkout-session error:', err);
    return new Response(JSON.stringify({ error: String(err?.message ?? 'Internal error') }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
