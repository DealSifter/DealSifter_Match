# Parcel Evidence Consensus — phase 2

## Reconciled baseline

Git HEAD and pushed branch SHA: `4419e3838b28509de22a8c673fd664e03675c996`.
Production frontend SHA: `0a93adc395758760816ae880f367469aebff9510`, READY and primary alias verified.
Production `public-parcel` v7; `feature-flags` v19; both ACTIVE with platform JWT verification preserved.
See `frontend-baseline.json` and `backend-baseline.json`. No older reset or override.

## Implemented

Pure `computeParcelEvidenceConsensus` with per-field candidates, provenance, stable
reason codes, family independence, internal source consistency, unique majority/outliers,
explicit provisional policy and temporal/equivalence guards. Required domains:
lot area, APN, owner, assessed value, actual property tax, zoning and property type.
Additional scalar domains support future evidence without universal provider ranking.

`getPropertyEvidenceConsensus` accepts already-authorized in-memory evidence bundles:
raw publisher property, existing normalized `PropertyEvidenceResult`, selected/verified
approved public parcel evidence, or future explicit candidates. It never acquires evidence.
Original candidate values survive; GIS attributes and calculated area do not become
independent providers. `properties.lot` parses without consensus presentation rounding.
Public source eligibility and subject association fail closed in the GIS adapter.

No schema, migration, endpoint, private cache, acquisition change, live provider call,
plan override, normal user diagnostic or survey-upload workflow. Maxxis/canonical/
reports/scenarios do not import or consume the new library. Read-only candidate
computation is sufficient for the requested proof phase; no persistence is needed.

## Deployment scope

The only existing runtime dependency changed is `public-parcel/geometry.ts`, importing
the centralized area variance policy. Closure: **public-parcel and frontend**, because
MapView already imports this geometry helper. No other Edge Function deployment is
warranted. The pure consensus engine/adapters are
versioned for the next integration phase; they are not invoked or shipped through an
unrequested new endpoint. GA flags/kill switch/public source policy remain unchanged.
Only the threshold-boundary machine-roundoff correction changes the GIS helper;
business thresholds and response schema remain unchanged.

## Validation

Fixtures are synthetic deterministic evidence, not fresh cadastral observations.
Gable two-source control has no approved Jefferson GIS evidence and stays unresolved.
The three-source GIS value is a synthetic control, not an acquisition/coverage claim.
QA artifacts cover statuses, units, duplicates, fiscal years, stale references and
source independence. Isolation artifacts scan runtime imports; full regression
separately exercises actual canonical/LAND/Maxxis/report/financial pipelines.
Automated tests use fixtures/mocks only. No authenticated production user session is
assumed or impersonated. Production checks are operator-only/read-only metadata,
published source markers and anonymous transport/init smoke, not real-user GIS testing.

Final pre-deploy results: 283/283 targeted assertions (14 files), 1,970/1,970 full
deterministic assertions (219 files), four additional Deno tests; contracts and affected
Deno checks PASS; source/script lint PASS; modern+legacy build PASS (11m11s, existing
chunk-size warnings only). Full/targeted runs use one isolated thread worker after
Windows fork-start timeouts; incomplete attempts are explicitly retained and rejected
in `validation-attempts.json`. Desktop and phone real-Leaflet/mocked-auth/GIS controls
both PASS, including unlocked magnifier, Z15/Z16/Z17, unchanged popup dimensions,
repeat activation, panning, basemap switches and lens-state persistence.

Production code commit: `aad2a78cf6d08ee62ea9604cdeacf05298243c47`, pushed.
Frontend deployment `dpl_DWcGKtBHboMDqVKBHvYve4z3xJtL`: READY; exact source SHA and
`dealsiftermatch.vercel.app` alias verified. `public-parcel` v8 ACTIVE/JWT true;
`feature-flags` v19 unchanged (including its published archive hash). All 38 other
secret digests/configuration preserved. Authenticated GA remains ON, global grid OFF.
Published source audit verifies shared area policy and absence of the consensus engine
in the runtime bundle; no new consumer or endpoint is silently activated.
Anonymous production smoke PASS: HTML/deep link 200/no-store, current hashed assets
200/immutable, obsolete assets 404/no-store, seven security headers, CORS, anonymous
parcel 401, browser errors zero, startup GIS zero. Real-user authenticated production
acceptance was not performed (no user session); local UI/auth/GIS evidence is explicitly
mocked and must not be represented as a live multi-user production test.
Only frontend/shared geometry policy and public-parcel were published. Engine/adapters
remain versioned, tested, read-only and unconsumed for the next phase.
