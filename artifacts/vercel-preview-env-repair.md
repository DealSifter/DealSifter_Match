# Vercel Preview Build Environment Repair

Date: 2026-09-09  
Branch: `fix/production-real-defects`  
Implementation commit: `32a89dd`

## Root cause

`scripts/check-build-env.mjs` previously enabled strict Production validation
whenever either `CI` or `VERCEL` existed. Every Vercel Preview has `VERCEL=1`
and normally compiles with a production-oriented Node/Vite mode, so Preview was
misclassified and required all eleven Production public values.

The defect was not caused directly by `NODE_ENV`; the equivalent incorrect
classification was `Boolean(process.env.CI || process.env.VERCEL)`.

## Previous behavior

- Vercel Production: strict validation.
- Vercel Preview: incorrectly received the same strict Production validation.
- Local development: missing values produced warnings and did not block.
- The failure message always said `production environment invalid`, regardless
  of the actual Vercel deployment target.

## New behavior and environment authority

`VERCEL_ENV` is the deployment-environment authority when `VERCEL=1`:

| Context | Decision | Build behavior |
| --- | --- | --- |
| `VERCEL_ENV=production` | Production | All 11 public Production values are required; fail closed |
| `VERCEL_ENV=preview` | Preview | Production-only Stripe values are not build requirements |
| `VERCEL_ENV=development` | Vercel Development | Non-blocking development validation |
| Vercel without valid `VERCEL_ENV` | Unknown | Fail closed because the target cannot be classified |
| Generic CI outside Vercel | CI | Existing strict behavior preserved |
| Explicit `--strict` | Strict | Existing strict audit behavior preserved |
| Local execution | Development | Existing non-blocking behavior preserved |

Vercel documents `VERCEL_ENV` as a system environment variable whose standard
values are `production`, `preview`, and `development`:
https://vercel.com/docs/environment-variables/system-environment-variables

## Build-time and runtime contract

- `BUILD_REQUIRED` for Preview: none of the application credentials or Stripe
  price IDs. Vite can compile without them.
- `PREVIEW_RUNTIME_REQUIRED`: public Supabase URL, public Supabase anon key, and
  App URL. Their absence is reported as a Preview runtime warning, not falsely
  treated as a compile-time Production failure.
- `PRODUCTION_ONLY`: Stripe P5/P15/P40/P100, Pro monthly/annual, and Enterprise
  monthly/annual price IDs.
- `PRODUCTION_REQUIRED`: the 3 public runtime values plus all 8 Stripe price IDs.
- Secret-like `VITE_*` variables remain forbidden and fail CI/Vercel builds.

No Production value or secret was copied to Preview. The Vercel environment
inventory showed that the public staging/runtime variables currently exist only
for selected historical Preview branches, not for this branch. That is a
separate Preview runtime-configuration concern and no longer blocks compilation.

## Tests and simulations

`npm run test:build-env`: PASS, 6/6.

Covered cases:

1. Production with complete variables: PASS.
2. Production missing one required value: FAIL.
3. Preview without Production-only Stripe values: PASS.
4. Preview missing a runtime-only public value: warning and build validation PASS.
5. Local development with incomplete environment: warning and PASS.
6. Vercel without `VERCEL_ENV`: FAIL closed.

Explicit simulations:

- Preview validator: PASS, `strict=no`.
- Development validator: PASS, `strict=no`.
- Production validator with all required values absent: expected exit code 1.
- Full `npm run build` with `VERCEL=1` and `VERCEL_ENV=preview`: PASS; 895
  modules transformed; Vite build completed.

## Real Vercel Preview

- Deployment ID: `dpl_9QP5H4dFQAimuLPiY9nZ9vwHKQ96`
- Implementation commit: `32a89dd`
- Target: `preview`
- Status: `READY`
- URL: https://dealsiftermatch-c58sjjv1q-deal-sifter-match-s-projects.vercel.app

This deployment completed where preceding automatic Preview deployments failed
after approximately 15 seconds.

## Non-blocking warnings

- Node version: `package.json` requires `>=22.17.0 <23`; local validation used
  Node `22.17.0`. The reported Vercel Project Setting `24.x` versus effective
  `22.x` remains `NODE_VERSION_WARNING_ONLY` and was not changed.
- `npm audit`: 3 vulnerabilities (2 moderate, 1 high). Reported only; no
  `npm audit fix`, dependency update, or lockfile mutation was performed.

## Scope integrity

- Production application deploy: not performed.
- Functional application behavior: unchanged.
- Maxxis: unchanged.
- Supabase/database/data: unchanged.
- Stripe configuration: unchanged.
- Auth/RLS/Nuggets: unchanged.
