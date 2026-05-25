import { supabase, isSupabaseConfigured } from './supabaseClient';

/**
 * Stripe Price IDs — configure in Stripe Dashboard and set in .env
 * Keys must match NUGGET_PACKS ids in src/data/mockData.js
 * Format: VITE_STRIPE_PRICE_<PACK_ID_UPPERCASE>
 */
export const STRIPE_PRICE_IDS = {
  p5:   import.meta.env.VITE_STRIPE_PRICE_P5   || null,
  p15:  import.meta.env.VITE_STRIPE_PRICE_P15  || null,
  p40:  import.meta.env.VITE_STRIPE_PRICE_P40  || null,
  p100: import.meta.env.VITE_STRIPE_PRICE_P100 || null,
};

/**
 * Stripe Subscription Price IDs — configure per plan in Stripe Dashboard.
 * Format: VITE_STRIPE_PRICE_PLAN_<PLAN_ID_UPPERCASE>
 */
export const STRIPE_SUBSCRIPTION_PRICE_IDS = {
  pro:        import.meta.env.VITE_STRIPE_PRICE_PLAN_PRO        || null,
  enterprise: import.meta.env.VITE_STRIPE_PRICE_PLAN_ENTERPRISE || null,
};

async function invokeEdge(functionName, body) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado. Verifique as variáveis de ambiente VITE_SUPABASE_*.');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message || 'Falha ao obter sessão de autenticação.');
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) {
    throw new Error('Sessão expirada ou ausente. Faça login novamente para continuar.');
  }

  const baseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const endpoint = `${baseUrl}/functions/v1/${functionName}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body || {}),
  });

  const rawText = await response.text();
  let parsed = null;
  try { parsed = rawText ? JSON.parse(rawText) : null; } catch { parsed = null; }

  if (!response.ok) {
    const message =
      parsed?.error
      || parsed?.message
      || rawText
      || `Edge Function HTTP ${response.status}`;
    throw new Error(String(message));
  }

  return parsed || {};
}

/**
 * Redirects the user to Stripe Checkout to buy a nugget pack.
 * Calls the `create-checkout-session` Supabase Edge Function.
 * Throws on error (caller should catch and display message).
 *
 * @param {object} pack  - Entry from NUGGET_PACKS  { id, qty, bonus, price }
 */
export async function redirectToCheckout(pack) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado. Verifique as variáveis de ambiente VITE_SUPABASE_*.');
  }

  const priceId = STRIPE_PRICE_IDS[pack.id];

  if (!priceId) {
    throw new Error(
      `Stripe price ID para o pacote "${pack.id}" não configurado. ` +
      'Adicione VITE_STRIPE_PRICE_* no .env.'
    );
  }

  const data = await invokeEdge('create-checkout-session', {
    pack_id:   pack.id,
    price_id:  priceId,
    success_url: `${window.location.origin}/?checkout=success&pack=${pack.id}`,
    cancel_url:  `${window.location.origin}/?checkout=cancelled`,
  });
  if (!data?.url) throw new Error('URL de checkout não retornada.');

  window.location.href = data.url;
}

/**
 * Redirects the user to Stripe Checkout to subscribe to a plan.
 * Calls the `create-checkout-session` Supabase Edge Function with mode=subscription.
 * Throws on error (caller should catch and display message).
 *
 * @param {string} planId  - Plan ID matching STRIPE_SUBSCRIPTION_PRICE_IDS key (e.g. 'pro', 'enterprise')
 */
export async function redirectToSubscription(planId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado. Verifique as variáveis de ambiente VITE_SUPABASE_*.');
  }

  const priceId = STRIPE_SUBSCRIPTION_PRICE_IDS[planId];

  if (!priceId) {
    throw new Error(
      `Stripe subscription price ID para o plano "${planId}" não configurado. ` +
      'Adicione VITE_STRIPE_PRICE_PLAN_* no .env.'
    );
  }

  const data = await invokeEdge('create-checkout-session', {
    plan_id:     planId,
    price_id:    priceId,
    mode:        'subscription',
    success_url: `${window.location.origin}/?checkout=success&plan=${planId}`,
    cancel_url:  `${window.location.origin}/?checkout=cancelled`,
  });
  if (!data?.url) throw new Error('URL de assinatura não retornada.');

  window.location.href = data.url;
}

/**
 * Opens the Stripe Customer Portal for billing management.
 * Calls the `create-portal-session` Supabase Edge Function.
 * Throws on error.
 */
export async function redirectToPortal() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado. Verifique as variáveis de ambiente VITE_SUPABASE_*.');
  }

  const data = await invokeEdge('create-portal-session', {
    return_url: `${window.location.origin}/?settings=payments`,
  });
  if (!data?.url) throw new Error('URL do portal não retornada.');

  window.location.href = data.url;
}
