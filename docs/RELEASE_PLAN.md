# Release plan ? Maxxis report v6.1

Status: **BLOCKED ? no remote publication authorized by the completed gates**.

## Outcome

Production target verified: cyeipfskwwisbbayyaca. Part 1 committed as 8ef615f. The source correction retains provider/retrieval metadata through the schema and merges snapshot evidence metadata into the report projection. Older saved reports disclose missing source metadata instead of omitting recorded sales or inventing a retrieval date. Layout and financial engines remain unchanged.

Ten fictional fixtures and the cached controlled report were regenerated offline in qa/report-v6/. The controlled report reused its stored map image: zero provider or tile requests. Orphans, duplicate blocks, raw ISO dates and internal labels are zero. The old saved controlled schema lacks the sold provider/date; that limitation is explicitly disclosed. Artifacts are ignored and excluded from commits/publication.

## Florida validation

No property matched all location criteria within the account associated with the previously authorized controlled property. Candidate UUID list: empty. Part 2 stopped at location, as instructed. Address/county gate, acquisition, second acquisition and Florida PDF were not executed. RentCast: 0; Census: 0; billable delta attributable to this run: 0. No property registration was changed. The last previously verified ledger was 4/30 and report allowance 4/10; a fresh final ledger count was not taken after the location stop. No provider coverage conclusion can be drawn without a located property.

The schema preflight against Production succeeded before location. The catalog captured during that preflight has no unapplied local migrations. No migration or secret/flag value was changed.

## Pre-release gates

| Gate | Status | Evidence / limitation |
|---|---|---|
| G1 | FAIL | Complete configured suite: 2868/2892 passed, 24 failed; 31 failed suite nodes across 15 files. It finished naturally before the stop check; no process was terminated. Focused source tests: 2/2. Changed-module TypeScript PASS; backend retains the same 31 errors at the same locations. Build PASS. No claim that all test failures predate this adjustment. |
| G2 | PASS at Part 2 preflight | Code/database compatibility: 118 checks, zero incompatibilities. No acquisition/schema defect was encountered; location produced zero candidates. A new pre-deploy freshness check would be needed before any later release. |
| G3 | PARTIAL | Local manifest below; five affected functions, 24 frontend modules, no pending migration in the captured catalog. Final publication package not prepared because gates failed. |
| G4 | PASS | Named stash remains e6871a826f822fa3b42a2c904d901e212c52c89a. Eight stashed paths exist in current tree; no exclusive imports were found. Build did not need the stash. Never applied. |
| G5 | FAIL | Supabase required names present and non-secret configuration comparisons match expected settings. Vercel read-only API returned HTTP 403; Preview Supabase target and remote deployment identifier could not be confirmed. Credentials/flags were not changed. |
| G6 | NOT EXECUTED | Full compatibility comparison with deployed function source/frontend was not completed after the stop gate. No deployment order approved. |
| G7 | NOT EXECUTED | No rollback code backup downloaded; backup path: none. Current Vercel production deployment ID: unavailable. Therefore deployment is prohibited independently of G1/G5. |
| G8 | PARTIAL | Source commit staged-file secret scan PASS. Final publication payload scan was not performed because no publication package was approved. |

The intended candidate order is functions first, then Vercel Preview, but **it is not approved** until G6 compatibility is proven and all other gates pass. No function was deployed; no preview was generated or promoted; no branch was pushed; main remains untouched.

## Function versions observed before release

Metadata-only read; these are current observed versions, not backup copies.

| Function | Before version | Status | After |
|---|---:|---|---|
| maxxis-chat | 101 | ACTIVE | unchanged; not deployed |
| property-intelligence | 27 | ACTIVE | unchanged; not deployed |
| arv-visual-comp-review | 25 | ACTIVE | unchanged; not deployed |
| public-parcel | 20 | ACTIVE | unchanged; not deployed |
| property-fact-review | 22 | ACTIVE | unchanged; not deployed |

## Candidate commit manifest

This is a local candidate inventory, not a record of commits sent to any remote. It includes the earlier documentation commit found in history as well as the hashes listed in the request.

- 2cfe28a checkpoint: report R4.1 finishing and in-progress R4.2 reading plan
- 5aa9504 docs(maxxis): record pipeline v0.6 and tier data requirements
- 5b1d761 fix(maxxis): order report sections and deduplicate limitations
- 7d8bbca docs(maxxis): update pipeline contract v0.7 and minimum acquisition costs
- 06ba72c test(maxxis): bound validation acquisition families and provider calls
- 8dbe2d6 fix(property-data): normalize composite evidence leases to deterministic UUIDs
- 3bd6f72 fix(maxxis): distinguish internal acquisition failures and retain GIS telemetry
- 80068bf fix(maxxis): refine report evidence layout and comparable selection
- 753a24b docs(maxxis): adopt analysis pipeline contract v0.8
- 3dfb14a fix(property-data): verify schema compatibility before live validation
- 01a4d4e fix(maxxis): refine report layout and record live source limitation
- 63cde37 docs(maxxis): adopt analysis pipeline contract v0.9
- 8ef615f fix(maxxis): retain recorded-sale sources through report normalization

Frontend paths in scope:

- src/components/matches/propertyReleaseExport.test.js
- src/domain/maxxis/maxxisReportSchema.js
- src/features/maxxis/export/comparableMapGeometry.ts
- src/features/maxxis/export/contentReportComposition.ts
- src/features/maxxis/export/marketRentReport.js
- src/features/maxxis/export/maxxisReportTemplate.test.js
- src/features/maxxis/export/referenceReportLayout.test.js
- src/features/maxxis/export/reportBrandShell.ts
- src/features/maxxis/export/reportContentPlan.ts
- src/features/maxxis/export/reportIntegrityTypes.ts
- src/features/maxxis/export/reportIntegrityViewModel.ts
- src/features/maxxis/export/reportMapAssets.js
- src/features/maxxis/export/reportMapAssets.test.js
- src/features/maxxis/export/reportR4.test.ts
- src/features/maxxis/export/reportR41.test.ts
- src/features/maxxis/export/reportR42.test.ts
- src/features/maxxis/export/reportR43.test.ts
- src/features/maxxis/export/reportR44.test.ts
- src/features/maxxis/export/reportReadingPlan.ts
- src/features/maxxis/export/reportRecovery.test.js
- src/features/maxxis/export/reportSourcesV6.test.ts
- src/features/maxxis/export/reportSurgicalRecovery.test.js
- src/features/maxxis/export/strictReportPdf.ts
- src/features/maxxis/intelligence/maxxisDealIntelligenceReport.js

The only migration in the candidate delta is 20261101164005_expand_property_provider_operation_lists.sql, already applied in Production before this prompt. No migration is to be run for this release.

## Complete-suite failures

Raw assertion payloads were not written to diagnostic logs. The following inventory contains paths, counts and bounded error categories only. No baseline rerun was performed, so these failures are not declared preexisting.

| File | Failed tests | Bounded category |
|---|---:|---|
| src/pages/Onboarding.previewProfiles.test.jsx | 2 | Failure recorded; details withheld to avoid payload/PII |
| src/pages/Onboarding.unsavedChanges.test.jsx | 2 | Failure recorded; details withheld to avoid payload/PII |
| src/components/cards/FeedPreviewModal.test.jsx | 1 | Failure recorded; details withheld to avoid payload/PII |
| src/components/cards/SwipeCard.profileImages.test.jsx | 1 | Failure recorded; details withheld to avoid payload/PII |
| src/features/maxxis/export/maxxisReportExportDelivery.test.jsx | 1 | AssertionError |
| src/features/maxxis/export/referenceReportLayout.test.js | 1 | Failure recorded; details withheld to avoid payload/PII |
| src/features/maxxis/export/reportR4.test.ts | 1 | Failure recorded; details withheld to avoid payload/PII |
| src/features/maxxis/export/reportR41.test.ts | 1 | Failure recorded; details withheld to avoid payload/PII |
| src/features/maxxis/export/reportR42.test.ts | 1 | Failure recorded; details withheld to avoid payload/PII |
| src/features/maxxis/intelligence/maxxisAnalysisReport.test.js | 2 | AssertionError |
| src/features/maxxis/intelligence/maxxisDealIntelligenceExperience.test.js | 3 | AssertionError, Timeout |
| src/features/maxxis/qa/runtimeOrchestration.test.js | 1 | AssertionError |
| supabase/functions/_shared/parcel-evidence-consensus/engine.test.ts | 1 | Failure recorded; details withheld to avoid payload/PII |
| supabase/functions/_shared/maxxis/r1Evidence.vitest.test.ts | 3 | AssertionError, Timeout |
| supabase/functions/_shared/property-data/cacheDegradedIntelligence.test.ts | 3 | AssertionError |

## Product-owner smoke test ? deferred until release gates pass

Perform only against an approved future Preview and the verified Production Supabase target. Capture the report/request IDs and compare counts immediately before and after each scenario; never log full property addresses, owner names or contacts.

| Scenario / steps | Expected result | Ledger verification |
|---|---|---|
| 1. Sign in as an ordinary user, open a property, generate/open free L1. | L1 works with card data and no paid acquisition. | Filter external_provider_usage and maxxis_provider_budget_usage by report_id/request_id; no new provider reservation or billable row for L1. |
| 2. Enterprise: select the Florida test only after its UUID is established, then open L3; also open L3 for the controlled Honolulu test. | Rent, value reference, comparables and all used sources appear. Zero new calls only when matching cache entries have valid TTL. Florida was not acquired in this run, so cache cannot be promised. Honolulu value/rent TTL is 72h; after expiry, up to two refreshes may occur subject to budget. | Record per-data-type retrieved_at/expires_at/address fingerprint and compare ledger deltas. Cache hits must add zero reservations/calls; actual refreshes must carry report_id, request_id, origin, HTTP, billable_success and evidence_outcome. |
| 3. In chat, request analysis; explicitly confirm target condition. | Existing engine returns ARV when enough eligible sales exist, or reports a clear remaining reason. No assumed condition. | Confirm persisted user confirmation; match report ID to attempts. Listing references must never be counted as closed-sale ARV evidence. |
| 4. Open a property with incoherent city/ZIP/state; request analysis. | Address confirmation requested before paid acquisition. Do not modify any real registration during this validation. | Compare ledger before/after: zero new paid reservation/call for the blocked address; record ADDRESS_CONFIRMATION_REQUIRED without PII. |
| 5. User without entitlement opens Property Intelligence. | Locked section and no provider request. | Zero new external/provider-budget reservations for that attempt; explicit entitlement reason rather than invented data. |

All billing/pricing/nugget/Stripe/Auth settings, financial engines and the parallel-work stash remain unchanged. No smoke test claiming a live Gemini request was executed in this prompt. Gemini calls: zero.
