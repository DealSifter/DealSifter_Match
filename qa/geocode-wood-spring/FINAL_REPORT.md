# Geocoding and portfolio publication — production closure

Runtime commit: `72cb9493707683f6cf322717cdac8e166656bf3f`, pushed to `origin/fix/production-real-defects`.

Production frontend: Vercel `dpl_BD6GzZRQayPNE9gQKyt2S3Mc7bAd`, READY, source SHA and `https://dealsiftermatch.vercel.app` alias verified. Backend: geocode-address 18 ACTIVE with verify_jwt=true. Maxxis chat 80, provider draft 16, property-intelligence 10, visual review 10, feature-flags 16 and public-parcel 4 unchanged. No environment, flags, sources or provider billing changes.

The real Raleigh property was repaired with the exact Census address match and its owner/publication/privacy were preserved. Published geocoding-invalid records: zero. Migration `20261013000001` is installed and recorded; no unrelated migration was pushed. Its invalid-point, address-change invalidation and unpublished-draft contract passed against a temporary table with transaction rollback.

Saving a portfolio property now validates and persists before publication. A failed match stays editable as an inactive unpublished draft, with a complete orange correction explanation and pulsing orange edit button. Temporary transport/provider failures have a different explanation from a definitive no-match. Correcting and saving revalidates, returns the authoritative DB state, removes the warning and makes the property ready for explicit publication. Failed saves retain the editor/form. Private validated properties may publish cards but cannot emit exact property PINs until the owner removes address privacy; payment/contact unlock does not remove it.

Tests: 1,813 passing assertions across 212 distinct files after targeted fixture/timeout retry (not a single clean full run); four maintenance assertions passed. Full src lint, affected-script lint, Deno lint/typecheck, contract TypeScript and final production build passed. Maxxis execution-budget transpilation is byte-identical despite the type annotation. Build chunk evidence is recorded in quality-readiness.json. Existing bundle-size warnings remain outside this focused fix.

Production browser smoke: frontend 200; geocode request carrying baggage/sentry-trace reaches an authenticated 401 without CORS errors; repaired property is present with VALID geocode and physical coordinates; the private card's street/address/input/coordinates remain redacted. No geocoder/paid-provider calls were initiated by the smoke. Real-user authenticated save/publication acceptance was not performed because no user session is available; it is not claimed as tested. UI save/edit state tests use explicit mocked persistence, and production database checks are authorized read-only maintenance checks.

Receipts: production-deployment.json, backend-runtime.json, production-smoke.json, repair-applied.json, quality-readiness.json. The receipt-only follow-up commit does not alter deployed runtime code. Unrelated user audit files remain unstaged and untouched.
