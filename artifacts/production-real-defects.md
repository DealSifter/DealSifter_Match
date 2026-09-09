# Production real-world defect ledger

Baseline: `release/maxxis-production-canary` at `f30af781483fe9821386193b2456371a48087f68`.

Production diagnosis was read-only. Identifiers below are SHA-256 prefixes, not raw user/property IDs. No unlock, purchase, billing call, database write, or fixture was used.

## PRD-01 — PROPERTY_OWNER_IDENTITY

- Reproduction: in Matches, selecting the professional profile rendered as DealSifter also associates FSBO properties belonging to the Dr. Dree profile of the same account.
- Evidence: production DB properties point to canonical user hash `d782010bca03`; their `primary_profile` is `fsbo`. The same account has distinct resolved presentation profiles: `resolved.fsbo.name = Dr. Dree` and `resolved.professional.name = Dealsifter`. Persisted interest payloads retain the canonical owner hash.
- First broken boundary: `FRONTEND_HYDRATION_WRONG`, followed by `PRESENTATION_ID_WRONG`.
- Root cause: Matches deduplicates contacts and links interests by owner ID only, losing profile scope. It then overwrites a property's canonical `ownerId` with the active card's presentation ID (`ownerId:scope`).
- Files involved: `src/pages/MatchesPage.jsx`, `src/lib/matchesEntitlement.js`, related tests.
- Data involved: read-only `users`, `user_profiles`, `professional_profiles`, `properties`, `services`, `user_feed_actions`, and canonical unlocked-contact RPC output.
- Risk: high for display identity and unlock targeting; no evidence of a wrong persisted DB relation.
- Planned correction: use the existing `ownerId + profileScope` entitlement key for presentation grouping/linking, preserve raw canonical `ownerId` on property objects, and keep canonical portfolio membership scoped.

## PRD-02 — NUGGET_COST_MISMATCH

- Reproduction: an interest row displays `10★`, while the resulting modal can fall back to `1 nugget` after the property's owner ID is replaced by a presentation key.
- Evidence: production `ds_get_property_unlock_quote` returns base cost `10` for the affected FSBO properties. `ds_profile_portfolio_cost` returns scope-specific costs; no charge was executed.
- First broken boundary: `UNLOCK_TARGET_WRONG` in frontend presentation state.
- Root cause: the interest row passes `ownerId:scope` as `ownerId`; the unlock-intent request cannot resolve that as the canonical UUID and the UI can retain its local minimum fallback. The authoritative RPC itself is consistent.
- Files involved: `src/pages/MatchesPage.jsx`, existing `src/services/unlockService.js` and `src/App.jsx` contract tests.
- Data involved: read-only authoritative pricing RPCs and rendered card/modal state.
- Risk: high for misleading display; backend authorization and actual charge remain authoritative.
- Planned correction: preserve canonical property/owner/scope into the modal target and show the intent quote already returned by the existing pricing service. Do not add a pricing engine or hardcode a value.

## PRD-03 — MAXXIS_AVATAR_SCALE_DRIFT

- Reproduction: production preference is saved as `1.81`; renderer attributes hydrate to `1.81`, but continuous avatar keyframes add scale (`1.016`–`1.03`) so the stable visual footprint is intermittently larger than the chosen value.
- First broken boundary: CSS animation transform composition.
- Root cause: repeating IDLE/OBSERVING/PROCESSING/WAITING animations combine a user scale on the art layer with an additional scale on the motion layer.
- Files involved: `src/features/maxxis/avatar/MaxxisAvatar.css`, avatar rendering tests.
- Data involved: read-only `users.settings_payload.userPreferences.maxxis.avatarSize`.
- Risk: medium visual/layout risk; official PNG assets must remain untouched.
- Planned correction: keep user scale as the sole scale for recurring states; retain motion through translation/rotation and preserve only bounded one-shot emphasis where it returns to `1`.

## PRD-04 — MAXXIS_PROACTIVE_NO_PRESENTATION

- Reproduction: no bubble was observed during ordinary production navigation.
- Evidence: production preference is enabled. Recent analytics show three real `PROVIDER_REPLIED` signals detected and all rejected as `STALE_SIGNAL`; there are no false `surfaced` events. The messages were older than the existing 15-minute freshness contract.
- First broken boundary: none proven for a fresh signal; current observed absence classifies as `SIGNAL_REJECTED_VALIDLY` / `NO_EVENT`.
- Root cause: the only available real signals were stale, not a lost UI queue. Global production flag and user preference are both enabled.
- Files involved: `src/components/maxxis/MaxxisAssistant.jsx`, `src/features/maxxis/proactive/*`, `src/features/maxxis/attention/*`, runtime acceptance tests.
- Data involved: read-only `app_events` and `users.settings_payload`; no fake signal.
- Risk: medium. Relaxing freshness would surface obsolete notifications and violate anti-intrusion policy.
- Planned correction: no speculative product-rule change. Validate a fresh, real structured service result through the existing Maxxis flow after deployment; change code only if that signal fails between acceptance and rendering.

## PRD-05 — MAXXIS_PROVIDER_ACTIONABILITY

- Reproduction: service/provider results render a non-clickable title plus a generic `Unlock Contact` action.
- First broken boundary: structured-result presentation followed by a cache-hydration dependency.
- Root cause: authoritative `serviceId` and contact-access quote survive tool output, but the UI did not expose a provider navigation action and navigation assumed the public inventory cache was already hydrated. The locked-contact surface also did not visibly identify its selected profile.
- Files involved: `src/components/maxxis/MaxxisCapabilities.jsx`, `src/components/maxxis/MaxxisAssistant.jsx`, `src/App.jsx`, `src/pages/MatchesPage.jsx`, tests.
- Data involved: public service result `serviceId`, the existing sanitized public inventory RPC, and contact-access state; no lookup by name and no protected contact data.
- Risk: medium navigation risk; unlock must continue resolving server-side from `serviceId`.
- Planned correction: make each provider title an accessible inline action carrying only the authoritative `serviceId`, re-resolve that ID against the existing sanitized public inventory when needed, and open the existing Matches/provider surface with the canonical profile visibly identified. Keep unlock requests keyed by the same service ID.

## PRD-06 — MAXXIS_STRUCTURED_LINK_STYLE

- Reproduction: navigation/provider actions inside structured responses use the same filled pill styling as large actions or appear as ordinary text.
- First broken boundary: component/CSS semantics.
- Root cause: `.maxxis-action-link` is shared by cards, buttons, and links.
- Files involved: `src/components/maxxis/MaxxisCapabilities.jsx`, `src/components/maxxis/MaxxisAssistant.css`, tests.
- Data involved: none.
- Risk: low, localized visual/accessibility change.
- Planned correction: introduce a scoped inline-link class using the official accent token, underline, hover, focus-visible, pointer cursor, and disabled semantics; keep major actions as buttons.

## PRD-07 — MAXXIS_STRUCTURED_TYPOGRAPHY

- Reproduction: structured cards/lists inherit 11px, weight 900 styling intended for CTA pills.
- First broken boundary: component/CSS semantics.
- Root cause: one class conflates structured result containers with action controls.
- Files involved: `src/components/maxxis/MaxxisAssistant.css`, structured-result render tests.
- Data involved: none.
- Risk: low, scoped visual change.
- Planned correction: apply the already-loaded Inter family only to structured result containers, with 14px/1.5 body text and 500–600 hierarchy; leave conversational bubbles and global typography unchanged.

## PRD-08 — MAPVIEW_PREFERENCE_NOT_APPLIED

- Reproduction: a customized panel width persists in storage/state on desktop, but at `<=900px` the rendered width is replaced by a responsive constant; tablet portrait silently ignores the preference.
- First broken boundary: responsive presentation calculation.
- Root cause: `panelOpenWidth` bypasses `panelWidth` whenever `isMobileViewport` is true, and customization state lives only in a mutable ref.
- Files involved: `src/pages/MapView.jsx`, `src/lib/mapPanelWidth.js`, MapView unit/browser tests.
- Data involved: local UI preference keys only (`mapViewPanelWidth`, `ds_mapview_ui_state_v1`).
- Risk: medium responsive layout risk.
- Planned correction: keep explicit customization state, apply/clamp a saved custom width on tablet portrait, preserve the existing mobile width policy, and verify navigation/reload persistence.

## Production data safety decision

- Database migrations: none planned.
- Production data mutation: none planned.
- Nuggets/billing/Auth/RLS: contracts remain unchanged.
