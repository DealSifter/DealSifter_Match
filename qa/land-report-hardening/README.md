# LAND report integrity validation

Baseline: `15fa6974c257dc0be90ed08cc1df7c362b13064a`.

Control: 741 Gable Dr, Center Point, AL 35215, property `20e8a78f-fcf7-4017-83cd-5c8355498da9`.

The control generator reads this property's existing app record and provider cache only. It does not invoke RentCast, Gemini, paid analysis, or credit mutations. R2 / new construction / one SFR are explicit user-control premises from the supplied production reproduction, not inferred provider facts or claims that a production conversation was read.

The app's `properties.lot` is `1,14ac`. Cached `property_record.payload.characteristics.lotSizeSqft` is 23854, RentCast VERIFIED_RECORD. Canonical evidence priority selects the verified sqft source and derives 0.5476124885215794 acres. The divergent app source remains in conflict metadata. Asking per acre is 34696.07 at a 19000 acquisition price.

`gable-report.pdf` is generated from the complete existing Deal Intelligence report builder with this cached control, not an isolated component. English and Spanish equivalents and layout-debug PDF are included. All retain six pages; only LAND page 2 and page 3 receive new visual composition. Screenshots are rasterized from the actual PDF. Shared layout audits record font sizes, line bounds, continuations, and collisions.

Run `node scripts/generate-land-report-hardening-qa.mjs`, then the deterministic suite with `--import=./scripts/p0-network-guard.mjs`, and `node scripts/verify-land-report-hardening-qa.mjs`. Deno logs compare the same four affected entrypoints against the archived baseline; both have 51 existing errors and no added diagnostic fingerprints.

Production authentication remains a separate acceptance step. No authorized browser storage state was provided. Cached service-role reads, deterministic tests, frontend health, and unauthenticated auth-boundary checks do not constitute authenticated production validation. See the deployment receipt for the actual deployed source and surfaces.
