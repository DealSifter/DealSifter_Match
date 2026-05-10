import { supabase } from './supabaseClient';

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
 * Redirects the user to Stripe Checkout to buy a nugget pack.
 * Calls the `create-checkout-session` Supabase Edge Function.
 * Throws on error (caller should catch and display message).
 *
 * @param {object} pack  - Entry from NUGGET_PACKS  { id, qty, bonus, price }
 */
export async function redirectToCheckout(pack) {
  const priceId = STRIPE_PRICE_IDS[pack.id];

  if (!priceId) {
    throw new Error(
      `Stripe price ID para o pacote "${pack.id}" não configurado. ` +
      'Adicione VITE_STRIPE_PRICE_* no .env.'
    );
  }

  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: {
      pack_id:   pack.id,
      price_id:  priceId,
      success_url: `${window.location.origin}/?checkout=success&pack=${pack.id}`,
      cancel_url:  `${window.location.origin}/?checkout=cancelled`,
    },
  });

  if (error) throw new Error(error.message || 'Falha ao criar sessão de checkout.');
  if (!data?.url) throw new Error('URL de checkout não retornada.');

  window.location.href = data.url;
}

/**
 * Opens the Stripe Customer Portal for billing management.
 * Calls the `create-portal-session` Supabase Edge Function.
 * Throws on error.
 */
export async function redirectToPortal() {
  const { data, error } = await supabase.functions.invoke('create-portal-session', {
    body: {
      return_url: `${window.location.origin}/?settings=payments`,
    },
  });

  if (error) throw new Error(error.message || 'Falha ao abrir portal Stripe.');
  if (!data?.url) throw new Error('URL do portal não retornada.');

  window.location.href = data.url;
}
