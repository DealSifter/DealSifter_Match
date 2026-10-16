# Financial Evidence Stack — pre-implementation audit

Observed 2026-10-16, before application changes. Branch `fix/production-real-defects`; local and pushed HEAD `2aed81213494de653e7265bc1744800864b9220b` (QA receipt). Actual production source `144056b478032efc61378d99f94432273b0b7a76`, deployment `dpl_5KKSStAccy2cg4NuYVwRQTqtfYnc`, READY and public alias verified. The supplied baseline is not reset.

Operator read-only receipts: `.cache/financial-phase1-baseline-{frontend,backend,database}.json`. Edge versions: maxxis-chat 86, maxxis-deal-workflow 17, maxxis-provider-message-draft 20, property-fact-review 4, property-intelligence 13, arv-visual-comp-review 13; all ACTIVE/JWT. Unchanged parcel 10/flags 19; authenticated parcel ON, general grid OFF. Latest migrations: `20261013000001_property_geocode_publication_guard`, `20261014213000_smart_property_fact_review`. Review/history RLS and direct-write denial remain intact. No migration planned.

## Existing contracts

- `property-fact-reconciliation/model.ts`: immutable candidates/consensus plus KEEP/ACCEPT/REVIEW_LATER, current evidence-hash proof, EffectiveFact. Property tax is already a review domain; rent and HOA are not. Do not extend review UI with assumptions.
- `analyticalPropertyFacts.ts`, `analyticalPropertyContext.ts`: opt-in deterministic area resolver. Source proof, conflict, qualified inputs/ranges and unavailable separate; preserve byte-for-byte.
- `propertyEvidenceProjection.ts`: CanonicalPropertyFacts grouped evidence wrapper (value/status/source/date/conflict). Includes asking price, stored NOI/CapRate, annual tax, assessment, HOA; it has no actual contractual-rent field. `canonicalInvestmentAnalysis.js` is an existing dimension/focus contract, not the new evidence stack; leave unchanged.
- `propertyDetails.ts` sanitized public RPC fields cover address, type, price, rehab, beds/baths, sqft/lot, objective and privacy. No general current-rent/insurance/expense onboarding form. Do not infer actual rent from occupancy or notes.
- `property_arv_review_contexts.deal_assumptions`, read under current user and property, holds explicit private scenario inputs. BUY_AND_HOLD cadence is annual tax/insurance, monthly HOA/rent, percentage vacancy/management/maintenance, annual maintenanceAmount/otherOperatingExpenses. These are scenario assumptions, never public actuals. Active scenario identity must match the current property.

## Provider/cache audit

- `rentcastMapper.ts` maps latest `propertyTaxes[year].total` → annualPropertyTax plus propertyTaxYear, independently from `taxAssessments[year].value` → assessedValue/assessmentYear. Provenance VERIFIED_RECORD/RentCast; zero is retained.
- HOA fee exists but source structure has no cadence. No monthly assumption is legitimate in the new stack.
- OwnerOccupied is a boolean ownership hint, not leased/vacant evidence. Sale dates/prices/history are stored; do not use as income.
- `supplementalEvidenceTypes.ts` / supplemental cache hold separate rent_estimate (rent/range/subject/comparables), rental_listings, sale_listings, ZIP market aggregates. Rent estimate has PROVIDER_ESTIMATE semantics, retrievedAt/query identity; sourceUpdatedAt is not supplied. TTL rent estimate 72h; retained STALE_USABLE policy is explicit. No lease/contract rent, insurance policy, tax-rate dataset or approved insurance benchmark exists in these normalized structures.
- Existing `getDealInsightContext.ts` loads supplemental evidence according to plan/cache policy, places rent summary in rentalEvidence and providerMarketContext. Canonical direct facts use the property-record cache only, so rent-estimate cache can exist without reaching that route. New financial direct facts must read that separate cache explicitly, cache-only, after entitlement and identity gates. No provider acquisition to fill gaps.
- Public tax: approved signed parcel receipt → candidate concept ANNUAL_RECORDED_TAX with year/source → consensus projection. Assessment remains separate. Private choices must not be written to this shared cache.

## Financial engine / hidden fallback inventory (not migrated)

- `dealMetrics.ts` reads stored CapRate, acquisition+rehab and area unit prices. It does not compute NOI or invent OPEX. Missing numbers return unavailable. Preserve all formulas.
- `scenarioEngine.ts` BUY_AND_HOLD requires positive rent/price; missing vacancy/management/tax/insurance/HOA/maintenance/other expense propagate null through sumKnown. No 5%/10%/1% automatic defaults. HOA in this **legacy scenario contract** is monthly; maintenanceAmount and tax/insurance annual. Utilities are not independently modeled there; otherOperatingExpenses is an aggregate. Completeness differs from the future explicit expense-domain policy; document, do not migrate.
- Legacy `compactScenarioInputs` allows providerRentEstimate as a scenario rent alias and HOA fee without extra cadence metadata. This is scenario evidence, not a contractual fact; keep out of the new actual-rent domain. The new stack must not reclassify that value as actual or silently feed a legacy formula.
- SUB_TO DSCR uses a legacy gross-rent/debt proxy rather than future NOI/debt semantics. Out of this operating-evidence phase; no broad formula migration.
- Reports L1/L2/L3 consume existing canonical wrappers/financial outputs (`maxxisAnalysisReport`, `maxxisDealIntelligenceReport`, export PDF). They remain isolated; no new stack/defaults added to reports.
- No approved financial benchmark dataset found in audited operating evidence paths. Architecture only: activated benchmark values 0, fabricated tax rates/insurance/vacancy/management/maintenance 0.

Six pre-existing dirty historical QA files are preserved and excluded from this release. Real authenticated production browser session is unavailable: smoke BLOCKED; operator metadata and synthetic browser checks are not represented as that smoke.
