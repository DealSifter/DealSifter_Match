# Phase 5E performance baseline

Date: 2026-08-15

Scope: staging project `oqdcnjupquhybwdbeeew` only

Production project `cyeipfskwwisbbayyaca`: not queried or modified during Phase 5E

## Method

The database baseline used rollback-only fixture transactions with 12,000 properties,
12,000 services, 2,000 chat messages, 3,000 workflow items, 1,000 pending actions and
1,000 feed actions. Every synthetic database fixture was rolled back. Browser integration
tests used uniquely named users and records and removed them in fixture teardown.

Database timings below are PostgreSQL execution times from `EXPLAIN (ANALYZE, BUFFERS)`.
External timings include the client, network, Supabase gateway/authentication and Edge
runtime where applicable. These two measurements must not be compared as if they measured
the same layer.

## Database before and after

| Operation | Before | After | Result |
| --- | ---: | ---: | --- |
| Public property search, valid result set | 39.093 ms, 884 buffers | 23.853 ms, 468 buffers | `GOOD`, 39% faster and 47% fewer buffers |
| Public property search, direct state filter | sequential/correlated filtering | 0.715 ms with `idx_properties_public_state_created` | `GOOD` |
| Service search, legacy fetch | 8.205 ms; 250 rows; 75,661 bytes | removed | N+1/filtering source eliminated |
| Service search, filtered shape | 28.195 ms; sequential scan over 12,000 rows | 0.557–0.778 ms; about 167 rows examined; 10 returned; 2,708 bytes | `GOOD` |
| Batched service search, two categories | first window implementation: 109.635 ms | 1.994 ms; 6 rows; 1,824 bytes | `GOOD`; lateral bounded lookup retained |
| Secure property details | 0.976 ms; 403-byte payload | unchanged query shape; bounded response | `GOOD` at database layer |
| Latest chat messages | 1.379 ms; 50 rows; 16,742 bytes | existing sender/recipient/time indexes retained | `GOOD` |
| Deal workflow lookup | 0.039 ms | existing `(user_id, property_id)` index retained | `GOOD` |
| Pending actions lookup | 0.044 ms in synthetic fixture | existing user/status/expiry index retained | `GOOD`; synthetic all-match plan is not representative |
| Feed actions lookup | 0.121 ms | existing user/update index retained | `GOOD` |

No duplicate indexes were found and no index was removed. Three forward-only migrations
were applied to staging: public search indexes, a sanitized service-search RPC, a bounded
batched service plan and an active-predicate property-search plan. User values remain query
parameters; they are not interpolated into dynamic SQL.

## Round trips and N+1 inventory

| Flow | Before | After | Classification |
| --- | ---: | ---: | --- |
| Maxxis service matching for property needs | 6–12 service/contact queries as categories grew | 2–4 queries, including contact-access lookup and at most one fallback batch | `GOOD` |
| Deal Copilot overview | 7–8 core database round trips | 5–6, depending on provider summary availability | `GOOD` |
| Deal workflow update | upsert plus redundant final read | upsert returns the authoritative row | `GOOD` |
| Maxxis authenticated tools | repeated `auth.getUser()` inside profile/search/detail/Copilot tools | one top-level authentication reused by trusted internal calls | `GOOD` |
| Feed action hydration | repeated request when identity/feed state converged | single-flight request with safe cached reapplication | `GOOD` |
| Realtime channel lifecycle | replacement could leave a prior channel attached | replacement and dispose remove the exact current channel | `GOOD` |
| Property search | behavior/profile plus bounded search calls | no per-result query; optional context reads remain bounded | `GOOD` |
| Property details | one secure RPC | one secure RPC | `GOOD` |
| Unlock prepare/confirm/cancel | one protected Edge request per action | unchanged; atomic server RPCs remain authoritative | `GOOD` |
| Messaging prepare/confirm/cancel | one protected Edge request per action | unchanged; idempotency and rate gates remain authoritative | `GOOD` |

The compatibility-only injected service matcher still supports a per-category loop for unit
tests. Production uses the batched RPC. The deterministic performance audit reports this as
a `WARNING`, not a production failure.

## Maxxis context and observability

Maxxis now records, in structured operational logs:

- request, system-prompt, tool-declaration and tool-result payload sizes;
- bounded history count;
- total, provider, tool, database and application durations;
- database query count, tool rounds and fallback count.

Deterministic budgets are stored in `config/performance-budgets.json`: maximum 10 history
messages, one tool round, 64,000 bytes of tool payload, 512,000-byte chunk ceiling, six Deal
Copilot database queries, 20 service results, 10 service categories, 50 chat messages and 720
feed actions. The staging SLOs are 50 ms for a database plan, 2 s for a non-provider Edge
request, 8 s for Maxxis and 2.5 s for LCP.

The Maxxis service-search load probe showed:

| Run | First observed | Warm p50 | Warm p95 | Payload p95 |
| --- | ---: | ---: | ---: | ---: |
| Complete run 1 | 1,641.4 ms | 1,443.3 ms | 1,634.6 ms | 706 bytes |
| Complete final run | 1,706.0 ms | 1,438.5 ms | 1,562.6 ms | 708 bytes |

This endpoint is `GOOD` against the 2 s non-provider Edge budget. The first-observed delta
was small in both successful runs; staging did not exhibit a material cold-start penalty in
this sample.

## Controlled concurrent browser load

Each complete run executed six concurrent read flows with zero Playwright retries.

| Operation | Run 1 p50 / p95 | Final run p50 / p95 | Final payload p95 | Status |
| --- | ---: | ---: | ---: | --- |
| Property search | 952.3 / 1,878.3 ms | 1,760.6 / 1,889.4 ms | 335 bytes | `GOOD` |
| Property details | 6,659.2 / 7,945.5 ms | 6,731.3 / 7,102.2 ms | 606 bytes | `NEEDS_OPTIMIZATION` externally |
| Global feed | 3,713.7 / 3,753.0 ms | 3,492.7 / 3,501.0 ms | 8,998 bytes | `WATCH` |

Property details remains fast in PostgreSQL but slow end-to-end under concurrent staging
load. This points to gateway/network/auth/runtime overhead as the leading hypothesis, not a
database plan regression. It must be remeasured from a region close to the Supabase project
before launch. Global feed payload remains bounded in this fixture but needs pagination or
incremental loading before data volume grows substantially.

## Verification evidence

- deterministic performance audit: 29 `PASS`, 1 documented `WARNING`, 0 `FAIL`;
- unit/integration tests: 47 files and 330 tests passed;
- focused Maxxis/realtime tests: 245 passed;
- mocked browser gate: 8 passed, zero retries;
- real staging browser gate: two complete successful runs, 8 passed each, zero retries;
- post-load data-integrity audit: 28 checks, 0 findings;
- dependency audit: 0 known vulnerabilities;
- production bundle: largest generated chunk 380.3 KiB, below the 500 KiB budget;
- lint and production build passed.

## Residual risks and launch follow-up

1. `NEEDS_OPTIMIZATION`: secure property-details end-to-end p95 is above the staging target
   under concurrency even though its database plan is below 1 ms. Capture distributed traces
   from a production-like region before changing SQL.
2. `WATCH`: global feed p95 and payload will grow with inventory. Add cursor pagination or
   incremental hydration before a large public import.
3. `WATCH`: staging is small and can be noisy; repeat load tests with representative cardinality
   and a fixed client region before setting a contractual SLO.
4. `WATCH`: operational metrics were added in this phase, so there is not yet enough historical
   data for a stable production percentile. Keep the 8 s Maxxis alert and review after a full
   observation window.
5. The production project must receive these migrations and functions only after release approval,
   a new readiness review and the established backup/rollback checks. Phase 5E did not deploy to
   production.
