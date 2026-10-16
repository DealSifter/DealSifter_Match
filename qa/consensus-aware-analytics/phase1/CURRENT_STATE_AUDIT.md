# Current state — before implementation

Observed 2026-10-16, read-only production checks. No reset or production write.

## Repository and production

- Branch: `fix/production-real-defects`.
- HEAD / pushed remote: `bf8f870ea821c3758e35c7157fbfbd07ac7f7587` (post-deploy QA only).
- Actual frontend runtime: `789abf8e54e0c2d2c29944f75208c44e4e20ec6b`, deployment `dpl_Cyi8Ztr2JrdwKqEZMcHgewGRH1U8`, READY, exact SHA and public alias verified.
- Original requested baseline `819af6faeada92fd4d1b7d7d6a178424db5f6e06` is historical; newer loading, Match and publisher-zoning corrections must remain.
- Functions: maxxis-chat 85; property-fact-review 3; maxxis-deal-workflow 16; maxxis-provider-message-draft 19; public-parcel 10; feature-flags 19. All ACTIVE / verify_jwt=true. Actual affected closure will be computed from transitive imports, not assumed from endpoint names.
- Latest migration `20261014213000_smart_property_fact_review`; preceding recent entry `20261013000001_property_geocode_publication_guard`. Existing review/history tables have RLS, no authenticated direct writes, no anonymous direct reads, and no client permission to execute the storage RPC.
- Parcel access remains GENERAL_AUTHENTICATED_ON, general grid OFF. No flag change intended.
- Six pre-existing user QA changes are preserved and excluded from commits: five `qa/map-navigation-cleanup` files and `qa/runtime-orchestration-hardening/land-state-persistence.json`.

## Existing facts and decisions

`property-fact-reconciliation/model.ts` builds ReviewSnapshot v1 with field-specific original/current values, candidates, immutable projection, evidence hashes and effective facts. Lot area is `lotArea`; current living area is `buildingArea` with SQFT units. No reviewed PRICE field exists: asking price must retain its existing `price` semantics.

KEEP_MY_VALUE, ACCEPT_EXTERNAL_VALUE and REVIEW_LATER are persisted with per-row evidence hashes. Only a matching current evidence hash preserves a decision. KEEP/ACCEPT can make an effective fact AVAILABLE without changing its original projected consensus. REVIEW_LATER suppresses repeat attention for the same evidence; it does not resolve the conflicting input. Publisher-declared zoning remains declared, not officially verified.

`canonicalEvidenceProjection.ts` already distinguishes CONFIRMED, SINGLE_SOURCE, PROVISIONAL, CONFLICTED, UNAVAILABLE and NOT_APPLICABLE. Material conflicts have no scalar. A supported two-family agreement cluster can yield an observed min/max range and retains outliers. The additive canonical read model explicitly leaves legacy/report/financial consumption unmigrated.

`canonicalEvidenceTool.ts` combines authorized public property data, signed parcel receipts, current-user assumptions and entitled provider cache only. `toolRegistry.ts` reads owner effective facts or the sanitized public projection; the public projection intentionally omits private decisions/history. Analytical permission must not infer a decision from a raw candidate or expose private review metadata.

## Consumer inventory and planned boundaries

| Consumer | Current behavior / boundary |
| --- | --- |
| `landMetrics.ts` | Raw lot parsing, unit conversion, dimension selection by evidence rank and confidence, rounded scalar price/acre and price/lot sqft. Shared with reports; preserve legacy default while introducing an explicit analytical input path. |
| `dealMetrics.ts` | Raw price/sqft scalar; acquisition+rehab and stored Cap Rate share the result. Migrate only physical area resolution; preserve the latter two branches exactly. |
| `propertyDetails.ts` | Normalizes raw published physical facts and calculates legacy scalar metrics; used by reports. Do not globally replace its contracts. |
| `propertyEvidenceProjection.ts` | Legacy canonical physical/financial facts and precomputed land scalars; shared downstream report inputs. Leave broad projection intact. |
| `dealDecisionContext.ts` | LAND lot dimensions and asking-price unit economics; other financial metrics out of scope. Use explicit analytical context for migrated chat paths, retain default report behavior. |
| `scenarioEngine.ts`, `landDevelopmentScenario.ts` | Existing LAND economics, explicit unit/type/development assumptions, area-dependent acquisition references. Gate lot inputs without inventing capacity, density, municipal rules, or changing comp methodology. |
| `marketReferenceAnswer.ts` | Recent-sales explanation with ancillary asking/acre output. Preserve sales methodology; only replace scoped asking/area input resolution. |
| `getDealInsightContext.ts` / `dealIntelligenceContext.ts` | Shared snapshot/report generation and legacy unit fields. Avoid a broad snapshot or financial migration. |
| `src/features/maxxis/intelligence/maxxisLandDevelopment.js` | Local deterministic LAND chat, scenario and DecisionContext; must receive current reconciled facts and preserve explicit assumptions. |
| `src/lib/normalizeFeedCard.js` | Compatibility land unit fields. No card redesign/new metric tiles. |
| `maxxis-chat/index.ts`, `propertyFactLookup.ts` | Early authorized direct-fact path before Gemini; add a narrowly classified deterministic analytical path without regressing direct facts. |
| `maxxisLandReportView.js`, `maxxisReportSchema.js`, `MaxxisDealIntelligenceReportPreview.jsx`, `maxxisReportPdf.js` | Report lot/acres and price/area consumers, including report-specific comparable normalization. Keep legacy report contracts and algorithms isolated in this phase. |

Raw lot/living inputs also feed comps, valuation, recent-sales and construction/rehab benchmarks. These are audit findings, **not** authorization to migrate those methodologies. Tests must prove acquisition+rehab, Cap Rate, NOI, ROI, CoC, DSCR, ARV, MAO, comps and report contracts remain unchanged.

## UX baseline and first change

Portfolio and modal share an 18px FactReviewIndicator. A 2.2s opacity animation already exists with reduced-motion support, but actual computed animation must be tested. The modal currently exposes an icon-only toggle. Replace its Page-1 conflict control with one borderless 24px-icon/text CTA using exact PT-BR `Revise clicando aqui` and natural EN/ES equivalents. Its click only sets the existing modal page locally. Complement-only remains a separate non-warning path. Warnings continue to use actionableReview, not raw conflict counts.

## Validation / deployment plan

Pure deterministic input resolution, no provider/Gemini calls or writes. Preserve scalar qualification, explicit valid decisions, original consensus and legitimate ranges. Reject invalid denominators, unknown values and lot/living cross-domain substitution. Generate the requested policy/matrix/control artifacts, run targeted and full suites while restoring old QA outputs, compare affected Deno diagnostics against the actual deployed runtime, then lint/typecheck/build and device/theme/reduced-motion browser checks. No migration expected; stop before any migration if one becomes necessary. Real authenticated production smoke is BLOCKED unless a real authorized session is available; synthetic browser checks must be labeled separately.
