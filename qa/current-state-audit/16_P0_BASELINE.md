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

- Application source committed and pushed: `a02951fe06db81b27a75ec9995ec5e93165ab592`, branch `fix/production-real-defects`.
- Frontend production deployment: `dpl_D1n3cxEAUBpUJf4eKXuwfmvkszp4`, **READY**, target **production**, API metadata SHA exactly `a02951fe06db81b27a75ec9995ec5e93165ab592`. Alias: https://dealsiftermatch.vercel.app. Deployment URL: https://dealsiftermatch-omvdus177-deal-sifter-match-s-projects.vercel.app.
- Supabase project `cyeipfskwwisbbayyaca`: all four functions deployed successfully from the same unchanged application source. CLI inventory confirms ACTIVE: `maxxis-chat` v77, `maxxis-analysis-inputs` v8, `maxxis-provider-message-draft` v14, `maxxis-deal-workflow` v12. All updated at `2026-10-11 20:31:11 UTC`.
- Non-destructive smoke at `2026-10-11T20:37:38.230Z`: production frontend HTTP 200; Maxxis health HTTP 200, release suffix `_77`; all three other function OPTIONS probes HTTP 200. Anonymous canonical RPC probe correctly rejected with HTTP 401 / permission code `42501`.
- Automated RentCast calls **0**, Gemini calls **0**, Stripe mutations **0**; no migration or data mutation. Receipt: `qa/p0-canonical-truth/production-smoke.json`.
- **Overall acceptance remains PARTIAL:** an authorized authenticated production smoke session is not configured. Public availability and the anonymous privacy boundary do not prove an authenticated canonical response, scenario result or report flow. No full production PASS or established P0 baseline is claimed.
- Control-property acceptance is deterministic fixture evidence, **not live production-property observations**.
- Post-deployment follow-up contains QA receipts and the read-only smoke script only. Deployed application source remains the SHA above; no additional application deployment is required for this documentation-only commit.
