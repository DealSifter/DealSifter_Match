# Repair Release Safety Protocol (R0)

## Operational source of truth

- Repair worktree: `C:\Users\Tarso\Desktop\DEALSIFTER\DealSifter_Match.worktrees\repair-maxxis-runtime`
- Repair branch: `repair/maxxis-runtime`
- R0 base SHA: `63b2c134a22289bacd7a642dcf4f040ce5a6c1a7`
- Staging Supabase: `oqdcnjupquhybwdbeeew`
- Production Supabase: `cyeipfskwwisbbayyaca`
- Production frontend alias: `https://dealsiftermatch.vercel.app`

R1-R8 must be performed only in the repair worktree. Historical branches, the divergent local `main`, other worktrees and `.tmp-codex` are not repair sources.

## Target contract and production guard

Every remote operation must use `--target=staging` or `--target=production`. Never infer the target from a Vite URL, a generic `POSTGRES_PASSWORD` or the Supabase CLI link.

```powershell
node scripts/release-guard.mjs --target=staging --operation=read-only
node scripts/release-guard.mjs --target=production --operation=deploy --confirm-production=cyeipfskwwisbbayyaca
```

Destructive E2E is always blocked in production. Production deploys, migrations, secret changes and other mutations require the explicit production ref as a second confirmation.

## Mandatory release evidence

Release approval requires all applicable evidence:

1. source parity;
2. frontend parity;
3. explicit environment target;
4. local and remote Edge Function inventory;
5. migration parity;
6. heartbeat contract;
7. authenticated real-runtime heartbeat in staging for Gemini/context/tool changes;
8. sanitized requestId/network/log evidence after deployment.

An ACTIVE Function, a Vercel Ready status, HTTP 200, unit tests or mocked E2E alone are not release authority.

## Read-only audits

```powershell
npm run audit:release
npm run audit:worktrees
npm run audit:env:names
npm run audit:release:staging
npm run audit:release:production
npm run audit:migrations:staging
npm run audit:migrations:production
npm run heartbeat:contract
npm run heartbeat:baseline
```

When the ignored `.env.local` remains in another worktree, set `ENV_AUDIT_SOURCE_DIR` explicitly to that worktree before `npm run audit:env:names`. The auditor prints names and status only, never values.

Migration audits accept only target-specific authority: `SUPABASE_DB_URL_<TARGET>` or `POSTGRES_PASSWORD_<TARGET>` plus versioned target connection metadata. `--env-file` may load an ignored file without logging values. Generic passwords and CLI linking are deliberately rejected.

Staging development readiness and production release readiness are separate gates:

```powershell
node scripts/audit-release.mjs --readiness=staging --affected-function=maxxis-chat --schema-change=false
node scripts/audit-release.mjs --readiness=production --affected-function=maxxis-chat --schema-change=false
```

The staging gate requires a matching controlled-deploy receipt only for the affected staging function. The production gate additionally requires a matching production receipt. Production migration parity is mandatory for a production repair that changes schema, RPC or migrations, but does not block schema-neutral staging work.

## Heartbeat policy

The ten scenarios are versioned in `config/heartbeat-contract.json`.

- Level A (`contract`): fast local/mock behavior contract. R0 versions its definition; until a repair binds each scenario to a functional runner, its result remains `NOT_EXECUTED`.
- Level B (`real`): authenticated staging, real Gemini and real backend. It is the release authority when a repair affects runtime behavior.

The R0-B baseline reuses `realBackendFixture.js`: isolated ephemeral staging users, two canonical properties and a provider/service, followed by cleanup. The exact HB-01..10 runner is `e2e/tests/real-gemini/maxxis-heartbeat-r0.spec.js`; it refuses production through `playwright.real-gemini.config.js`, requires real backend/LLM modes and records sanitized request evidence. No stub or network interception is permitted.

The local R0-B staging baseline uses the existing ephemeral E2E fixture and authenticated real-runtime requests. Fixture rows are isolated by run ID and cleaned after the suite; production data is never used. CI credential wiring remains unchanged until it receives a separate credential-scope review.

Before and after every repair, preserve the results. A PASS may not regress. Targeted FAIL/DEGRADED heartbeats must become PASS.

## Stop rules

Stop promotion when any applicable condition occurs:

- a previously passing heartbeat fails;
- real Gemini cannot be validated for a Gemini/context/tool repair;
- affected Edge Function parity is UNKNOWN;
- auth, RLS or security contracts fail;
- a production destructive E2E target is selected;
- canonical IDs diverge;
- Nugget debit or messages duplicate;
- global visual behavior regresses.

Classify incidents as PRODUCT, CONTRACT, DATA, SECURITY, TEST, FIXTURE, ENVIRONMENT, INFRASTRUCTURE or PROVIDER_EXTERNAL.

## Deployment map

```text
push/PR
  -> GitHub Quality Gate (local checks + mocked browser suites)
  -> Vercel frontend deploy for configured branch

Edge Function deploy
  -> manual Supabase CLI operation with explicit project ref

Migration deploy
  -> manual Supabase CLI operation with explicit target and production confirmation
```

Frontend deployment does not deploy Edge Functions or migrations. GitHub's normal quality workflow uses placeholder/mock services; its success does not prove runtime parity.

## Observability without Sentry

Sentry remains installed but is optional and non-blocking. Primary evidence is Supabase Edge logs, structured sanitized logs, requestId/correlation ID, browser console/network, GitHub Actions logs, Vercel logs and local audit output. Do not log PII, tokens or secrets.

## Commit and canary discipline

Each repair has one responsibility and small reversible commits. Gemini Core, Context, Fase 6 engines and Proactivity must follow staging -> real heartbeat -> limited canary when available -> production. R0 does not authorize any product deploy.
