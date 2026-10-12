# Public Parcel Intelligence — Phase 1B

Baseline: `970c5d6dd47c5ecc0b8594922e097be50f31fa97`.

## Scope and decisions

The zero-ACTIVE discrepancy was a valid conjunction of licensing and technical gates, not a resolver defect. Phase 1 technically queried King, Salt Lake and Sonoma, but their terms had not been sufficiently reviewed. Wake's original service has an explicit CC-BY-4.0 license but still times out. It is **not** promoted by the success of NC OneMap.

The specific Salt Lake LIR item's explicit CC-BY-4.0 license resolves its prior uncertainty. Actual point/APN/viewport validation and reviewed terms permit five manually activated internal sources across five states and nine explicitly inspected counties:

| Active source | Counties allowed |
| --- | --- |
| Utah UGRC Salt Lake LIR | Salt Lake 49035 |
| MassGIS | Middlesex 25017, Suffolk 25025 |
| NJOGIS | Mercer 34021, Bergen 34003 |
| VCGI | Chittenden 50007, Washington 50023 |
| NC OneMap | Wake 37183, Durham 37063 |

Inspected: **11 states / 18 counties / 14 configured candidates / 12 schema-valid sources / 7 license-cleared / 7 license-review / 3 technically blocked / 0 tested counties without a candidate**. These are tested-sample metrics, not national coverage percentages or guarantees of complete county coverage.

All sources have `statusReason` and `licenseReason`. ACTIVE is ineffective unless authority, schema, geometry, APN, viewport and declared county coverage have recorded proof. Source roles/specializations are explicit; multiple sources per county are supported. Tax/assessment/zoning-only roles are not silently consumed by the parcel layer or promoted to consensus.

## Evidence and limitations

Live inspection uses the normal resolver/adapter for ACTIVE sources, actual Census county routing and government polygon/APN/viewport requests. Real address flow uses the existing public-provider order (Nominatim followed by Census), not a fabricated geocode. Some street-center or unmatched addresses correctly remain unresolved; successful addresses are recorded independently. The authenticated production `geocode-address` endpoint was **not** exercised without an actual user session.

Real cached records demonstrate MISS → HIT with zero repeated source requests. STALE_USABLE and source-health behavior are tested with an explicitly isolated virtual clock and simulated outage, not a claim that an authority suffered a live outage. Live zoom transitions exposed healthy courtesy intervals being reported as county outages. Healthy queries now reserve bounded 1.5-second slots (maximum 3-second queued wait); true backoff/circuit-open still fail closed, without counting queued rejections as government failures. The request cap remains unchanged.

New Jersey public owner identities are intentionally excluded. Actual prior-year tax is mapped only from LAST_YR_TX; its year is not invented. Massachusetts mixed area units are respected. Florida just/market value and differing assessment bases are not mislabeled as total assessment. Current FGIO 2026 polygons timed out even under a bounded 20-second diagnostic query and remain BROKEN, despite clear internal-use terms. Legacy Florida, King, Sonoma, NY and TX candidates remain inactive for their documented reasons; TCAD record mining was not performed.

Jefferson's observed 403 is Imperva/Incapsula gateway HTML, including on server-info, not an ArcGIS token error. The precise WAF rule is unconfirmed. Six official entrypoints were investigated; repeated catalog items reference the same backend. No approved usable alternate source was established. Gable APN/geometry/area/assessment/tax/zoning remain unavailable. Existing publisher 1.14 acres versus cached RentCast ~0.5476 acres is preserved diagnostically; no new RentCast request or canonical promotion.

## Internal flag and deployment safety

Existing flag: `public_parcel_intelligence`. Defaults OFF everywhere. The same server flag resolution is used by `feature-flags` and `public-parcel`. An explicit `internalUserIds` server allowlist is mandatory even when enabled at 100%; neither client nor administrator overrides can bypass it. No production cohort was configured because no internal user ID was provided. No FEATURE_FLAGS_JSON secret/configuration was changed.

For a future approved internal cohort, **merge**, do not replace, the existing server FEATURE_FLAGS_JSON with this flag entry:

```json
{
  "public_parcel_intelligence": {
    "enabled": true,
    "environments": ["production"],
    "percentage": 100,
    "internalUserIds": ["EXPLICITLY_APPROVED_USER_UUID"]
  }
}
```

The UUID is a placeholder, not an enabled account. General public access remains OFF. Development MapView QA uses an explicitly allowlisted local identity; unrelated app/auth boundaries are mocked, but parcel and county responses are **live government queries, not fixture geometry**. It is not an authenticated production-user test.

Real UI testing identified that native tile zoom stopped at 18 while capped parcel views requested more zoom. Internal layer activation now permits tile overzoom through 20, reusing native zoom-18 tiles; layer OFF preserves the original zoom ceiling and basemap behavior. The 120-parcel cap, no arbitrary URL proxy, timeouts, field allowlists, lazy OFF/low-zoom behavior and existing PIN ownership/unlock flow remain intact.

Leaflet popup auto-pan also caused viewport refresh to remove the selected polygon and close its details. Pending queries now retain the visible polygon owners, with geometry-stable React keys rather than retrieval-time keys. New/failed/capped responses replace the prior view; layer OFF, inactive map and low zoom clear it immediately. The regression is covered by unit tests and real pointer-click UI validation, not forced events.

No migration, secrets, paid-provider calls, RentCast changes, CanonicalPropertyFacts changes, Maxxis consumption, LAND calculation changes or report consumption. Backend dependency closure: **feature-flags + public-parcel**, no unresolved imports. All other analytical functions are outside the deploy closure.

## Artifacts

Status before promotion: `phase1b-status-audit.md`. Terms: `source-license-review.md`, `phase1b-official-review.json`. Discovery: `phase1b-discovery.json`. Source evidence: `phase1b-source-inspection.json`, `source-registry-expanded.json`, `active-source-runtime-validation.json`. Coverage/field matrix: `coverage-report-expanded.json`, `field-availability-matrix.csv`. Jefferson/Gable: `jefferson-source-investigation.md`, `gable-source-comparison.json`. Cache/health: `cache-runtime-validation.json`, `source-health.json`.

Final verification: **88/88 targeted tests, 1,729/1,729 full tests in 206 files, typecheck/lint/build PASS and zero new Deno errors in the two affected roots**. The full run includes the popup refresh regression. Real internal MapView desktop/mobile E2E is PASS, with zero GIS requests while OFF and zero requests at low zoom. Final screenshots include expanded-filter overlay and unobscured parcel details with filters collapsed. Evidence: `phase1b-validation.json`, `mapview-internal-e2e.json` and the four `active-parcel-*.png` files.

Implementation/source commit: `be3d3e94b43b1f3f90936f9e55890e50d14ff1e8`, pushed to `fix/production-real-defects`. Production deploy is limited to the frontend plus `feature-flags` v14 and `public-parcel` v2. The Maxxis/analytical function versions are unchanged. The production receipt in `phase1b-production-deploy.json` records the verified frontend deployment, source SHA and read-only smoke checks. Its follow-up commit contains QA/receipt refinements only; deployed application/backend code remains identical to the source commit. No PASS is inferred from an unfinished command.
