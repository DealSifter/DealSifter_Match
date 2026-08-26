# E2E Testing

The DealSifter Match E2E suite runs with Playwright and Chromium.

The default mode is intentionally safe: the real browser opens the real app, while Supabase Auth, PostgREST RPCs and Edge Functions are intercepted with namespaced E2E fixtures. This prevents production writes, live Stripe usage, real Nugget debits and service-role exposure in the browser.

A separate real-backend integration suite exists for staging/test Supabase only. It creates temporary users and records with a unique `E2E_RUN_ID`, authenticates through real Supabase Auth, calls real PostgREST/RPC/Edge Functions, and then deletes only the exact fixture users it created.

## Commands

```bash
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:ci
npm run test:e2e:integration
```

Install the Chromium browser once per environment if needed:

```bash
npx playwright install chromium
```

Start the local E2E app server before running the tests:

```bash
VITE_APP_URL=http://127.0.0.1:4180 \
VITE_SUPABASE_URL=http://127.0.0.1:54321 \
VITE_SUPABASE_ANON_KEY=e2e-local-anon-key \
npm run dev:e2e
```

Start the real-backend integration app server against a staging/test Supabase project:

```bash
E2E_BACKEND_MODE=real \
E2E_BASE_URL=http://127.0.0.1:4181 \
E2E_SUPABASE_URL=https://your-staging-ref.supabase.co \
E2E_SUPABASE_ANON_KEY=your-staging-public-key \
E2E_SUPABASE_SERVICE_ROLE_KEY=your-staging-service-role-key \
VITE_APP_URL=http://127.0.0.1:4181 \
VITE_SUPABASE_URL=https://your-staging-ref.supabase.co \
VITE_SUPABASE_ANON_KEY=your-staging-public-key \
npm run dev:e2e:integration
```

## Environment

- `E2E_BASE_URL`: app URL. Defaults to `http://127.0.0.1:4180`.
- `E2E_SUPABASE_URL`: intercepted Supabase URL. Defaults to `http://127.0.0.1:54321`.
- `E2E_SUPABASE_ANON_KEY`: public placeholder key used by the browser.
- `E2E_RUN_ID`: namespace for fixtures and generated test data.
- `E2E_INVESTOR_EMAIL`, `E2E_INVESTOR_PASSWORD`, `E2E_PROVIDER_EMAIL`, `E2E_PROVIDER_PASSWORD`, `E2E_INCOMPLETE_EMAIL`, `E2E_INCOMPLETE_PASSWORD`, `E2E_NO_NUGGETS_EMAIL`, `E2E_NO_NUGGETS_PASSWORD`: optional user overrides.

Service-role credentials are not used by browser tests.

Real-backend integration adds:

- `E2E_BACKEND_MODE=real`: required explicit opt-in.
- `E2E_SUPABASE_SERVICE_ROLE_KEY`: required only in the Playwright Node worker to create and clean staging fixtures. It is never exposed to the browser bundle.
- `MAXXIS_E2E_LLM_STUB=1`: optional Supabase Edge Function secret for the staging/test project when Gemini is not configured. This stubs only LLM routing; the Edge Function, JWT validation, Supabase queries, RLS and Maxxis Deal AI tools remain real. The current guard allows this only on the staging project ref `oqdcnjupquhybwdbeeew`.

## Current coverage

- Auth: valid login, invalid login, logout, reload/session persistence and account switch without visible leakage.
- Profile: profile loading, allowed profile update persistence and `profile_version` conflict rejection.
- Feed/property/Maxxis Deal AI: investor enters showcase, requests structured property/Deal Copilot data, receives service needs/provider fit, prepares provider unlock and cancels before any debit.
- Security negatives: public inventory omits protected fields, contact data stays hidden before unlock, protected functions reject missing JWT, invalid origin is rejected, message draft/cancel does not send.

## Real-backend integration coverage

- Auth: real login, session persistence after reload, logout/account switch, and no visible leakage from User A to User B.
- Profile: real profile load, `ds_save_professional_profile` save, reload persistence and optimistic concurrency conflict.
- Property/feed: real fixture property from Supabase through `ds_get_global_feed_inventory`, with private address/geolocation/contact fields hidden.
- Maxxis Deal AI: real staging/test Edge Function calls. Gemini is preferred; if `MAXXIS_E2E_LLM_STUB=1` is set, only LLM routing is stubbed and real Maxxis Deal AI tools still execute against Supabase/RLS.
- Provider: real service fixture, provider search/service fit through Maxxis Deal AI, provider unlock prepare quote, then cancel.
- Nuggets/unlock safety: prepare+cancel leaves user Nuggets unchanged and creates no `unlocks` row.
- Privacy/RLS: browser-captured RPC/API payloads are checked for fixture emails/phones/WhatsApp/full address/exact coordinates/unlock data; cross-account base-table reads are empty; anonymous protected Edge Function calls reject.

For cross-account privacy assertions, `user_profiles` is the public identity-card table by design. Its allowed public contract is limited to `id`, `user_id`, `full_name`, `photo_url`, `bio`, `visibility`, `created_at` and `updated_at`. The real suite permits these fields while still rejecting contact PII, private `profile_payload`, administrative data and protected property fields.

## Safety guard

`playwright.config.js` blocks destructive E2E runs against known production hosts.

`playwright.integration.config.js` additionally requires `E2E_BACKEND_MODE=real`, a service-role key for fixture cleanup, and a non-production Supabase project ref. The production project ref `cyeipfskwwisbbayyaca` is explicitly rejected.

## Cleanup model

The default suite uses intercepted mock responses, so no remote cleanup is required.

The real-backend integration suite creates temporary Auth users and application rows containing `E2E_RUN_ID`. Cleanup deletes only the exact created Auth user IDs, relying on `on delete cascade` for owned rows and deleting related app events by those user IDs. Never point this suite at production.

## CI

`.github/workflows/quality.yml` runs the regular quality gate first, then a separate mocked browser E2E job. The mocked E2E job has no `continue-on-error` and does not mask failures.

The real-backend `e2e-integration` job is manual (`workflow_dispatch`) and requires staging/test secrets:

- `E2E_SUPABASE_URL`
- `E2E_SUPABASE_ANON_KEY`
- `E2E_SUPABASE_SERVICE_ROLE_KEY`

Do not configure production secrets for this job.
