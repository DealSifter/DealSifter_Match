# RentCast Market Rent AVM + Financial Evidence Corrections

IMPLEMENTATION: PASS — pre-deployment gates validated.

Original production baseline: `97692d0ac00834e4b083a2f9bf3db3df9bec8bde`.
Actual repository/pushed baseline: `e6f13b759238a21de1ca6b1367dd17ade46bc657`
(QA-only receipt over that application source). Branch `fix/production-real-defects`.
Legitimate subsequent work was preserved; six existing dirty historical QA files
are excluded from this release.

## Delivered

Backend-only long-term Rent AVM through a controlled application service: current
effective publisher facts, supported explicit overrides, missing-attribute lookup,
material-conflict review gate, LAND/unsupported/unit-context safety, full structured
provider-address validation, fingerprinted persistent cache, shared miss lease,
stricter-than-provider Market Rent rate gate, existing entitlement and unchanged
monthly/plan Usage Guards. No legacy address-only supplemental rent fallback remains.

Current contract rent, provider market estimate and private investor assumption are
separate. Estimates/ranges, actual returned subject, comparable metadata, request
identity, date/cadence and provider provenance survive normalization. Subject and
rent evidence never directly overwrite property rows. API keys remain backend-only.
Provider no-result, temporary failure, disabled, budget/access, not-queried and review
states have localized deterministic responses. Retained older evidence survives
refresh failure without a fabricated fresh retrieval date. No uncontrolled retry.

PT/EN/ES financial source formatter separates provider record, public record, user
declaration, estimate and private assumption. RentCast tax cannot be a declared-user
input. Tax year and single-/cross-source qualification remain explicit. Assessment
is not property tax. Unknown expenses distinguish unconfirmed applicability from
missing value/assumption; actual NOI readiness remains distinct from market scenario
readiness, with one prioritized gap by default. No hidden zero/defaults.

Later user report supplement: L1 unchanged; L2 main monthly rent only; L3 conditionally
adds one Market Rent page (seven pages with valid evidence) containing estimate,
range, calculated per-sqft/per-bedroom metrics, subject, **existing ARV map pipeline**
and the same ordered table of at most five rentals. No second map subsystem or
per-comp lookup. Missing-coordinate rows keep their table numbers; no invented
markers. Ordinary multifamily records remain blocked without explicit unit context;
the resolver supports unit overrides and unit-scoped evidence is labeled accordingly.

## Accepted validation

- Targeted: **283/283**, six files. New Market Rent **74/74**, report/map **12/12**;
  prior financial stack/readiness **86/86**, Maxxis financial questions **39/39**;
  client **17/17**, supplemental **5/5**, consensus including original unchanged
  consumer-isolation guard **50/50**.
- Full deterministic repository suite: **2470/2470**, 241 files, exit 0.
- Frontend lint and contract typecheck PASS. Affected six-function Deno closure:
  50 identical legacy diagnostics, **zero new**, compared by code/path/source line.
- Modern + legacy isolated build PASS. Current source ↔ build ↔ Deno binding PASS.
- 25 calculation/ARV/sold/area modules unchanged; MapView and migrations unchanged.
  NOI/Cap Rate/Cash Flow/CoC/DSCR/ROI engines are not migrated. No ARV/MAO/recent-sales
  formula changes. Only the explicitly scoped Market Rent report extension above.
- PT/EN/ES L3 PDFs: subject S + markers/table 1–5, zero ID/order mismatch, all points
  inside padded viewport, no map/marker/table/footer clipping/overlap observed.
  Actual shared map renderer with deterministic offline mock tiles; no live calls.
- L1 PDF remains one page, no Market Rent; L2 three pages, main rent only, no range,
  rental table or rental map. New derived unit metrics explicitly CALCULATED.
- Actual isolated application assets: six device/locale review cases, ten Map→module
  transitions (including in-flight native zoom), two photo→Feed handoffs; zero page
  errors, generic full-page loader flashes, radio network mutations or Portfolio
  provider fan-out. Explicit synthetic authentication/backend; zero real DB writes.
- Automated live RentCast/GIS evidence calls **0**. Migration **NONE**. No new
  feature-flag framework, secret changes or loosened provider safety policy.

See `quality-gates.json`, `source-binding.json`, `rental-map-pdf-qa.json`, visual
rasters/PDFs, `rental-map-visual-inspection.json`, `financial-engine-isolation.json`,
`browser/`, `map/`, `photo/`, and policy/audit documents. Superseded runner attempts
are documented in `runner-diagnostic.md`; they are not accepted release gates.
The Node 22 review harness requires `--experimental-strip-types --experimental-transform-types`.

## Release

COMMIT: NOT_COMMITTED (source commit follows these accepted gates).
PUSH: PENDING.
PRODUCTION DEPLOY: PENDING.
PRODUCTION SHA: PENDING.
Exact affected closure: arv-visual-comp-review, maxxis-chat, maxxis-deal-workflow,
maxxis-provider-message-draft, property-fact-review, property-intelligence.
Public-parcel and feature-flags are not redeployed. Existing flags and schema/RLS
will be reconfirmed after release.

AUTHENTICATED PRODUCTION SMOKE: **BLOCKED** — no legitimate real user session is
available. Operator metadata and synthetic browser authentication are not substitutes.
New successful/billable production smoke calls: **0**. Honolulu live/cached control
result/range/subject: **BLOCKED**, not the fixed automated fixture values.

NEXT PHASE: FINANCIAL ANALYTICAL ENGINES — NOI + CAP RATE + OPERATING CASH FLOW.
FOLLOWING PHASE: FINANCING-AWARE METRICS — COC + DSCR + ROI.
