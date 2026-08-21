# DealSifter Disaster Recovery and Rollback Runbook

Last validated: 2026-08-15. This runbook covers the frontend, Supabase database,
Edge Functions, Stripe state, Nuggets, unlocks, messaging and Maxxis.

## Safety boundary

- Production Supabase project: `cyeipfskwwisbbayyaca`.
- Recovery/staging project: `oqdcnjupquhybwdbeeew`.
- Never restore a backup over production as a diagnostic step.
- Never run `db reset`, destructive SQL, fixture cleanup or the recovery drill against production.
- Commands marked **DANGER / PRODUCTION** require a second human to confirm the target project, recovery point and rollback plan.

## 1. Incident classification

- **SEV-1:** confirmed data loss/corruption, unauthorized financial mutation, cross-account disclosure, duplicate Stripe/Nugget credit, or widespread write failure.
- **SEV-2:** localized inconsistency, failed migration/function release, delayed webhook processing, or degraded recovery objectives without confirmed loss.
- **SEV-3:** warning-only integrity findings, isolated retry/backlog, or a non-critical operational regression.

## 2. Detection and ownership

Sentry/observability alerts, GitHub Actions, Supabase logs, Stripe webhook health and
the read-only integrity auditor can detect an incident. The incident commander owns
the timeline; a database owner controls recovery; a payments owner controls Stripe
reconciliation. Record UTC timestamps, release SHA, migration version and request IDs.

Run the aggregate auditor with a service-role key supplied only through the process environment:

```powershell
$env:DATA_INTEGRITY_SUPABASE_URL='https://<staging-ref>.supabase.co'
$env:DATA_INTEGRITY_SERVICE_ROLE_KEY='<service-role-key>'
node scripts/audit-data-integrity.mjs
```

The script blocks the production project unless the operator deliberately supplies its
read-only override. Its output contains counts/categories only, not row data or PII.

## 3. First response

1. Declare severity and stop promotion/deployment pipelines.
2. Capture the current frontend deployment ID, Git SHA, Edge Function versions and migration list.
3. Preserve Sentry/Supabase/Stripe logs; do not paste tokens, request bodies or customer data into the incident channel.
4. Run the read-only consistency auditor.
5. Determine whether writes, only one subsystem, or the entire product must be contained.

## 4. Kill switches

Use the existing server-side controls when Maxxis cost, messaging or unlock integrity is at risk:

- `MAXXIS_ENABLED=false`
- `PROVIDER_MESSAGING_ENABLED=false`
- `CONTACT_UNLOCK_ENABLED=false`

Changing a production secret is **DANGER / PRODUCTION**. Confirm the project ref and
record the previous value before using `supabase secrets set ... --project-ref cyeipfskwwisbbayyaca`.
Re-enable only after the post-recovery checklist passes.

## 5. Preventing new writes

Prefer narrow containment first: kill the affected Maxxis/messaging/unlock capability,
disable the affected Stripe webhook endpoint in Stripe when payments are unsafe, or
roll the frontend back to a known-good deployment. A database-wide read-only change is
not a routine action and requires Supabase support/database-owner approval.

Do not rely on a frontend maintenance page as the only write barrier: existing clients
and direct API calls may remain active.

## 6. Evidence preservation

Preserve UTC time range, release SHA, deployment IDs, migration history, sanitized audit
output, Stripe event IDs, affected technical UUIDs and row counts. Do not export secrets,
Authorization headers, chat text, addresses, contact details or full Stripe payloads.

## 7. Identifying a migration problem

In staging, the validated read-only commands are:

```powershell
supabase migration list --password '<staging-db-password>'
supabase db push --dry-run --password '<staging-db-password>'
```

Compare the first failing migration with its Git commit and the actual constraint/function
state. Do not use migration repair merely to hide a failed or partially applied migration.

## 8. Edge Function rollback

Select the last known-good Git commit, inspect its function/config diff, and deploy only
the affected function from a clean temporary worktree. The deploy syntax already used by
this project is:

```powershell
supabase functions deploy <function-name> --project-ref <target-project-ref>
```

**DANGER / PRODUCTION:** verify `<target-project-ref>` is exactly
`cyeipfskwwisbbayyaca`, obtain human confirmation, deploy one function at a time, then
run authenticated/unauthenticated smoke tests and the integrity auditor.

## 9. Frontend/Vercel rollback

The installed CLI supports rollback by deployment ID or URL:

```powershell
npx vercel rollback <known-good-deployment-id-or-url>
```

**DANGER / PRODUCTION:** confirm the deployment belongs to the DealSifter production
project, verify its Git SHA and environment, then obtain human confirmation. Check
`npx vercel rollback status` and run the browser smoke suite after completion.

## 10. Incompatible migrations

Do not automatically reverse a migration that dropped/transformed data. Freeze new
writes, preserve evidence and decide between forward-fix and restore. Additive tables,
indexes, functions and `NOT VALID` constraints should normally remain while application
code is rolled back.

## 11. Forward-fix versus rollback SQL

Prefer forward-fix when the deployed migration is additive or data has already been
written under the new schema. Rollback SQL is acceptable only when it is explicitly
reviewed, proven lossless on a restored/non-production copy and approved by the database
owner. Never improvise `DROP`, `TRUNCATE` or mass `UPDATE` in production.

## 12. Database recovery

Verified provider facts on 2026-08-15:

- `supabase backups list --project-ref oqdcnjupquhybwdbeeew --output json` returned no backups and `pitr_enabled=false` for staging.
- Supabase documents daily physical backups for Pro/Team/Enterprise projects and recommends regular logical `supabase db dump` exports for free-tier projects.
- Restore-to-new-project is a paid feature using a physical backup/PITR source and may incur additional cost.
- Database backups do not restore Storage API objects; storage requires a separate recovery plan.

Official references:

- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/platform/clone-project

For a real incident, prefer restoring the chosen backup/PITR point to a new isolated
project, disabling external side effects there, and validating it before traffic cutover.
Restoring in-place makes the source project unavailable and is **DANGER / PRODUCTION**.

The staging drill in this repository validates a fixture-scoped logical snapshot and
restore because staging currently has no physical backup/PITR:

```powershell
$env:RECOVERY_DRILL_SUPABASE_URL='https://oqdcnjupquhybwdbeeew.supabase.co'
$env:RECOVERY_DRILL_SERVICE_ROLE_KEY='<staging-service-role-key>'
$env:RECOVERY_DRILL_CONFIRM='staging-fixtures-only'
node scripts/recovery-drill.mjs
```

## 13. Post-restore validation

1. Confirm migration history and required extensions/functions.
2. Confirm primary/foreign/check constraints and indexes.
3. Confirm RLS is enabled and policies/grants deny anonymous cross-account access.
4. Run `node scripts/audit-data-integrity.mjs`.
5. Run Vitest, mocked Playwright and real-backend Playwright against the restored target.
6. Compare sanitized counts/hashes for users, profiles, properties, services, workflows,
   pending actions, subscriptions and local payment records.
7. Confirm no restored environment can send email, provider messages, Stripe mutations or unlocks.

## 14. Stripe reconciliation

Use Stripe as the external financial source for covered payments/subscriptions. Compare
event IDs, checkout session/payment IDs, subscription IDs/statuses and local processing
timestamps. Replay through the existing idempotent webhook/reprocess path only after
signature/event ownership verification. Never directly credit Nuggets to “balance” a
discrepancy without an approved reconciliation record.

## 15. Nuggets reconciliation

For each affected technical user ID, establish opening balance, completed unique purchases,
admin grants and unique unlock debits. Required invariant: opening + valid credits - unique
debits = stored non-negative balance. Duplicate retries and cancelled/failed intents contribute
zero. Any manual correction requires an audited admin operation and two-person review.

## 16. Unlock reconciliation

Validate buyer, seller/owner, property, profile scope, cost, intent state and entitlement
uniqueness. The property owner must match the stored unlock owner. Do not reconstruct an
unlock from chat/contact payloads. Keep messaging and unlock kill switches off until all
CRITICAL unlock audit categories are zero.

## 17. Messaging consistency

Validate sender, recipient/provider, entitlement, pending action state and message result ID.
Cancelled actions must have no message; executed provider-message actions must have a result.
Do not resend messages automatically during recovery.

## 18. Workflow consistency

Validate `(user_id, property_id, code)` uniqueness, allowed manual codes, source, status and
completion timestamp. Reconciliation must preserve a legitimate manual completion and must
not mutate property or financial state.

## 19. Reopening criteria

- Root cause contained and known-good application/functions selected.
- Integrity auditor reports no HIGH/CRITICAL findings.
- Stripe/Nuggets/unlocks reconcile for the affected interval.
- RLS/cross-account and replay tests pass.
- Mocked and real-backend E2E pass with zero retries.
- Error/rate/budget metrics have returned to expected levels.
- Incident commander and database/payments owners approve reopening.

## 20. Post-incident checklist

- Record final timeline, scope, recovery point, RPO/RTO achieved and residual data loss.
- Rotate any credential that could have been exposed.
- Re-enable external integrations and kill switches one at a time.
- Monitor Sentry, Supabase and Stripe during a defined observation window.
- Capture sanitized reconciliation evidence and CI links.
- Add regression tests and a forward-fix migration where needed.
- Schedule a new recovery drill and review backup retention/cost.
