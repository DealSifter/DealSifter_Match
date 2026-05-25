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

async function getAuthenticatedUser(authHeader: string) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
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
      console.warn('Could not update subscription customer cache; portal will continue.', error);
    }
  } else {
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .insert({ user_id: user.id, stripe_customer_id: customer.id });
    if (error) {
      console.warn('Could not insert subscription customer cache; portal will continue.', error);
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

    const user = await getAuthenticatedUser(authHeader);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { return_url } = await req.json().catch(() => ({}));
    const appUrl = Deno.env.get('APP_URL') ?? 'https://dealsifter.com';
    const customerId = await ensureStripeCustomer(user);

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: return_url ?? `${appUrl}/?settings=payments`,
    });

    return new Response(JSON.stringify({ url: portalSession.url }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('create-portal-session error:', err);
    return new Response(JSON.stringify({ error: String(err?.message ?? 'Internal error') }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
