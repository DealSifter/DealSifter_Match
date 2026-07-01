import {
  markStripeEventFailed,
  processVerifiedStripeWebhookEvent,
  stripe,
} from "../_shared/stripe-event-processor.ts";

const webhookSecret =
  Deno.env.get('STRIPE_WEBHOOK_SECRET')
  ?? Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET')
  ?? '';

if (!webhookSecret) throw new Error('Missing STRIPE_WEBHOOK_SECRET');

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature ?? '', webhookSecret);
  } catch (err) {
    console.error('Stripe signature verification failed:', err);
    return new Response('Webhook signature invalid', { status: 400 });
  }

  try {
    await processVerifiedStripeWebhookEvent(event);
    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('stripe-webhook processing failed:', err);
    await markStripeEventFailed(event.id, String(err?.message ?? err ?? 'Unknown webhook processing error'));
    return new Response('Webhook processing failed', { status: 500 });
  }
});
