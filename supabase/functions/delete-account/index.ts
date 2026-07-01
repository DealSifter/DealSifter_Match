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

const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-04-10' });
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getAuthenticatedUser(authHeader: string) {
  const accessToken = String(authHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) return { user: null, error: 'Missing bearer token' };

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) return { user: null, error: String(error?.message || 'Invalid user session') };
  return { user, error: null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const { user, error: authError } = await getAuthenticatedUser(authHeader);
    if (authError || !user) return jsonResponse({ error: authError || 'Unauthorized' }, 401);

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const reason = String(body.reason || 'user_requested').trim().slice(0, 240);
    const { data: subscriptionRows, error: subscriptionError } = await supabaseAdmin
      .from('subscriptions')
      .select('id, stripe_sub_id, status')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing', 'past_due']);

    if (subscriptionError) throw subscriptionError;

    const canceledStripeSubscriptions: string[] = [];
    for (const row of subscriptionRows || []) {
      const stripeSubId = String(row?.stripe_sub_id || '').trim();
      if (!stripeSubId) continue;
      try {
        await stripe.subscriptions.cancel(stripeSubId);
        canceledStripeSubscriptions.push(stripeSubId);
      } catch (err) {
        const message = String((err as Error)?.message || err || '');
        if (!message.toLowerCase().includes('already canceled')) throw err;
      }
    }

    const { data: deletionResult, error: deletionError } = await supabaseAdmin.rpc('delete_user_account', {
      target_user_id: user.id,
      p_reason: reason,
    });
    if (deletionError) throw deletionError;

    const anonymizedAuthEmail = `deleted+${user.id}@deleted.dealsifter.local`;
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email: anonymizedAuthEmail,
      phone: null,
      user_metadata: {
        deleted: true,
        deleted_at: new Date().toISOString(),
      },
      app_metadata: {
        deleted: true,
      },
      ban_duration: '876000h',
    });

    if (authUpdateError) {
      console.warn('Account soft-delete completed, but auth anonymization failed:', authUpdateError);
      return jsonResponse({
        ok: true,
        authAnonymized: false,
        canceledStripeSubscriptions,
        deletion: deletionResult,
        warning: authUpdateError.message,
      }, 202);
    }

    return jsonResponse({
      ok: true,
      authAnonymized: true,
      canceledStripeSubscriptions,
      deletion: deletionResult,
    });
  } catch (err) {
    console.error('delete-account failed:', err);
    return jsonResponse({ error: String((err as Error)?.message || err || 'Delete account failed') }, 500);
  }
});
