# Release plan ? Maxxis report v6.1

Status: **RECONCILIATION DEPLOYED - G1-G8 passed; five Production Edge Functions active; protected Vercel Preview verified. Awaiting product-owner smoke test. Production frontend not promoted.**

## Final release result - November 3, 2026

Reconciliation checkpoint: `d5bca41`. Test-contract checkpoint: `b3b91c8` (six previously validated test adjustments; no deployed source changes). Source package fingerprint: `fe9aff373fc4d2e315388ce5b6554a6c8b929206b23257519df4b05060592c74`. The isolated package contains 566 files; the prebuilt frontend contains 131 files. Both secret scans passed. No generated QA PDFs/PNGs, changed preview fixtures, tests, private environment files or backups were uploaded. The existing committed preview illustrations were retained.

All eight pre-release gates passed before publication: complete offline suite 3057/3057; report TypeScript and public-parcel production entrypoint passed; Maxxis kept exactly 31 preexisting type errors at unchanged locations; offline build passed in 7m45s; Production schema 118 checks / zero incompatibilities; no pending migrations; no stash dependency; branch-specific Preview configuration verified; deployed coverage and legacy contracts preserved; exact pre-release function backups verified; source and built-output secret scans passed. The scoped code manifest contains five functions and 24 frontend runtime modules; the two historical schema migrations are already applied and none was executed in this release.

The exact source checkpoint inventory relative to the published frontend ancestor is: `2d010d7`, `d36ea4a`, `2cfe28a`, `5aa9504`, `5b1d761`, `7d8bbca`, `06ba72c`, `8dbe2d6`, `3bd6f72`, `80068bf`, `753a24b`, `3dfb14a`, `01a4d4e`, `63cde37`, `8ef615f`, `c970f62`, `d5bca41`. Publication used the isolated source package and prebuilt CLI, not a new Git push. Later test-only/documentation checkpoints do not change the published package fingerprint.

Frontend runtime delta relative to `72ff4cdf` (tests and generated preview artifacts excluded):

```text
src/components/matches/MatchesPortfolio.jsx
src/components/maxxis/MaxxisAssistant.jsx
src/domain/maxxis/maxxisReportSchema.js
src/features/maxxis/export/comparableMapGeometry.ts
src/features/maxxis/export/contentReportComposition.ts
src/features/maxxis/export/marketRentReport.js
src/features/maxxis/export/maxxisReportExportPreview.js
src/features/maxxis/export/maxxisReportPdf.js
src/features/maxxis/export/referenceReportPdf.ts
src/features/maxxis/export/reportBrandShell.ts
src/features/maxxis/export/reportContentPlan.ts
src/features/maxxis/export/reportIntegrityTypes.ts
src/features/maxxis/export/reportIntegrityViewModel.ts
src/features/maxxis/export/reportMapAssets.js
src/features/maxxis/export/reportPublisherDisclosure.ts
src/features/maxxis/export/reportReadingPlan.ts
src/features/maxxis/export/strictReportPdf.ts
src/features/maxxis/intelligence/MaxxisAnalysisGapResolution.jsx
src/features/maxxis/intelligence/MaxxisCanonicalReportPreview.jsx
src/features/maxxis/intelligence/confirmParsedAnalysisInputs.js
src/features/maxxis/intelligence/maxxisAnalysisReport.js
src/features/maxxis/intelligence/maxxisDealIntelligenceReport.js
src/features/maxxis/qa/maxxisProductionReadiness.js
src/services/propertyIntelligenceService.js
```

Executed order and provider-free checks:

| Function | Previous version | Published version | State | JWT verification | Production-origin OPTIONS |
|---|---:|---:|---|---|---:|
| public-parcel | 20 | 21 | ACTIVE | preserved / true | 200 |
| property-intelligence | 27 | 28 | ACTIVE | preserved / true | 200 |
| property-fact-review | 22 | 23 | ACTIVE | preserved / true | 200 |
| arv-visual-comp-review | 25 | 26 | ACTIVE | preserved / true | 200 |
| maxxis-chat | 101 | 102 | ACTIVE | preserved / true | 200 |

The initial operator probe used an unconfigured origin and property-fact-review correctly rejected it with 403. Publication paused. Read-only alias inspection identified the actual Production origin, `https://dealsiftermatch.vercel.app`; all five functions then returned 200 with that exact allowed origin. The first three functions were not redeployed during resumption. No CORS or Auth configuration was changed.

- Preview: https://dealsiftermatch-kuj9heeat-deal-sifter-match-s-projects.vercel.app
- Deployment: `dpl_4hwiUxZ2rG6fFpTphPW3VaseHX94`, READY, Preview only; release branch metadata `release/maxxis-report-v1`.
- Build marker confirmed in the served bundle: `maxxis-reconciled-fe9aff373fc4d2e3`.
- Anonymous request: HTTP 302 to existing Vercel access protection. Authorized verification with an already-existing automation credential: HTTP 200 and build marker present. No bypass token was created, no protection setting was changed, and no credential value was logged or committed. Product-owner browser access may require signing into Vercel.
- Previous/current Production frontend remains `dpl_422DqBc6WV6diriCmb5qfHzJz5PD`, commit `72ff4cdfb9dca6183c8778813d0fd9c8f8172487`. No frontend Production promotion, main change or new Git code push occurred.
- Rollback backup: `.release-backup/20261102T184410Z/` with SHA256-verified bodies, metadata and recovered original sources for all five previous versions. Preserve this ignored directory. Function rollback must use the corresponding backed-up source tree and preserve JWT verification; the Production frontend was not changed and needs no rollback for this release.
- RentCast / ArcGIS / Census / OpenStreetMap / Gemini calls during reconciliation and deployment verification: 0. No user report/chat generation was triggered. The earlier Florida gate used one Census request and stopped at address incoherence; Florida acquisition, repeat and PDF remain unexecuted, not falsely reported as cache-hit validation.
- The Property Intelligence UI flag remains disabled in Preview as copied from Production. Smoke steps dependent on that UI require a separate explicit flag-activation decision; this release does not claim they have been exercised.

The historical findings below are retained for audit. This final result supersedes their blocked/pending publication status. STOP: await the product owner's smoke test; do not begin another analysis phase or promote the frontend.

## Reconciliation follow-up - November 3, 2026

The user authorized reconciliation of the deployed GIS expansion with the Maxxis/report candidate. The correct common ancestor is the currently published frontend commit `72ff4cdfb9dca6183c8778813d0fd9c8f8172487`. A three-way comparison against the extracted deployed sources restored all eight missing GIS coverage modules and the deployed registry/cache behavior. Manual merges retained county-scoped adapters, Retry-After, timeout classification and report telemetry. No financial engine, pricing, nuggets, Stripe, Auth, billing RPC, migration, property record or remote flag was changed.

- Production coverage preserved: 60 sources across 19 states, zero removed sources/exports. Tests compare all source configuration fingerprints, activation permissions and 68 county selections to the deployed public-parcel v20 baseline. This is offline compatibility evidence, not a new live source-availability audit.
- Targeted GIS tests: 265/265. Complete offline configured suite: 3057/3057, zero failed/pending tests. Public-parcel production entrypoint type check passed. Maxxis remains at exactly 31 preexisting type errors at unchanged locations.
- Compatibility: deployed parcel request validators and the current public-parcel client are unchanged; old and candidate Maxxis normalizers accept all 18 reason/status contract cases. All five function dependency trees have no missing modules. The remaining changes are the approved report route/telemetry and earlier Maxxis acquisition/report corrections.
- November 3 Production verification: target `cyeipfskwwisbbayyaca`, healthy; 118 schema compatibility checks, zero incompatibilities. Function versions still match the November 2 backup. No reconciliation-related RentCast, ArcGIS, Census, OpenStreetMap or Gemini requests were made.
- Publication package: 566 source/assets files, SHA256 fingerprint `fe9aff373fc4d2e315388ce5b6554a6c8b929206b23257519df4b05060592c74`; secret scan passed. Local regenerated report previews are excluded; committed baseline preview assets are retained. Tests, QA reports, backups and private environment files are excluded.
- Preview configuration: the three previously authorized variables remain branch-scoped to `release/maxxis-report-v1`. The Property Intelligence UI flag remains disabled, matching Production. No flag activation or frontend Production promotion is authorized.
- Safe order after all gates pass: public-parcel, property-intelligence, property-fact-review, arv-visual-comp-review, maxxis-chat, then Vercel Preview. Each function requires an ACTIVE version check, unchanged JWT verification and a provider-free OPTIONS check before proceeding.
- Backup remains `.release-backup/20261102T184410Z/`, with verified source extraction. Stash remains `e6871a826f822fa3b42a2c904d901e212c52c89a` (34 entries total), untouched and unapplied. The remote release reference still contains only the already published Production commit; no new application code has been pushed.

The previous compatibility stop below records the historical finding that triggered this reconciliation. The final release result above supersedes the pending status at the time of this follow-up.

## Latest result - authorized Preview configuration and compatibility stop

The user authorized the three Preview variables and then explicitly authorized creating only the missing remote branch reference at the already deployed Production commit. Both actions are complete:

- Remote reference release/maxxis-report-v1 points to 72ff4cdfb9dca6183c8778813d0fd9c8f8172487. It was created through the GitHub refs API; no new code or Git objects were uploaded, main was not changed, and no automatic Preview was observed.
- VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_PROPERTY_INTELLIGENCE_ENABLED were created for Preview and this branch only, using the current Production values. The public Supabase configuration was verified against the currently deployed frontend. Production variable metadata remained unchanged; Stripe was untouched. The flag retains Production's disabled state; activation was not authorized.
- G7 backup PASS: .release-backup/20261102T184410Z/ contains all five exact ESZIP2.3 deployment bodies, version/JWT metadata, SHA-256 hashes, validated section/module ranges and recovered readable source trees. All five entrypoints are present. The 396 extracted local modules include 391 original sources recovered from source maps. Backups are ignored and must never be committed or published.
- Versions backed up: arv-visual-comp-review 25; maxxis-chat 101; property-fact-review 22; property-intelligence 27; public-parcel 20. Current frontend Production deployment remains dpl_422DqBc6WV6diriCmb5qfHzJz5PD.
- G6 FAIL: the recovered Production public-parcel registry has 60 sources across 19 states, while the local candidate has 17 across 14 states. Publishing the candidate would remove 43 sources; CT, KS, MN, ND and VA would disappear from its state coverage. Eight deployed coverage modules are missing locally: statewideSources, statewideCoverage, phase2Sources, phase2Declarations, priorityCoverage, subjectCoverage, requestedStatesSources and municipalExpansionSources. This is a real compatibility regression, not a provider coverage limitation.
- The existing frontend response normalizer is unchanged and accepted 18 cross-version evidence/status envelopes, but that does not make the GIS regression compatible. No deployment order is approved while G6 fails.
- The candidate manifest must be reconciled against actual deployed source, not only the local commit range: the backup comparison found additional deployed/local differences. Do not publish a subset to bypass this gate.

| Gate | Latest status |
|---|---|
| G1 | PASS: full offline suite 2925/2925, changed report TypeScript and six-file lint pass; application implementation remains unchanged from the previous successful build/type baseline. |
| G2 | PASS: fresh Production catalog, 118 checks, zero incompatibilities. |
| G3 | PARTIAL: manifest must be reconciled with the actual deployed-source differences before publication. |
| G4 | PASS: named stash remains intact and unapplied. |
| G5 | PASS for the specifically authorized Preview configuration; Production flag state preserved. |
| G6 | FAIL: 43 parcel sources would be lost. STOP. |
| G7 | PASS: five complete binary/source backups plus current Production deployment ID. |
| G8 | PARTIAL: changed local files pass the secret scan; final publication package is not prepared or approved. |

Next scoped work: reconcile the candidate with the existing Production parcel coverage while retaining the approved report/telemetry corrections, then repeat the relevant compatibility/manifest checks before publication. No reconciliation code was changed in this phase because v6.1 requires stopping on a failed gate. No new function version, frontend Preview build or Production promotion was published. RentCast/Gemini calls in this configuration/backup phase: zero.

## Recovery audit - November 2, 2026

Release is still blocked. The following findings supersede the earlier test/configuration observations below; the earlier tables remain as the original preflight record.

- Target Production cyeipfskwwisbbayyaca was verified again. Required Supabase configuration names exist and the bounded configuration comparisons still match. No configuration or deployed function was changed.
- Initial Vercel GET /v2/user returned HTTP 403. After the user's authentication confirmation, the official CLI successfully refreshed the local session; project/environment reads now succeed. No token or account details were logged.
- Current Vercel Production deployment: `dpl_422DqBc6WV6diriCmb5qfHzJz5PD`, source commit `72ff4cdfb9dca6183c8778813d0fd9c8f8172487`. No deployment was changed.
- Initial G5 failure: no applicable VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY configuration existed for release/maxxis-report-v1 in Preview; existing Preview entries were scoped to other branches. VITE_PROPERTY_INTELLIGENCE_ENABLED existed only for Production. The user explicitly authorized copying these three current Production values to this Preview branch only on November 2. This initial failure was subsequently resolved as recorded above.
- The current public Production frontend was verified through an alias attached to deployment dpl_422DqBc6WV6diriCmb5qfHzJz5PD. Its public Supabase URL and publishable key were identified without printing them; the current flag was verified separately through official Vercel Production configuration. Sensitive environment values could not be reread through the variables API. The official CLI pull and public configuration evidence remain in ignored private local files; none is staged or publishable.
- Preserve the current flag exactly: the Production Property Intelligence UI flag is disabled. The user's approval permits copying that state, not enabling it. No flag activation is authorized.
- Before the reference existed, Vercel rejected branch-specific creation with HTTP 400 / BAD_REQUEST because the branch was missing. No partial environment changes occurred during those rejected attempts. The user then authorized the minimal reference-only exception; reference creation and all three variable creations succeeded as recorded above.
- Targeted offline rerun: 234/234 tests passed with one worker and a 30-second test execution limit. The earlier run used the default 5-second limit. This diagnostic limit does not change application timeouts or test assertions.
- Test contracts were corrected for existing behavior: fit requires an authenticated current profile; canonical report schemas do not preallocate six pages; internal access-check failures retain INTERNAL_ERROR; mismatched address fingerprints remain cache misses. Added positive assertions that an authenticated profile preserves the existing deterministic fit score.
- Cache-degradation tests now use the fixture clock for Date as well as the repositories. Timers and application cache policy are unchanged.
- Complete configured suite PASS: 2925/2925 tests, 278 files, zero failures or pending tests, two workers and a 30-second execution limit, offline and without a concurrent build. Changed-module TypeScript and lint for all six changed test files passed; secret scan of the seven changed source/documentation files passed. The earlier successful application build remains applicable because only tests/documentation changed in this recovery. Backend implementation is unchanged from the previous 31-error type baseline.
- Florida property UUID supplied by the user: `089fee38-d90e-4e2d-a582-8d577be72ed4`. The analysis account remains the previously authorized administrator/Enterprise account; the publisher of the selected property is a different account and must not be used to decide the report requester's budget. This distinction was corrected only in the private QA operator, before any provider request. No application authorization or billing rule was changed.
- Fresh code/database preflight succeeded. Analysis budget observed: Enterprise 4/10 consumed, six available; global ledger 4/30, no outstanding reservations; all four allowed evidence families had cold cache. Maximum forecast: four calls.
- Identity gate STOP: Census returned Polk County (12105); offline city/state/ZIP coherence returned BLOCKED / CITY_STATE_ZIP_MISMATCH. User message: confirm the city, state and ZIP before querying property data. No property registration was changed. This is an address-confirmation result, not a provider coverage result or evidence of an application/schema defect; it does not block release under v6.1.
- Florida acquisition/repeat/PDF: NOT EXECUTED after the identity stop. Evidence receipt: qa/report-v6/fl-recovery/fl-validation.json (ignored/local). The earlier cached controlled PDF and ten offline fixtures remain available in qa/report-v6/.
- RentCast 0; Census 1; OpenStreetMap 0; Gemini 0 in this recovery audit. Billable delta attributable to the audit: zero. No push, deployment, stash application or property mutation. Function backups and the remaining compatibility/publication gates are deferred while G5 is blocked.

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

## Product-owner smoke test - pending owner execution on the verified Preview

Perform only against the verified Preview above and Production Supabase target `cyeipfskwwisbbayyaca`. Existing Vercel access protection remains enabled. Capture the report/request IDs and compare counts immediately before and after each scenario; never log full property addresses, owner names or contacts. The copied UI flag is disabled; do not enable it without separate authorization. No user-triggered provider or Gemini test was performed during this deployment.

| Scenario / steps | Expected result | Ledger verification |
|---|---|---|
| 1. Sign in as an ordinary user, open a property, generate/open free L1. | L1 works with card data and no paid acquisition. | Filter external_provider_usage and maxxis_provider_budget_usage by report_id/request_id; no new provider reservation or billable row for L1. |
| 2. Enterprise: Florida UUID supplied by the user is `089fee38-d90e-4e2d-a582-8d577be72ed4`; also open L3 for the controlled Honolulu test. Respect the address-confirmation gate and the current UI flag. | Florida currently stops for city/state/ZIP confirmation; no acquisition or matching report cache was produced in this validation. Rent, value reference, comparables and sources can only be expected where valid evidence exists. Honolulu value/rent TTL is 72h; after expiry, up to two refreshes may occur subject to budget and authorization. | Record per-data-type retrieved_at/expires_at/address fingerprint and compare ledger deltas. Cache hits must add zero reservations/calls; actual refreshes must carry report_id, request_id, origin, HTTP, billable_success and evidence_outcome. |
| 3. In chat, request analysis; explicitly confirm target condition. | Existing engine returns ARV when enough eligible sales exist, or reports a clear remaining reason. No assumed condition. | Confirm persisted user confirmation; match report ID to attempts. Listing references must never be counted as closed-sale ARV evidence. |
| 4. Open a property with incoherent city/ZIP/state; request analysis. | Address confirmation requested before paid acquisition. Do not modify any real registration during this validation. | Compare ledger before/after: zero new paid reservation/call for the blocked address; record ADDRESS_CONFIRMATION_REQUIRED without PII. |
| 5. User without entitlement opens Property Intelligence. | Locked section and no provider request. | Zero new external/provider-budget reservations for that attempt; explicit entitlement reason rather than invented data. |

All billing/pricing/nugget/Stripe/Auth settings, financial engines and the parallel-work stash remain unchanged. No smoke test claiming a live Gemini request was executed in this prompt. Gemini calls: zero.
