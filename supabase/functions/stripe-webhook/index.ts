import {
  logStripeEventFailure,
  markStripeEventFailed,
  processVerifiedStripeWebhookEvent,
  stripe,
} from "../_shared/stripe-event-processor.ts";
import { createRequestId, logOperationalEvent, withRequestId } from '../_shared/observability.ts';

const webhookSecret =
  Deno.env.get('STRIPE_WEBHOOK_SECRET')
  ?? Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET')
  ?? '';

if (!webhookSecret) throw new Error('Missing STRIPE_WEBHOOK_SECRET');

Deno.serve(async (req) => {
  const requestId = createRequestId(req);
  const startedAt = Date.now();
  if (req.method !== 'POST') {
    return withRequestId(new Response('Method not allowed', { status: 405 }), requestId);
  }

  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature ?? '', webhookSecret);
  } catch (err) {
    logOperationalEvent({ functionName: 'stripe-webhook', operation: 'verify_signature', requestId, durationMs: Date.now() - startedAt, success: false, errorCode: 'STRIPE_SIGNATURE_INVALID', status: 400, provider: 'stripe' });
    return withRequestId(new Response('Webhook signature invalid', { status: 400 }), requestId);
  }

  try {
    const result = await processVerifiedStripeWebhookEvent(event);
    logOperationalEvent({
      functionName: 'stripe-webhook',
      operation: 'process_event',
      requestId,
      durationMs: Date.now() - startedAt,
      success: true,
      status: result.processed ? 'processed' : 'skipped',
      provider: 'stripe',
      metrics: { event_type: event.type, processed: result.processed },
    });
    return withRequestId(new Response('ok', { status: 200 }), requestId);
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    logOperationalEvent({ functionName: 'stripe-webhook', operation: 'process_event', requestId, durationMs, success: false, errorCode: 'STRIPE_WEBHOOK_FAILED', status: 500, provider: 'stripe', severity: 'CRITICAL', metrics: { event_type: event.type } });
    await markStripeEventFailed(event.id, String((err as Error)?.message ?? err ?? 'Unknown webhook processing error'));
    try {
      await logStripeEventFailure(event, err, durationMs);
    } catch {
      logOperationalEvent({ functionName: 'stripe-webhook', operation: 'persist_failure_log', requestId, durationMs: Date.now() - startedAt, success: false, errorCode: 'STRIPE_FAILURE_LOG_DATABASE_FAILED', status: 500, provider: 'supabase', severity: 'HIGH' });
    }
    return withRequestId(new Response('Webhook processing failed', { status: 500 }), requestId);
  }
});
