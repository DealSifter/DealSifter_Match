# Release Checklist

## Preflight

- [ ] Release work is being performed only from `repair/maxxis-runtime` (R1-R8) and `npm run audit:release` passes.
- [ ] The target is explicit (`TARGET_ENV=staging` or `TARGET_ENV=production`); CLI link and `VITE_SUPABASE_URL` are not release authority.
- [ ] Frontend SHA, local Function hashes, remote Function versions and migration head are recorded in the release evidence.
- [ ] Level A behavior heartbeat is executed (definition validation alone is insufficient) and affected real-runtime heartbeats pass against authenticated staging.
- [ ] Scope/commit inventory reviewed; user changes preserved; release branch current.
- [ ] Environment and secret audits pass without printing secret values.
- [ ] Generated Supabase types have zero staging drift.
- [ ] Migrations are reviewed, additive where possible, and dry-run against staging.
- [ ] Backup/recovery point and rollback/compensation owner are confirmed.
- [ ] `npm run quality`, architecture, performance, privacy/consistency, mocked E2E, two real staging E2E runs, mobile and accessibility all pass with zero final retries.
- [ ] Supabase logs, requestId correlation, browser network/console and Vercel/GitHub logs are ready.
- [ ] Sentry is optional and non-blocking; missing Sentry access, tokens, alerts or sourcemaps cannot block release.
- [ ] Feature flags start at the approved environment/audience percentage; kill switches are independently verified.

## Rollout

- [ ] Deploy to staging, run smoke and validate database/function parity.
- [ ] Obtain explicit production authorization and use staged exposure where supported.
- [ ] Record release SHA, migration versions and flag configuration.

## Post-deploy

- [ ] Verify auth, feed, Matches, Maxxis Deal AI, unlock/nugget, chat, payments and admin health.
- [ ] Check error rate, latency, cost/rate-limit metrics and product funnel events without PII.
- [ ] Keep rollback window staffed; close only after the observation period and evidence are recorded.

