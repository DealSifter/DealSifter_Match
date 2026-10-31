# R4 offline report QA

All properties, identities, prices and evidence in these artifacts are fictional. Network access was blocked by scripts/r1-offline-runtime.mjs. No provider calls were made.

## Before and after

- Baseline captured before the renderer change: [before-sparse-L3.pdf](before-sparse-L3.pdf), 7 pages.
- Content-driven result: [sparse-L3.pdf](sparse-L3.pdf), 2 pages.
- PNGs of every physical page use the same PDF filename followed by -page-N.png.
- No live report or private payload was copied into the fixtures. The baseline reproduces the sparse Subject-to single-family case using fictional data.

## Acceptance metrics

Empty area is measured in two dimensions as the union of measured content-block bounds inside the body rectangle (x=26..569.28, y=130..790 PDF points), excluding the shared header and footer. Internal text whitespace is not estimated from pixels. Nonfinal pages must be below 25%; the final page is exempt. No minimum card heights or stretched filler are used.

| Fixture | Pages | Empty body % per page | Duplicate blocks | Ellipses | Internal jargon |
|---|---:|---|---:|---:|---:|
| rich-L1 | 1 | 27.2 | 0 | 0 | 0 |
| rich-L2 | 2 | 14.7 / 35.3 | 0 | 0 | 0 |
| rich-L3 | 3 | 13.6 / 14.1 / 66 | 0 | 0 | 0 |
| partial-L1 | 1 | 35.6 | 0 | 0 | 0 |
| partial-L2 | 2 | 15.9 / 42.6 | 0 | 0 | 0 |
| partial-L3 | 3 | 10.1 / 17 / 78.6 | 0 | 0 | 0 |
| sparse-L1 | 1 | 57.3 | 0 | 0 | 0 |
| sparse-L2 | 2 | 21.2 / 82.2 | 0 | 0 | 0 |
| sparse-L3 | 2 | 10.2 / 70.9 | 0 | 0 | 0 |

All new PDFs contain at most one map and omit publisher details by default. Long content that cannot physically fit a level ceiling fails explicitly instead of being cut or silently dropped.

The historical before-metrics.json used vertical occupancy; its percentages are not comparable with the new two-dimensional metric. The before/after page counts and PDFs are directly comparable.

## Reproduce

Run node --import ./scripts/r1-offline-runtime.mjs scripts/report-r4-qa.mjs for the nine current fixtures. The baseline is an immutable capture of the previous renderer.

## Ledger correlation (R1.3)

Production target: cyeipfskwwisbbayyaca. The clean dry run listed only 20261031060000_provider_report_attempt_trace.sql; it was applied. The historical 75 external-ledger rows and 104 budget-ledger rows retained their content digests and NULL metadata. Existing RLS and the four reservation/finalization functions are unchanged. See r13-production-verification.json.

Request and report references are generated before acquisition. All authenticated user paths set origin on the server; client-provided origin is ignored. Mock tests exercise explicit test and validation origins. The PDF Subject metadata contains report_id and request_id; r13-ledger-query.sql shows the SELECTs used to inspect its attempts without publisher or property identity. HTTP 200 rejected for identity stays billable; empty and accepted evidence are separate outcomes.

The migration is in Production; the application and Edge Function changes are local and await an explicitly authorized deployment. No code was committed, pushed or deployed. No provider calls or billing operations were executed. Full validation results are in validation.json.

Final checks: 558/558 tests (303 frontend/report, 255 backend), plus a repeated 55/55 catch-boundary regression check. Frontend TypeScript passes; Deno retains the same 31 pre-existing root errors with zero added diagnostic signatures. Build PASS (exit 0). Provider live calls: 0. Pricing, nuggets, Stripe, financial engines and stash preserved.
