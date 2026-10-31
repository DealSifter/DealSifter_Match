# R-4.2: ordered, semantically deduplicated reports

Nine fictional controls are rendered with the application schema, view model and PDF renderer. All media and the real OpenStreetMap base are already local. No network requests are needed or allowed for this phase.

## Reading and layout

The six sections are: property overview/records; pending inputs/next steps; market/valuation; finances; profile/risk; sources/dates/qualification. Empty sections are omitted. Every displayed section has a heading. Placement may fill gaps only inside the current section; it never revisits an earlier section or page to insert a later section. Compatibility and its criteria form an atomic card. A subject-only map belongs with the property record; comparable geography remains attached to the numbered comparable table.

Both normal and compact layouts are measured before drawing. Compact type stays at 8.5pt or above for body content. The property section may reorder its smaller factual blocks to fill its own columns. Section order, physical bounds, overflow and badge centering are tested. Oversized content fails explicitly rather than silently clipping it or upgrading the report tier.

## Assertions and additional checks

`SEM_EVIDENCIA_VALUATION`, `SEM_DADO_EXTERNO`, `SEM_PERFIL` and other assertion identities share one limitation registry. Rephrased absence statements from the summary, opportunity coverage and decision blockers do not become separate cards. Missing profile/compatibility is one line in Limitations. The adjacent action table does not repeat those reason statements. Additional checks contain at most three distinct inspection/contract/title checks and do not copy the table actions.

## Tier-scoped completion in this phase

- **L1:** Complete when the card identity, price/type and applicable physical dimensions are known without conflicts; Partial when the core identity exists but required card facts are incomplete; Preliminary when the core identity is absent. It does not require provider queries, valuation or financial inputs that L1 does not promise.
- **L2:** Complete when the card facts, investor-profile fit, requested market rent and financial-input readiness for the analysis are present without conflicts. Partial retains a usable core card with incomplete analysis inputs; Preliminary lacks that core. It does not require L3 property-record acquisition, automated valuation, primary ARV or ROI. Optional existing financial results remain labeled in Finances.
- **L3:** the existing strict accepted-record/value/primary-ARV/calculated-financial/no-blocking-gap policy remains. Two eligible sales can support a labeled preliminary ARV without making a report Complete.

The v0.6 percentage-based coverage/badge contract is a specification for a later change. It is **not implemented** here. This phase does not change provider acquisition, entitlements, billing, budgets or financial calculations.

Existing NOI/Cap Rate/ROI values, including confirmed private-scenario outputs, appear in Finances with their original scenario distinction and an explicit calculation/publisher origin. No new financial value is computed by this presentation layer. Pictures share the overview/gallery, not a miniature standalone card. Rent has a prominent amount and period followed by its qualifications.

## Evidence and reproduction

```sh
node --import ./scripts/r1-offline-runtime.mjs scripts/report-r42-qa.mjs
```

`metrics.md` and `metrics.json` report all nine controls. Orphan means **last-page occupied body area below 25%**, including a single-page report; it is no longer a test of block kind. Occupancy is the union of measured content-block bounds, excluding the masthead/footer (first-page body y=130–790; later pages y=86–790). The section-order check reads actual rendered audit entries, not just the input array.

For public example parity, first regenerate locally:

```sh
node --import ./scripts/r1-offline-runtime.mjs scripts/generate-report-template-qa.mjs
node --import ./scripts/r1-offline-runtime.mjs scripts/render-report-template-pages.mjs
```

Generated PDFs/PNGs and their generated preview manifests remain outside the new commits as requested. Previously tracked binaries are not untracked or restored. The committed generation scripts reproduce the local examples. Never commit `.env*`, local credentials or `qa/report-r2`.

Provider calls: RentCast 0; Gemini 0; ArcGIS 0. Tiles requested: 0. The stored OSM base is cropped to the exact production viewport before plotting the fictional points; attribution remains visible. Live validation is exclusively a separate, date-gated Part 4.
