# Portfolio property-fact review hotfix

The general Portfolio button calls `open(propertyId)` without a field deep link. The provider normalizes this to `field: ''`. The focus effect previously used `field && querySelector(...)`, producing an empty string instead of an element, then invoked `.focus()` on that string. React propagated the effect exception to the app ErrorBoundary.

`reproduced.json` reproduces this failure in the pre-fix production frontend through the actual Onboarding/Portfolio button. Authentication, property records, and backend responses are explicitly mocked; no real user session or production write is involved. A separate scoped, read-only production check confirmed that the reported property's persisted review is a complete v1 snapshot (revision 2), with no external candidates; private data remains outside version control.

The corrected effect uses an element-or-null result. General review focuses the dialog, while field links still focus the requested row. Empty reviews show the existing no-new-facts state. Closing restores focus to the initiating button. The frontend copy adapter now normalizes the app's display locales (`pt-BR`, `en-US`, `es-ES`) to the shared presentation language keys, including number formatting. No backend, database, feature-flag, or provider-acquisition change is required.

Targeted regression suite: 3 files, 31 tests passed, including empty-field opening, regional locales, field focus, focus restoration, decisions, stale saves, owner-scoped deep links, and service requests. Lint, contracts typecheck and diff checks passed.

`local.json` and `production.json`, when present, record the real app's Portfolio button in desktop/mobile and Portuguese/English, backed by an explicit mock session/backend. They assert opening, correct localization, geometry, closing/reopening, restored focus, READ-only review requests and absence of app-boundary errors. They do not establish a real authenticated production-session test.

`build.json` records the isolated modern/legacy build. `production-deployment.json` records the deployed runtime commit and production alias verification.
