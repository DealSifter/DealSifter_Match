# E2E Testing

The DealSifter Match E2E suite runs with Playwright and Chromium.

The default mode is intentionally safe: the real browser opens the real app, while Supabase Auth, PostgREST RPCs and Edge Functions are intercepted with namespaced E2E fixtures. This prevents production writes, live Stripe usage, real Nugget debits and service-role exposure in the browser.

## Commands

```bash
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:ci
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

## Environment

- `E2E_BASE_URL`: app URL. Defaults to `http://127.0.0.1:4180`.
- `E2E_SUPABASE_URL`: intercepted Supabase URL. Defaults to `http://127.0.0.1:54321`.
- `E2E_SUPABASE_ANON_KEY`: public placeholder key used by the browser.
- `E2E_RUN_ID`: namespace for fixtures and generated test data.
- `E2E_INVESTOR_EMAIL`, `E2E_INVESTOR_PASSWORD`, `E2E_PROVIDER_EMAIL`, `E2E_PROVIDER_PASSWORD`, `E2E_INCOMPLETE_EMAIL`, `E2E_INCOMPLETE_PASSWORD`, `E2E_NO_NUGGETS_EMAIL`, `E2E_NO_NUGGETS_PASSWORD`: optional user overrides.

Service-role credentials are not used by browser tests.

## Current coverage

- Auth: valid login, invalid login, logout, reload/session persistence and account switch without visible leakage.
- Profile: profile loading, allowed profile update persistence and `profile_version` conflict rejection.
- Feed/property/Maxxis: investor enters showcase, requests structured property/Deal Copilot data, receives service needs/provider fit, prepares provider unlock and cancels before any debit.
- Security negatives: public inventory omits protected fields, contact data stays hidden before unlock, protected functions reject missing JWT, invalid origin is rejected, message draft/cancel does not send.

## Safety guard

`playwright.config.js` blocks destructive E2E runs against known production hosts. Keep this guard in place before introducing any staging or database-backed destructive suite.

## Cleanup model

The current default suite uses intercepted mock responses, so no remote cleanup is required. If a future staging suite creates real rows, every row must be namespaced with `E2E_RUN_ID` and cleanup must delete only records owned by that namespace. Prefer permanent controlled fixtures for staging accounts when cleanup would be risky.

## CI

`.github/workflows/quality.yml` runs the regular quality gate first, then a separate browser E2E job. The E2E job has no `continue-on-error` and does not mask failures.
