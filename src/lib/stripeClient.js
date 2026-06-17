import { supabase, isSupabaseConfigured } from './supabaseClient';

/**
 * Stripe Price IDs - configure in Stripe Dashboard and set in .env.
 * Keys must match NUGGET_PACKS ids in src/data/mockData.js.
 */
export const STRIPE_PRICE_IDS = {
  p5:   import.meta.env.VITE_STRIPE_PRICE_P5   || null,
  p15:  import.meta.env.VITE_STRIPE_PRICE_P15  || null,
  p40:  import.meta.env.VITE_STRIPE_PRICE_P40  || null,
  p100: import.meta.env.VITE_STRIPE_PRICE_P100 || null,
};

/**
 * Stripe Subscription Price IDs - configure per plan in Stripe Dashboard.
 */
export const STRIPE_SUBSCRIPTION_PRICE_IDS = {
  monthly: {
    pro:        import.meta.env.VITE_STRIPE_PRICE_PLAN_PRO        || null,
    enterprise: import.meta.env.VITE_STRIPE_PRICE_PLAN_ENTERPRISE || null,
  },
  annual: {
    pro:        import.meta.env.VITE_STRIPE_PRICE_PLAN_PRO_YEAR        || null,
    enterprise: import.meta.env.VITE_STRIPE_PRICE_PLAN_ENTERPRISE_YEAR || null,
  },
};

async function invokeEdge(functionName, body) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase nao configurado. Verifique as variaveis de ambiente VITE_SUPABASE_*.');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message || 'Falha ao obter sessao de autenticacao.');
  let accessToken = sessionData?.session?.access_token;
  if (!accessToken) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) throw new Error(refreshError.message || 'Falha ao atualizar sessao de autenticacao.');
    accessToken = refreshed?.session?.access_token || null;
  }
  if (!accessToken) {
    throw new Error('Sessao expirada ou ausente. Faca login novamente para continuar.');
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

function getNuggetCheckoutBody(pack) {
  if (!pack?.id) throw new Error('Pacote de nuggets invalido para checkout.');

  const priceId = STRIPE_PRICE_IDS[pack.id];
  if (!priceId) {
    throw new Error(
      `Stripe price ID para o pacote "${pack.id}" nao configurado. ` +
      'Adicione VITE_STRIPE_PRICE_* no .env.'
    );
  }

  return {
    pack_id: pack.id,
    price_id: priceId,
  };
}

function normalizeBillingCycle(value) {
  return String(value || '').trim().toLowerCase() === 'annual' ? 'annual' : 'monthly';
}

function getSubscriptionCheckoutBody(planId, options = {}) {
  const normalizedPlanId = String(planId || '').trim();
  const billingCycle = normalizeBillingCycle(options.billingCycle || options.billing_cycle);
  const priceId = STRIPE_SUBSCRIPTION_PRICE_IDS[billingCycle]?.[normalizedPlanId];

  if (!priceId) {
    throw new Error(
      `Stripe subscription price ID para o plano "${normalizedPlanId}" (${billingCycle}) nao configurado. ` +
      'Adicione VITE_STRIPE_PRICE_PLAN_* no .env.'
    );
  }

  return {
    plan_id: normalizedPlanId,
    billing_cycle: billingCycle,
    price_id: priceId,
    mode: 'subscription',
  };
}

function getTermsMetadata(options = {}) {
  if (!options?.termsAccepted) return {};
  return {
    terms_accepted: true,
    terms_accepted_at: options.termsAcceptedAt || new Date().toISOString(),
  };
}

function getCheckoutReturnUrl(params = {}) {
  const url = new URL(window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

/**
 * Redirects the user to Stripe Checkout to buy a nugget pack.
 */
export async function redirectToCheckout(pack, options = {}) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase nao configurado. Verifique as variaveis de ambiente VITE_SUPABASE_*.');
  }

  const data = await invokeEdge('create-checkout-session', {
    ...getNuggetCheckoutBody(pack),
    ...getTermsMetadata(options),
    success_url: getCheckoutReturnUrl({ checkout: 'success', pack: pack.id }),
    cancel_url:  getCheckoutReturnUrl({ checkout: 'cancelled', page: 'pricing' }),
  });
  if (!data?.url) throw new Error('URL de checkout nao retornada.');

  window.location.href = data.url;
}

/**
 * Redirects the user to Stripe Checkout to subscribe to a plan.
 */
export async function redirectToSubscription(planId, options = {}) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase nao configurado. Verifique as variaveis de ambiente VITE_SUPABASE_*.');
  }

  const data = await invokeEdge('create-checkout-session', {
    ...getSubscriptionCheckoutBody(planId, options),
    ...getTermsMetadata(options),
    success_url: getCheckoutReturnUrl({ checkout: 'success', plan: planId, billing: normalizeBillingCycle(options.billingCycle || options.billing_cycle) }),
    cancel_url:  getCheckoutReturnUrl({ checkout: 'cancelled', page: 'pricing' }),
  });
  if (!data?.url) throw new Error('URL de assinatura nao retornada.');

  window.location.href = data.url;
}

/**
 * Opens the Stripe Customer Portal for billing management.
 */
export async function redirectToPortal() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase nao configurado. Verifique as variaveis de ambiente VITE_SUPABASE_*.');
  }

  const data = await invokeEdge('create-portal-session', {
    return_url: `${window.location.origin}/?settings=payments`,
  });
  if (!data?.url) throw new Error('URL do portal nao retornada.');

  window.location.href = data.url;
}
