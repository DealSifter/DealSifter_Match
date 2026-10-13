import { buildCorsHeaders } from '../maxxis/corsPolicy.ts';

// Keep geocoding's existing origin policy and reuse the application's tracing
// header contract. Sentry adds baggage/sentry-trace even to SDK invocations.
// CORS permits browser transport; the handler still requires an authenticated
// user and applies its existing rate limit before contacting any provider.
export const geocodeCorsHeaders = {
  ...buildCorsHeaders(),
  'Access-Control-Allow-Origin': '*',
};
