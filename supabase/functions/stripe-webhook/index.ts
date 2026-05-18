import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
});

// NUGGET_PACKS must mirror src/data/mockData.js — qty + bonus credited per pack_id
const PACK_CREDITS: Record<string, { qty: number; bonus: number; price_cents: number }> = {
  p5:   { qty: 5,   bonus: 0,  price_cents: 900  },
  p15:  { qty: 15,  bonus: 2,  price_cents: 1900 },
  p40:  { qty: 40,  bonus: 8,  price_cents: 3900 },
  p100: { qty: 100, bonus: 25, price_cents: 7900 },
};

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature ?? '', webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Webhook signature invalid', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    // Pegar informações do pagamento
    const customerEmail = session.customer_details.email;
    const amount = session.amount_total;
    const planId = session.metadata?.plan_id;
    
    // Ativar a assinatura no seu sistema
    // Exemplo: atualizar banco de dados, enviar email, etc.
    
    console.log(`Usuário ${customerEmail} ativou plano ${planId}`);

    const userId  = session.metadata?.user_id;
    const packId  = session.metadata?.pack_id;

    if (!userId || !packId) {
      console.warn('Missing metadata in session:', session.id);
      return new Response('ok', { status: 200 });
    }

    const pack = PACK_CREDITS[packId];
    if (!pack) {
      console.warn('Unknown pack_id:', packId);
      return new Response('ok', { status: 200 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Record the purchase
    const { error: insertErr } = await supabaseAdmin
      .from('nugget_purchases')
      .insert({
        user_id:          userId,
        stripe_payment_id: session.payment_intent as string ?? session.id,
        pack_id:          packId,
        qty:              pack.qty,
        bonus:            pack.bonus,
        price_cents:      pack.price_cents,
        status:           'completed',
      });

    if (insertErr) console.error('nugget_purchases insert error:', insertErr);

    // Credit nuggets to user profile (stored in profile_payload.nuggets or a dedicated column)
    // Using users table — assumes a `nuggets` integer column exists.
    // If column doesn't exist yet, this upserts profile_payload instead.
    const { error: creditErr } = await supabaseAdmin.rpc('credit_nuggets', {
      p_user_id: userId,
      p_amount:  pack.qty + pack.bonus,
    });

    if (creditErr) {
      console.error('credit_nuggets rpc error:', creditErr);
      // Non-fatal: purchase is already recorded, can be reconciled manually.
    }
  }

  return new Response('ok', { status: 200 });
});
