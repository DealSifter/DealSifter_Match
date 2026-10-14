# Production acceptance

Code commit/pushed: 06913dce671f805a89663d3a5a07f71d17c39785.
Frontend: READY, exact Git SHA and production alias verified; deployment
dpl_MRXEkzbTVpnyjCrWVkURo4dS1FdD, https://dealsiftermatch.vercel.app.

Affected backend: maxxis-chat 82 → 83, public-parcel 8 → 9, both ACTIVE,
verify_jwt=true. Published archives contain the new deterministic tool/projection,
consensus runtime consumer and signed acquisition/verification markers. Public-parcel
does not bundle the consensus engine; no extra GIS computation/acquisition there.
feature-flags remains 19, with its exact baseline archive digest unchanged.
GENERAL_AUTHENTICATED_ON remains unchanged; global QA grid stays OFF; no secrets,
source policy, feature configuration, prices or schema changed.

Anonymous production smoke PASS: HTML/deep link/assets 200, correct no-store HTML
and immutable JS, obsolete assets 404 without long-lived cache, security headers,
CORS, maxxis-chat/public-parcel unauthenticated requests 401, browser errors zero,
startup GIS requests zero. The actual deployed MapView shared receipt module and
Maxxis transport chunk were fetched and fingerprinted, not inferred from local build.

Authenticated production smoke: **BLOCKED_NO_REAL_USER_SESSION**. No actual signed-in
user session was available. Anonymous smoke and synthetic authenticated fixtures are
not an authenticated production acceptance. No real user's account was impersonated;
no user session/password/token was created or obtained to bypass this limitation.

See production-deployment.json, backend-deployment.json and production-smoke.json
for machine-readable observed results and source/archive fingerprints. This acceptance
documentation is committed separately; it does not require another runtime deployment.
Next product phase: consensus-aware analytical engines + financial evidence stack.
