# Consensus-aware area / LAND analytics — phase 1

## Baselines and scope

- Historical requested production: `819af6faeada92fd4d1b7d7d6a178424db5f6e06`.
- Actual repository baseline: `bf8f870ea821c3758e35c7157fbfbd07ac7f7587`.
- Actual production baseline: `789abf8e54e0c2d2c29944f75208c44e4e20ec6b`.
- Newer legitimate navigation, loading, Match and publisher-zoning fixes were preserved. Six pre-existing user QA edits are excluded from this release.

## Validated implementation

The existing edit modal has one borderless icon-and-text CTA. PT-BR copy is exactly “Revise clicando aqui”; EN/ES are localized. The icon is 24 px on desktop and 22 px on mobile. Existing conflict-only portfolio warnings, the shared yellow pulse, reduced-motion behavior and local page-2 navigation are preserved. Complement-only records do not gain a yellow warning. No automatic provider acquisition or radio mutation was introduced.

A pure resolver separates evidence consensus, explicit effective decisions and analytical permission. KEEP and ACCEPT authorize qualified values only with current decision proof; they never rewrite consensus. REVIEW_LATER does not authorize a conflicted scalar. Lot and living/building domains remain separate. Asking price does not fall back to AVM, assessment or comp values. Area conversion uses exactly 43,560 sqft/ac; engine precision is retained and display formatting alone rounds. Observed provisional ranges invert price/area endpoints without a midpoint.

Gable controls: unresolved price/acre is blocked; KEEP 1.14 ac yields `19000 / 1.14` while retaining MATERIAL_CONFLICT. The observed 1.14–1.23 ac agreement yields `[19000 / 1.23, 19000 / 1.14]`, with the RentCast outlier retained. Direct Maxxis area-price questions precede Gemini and stale gap/scenario interception. Shared confirmations use neutral wording, not a claim that another reader made the choice.

The additional bounded decision-proof read is enabled only for explicit area-analysis requests. It follows the authenticated published-property gate, matches the current publisher and public effective facts, and excludes actor identity, history and private alternatives. Other direct-fact reads gain no additional database query. No migration, RLS, feature-flag or source-license change was made.

## Quality evidence

- Full deterministic suite: **2,259/2,259**, 238 files.
- Targeted integration/regression: **130/130**.
- Final analytical controls: **57/57**.
- Smart Enrichment / UX unit group: **118/118**.
- Map lifecycle unit group: **37/37**.
- Browser: six device/locale combinations on an isolated production build; ten map/module transitions; two photo-to-Feed handoffs; one controlled cold-hydration case. Explicit mock authentication/backend only; no real backend writes.
- Cold hydration confirmed an existing READ recovery path, not an extra CHECK/provider acquisition/mutation. The browser harness now distinguishes these correctly.
- ESLint and frontend contract typecheck: PASS. Modern + legacy build: PASS.
- Deno affected closure: 50 baseline diagnostics / 50 current diagnostics / **0 new errors**; source-expression comparison, not count alone.
- Source/build/Deno hash binding: PASS. Report isolation: 48 unchanged files; MapView isolation: seven unchanged files. Five financial implementations and the acquisition-plus-rehab / cap-rate branches are unchanged.

See `quality-gates.json`, `validated-source-binding.json`, `analytical-input-policy.md`, `analytical-input-matrix.csv`, the requested control JSON files and browser artifacts in this directory. Browser wall-clock timings are workstation observations, not a controlled production benchmark.

## Release

COMMIT: PENDING

PUSH: PENDING

PRODUCTION DEPLOY: PENDING

PRODUCTION SHA: PENDING

Backend dependency closure: `arv-visual-comp-review`, `maxxis-chat`, `maxxis-deal-workflow`, `maxxis-provider-message-draft`, `property-fact-review`, `property-intelligence`. JWT verification must remain enabled. Existing parcel GA configuration and general-grid OFF must remain unchanged.

## Validation limit

AUTHENTICATED PRODUCTION SMOKE: **BLOCKED** — no real authenticated production session is available. Synthetic browser authentication is not presented as a real user session or end-to-end live backend validation.

Next phase: FINANCIAL EVIDENCE STACK — OPERATING INCOME + EXPENSE INTELLIGENCE. It is not implemented in this release.
