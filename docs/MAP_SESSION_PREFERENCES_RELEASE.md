# Map preferences and session filters — 2026-11-24

## Scope

Master map preferences control initial zoom, style, grouping and default filters.
Sidebar changes and camera position survive navigation and reload in the current
signed-in tab. Logout, session expiry and account changes discard these temporary
choices, including late cleanup writes from the previous map. Changing the master
map preferences starts fresh on the next map opening.

The map waits for profile/preferences hydration. Automatic fitting to owned pins
and mobile filter normalization no longer override the selected master defaults.
Explicit camera/filter actions remain available. Panel dimensions, pin positions,
master preference persistence and backend rules are unchanged.

## Validation and publication

Targeted lifecycle/component regressions, lint, contracts, isolated production
build and staging functional verification are required before publication.
Publication receipt will be recorded after the production smoke check.

Profile contact verification preparation and the existing stash are excluded.
No backend, provider, SQL, billing or security configuration changes.
