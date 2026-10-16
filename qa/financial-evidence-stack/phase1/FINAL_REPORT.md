# Financial Evidence Stack — Phase 1

IMPLEMENTATION: PASS

Original production baseline: `144056b478032efc61378d99f94432273b0b7a76`.
Actual repository baseline: `2aed81213494de653e7265bc1744800864b9220b` (QA-only receipt over the same application source).
Branch: `fix/production-real-defects`. Production baseline/versions/schema/flags were reconfirmed after the interrupted session; no unrelated production change occurred.

## Delivered

Deterministic, read-only operating evidence contracts, per-domain resolution, cadence/annualization, provenance/freshness, conflict/decision handling, categorical metric-specific readiness and localized Maxxis direct answers. Current contract rent, provider market-rent estimate and private investor rent assumption remain separate. Recorded tax is never assessment. Unknown is never zero; one-time/unknown-frequency inputs cannot satisfy recurring expenses. Percentages cannot substitute for monetary rent/tax/insurance. Benchmarks are architecture only: activated datasets/values zero.

Tax KEEP/ACCEPT requires current matching proof and preserves consensus history. Public conflicts cannot become provider-only winners; failed proof reads fail closed. Public/shared evidence never receives private assumptions. Existing scenario inputs remain private and retain their documented cadence. Numeric user declarations continue through the existing input workflow, not the new read-only question route.

NOI, Cap Rate, Cash Flow, CoC, DSCR and ROI calculators were **not migrated**. Financing remains not evaluated. Future ROI requires its own definition rather than rental inputs by default. Reports, ARV/MAO/recent sales, area analytics, Smart Enrichment, map lifecycle and Parcel Lens remain isolated and unchanged.

## Validation

- Full deterministic suite: **2384/2384**, 239 files, exit 0, two workers, no skipped/pending cases.
- Targeted integration: **243/243**; final financial controls **125/125**.
- Financial semantics: **54/54**; cache/decision/isolation: **14/14**; readiness: **18/18**; Maxxis financial questions: **39/39**.
- Area analytics **57/57**; Smart Enrichment **118/118**; map lifecycle **37/37**; RentCast/supplemental **26/26**; canonical/consensus **102/102** (groups overlap the full suite).
- Lint and frontend contract typecheck PASS. Edge/Deno: 50 matching legacy diagnostics before/after, **0 new**, compared by code/path/source expression.
- Modern + legacy build PASS. Source binding PASS, including exact used-browser-export bundle equivalence for backend-only financial answer/readiness changes.
- Browser regression: six desktop/mobile × PT/EN/ES cases, ten Map→module transitions and two photo→Feed handoffs; zero error boundaries, generic loader flashes, automatic acquisition or real backend writes. Actual app build with explicit synthetic auth/backend; not a real-user production smoke.
- Source isolation: 12 calculation/area modules, 33 report/valuation files, five map modules and 15 fact-review modules unchanged. Migration **NONE**; no flags/secrets changed.
- Resolver provider calls **0**, Gemini arbitration **0**, automated live RentCast/GIS evidence calls **0**. No new bootstrap/portfolio provider fan-out.

An earlier three-worker run exited before initializing three DOM suites despite passing its collected assertions. All 46 omitted tests passed isolated; the accepted final full run executed all 239 files successfully with two workers. See `runner-diagnostic/`.

## Release

Quality gate: **PASS** (`quality-gates.json`). Exact affected closure: maxxis-chat, maxxis-deal-workflow, maxxis-provider-message-draft, property-fact-review. Public-parcel, feature-flags, property-intelligence and arv-visual-comp-review are not redeployed.

COMMIT: PENDING
PUSH: PENDING
PRODUCTION DEPLOY: PENDING
PRODUCTION SHA: PENDING
AUTHENTICATED PRODUCTION SMOKE: **BLOCKED** — no real user session is available. Operator metadata audits and synthetic authentication do not substitute for it.

Six pre-existing user QA changes are preserved and excluded from this release.

NEXT PHASE: FINANCIAL ANALYTICAL ENGINES — NOI + CAP RATE + CASH FLOW.
FOLLOWING PHASE: FINANCING-AWARE METRICS — COC + DSCR + ROI.
