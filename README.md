# DealSifter Match

DealSifter is a real estate matching app for investors, wholesalers, FSBO owners, lenders, service providers, and support/admin workflows. The product combines swipe-style discovery, map-based inventory, paid contact unlocks, spotlight placement, Stripe billing, Supabase Auth/DB, and internal chat/support operations.

This README is the starting point for running, testing, and operating the project.

## Stack

- React 19
- Vite 7
- Supabase Auth, Postgres, Storage, Realtime, RPCs, and Edge Functions
- Stripe Checkout, Billing Portal, webhooks, and reprocess queue
- Leaflet / React Leaflet for MapView
- Framer Motion for UI motion
- Vitest for unit tests
- Vercel for production deploy

## Setup Local

1. Clone the repository:

```bash
git clone https://github.com/DealSifter/DealSifter_Match.git
cd DealSifter_Match
```

2. Install dependencies:

```bash
npm install
```

3. Configure local environment variables.

Required frontend variables include:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- Stripe public/price variables used by checkout and pricing flows

Backend secrets for Supabase Edge Functions include Stripe, Supabase service role, webhook, and optional email provider keys.

Environment references:

- [docs/VERCEL_ENV.md](docs/VERCEL_ENV.md)
- [docs/SEGURANCA_ENV.md](docs/SEGURANCA_ENV.md)

4. Run locally:

```bash
npm run dev
```

The local app runs on `http://localhost:5174`.

## Build And Deploy

Run a production build locally:

```bash
npm run build
```

Production is deployed on Vercel. The active GitHub repository is:

```text
https://github.com/DealSifter/DealSifter_Match.git
```

Branches used in the current workflow:

- `dev`: working branch for implementation
- `main`: production branch mirrored from `dev` after validation

Vercel production deploys are published to:

```text
https://dealsiftermatch.vercel.app
```

## Required Tests Before PR

Every PR must pass:

```bash
npm run lint
npm run test
npm run build
```

Do not merge visual, billing, auth, unlock, map, or chat changes without running those commands.

## Visual QA

Every PR with visual changes must include the result of:

- [docs/QA_DEPLOY_MOBILE.md](docs/QA_DEPLOY_MOBILE.md)

At minimum, validate mobile Safari, Android Chrome, theme switching, logo assets, Feed, Matches, MapView, modals, and PWA install behavior.

## Supabase

Supabase owns:

- Auth and email confirmation
- Postgres tables, RLS, RPCs, migrations
- Storage buckets for user/card assets
- Edge Functions
- Realtime subscriptions for chat, unlock notifications, plan/subscription refresh, and operational events

Apply database migrations:

```bash
supabase db push
```

Deploy Edge Functions:

```bash
supabase functions deploy <function-name>
```

Run or inspect RPCs from Supabase SQL Editor when validating production behavior. Useful QA docs:

- [docs/QA_RPC_UNLOCKED_CONTACT_CARDS.md](docs/QA_RPC_UNLOCKED_CONTACT_CARDS.md)
- [docs/AUTH_EMAIL_CHECKLIST.md](docs/AUTH_EMAIL_CHECKLIST.md)
- [docs/POLITICA_DADOS_LGPD.md](docs/POLITICA_DADOS_LGPD.md)

Production Supabase dashboard:

```text
https://supabase.com/dashboard
```

## Stripe

Stripe is used for:

- Nugget packs
- Subscription plans
- Billing Portal
- Webhooks as the source of truth for financial events
- Reprocessing failed/out-of-order webhook events

Use Stripe test mode for local validation. Do not use live keys in local experiments unless intentionally testing production checkout.

Financial and operational references:

- [docs/RUNBOOK_STRIPE.md](docs/RUNBOOK_STRIPE.md)
- [docs/QA_E2E_FLUXOS_FINANCEIROS.md](docs/QA_E2E_FLUXOS_FINANCEIROS.md)
- [docs/CHECKOUT_FINANCIAL_FLOW_AUDIT.md](docs/CHECKOUT_FINANCIAL_FLOW_AUDIT.md)

## Incident Runbooks

Production incident procedures are documented in:

- [docs/RUNBOOK_INCIDENTES.md](docs/RUNBOOK_INCIDENTES.md)
- [docs/RUNBOOK_GEOCODING.md](docs/RUNBOOK_GEOCODING.md)
- [docs/RUNBOOK_STRIPE.md](docs/RUNBOOK_STRIPE.md)

Use these before making emergency code changes.

## Folder Structure

- `src/pages/`: main app screens such as Feed/Dashboard, MapView, Matches, Settings, AdminDashboard, Onboarding, Pricing.
- `src/components/`: reusable UI components, cards, modals, layout, matches panels, and shared widgets.
- `src/services/`: runtime services for Supabase-backed behavior, plan usage, unlocks, chat, support, Stripe helpers, theme, consent, map inventory, and feed state.
- `src/lib/`: pure helpers, normalization, formatting, security guards, entitlement logic, observability helpers, and local storage policy.
- `src/hooks/`: React hooks for realtime, checkout, media queries, and notification flows.
- `src/i18n/`: translation dictionaries and translation utilities.
- `src/assets/`: bundled images and app visual assets.
- `supabase/migrations/`: database migrations and RPC definitions.
- `supabase/functions/`: Supabase Edge Functions.
- `docs/`: QA checklists, runbooks, audits, production gaps, and operational procedures.

## Current Development Discipline

- Keep business logic out of UI components whenever possible.
- Financial, unlock, entitlement, and plan decisions must be validated by Supabase RPCs or dedicated services.
- Do not use `localStorage` as a source of truth for paid access, nuggets, subscriptions, unlocks, or matches.
- Do not commit `.bak` files under `src/`; `.gitignore` blocks `src/**/*.bak`.
- Keep commits focused and easy to revert.
