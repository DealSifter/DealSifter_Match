# Publisher zoning, Match visibility and module loading

## Scope

- Explicit publisher confirmation shares zoning through the existing sanitized property-fact projection. A private chat premise alone does not publish anything. Non-publishers retain private assumptions; actor/history metadata is not public. No migration or canonical/legal verification is introduced.
- Known zoning codes are reused without generic repeated zoning/permitted-use prompts. Municipal parameters remain unverified; the analytical permitted-use evidence gap is retained.
- Map Match uses the magnifier's outline/ink/surface tokens and an opaque icon; selected Match has a green fill. Existing ownership/disabled rules remain intact.
- Boot and page-module loading reuse the established animated DealSifter logo. Independently loaded Maxxis/consent/cookie modules do not render competing page loaders. Boot and processing splash are mutually exclusive.
- A pending module import has a 30-second deadline and scoped explicit recovery. Retrying shares an unresolved physical import rather than starting competing downloads. Programming errors remain distinct from transport failures; failed CSS still requires explicit reload.

## Navigation diagnosis and limits

The duplicate text-only loader is reproducible from the previous source: every lazy module used ModuleLoadingState, including auxiliary modules displayed alongside the active page. Module imports previously had no deadline.

The production frontend's mobile person-popup “View in Feed” handoff and return from the map's Spotlight Cards tab pass with synthetic authentication and a fully mocked backend. Earlier property-photo tests also passed, but are a different path. These checks do **not** prove the absence of an account/data-dependent Dashboard runtime error, and no real production-user session was used. The complete reported Dashboard crash has not been reproduced with the available fixtures.

## Validation artifacts

- `full-tests.json`: complete Vitest suite; historical tracked QA files restored byte-for-byte after tests.
- `security-validation.json`: actual local PostgreSQL/PGlite owner/CAS/RLS/public-projection checks, including publisher declaration controls.
- `deno-baseline-comparison.json`: baseline comparison; 50 pre-existing diagnostics, zero new diagnostics in the affected backend closure. This is not an unconditional clean Deno typecheck.
- `build.json`: isolated complete modern and legacy production build.
- `navigation/`: browser scenarios explicitly distinguish production assets from local assets and synthetic sessions from real sessions.
- `backend-dependency-closure.json`: only maxxis-chat and property-fact-review require backend deployment.

No existing flags are changed, no paid providers are called by declaration, no real property data is changed by QA, and the six pre-existing modified user QA artifacts remain outside the release commit.

## Production acceptance

Runtime commit `789abf8e54e0c2d2c29944f75208c44e4e20ec6b` is READY and its production alias verified. Backend maxxis-chat is v85 and property-fact-review is v3; both remain ACTIVE with JWT verification. No flags or migrations changed.

Post-deploy checks passed: four two-account publisher/Match device/theme cases, ten map-to-module transitions, the mobile person-popup/Spotlight-tab return paths, and animated-logo/scoped-timeout recovery. These use production frontend assets with synthetic authentication/backend; backend behavior is covered by local real PostgreSQL contracts and deployment metadata, not by a real authenticated production write. One concurrent browser setup timed out waiting after the mobile login click, without an application exception or recorded error boundary; its isolated repetition passed. See `production-verification.json` and `navigation/failure.json` for that distinction.

The specific reported full Dashboard runtime crash remains unreproduced and its resolution is not claimed. Reload an already-open app once to adopt the new frontend release.
