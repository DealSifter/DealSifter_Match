# Feed ordering: profile match + preset — 2026-11-24

## Behavior

- Mobile: replace the Feed mode block in the sidebar with the existing ordering presets and a short explanation of the precedence. The main Feed/Showcase navigation remains available.
- Desktop/tablet: keep the ordering control in general Preferences.
- Saved Preferences provide the default. A mobile override belongs only to the current signed-in tab/session and is cleared on logout/account cleanup. It never writes the master preference. Desktop/tablet always use the master preset.
- Preserve paid Spotlight placement (explicitly confirmed by the owner). Within each placement group, higher profile match comes first, followed by the selected preset for ties. Preserve explicit focus/navigation requests and the swipe rotation of already skipped cards.
- Support random, recent, name, ascending/descending price, and the existing gated own-card preset. Unknown prices remain after known values. Unknown compatibility remains unknown and falls back to the preset.

## Compatibility inputs

Reuse `calculatePropertyMatch` for properties, with its existing weights and missing-data behavior: market 35, price 25, property type 25, strategy 15. No backend change or additional provider call.

For contacts/services, evaluate the saved target markets (35) and explicitly requested roles in `lookingFor` (65). Only available criteria enter the denominator. Normalize existing category aliases and published service specialties. A matching published property from the same owner/profile may also establish portfolio compatibility; use the strongest compatible opportunity. Do not use popularity, purchases, unlock counts, freshness, verification or login email as a compatibility percentage.

Investment criteria and markets are scoped to the active profile. Do not borrow another profile's investment preferences or unpublished/other-owner portfolio items. Scores are used internally for ordering; this change does not add a public percentage badge or assert identity verification.

## Validation and release

Publication pending targeted tests, lint, TypeScript contracts, isolated build, browser/staging verification and production smoke. No SQL, backend deploy, provider activation, billing, purchase, unlock or email operations are included. Pending contact verification work and the existing stash remain excluded.
