# Maxxis staging real-runtime acceptance gate

This gate is the release authority for changes that affect Maxxis Deal AI, Gemini, tools, trusted context, property intelligence, Phase 6, or proactivity. Unit tests and mocked E2E remain mandatory PR checks, but they do not replace this gate.

## Official commands

```text
npm run test:heartbeat:staging
npm run test:heartbeat:staging -- --variance-check
npm run test:heartbeat:staging:variance
npm run gate:maxxis:staging
npm run gate:maxxis:staging:variance
npm run gate:maxxis:staging -- --variance-check
```

The target is hard-locked to staging project `oqdcnjupquhybwdbeeew`. Production, another Supabase project, a missing staging credential, non-real runtime modes, or `MAXXIS_E2E_LLM_STUB` abort before fixture setup. Credentials are supplied only through process environment variables and are never written to artifacts or logs.

## Gate composition

1. Acceptance-specific lint.
2. Database/TypeScript contract audit.
3. Acceptance, routing, status, and provider-failure contract tests.
4. Production build.
5. Authenticated real-runtime HB-01..HB-10 against the deployed staging `maxxis-chat`.

The runner verifies the R1 baseline lock, current local function hash, controlled staging deployment receipt, remote function version, and deployed SHA ancestry before sending a heartbeat. It verifies the remote version again afterwards.

## Fixture and evidence

The real staging fixture uses a unique `r2-*` run ID, canonical IDs returned by staging, explicit setup, and mandatory cleanup. Any cleanup failure makes the run `INCOMPLETE` even if every heartbeat passed.

Each run writes a sanitized ignored artifact under `artifacts/heartbeat/`. It contains candidate SHA, R1 baseline SHA, frontend source evidence, staging function version/hash, staging migration head, run/heartbeat/request IDs, model, tool, provider status, duration, semantic classification, attempts, first failure, final result, and fixture lifecycle. It contains no message body, email, password, session, key, token, property address, or contact data.

## Variance and failures

`--variance-check` repeats HB-05, HB-06, and HB-07 exactly three times; other heartbeats run once. Mixed PASS/FAIL attempts are `FLAKY`, and FLAKY blocks release. There are no runner retries. Provider retry remains bounded by the product's existing execution budget.

Real calls are started at least eight seconds apart to remain below the staging provider's request-rate ceiling. This pacing is not a retry: every configured attempt is still recorded exactly once.

Failures are classified as `PRODUCT`, `CONTRACT`, `DATA`, `SECURITY`, `FIXTURE`, `ENVIRONMENT`, `INFRASTRUCTURE`, or `PROVIDER_EXTERNAL`. Controlled provider-failure simulations are unit-test evidence only and are explicitly not real-Gemini proof.

## CI policy

The normal Quality Gate remains the PR gate. The real-runtime release job is manual, protected by the explicit `staging` environment, staging-only, concurrency-locked, timed out, and artifact-producing. The approved execution model is GitHub-hosted `ubuntu-latest`; only the staging service-role credential is available to that manually dispatched job. Production is not a selectable target.
