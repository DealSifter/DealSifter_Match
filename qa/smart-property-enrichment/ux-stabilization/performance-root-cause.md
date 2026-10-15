# Root causes and controlled measurement

The audit began on pushed HEAD `fb1e0412b37649118e97d05349342d9772b444d0`, preserving production runtime `8c5e57aa652c90084a937aa7044df29833112c6c` and all later map/APN fixes.

## Persistence defect reproduced with actual Postgres JSONB

Consensus candidate IDs are ordinal display IDs assigned after sorting serialized candidate objects. Postgres JSONB reorders object keys. Rebuilding reconciliation after loading JSONB can therefore change those IDs while material evidence is unchanged. The old DECIDE path sent a reviewed ordinal into the regenerated set, causing `INELIGIBLE_CANDIDATE`. This was reproduced by the eight-complement control against the existing transactional store RPC in local PGlite, not inferred merely from a mock HTTP success.

The reconciliation layer now maps a submitted candidate from the exact reviewed/versioned snapshot into the regenerated set by field, normalized value/unit and material provenance. It does not alter the consensus algorithm, relax ownership/version checks, select a source automatically, or rewrite raw property fields. Existing choices are carried by their selected candidate, not an old ordinal. The inline UI also binds local choices to field evidence versions and material candidate identities; a material refresh cannot silently apply a subset or switch the user's chosen source.

The same real Postgres control now passes eight accepted complements, mixed eight decisions, invalid-batch zero-partial-write protection, reload and same-evidence notification deduplication. `security-validation.json` records 25 checks, including the preceding RLS/privacy protections.

## Request and render amplification

- Owner hydration previously warmed up up to 16 individual properties through CHECK, sequentially, even though it was labeled cache-only. That path still entered runtime-entitlement/provider-cache orchestration.
- Opening Edit started CHECK; opening review started READ and sometimes CHECK. A single busy state disabled radios and close during those requests.
- Every owned reconciliation change was a dependency of the entire public effective-facts RPC load, creating redundant reads and context updates.
- A response could replace a newer revision with an older READ. Stale save recovery ran CHECK again, adding provider orchestration rather than simply reading the current version.
- The root provider eagerly imported the standalone review and heavy server reconciliation/projection graph.

The owner repository now performs one owner-scoped batch read, with no per-property warmup. Edit/review switching is local; cached evidence is immediately selectable. Individual choices are local. Apply is one transactional decision flow, with one guarded same-evidence retry if a revision race occurs; it never invokes CHECK. Local effective facts update without refetching the public inventory. Older revisions cannot overwrite newer ones. Close belongs to the existing Modal and never waits for review network work. The root imports only the lightweight review projection. A same-identity cache-only update reuses its already-authorized provider evidence rather than repeating entitlement/cache orchestration.

The production log audit found 27 successful invocations with maximum observed duration 79,887 ms, three 409s and six 400s in the bounded observation window (`production-diagnostics.json`). Response bodies were not collected: these counts alone do not establish the error reason of each particular request.

## Incorrect attention and redundant UI

Persisted summary counts and the displayed rows used different rules. Rendering `effective.adopted` and every candidate row also listed confirmed/no-action fields as “saved choices,” repeating their current values. Warning, visible rows, summary and notifications now derive from the same actionable projection. Missing-source, equal/minor, resolved and same-version deferred items cannot create a yellow warning. Complements have neutral access inside Edit and via private notifications, not a warning under the Portfolio record.

## Loading

The authenticated first-visit hydration branch replaced the module with a full-viewport “Loading your DealSifter data...” screen. That replacement was removed. Existing module keep-alive, auth bootstrap and the standard animated-logo CSS remain; reconciliation is not an awaited bootstrap dependency. Modal state does not route/remount the shell.

## Measurement scope

The browser harness uses real frontend modules with explicit synthetic authentication/backend responses, including JSONB-style key reordering. Its before/after measurements isolate review-triggered requests by controlling the pre-existing 30-second background poll clock in both runs. Timings are observations on this test host, not claimed production percentiles or a wall-clock SLA. Public inventory polling and provider security/budget policy are not disabled in production. Authenticated production-session smoke remains blocked unless a legitimate user session becomes available.
