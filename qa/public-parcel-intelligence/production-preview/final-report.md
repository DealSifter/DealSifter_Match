IMPLEMENTATION: PARTIAL — authenticated production acceptance pending
BASELINE: be3d3e94b43b1f3f90936f9e55890e50d14ff1e8
MAP ENGINE: Leaflet / react-leaflet
NEW MAP ENGINE: NO
FEATURE FLAG: public_parcel_intelligence
INTERNAL PREVIEW ELIGIBILITY: Existing FEATURE_FLAGS_JSON.internalUserIds; one confirmed account explicitly approved by user; configured without identity in code/artifacts
GENERAL PUBLIC EXPOSURE: DISABLED
FILTER CONTROL: PASS
FILTER LOCATION: src/pages/MapView.jsx → Filters → map display .map-section-card
PT-BR LABEL: Limites de lotes
EN LABEL: Parcel boundaries
ES LABEL: Límites de parcelas
DEFAULT STATE: OFF
PREFERENCE PERSISTENCE: sessionStorage.ds_mapview_ui_state_v1; account-scoped and server eligibility required
FEATURE OFF GIS CALLS: 0
LOW-ZOOM GIS CALLS: 0
PARCEL POLYGONS: PASS — local real GIS, mocked application authentication boundary
PARCEL CLICK: PASS
PARCEL PANEL: PASS
SOURCE ATTRIBUTION: PASS
APN DISPLAY: PASS
AREA DISPLAY: PASS
GEOMETRY AREA: PASS
OWNER DISPLAY: PASS
ASSESSMENT DISPLAY: PASS
PROPERTY TAX DISPLAY: PASS — deterministic supplied-field fixture; unavailable on live MassGIS pilot
ZONING DISPLAY: PASS
AREA CONFLICT UI: PASS — deterministic fixture
NO-COVERAGE STATE: PASS — normal resolver and real Census county routing; no blocked source contacted
STALE-USABLE UI: PASS — deterministic fixture
DESKTOP: PASS
MOBILE: PASS
MAPVIEW REGRESSION: 0
PROPERTY FILTER REGRESSION: 0
CANONICAL PROPERTY WRITES: 0
PROPERTY ROW WRITES: 0
MAXXIS PARCEL CONSUMPTION: 0
REPORT PARCEL CONSUMPTION: 0
SCENARIO CHANGES: 0
PAID API CALLS: 0
ARBITRARY URL PROXY: 0
SSRF REGRESSION: 0
REAL ACTIVE SOURCE TESTED: MassGIS / Middlesex County / MA
REAL PRODUCTION AUTH TEST: BLOCKED — genuine authenticated user session unavailable
REAL ADDRESS → PARCEL: BLOCKED — production user session unavailable
REAL PARCEL DISPLAY: BLOCKED — production user session unavailable; local real GIS display passed
REAL CACHE REUSE: BLOCKED — production user session unavailable; local OFF/ON cache reuse passed
NO-COVERAGE PRODUCTION TEST: BLOCKED — production user session unavailable; local normal resolver passed
TARGETED TESTS: 117/117
FULL TESTS: 1758/1758
TYPECHECK: PASS
LINT: PASS
BUILD: PASS — local and Vercel production
NEW DENO ERRORS: 0
MIGRATION: NONE
ENV CHANGES: FEATURE_FLAGS_JSON; one approved account; all 38 previous secret names/digests unchanged; no function redeploy required
COMMIT: 139f9a26ea61c813c4c1f05ec8dfceccd981ff3d
PUSH: PASS
PRODUCTION DEPLOY: YES — frontend only
PRODUCTION SHA: 139f9a26ea61c813c4c1f05ec8dfceccd981ff3d
QA ARTIFACTS: qa/public-parcel-intelligence/production-preview/
FINAL: PUBLIC PARCEL PREVIEW DEPLOYED — AUTHENTICATED VALIDATION REQUIRED

User handoff: reload production with the approved login account. Open MapView → Filters → Map display → Limites de lotes. Initially OFF; explicitly switch ON and zoom into approved coverage (e.g. Cambridge/Middlesex County, MA). Jefferson County remains unsupported. A user UUID was resolved privately; no password/token was requested and no user session was fabricated.
