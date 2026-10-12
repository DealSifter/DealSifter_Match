# Public Parcel Intelligence — Phase 1

Baseline: `9dbedf145bbe775248cc18e0a8801fc3209f1c71`.

## What is ready

National FIPS registry, replaceable provider contract, ArcGIS MapServer/FeatureServer adapter, geodesic geometry/area, field-level provenance, bounded cache and stale fallback, authenticated resolver, local discovery/inspection, lazy MapView layer and PT/EN/ES panel. No migration or dependency/package additions.

`public_parcel_intelligence` is OFF by default in every environment. All five registry sources are non-ACTIVE. Public sources enabled: **0**. One source has explicit CC-BY-4.0 terms (Wake); four still require commercial-use/license review. Schema validation and discovery scores do not activate sources. No production flag configuration is changed by deployment.

No paid provider calls, new Maxxis evidence, canonical property mutations, valuation changes, report changes or credit purchases. Existing address geocoding is reused without propertyId. APN search is backend-first; the existing MapView location filter is not replaced.

## Real public diagnostics versus browser fixtures

`cross-state-validation.json` contains actual bounded public-service queries: King/WA, Salt Lake/UT and Sonoma/CA normalized successfully using the same resolver; point/APN parity passed. Jefferson/AL returned HTTP 403; Wake/NC timed out. These are local diagnostics of reviewed candidate sources, not publicly enabled production results.

`gable-public-parcel.json` preserves the actual stored property coordinates and existing app/cache comparison. No matching geocode cache entry was found. A fresh authenticated address-geocode flow was not run. Gable parcel geometry, APN and public acreage remain unavailable; none is fabricated. Its publisher lot and cached RentCast facts are untouched.

Browser tests mock the resolver response with the **real recorded Sonoma diagnostic polygon** to validate presentation without republishing or querying unapproved sources. `pilot-parcel-panel-*.png` are local UI evidence, not live-production coverage. `gable-parcel-overlay.png` and `gable-parcel-panel.png` demonstrate the no-approved-source state and existing property PIN, **not a successfully resolved Gable polygon**. `parcel-no-coverage.png` demonstrates the unsupported-county response.

`mapview-performance.json` compares warm local MapView mounts against the historical baseline; it is a small local regression check, not a national production performance benchmark. OFF/low-zoom/inactive behavior and fast-panning cancellation have independent deterministic tests.

## Reproduce

1. `node scripts/parcel-map-baseline-fixture.mjs` generates an ignored historical MapView fixture for the optional performance test.
2. Start `npm run dev:e2e` with local build mode and polling disabled.
3. `node node_modules/@playwright/test/cli.js test --config=playwright.config.js public-parcel.spec.js --workers=1`.
4. Run the three targeted Vitest files listed in `arcgis-adapter-tests.json`, or the full offline suite using `vitest.p0.config.mjs` and `scripts/p0-network-guard.mjs`.
5. `node scripts/parcel-source-diagnostics.mjs --refresh-artifacts` refreshes inspection/registry artifacts **without network requests**. `--live` deliberately requests approved-origin public candidate diagnostics locally; it never enables production sources.

## Operational limits and next gate

Provider coalescing, metadata TTL, courtesy spacing, circuits and source health are per Edge isolate, not globally distributed. Existing database-backed rate limits protect user requests. In-process cache is not guaranteed to survive a cold start. Persistent cache/registry would need a separately approved migration.

Public activation requires explicit server-side flag/cohort approval AND ACTIVE sources with APPROVED/CLEAR_FOR_USE licenses and working schema/queries. Jefferson's 403 must be resolved through the authority; no bypass was attempted. Wake needs a successful live schema/query validation. Broader source coverage, full authenticated address validation and real Gable polygon validation remain Phase 1B work.
