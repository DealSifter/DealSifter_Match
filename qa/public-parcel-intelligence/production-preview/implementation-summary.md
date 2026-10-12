# Production MapView parcel preview

Audited production baseline: `be3d3e94b43b1f3f90936f9e55890e50d14ff1e8`. Working HEAD includes the QA-only receipt `6591957`; application/backend code matches that baseline.

## Pre-edit audit

- `App.jsx` gets authenticated eligibility from the existing `feature-flags` function and passes only `parcelFeatureEnabled` to `MapView`.
- `MapView.jsx` owns the existing desktop filter panel and mobile/tablet drawer. Its Filters tab already contains a Map display subsection and a basic parcel chip. The shared `map-chip` design tokens and existing `Icon` layers glyph are reused.
- Existing map preferences use `sessionStorage.ds_mapview_ui_state_v1`, with viewport restoration and normal persistence. The parcel chip was not persisted. Reset changes the basemap/viewport and selection, not all filter preferences; parcel preference must stay independent.
- `PublicParcelLayer` is lazy, uses the existing GeoJSON/Popup, and calls `queryPublicParcels` through the authenticated DealSifter backend. Polygon pane 410 is below marker pane 600. Selection uses native Leaflet popup state, not property-selection state.
- `ParcelViewportController` already provides 450ms debounce, a minimum two-second request interval, cancellation/latest-generation protection and an eight-entry/five-minute viewport cache. OFF/inactive/zoom below 16 produces no requests. Existing server cache, rate limits, bounded viewport results, approved registry and circuit breaker remain unchanged.
- Server eligibility already supports `FEATURE_FLAGS_JSON.public_parcel_intelligence.internalUserIds`, validated against Supabase's authenticated user ID. Default is OFF; admin/frontend overrides cannot bypass the internal allowlist. No second flag system or identity hardcoding is needed.
- Registry has exactly five ACTIVE approved sources, covering nine inspected counties. No source activation is in scope. Unsupported Jefferson remains a normal no-coverage state.
- Existing popup lacks sqft/legal-description/subdivision presentation and visible per-field provenance. Its auto-pan does not account for the desktop filter panel or zoom-control collision. These are the only parcel-detail refinements planned.
- Existing telemetry is `trackAppEvent` to DealSifter's `track_app_event` RPC. Parcel telemetry will reuse it with bounded technical metadata only; no addresses, APNs, coordinates, owner names or user identities.

## Internal production eligibility

Reuse the existing backend secret `FEATURE_FLAGS_JSON`, merging only the parcel flag entry after explicit approval of valid authenticated user UUIDs. Do not replace unrelated flag settings. No new environment variable, migration or backend implementation is required. No configuration values/identities are written to this document or QA artifacts.

At task intake no approved user UUID/session was supplied. The project reference is not a user UUID and cannot authorize a person. Production authentication/real production GIS validation must remain BLOCKED unless a valid approved identity and authenticated session become available. UI/code may still be deployed safely behind the OFF flag.

## Implementation and validation

- Existing map-display chip now uses exact PT/EN/ES labels, existing layers icon, explicit ON/OFF, native keyboard behavior and visible focus. Default is OFF.
- Parcel preference shares the existing session document and is scoped to the current account. Saved ON never bypasses server eligibility. Keeping the existing controller mounted while OFF preserves its valid viewport cache without background requests; changing account discards it.
- Native parcel popup now displays supplied acreage/sqft independently, full optional legal description/subdivision, and expandable field provenance. Tax remains reported tax, not an estimate; assessment remains fiscal assessment, not market value. Null fields are hidden, explicit zero is retained.
- Popup auto-pan avoids the expanded desktop filter panel and map controls; long details scroll internally. Parcel click does not modify property selection.
- Existing telemetry receives technical counts/zoom/stale only. No new analytics provider, backend code, source activation, migration or environment setting.
- Targeted deterministic tests: **117/117 PASS**. Full deterministic suite: **1758/1758 PASS**, 207 files. Full frontend lint, changed scripts lint, contract typecheck and production build PASS. Relevant Deno checks pass with zero new errors.
- Real local MapView/browser validation: desktop 1280x900, tablet 768x1024, mobile 390x844 all PASS. Real approved MassGIS/Middlesex County data passes through the existing resolver/ArcGIS adapter. Authentication/app boundary is mocked locally; these are NOT authenticated production tests.
- Feature OFF and low zoom each cause zero parcel requests. Re-enable at the same viewport produces zero additional upstream GIS requests. Markers remain present; parcel selection is independent; preference restoration and revoked eligibility pass. Dense results correctly require a smaller viewport, without removing the existing 120-result cap.
- Unsupported Jefferson County follows normal Census routing to no active coverage, without contacting a blocked GIS service or attempting WAF bypass. Paid provider calls: zero.
- Six deterministic popup presentation checks (desktop/mobile × PT/EN/ES) pass for stale/conflict messages, full legal description, supplied annual tax, subdivision, field provenance, bounded scroll and dismissal. Their fixture-only tax/legal fields are explicitly NOT presented as live MassGIS evidence.
- Seven required screenshots are in `screenshots/`. Desktop/mobile parcel popups were visually inspected for clipping, overflow, filter collision and marker obstruction: none found.
- Backend dependency closure is empty with zero unresolved local imports. Deployment scope is frontend only. Maxxis, reports, canonical facts, properties, scenarios, registry and all backend functions remain unchanged.

## Remaining production acceptance

No valid approved user UUID or authenticated user session was supplied. Existing production configuration is unchanged, general exposure remains DISABLED, and real authenticated production address/parcel/display/cache/no-coverage tests remain BLOCKED. Local real-GIS and fixture validations must not be mislabeled as authenticated production acceptance.

The user can obtain their ID at Supabase Dashboard → Authentication → Users → their email → User UID/ID. The project reference is not a user ID. Do not send passwords or access tokens.
