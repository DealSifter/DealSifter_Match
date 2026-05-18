import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

// COLE AQUI ⬇️ (substitui as linhas que eu mostrei antes)
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'), {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
});

const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
// ATÉ AQUI ⬆️

serve(async (req) => {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature!, endpointSecret);
  } catch (err) {
    return new Response('Webhook error', { status: 400 });
  }

  // Processar o evento
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('Pagamento aprovado:', session.id);
    
    // Aqui você ativa a assinatura do usuário
  }

  return new Response('OK', { status: 200 });
});