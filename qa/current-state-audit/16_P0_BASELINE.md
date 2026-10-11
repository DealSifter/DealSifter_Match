# P0 canonical truth baseline

Authorized baseline: `d9ea801ffd1c57a85e418acddb0c198be744a02c`.

## Implementation and validation

- P0-1: one portable fact-semantics contract, application-owned subject classification, canonical LAND applicability, retained provider evidence and `MATERIAL_TYPE_CONFLICT`.
- P0-2: null/empty/unknown/non-finite/absent semantic states never become financial zero. Explicit zeros remain valid. Unknown cost components prevent final totals, NOI, profit, cap rate and ROI. Known-only subtotals are explicitly preliminary.
- P0-3: L1/L2/L3 share the canonical property projection. Original Notes, presentation translations, authorized owner Notes, material fields, conflicts and all source photos remain in structured report data. Privacy allowlists still exclude unauthorized owner fields.
- Report reduction is priority-based, preserves numeric tokens/APNs, and never cuts bullet lines at two lines. Direct physical completeness exception: overflow is retained in consolidated continuation pages using the existing font, header, panel and footer renderer; normal base-page definitions remain 1/3/6. No report redesign.
- Full deterministic suite: **201 files, 1,580/1,580 tests passed**, `qa/p0-canonical-truth/full-tests-final.json`.
- Targeted accepted runs: 27/27 contracts, 31/31 report/schema, 54/54 semantic safety. The final full suite includes these cases.
- Lint: `node node_modules/eslint/bin/eslint.js src/ --max-warnings=0`, exit 0.
- Frontend type contracts and database snapshot audit: passed. Official npm Deno wrapper lacked its offline cache; the equivalent checked roots were run directly with the installed cached Deno executable and `--cached-only`, exit 0.
- Changed portable backend modules: Deno check exit 0. Aggregate four-root check: **38 existing errors, 0 new errors**. TS2785 is a secondary diagnostic for TS2783, not a 39th primary error. No broad Deno debt cleanup.
- Final production-mode Vite build: exit 0, 2,709 modules, 10m03s. Sentry upload disabled via local release solely for validation. Existing large-chunk warnings remain.
- Offline guard preflight passed: direct TCP, Node-normalized TCP and external fetch blocked. Automated RentCast calls 0, Gemini calls 0, Stripe mutations 0. Fixtures are explicitly not live property observations.
- Migration: **NONE**.

## Exact transitive deployment scope

Computed from local imports, re-exports and dynamic imports, not guessed. No unresolved local imports.

1. `maxxis-chat`
2. `maxxis-analysis-inputs`
3. `maxxis-provider-message-draft`
4. `maxxis-deal-workflow`

Evidence: `qa/p0-canonical-truth/backend-dependency-closure.json`.

## QA artifacts

`qa/p0-canonical-truth/fact-parity.json`, `zero-semantics.json`, `report-completeness.json`, `reducer-priority.json`, `scenario-completeness.json`, `backend-dependency-closure.json`.

Final accepted test receipt is `full-tests-final.json`; earlier attempt receipts are retained as history and are not the acceptance result.

## Production receipt

Pending commit/push and deployment. The committed application revision, frontend deployment metadata, Edge versions/timestamps and non-destructive smoke results will be recorded below after publication. No production PASS is claimed yet.
