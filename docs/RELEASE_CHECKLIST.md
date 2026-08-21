# Release Checklist

## Preflight

- [ ] Scope/commit inventory reviewed; user changes preserved; release branch current.
- [ ] Environment and secret audits pass without printing secret values.
- [ ] Generated Supabase types have zero staging drift.
- [ ] Migrations are reviewed, additive where possible, and dry-run against staging.
- [ ] Backup/recovery point and rollback/compensation owner are confirmed.
- [ ] `npm run quality`, architecture, performance, privacy/consistency, mocked E2E, two real staging E2E runs, mobile and accessibility all pass with zero final retries.
- [ ] Sentry/release health, alerts and dashboards are ready.
- [ ] Feature flags start at the approved environment/audience percentage; kill switches are independently verified.

## Rollout

- [ ] Deploy to staging, run smoke and validate database/function parity.
- [ ] Obtain explicit production authorization and use staged exposure where supported.
- [ ] Record release SHA, migration versions and flag configuration.

## Post-deploy

- [ ] Verify auth, feed, Matches, Maxxis, unlock/nugget, chat, payments and admin health.
- [ ] Check error rate, latency, cost/rate-limit metrics and product funnel events without PII.
- [ ] Keep rollback window staffed; close only after the observation period and evidence are recorded.

