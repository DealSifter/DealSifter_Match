import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
});

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

const PLAN_PRICE_ENV: Record<string, string> = {
  pro: 'STRIPE_PRICE_PLAN_PRO',
  enterprise: 'STRIPE_PRICE_PLAN_ENTERPRISE',
};

function getAllowedPriceId(kind: 'pack' | 'plan', id: string) {
  const envName = kind === 'pack' ? PACK_PRICE_ENV[id] : PLAN_PRICE_ENV[id];
  return envName ? Deno.env.get(envName) ?? '' : '';
}

serve(async (req) => {
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === 'subscription' ? 'subscription' : 'payment';
    const packId = String(body?.pack_id ?? '').trim();
    const planId = String(body?.plan_id ?? '').trim();
    const requestedPriceId = String(body?.price_id ?? '').trim();
    const appUrl = Deno.env.get('APP_URL') ?? 'https://dealsifter.com';
    const successUrl = String(body?.success_url ?? `${appUrl}/?checkout=success`).trim();
    const cancelUrl = String(body?.cancel_url ?? `${appUrl}/?checkout=cancelled`).trim();

    const itemId = mode === 'subscription' ? planId : packId;
    const expectedPriceId = getAllowedPriceId(mode === 'subscription' ? 'plan' : 'pack', itemId);

    if (!itemId || !expectedPriceId) {
      return new Response(JSON.stringify({ error: 'Stripe price is not configured for this item.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (requestedPriceId && requestedPriceId !== expectedPriceId) {
      return new Response(JSON.stringify({ error: 'Invalid Stripe price id.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const metadata: Record<string, string> = {
      user_id: user.id,
      mode,
    };
    if (mode === 'subscription') metadata.plan_id = planId;
    else metadata.pack_id = packId;

    const { data: existingSub } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let customerId = existingSub?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      await supabaseAdmin
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
        }, { onConflict: 'user_id' });
    }

    const session = await stripe.checkout.sessions.create({
      mode,
      customer: customerId,
      line_items: [{ price: expectedPriceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      subscription_data: mode === 'subscription' ? { metadata } : undefined,
      payment_intent_data: mode === 'payment' ? { metadata } : undefined,
    });

    return new Response(JSON.stringify({ url: session.url }), {
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
