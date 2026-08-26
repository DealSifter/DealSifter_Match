# DealSifter Match observability

## Scope and current baseline

This runbook covers the launch-critical journeys `AUTH`, `FEED`, `MAXXIS DEAL AI`, `STRIPE`, `UNLOCK`, and `MESSAGING`. The checked-in baseline is intentionally marked `initial_baseline_without_historical_claims`: its targets are launch objectives, not claims derived from production history.

The canonical machine-readable configuration is `config/observability.json`. Session Replay is disabled. Error events are retained at 100%; traces, operational signals, and Web Vitals are sampled independently.

## Architecture

- The React client initializes Sentry only when `VITE_SENTRY_DSN` is present. Without a DSN the app and ErrorBoundary continue normally.
- React render failures, uncaught exceptions, rejected promises, chunk-loading failures, browser tracing, and LCP/INP/CLS use the same Sentry SDK boundary. There are no duplicate global listeners.
- Frontend operational signals contain only operation names, booleans, durations, safe status/code values, counts, route path, environment, and release.
- Critical Supabase Edge Functions write one-line JSON events through `_shared/observability.ts`. Responses carry `x-request-id` when a valid UUID is available.
- The release is supplied at build/deploy time and is included in frontend Sentry events, Edge logs, health responses, and uploaded source maps.
- The scheduled GitHub Actions smoke probes the production frontend and the staging Maxxis Deal AI health endpoint. It does not authenticate, mutate records, call Gemini, charge nuggets, or invoke Stripe.

## Privacy boundary

Never send or persist the following in telemetry:

- access/refresh tokens, authorization headers, cookies, API or Stripe keys;
- email, phone, WhatsApp, full name, private address, avatar/photo/image content;
- profile payloads, chat/conversation content, message bodies, request bodies;
- Stripe webhook payloads or raw provider responses.

The browser SDK uses `sendDefaultPii: false` and scrubs messages, URLs, breadcrumbs, exception frames, contexts, tags, and extras before sending. Edge structured events use an allowlist and reject sensitive metric keys. `user_id` and `request_id` are accepted only as UUIDs. Free-form database/provider errors are classified and normalized to safe error codes. Persistent Stripe failure diagnostics are redacted and length-limited before storage.

If a new telemetry field is required, add a test proving its safe representation before adding it to an event.

## Configuration

Frontend public build variables:

| Variable | Purpose |
| --- | --- |
| `VITE_SENTRY_DSN` | Public Sentry ingestion DSN; empty disables Sentry safely. |
| `VITE_SENTRY_TRACES_SAMPLE_RATE` | Browser trace sampling, default `0.05`. |
| `VITE_SENTRY_OPERATION_SAMPLE_RATE` | Operational SLI event sampling, default `0.1`. |
| `VITE_SENTRY_WEB_VITALS_SAMPLE_RATE` | LCP/INP/CLS sampling, default `0.1`. |
| `VITE_APP_ENVIRONMENT` | `development`, `preview`, `staging`, or `production`. |
| `VITE_APP_RELEASE` | Immutable Git SHA or release identifier. |

Build-only secrets, never prefixed with `VITE_`:

| Variable | Purpose |
| --- | --- |
| `SENTRY_AUTH_TOKEN` | Uploads source maps during production builds. |
| `SENTRY_ORG` | Sentry organization slug. |
| `SENTRY_PROJECT` | Sentry project slug. |

Edge runtime variable:

| Variable | Purpose |
| --- | --- |
| `OBSERVABILITY_RELEASE` | Git SHA/deployment release included in structured logs and health output. |

Vercel supplies `VERCEL_GIT_COMMIT_SHA`; GitHub supplies `GITHUB_SHA`. Source maps are generated only when all three Sentry upload credentials are available, uploaded under the same release, hidden from bundle references, and deleted from the output after upload.

## Structured Edge event

Every critical operation emits the common schema:

```json
{
  "timestamp": "ISO-8601",
  "signal": "operational_event",
  "function_name": "maxxis-chat",
  "operation": "provider_request",
  "request_id": "UUID",
  "user_id": "UUID-or-empty",
  "duration_ms": 120,
  "success": true,
  "error_category": "PROVIDER",
  "error_code": "SAFE_ENUM_CODE",
  "provider": "gemini",
  "status": 200,
  "severity": "INFO",
  "release": "git-sha",
  "metrics": {}
}
```

Allowed error categories are `AUTH`, `RLS`, `VALIDATION`, `PROVIDER`, `TIMEOUT`, `QUOTA`, `PAYMENT`, `CONFLICT`, `DATABASE`, and `INTERNAL`.

Maxxis Deal AI events distinguish total duration, Gemini provider duration, tool duration, and database duration where the layer owns that measurement. Stripe events distinguish signature validation, event processing, failure persistence, customer caching, and session creation. Unlock and messaging functions preserve their intent/action idempotency signals without logging message content.

## SLIs and launch SLOs

| Journey | Success objective | p95 latency | Maximum error rate |
| --- | ---: | ---: | ---: |
| AUTH | 99.5% | 2 s | 0.5% |
| FEED | 99.0% | 2 s | 1.0% |
| MAXXIS DEAL AI | 98.0% | 8 s | 2.0% |
| STRIPE | 99.9% | 3 s | 0.1% |
| UNLOCK | 99.9% | 2 s | 0.1% |
| MESSAGING | 99.5% | 2 s | 0.5% |

The first seven days after release establish observed baselines. Do not loosen an objective because of a single incident; review at least one full week, traffic volume, sample rate, false-positive rate, and error-budget consumption.

Frontend UX guardrails are LCP <= 2.5 s, INP <= 200 ms, and CLS <= 0.1 at p75. A regression should be segmented by route, release, device class, and environment, without user attributes.

## Alerts and routing

Alert definitions and exact windows live in `config/observability.json`:

- `CRITICAL`: Stripe webhook failure, repeated unlock transaction failure, or deployment health regression. Page the release/on-call owner immediately and suspend the affected money-moving path if integrity is uncertain.
- `HIGH`: elevated 5xx, Maxxis Deal AI failure-rate breach, or authentication anomaly. Investigate within 15 minutes and correlate by release/request ID.
- `WARNING`: Gemini timeout/quota burst. Check provider status, configured quota, latency, and fallback response.

Sentry alert rules use the `sentry` channel entries. The health workflow uses `github_actions` and produces an actionable annotation on failure. Repository notification routing must send failed `Observability Smoke` workflow runs to the launch/on-call channel.

Controlled alert validation:

1. Dispatch `Observability Smoke` with `force_alert=false`; both safe probes must pass.
2. Dispatch it with `force_alert=true`; probes pass first, then the job fails with `CONTROLLED_OBSERVABILITY_ALERT` and a `CRITICAL observability alert` annotation.
3. Confirm the configured repository notification reaches the responsible channel.
4. Dispatch again with `force_alert=false` and confirm recovery.

## Health, smoke, and release verification

Run locally:

```powershell
npm run audit:observability
npm run observability:smoke
```

With staging Edge coverage:

```powershell
$env:E2E_SUPABASE_URL='https://<staging-ref>.supabase.co'
$env:E2E_SUPABASE_ANON_KEY='<staging-publishable-key>'
npm run observability:smoke
```

The Maxxis Deal AI health endpoint is `GET /functions/v1/maxxis-chat?health=1`. It returns only status, function, and release plus `x-request-id`; it never calls Gemini or reads user data.

For each release verify:

1. frontend and Edge release identifiers match the intended Git SHA;
2. source-map upload ran only in the authenticated build and no `.map` is publicly referenced;
3. ErrorBoundary fallback still renders with no DSN;
4. normal health smoke passes twice against staging;
5. Sentry receives one controlled non-production smoke event when a DSN is configured;
6. the deployment marker/release is visible before traffic is promoted.

## Incident triage

1. Identify journey, environment, release, and alert severity.
2. Correlate browser event and Edge event using operation, time window, and `x-request-id` when available.
3. Compare the failing release with the previous release and inspect provider/status/error category.
4. For Stripe or unlock integrity uncertainty, stop retries that could duplicate financial mutations and verify idempotency state first.
5. For AUTH/RLS, do not weaken policies as mitigation. Reproduce with the least-privileged staging user.
6. For Maxxis Deal AI provider degradation, preserve the safe fallback and do not expose raw Gemini errors.
7. Record mitigation, affected release, validation evidence, and recovery time.

## Readiness gate

Code readiness is verified by `npm run audit:observability`, unit tests, the full quality suite, staging Edge parity, and two staging smoke passes. Operational readiness additionally requires real values for the Sentry DSN/upload credentials, Sentry alert rules created from the checked-in policy, notification routing confirmed, and one controlled event/alert observed end to end. Missing external credentials must be reported as an operational blocker; they must never be replaced by placeholder secrets or client-exposed tokens.
