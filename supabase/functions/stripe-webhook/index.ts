import {
  logStripeEventFailure,
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
  const startedAt = Date.now();
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
    const result = await processVerifiedStripeWebhookEvent(event);
    console.log(JSON.stringify({
      component: 'stripe-webhook',
      event_id: event.id,
      event_type: event.type,
      status: result.processed ? 'processed' : 'skipped',
      skip_reason: result.skipReason ?? null,
      duration_ms: Date.now() - startedAt,
    }));
    return new Response('ok', { status: 200 });
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    console.error(JSON.stringify({
      component: 'stripe-webhook',
      event_id: event.id,
      event_type: event.type,
      status: 'failed',
      duration_ms: durationMs,
      error: String((err as Error)?.message ?? err ?? 'Unknown webhook processing error'),
    }));
    await markStripeEventFailed(event.id, String((err as Error)?.message ?? err ?? 'Unknown webhook processing error'));
    try {
      await logStripeEventFailure(event, err, durationMs);
    } catch (logErr) {
      console.error('stripe-webhook failure log insert failed:', logErr);
    }
    return new Response('Webhook processing failed', { status: 500 });
  }
});
