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

PASS: 20 lifecycle/component/inventory tests, full source lint, TypeScript
contracts, isolated offline build/secret scan, 38 staging checks, public
production/domain smoke and critical asset hashes.

Source: 20b993f851dab9b9707c22c5e1bf22789727cc95

Fingerprint: a575c5385d67fc480963d3bf26c0d013e5814ae894c8995f76a93b68edbcb707

Production: dpl_Aee7JTjm5tRYDMPkFqBgNvKWVqgj — https://dealsifter.com/

Rollback: dpl_6PTzjfCSBJ4Cq3FdZCS7gmgbNubk

Evidence: .tmp-codex/map-release-20261124/. The staging browser used the exact compiled artifact
with a private read-only adapter to authorized QA staging; zero Production
backend requests or backend writes. All 28 backend functions remain unchanged.

Profile contact verification preparation and the existing stash are excluded.
No backend, provider, SQL, billing or security configuration changes.


Harness notes: initial attempts exposed adapter response-format and navigation
timing issues, plus a mobile sidebar covering the menu. The final harness
preserves the requested Supabase Accept header, waits for hydration and closes
the sidebar before navigation/logout. No application gate was bypassed and no
fixture was edited. External map tiles and background writes were blocked in
this read-only test; visual checks cover layout, not provider availability.
