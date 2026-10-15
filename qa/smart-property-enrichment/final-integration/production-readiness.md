# Production readiness and rollback

Baseline frontend: `6dbb16397f531137e357ed4c1d884d9fc37ee792`, verified READY deployment `dpl_Dm2hkkEgZiMHnNv9pFWAcqB1dhk9`. Mandatory original map hotfix: `0f3e6d8fcf8ab91e31b7a7452ec4ea0f36aae6aa`. Current integration starts at `1e8b3b0aeed778fce1a7f80d27db4c74241cd08c`; no old whole-file restoration or stash replay.

## Deployment gate and order

Deployment remains pending until the complete current deterministic suite, original 78 map tests, real Leaflet/app navigation, owner notification/review integration, local PostgreSQL RLS/migration checks, lint/contracts, modern/legacy build and zero-new-error Deno comparison pass. Do not turn a blocked authenticated production session into PASS.

1. Commit the reviewed code and safe QA metadata, then push the exact branch/SHA.
2. Recheck production migration history. Apply only `20261014213000_smart_property_fact_review.sql` with its migration ledger entry in one transaction, a 3-second lock timeout and 20-second statement timeout. Do not run a blanket database push.
3. Deploy only the dependency closure in `backend-dependency-closure.json`. The conservative graph includes `maxxis-chat`, `public-parcel`, new `property-fact-review`, and the two consumers of the modified shared types: `maxxis-deal-workflow`, `maxxis-provider-message-draft`. JWT verification remains enabled.
4. Deploy the exact pushed frontend SHA. Verify READY and production alias ownership. Record Edge versions, unchanged flags/secrets and migration metadata afterward.
5. Run production-asset smoke with explicitly simulated authentication. Real authenticated production smoke remains BLOCKED unless a legitimate user session is actually available.

## Boundaries

No new feature-flag framework. Existing public parcel licensing/registry, authentication, budgets, timeouts, privacy and source eligibility remain authoritative. No live paid provider acquisition in automatic enrichment. No private review decisions in provider/public caches. Public effective facts are separately sanitized and address-private parcel identifiers remain protected.

EffectivePropertyFacts are display/direct-fact-review inputs only. Financial engines, valuation and scenario calculations do not consume them. The pending independent factual APN export fix uses the existing signed parcel-evidence/canonical report path, not this review projection. Both changes may share the final release commit without migrating L1/L2/L3 to effective facts.

## Code rollback / feature disable

Use existing operator release controls to promote the previously verified READY frontend deployment above; do not reset the working branch or discard local work. This removes the new review UI without changing existing Parcel Lens availability. There is no dedicated enrichment kill switch; do not disable the already-public parcel feature as a substitute.

For affected existing Edge functions, redeploy their source/dependency closure from the verified baseline SHA using a separate clean stage. Keep JWT verification and all existing secrets/flags. The owner-only new endpoint may remain deployed but unused by the old frontend; no destructive function deletion is required for rollback.

## Database forward-fix strategy

Leave additive sidecar/history tables and saved decisions intact during code rollback. Do not drop tables, rewrite existing rows, or infer legacy zero values. Nullable optional columns remain compatible with old writers. Correct any schema/RLS issue using a new reviewed forward migration; never overwrite an applied migration. If a lock timeout or any statement fails, the targeted transaction must roll back atomically.

## Current status

PENDING final validation and deployment receipts. This document is a plan, not a production-deploy PASS receipt.
