# Maxxis-only production canary manifest

## Release identity

- Production application: `https://dealsiftermatch.vercel.app/`
- Production Supabase project: `cyeipfskwwisbbayyaca`
- Production base SHA: `63b2c134a22289bacd7a642dcf4f040ce5a6c1a7`
- Production deployment before canary: `dpl_2XoKbvNbfsU7NDMVed7PE3kFoymh`
- Selectively validated source: `fix/maxxis-production-runtime@0bb6b61`
- Release branch: `release/maxxis-production-canary`
- Maxxis runtime release-set commit: `4e75f965b2c0b539bbe4be3bce910d3ec9bb2c73`
- Release strategy: branch created from the production base and populated with approved Maxxis-only hunks.
- Database backup: not required because this release does not touch the database.

## Production snapshot before promotion

| Area | Snapshot |
|---|---|
| Frontend | SHA `63b2c134a22289bacd7a642dcf4f040ce5a6c1a7`, deployment `dpl_2XoKbvNbfsU7NDMVed7PE3kFoymh`, state `READY`, target `production` |
| Supabase | Production ref `cyeipfskwwisbbayyaca` |
| Maxxis Edge | `maxxis-chat` ACTIVE v26 |
| Feature flags Edge | `feature-flags` ACTIVE v9 |
| Edge source delta | None between production base and the validated source |
| Migration delta promoted | None |
| Environment policy | Production frontend and production Supabase only; staging ref is forbidden |

## Complete source change classification

This table classifies every file changed between production base `63b2c13` and validated source `0bb6b61`.

| FILE | CHANGE | CLASSIFICATION | MAXXIS DEPENDENCY | PROMOTE | REASON |
|---|---|---|---|---|---|
| `artifacts/r27-e2e-baseline.json` | Staging acceptance evidence | TEST_ONLY | None at runtime | NO | Evidence is not production runtime. |
| `artifacts/r27b-e2e-defects.md` | Staging defect report | TEST_ONLY | None at runtime | NO | Documentation from the staging laboratory. |
| `artifacts/r27b-e2e-results.json` | Staging E2E results | TEST_ONLY | None at runtime | NO | Test output must not be promoted as application state. |
| `src/App.jsx` | Bounded feature-flag recovery and preference-hydration signal for Maxxis | MAXXIS_SUPPORTING_REQUIRED | Provides reliable proactive state and avatar preference timing | YES | Only Maxxis wiring was selected; general application behavior is unchanged. |
| `src/components/matches/MatchesPortfolio.jsx` | Separate localized visible message from internal property-analysis instruction | MAXXIS_SUPPORTING_REQUIRED | Prevents an internal Maxxis prompt from being rendered to the user | YES | One isolated surface-to-Maxxis context hunk; portfolio rules are unchanged. |
| `src/components/maxxis/MaxxisAssistant.css` | Avatar header reserve and hydration-safe visibility | MAXXIS_REQUIRED | Maxxis avatar rendering | YES | Confined to Maxxis presentation. |
| `src/components/maxxis/MaxxisAssistant.jsx` | Visible-message contract, semantic continuation, property context and avatar hydration | MAXXIS_REQUIRED | Conversation, Next Interaction, property context and avatar | YES | Direct Maxxis runtime repair. |
| `src/features/maxxis/intelligence/maxxisDealIntelligence.js` | Evidence deduplication and semantic metric action type | MAXXIS_REQUIRED | Next Interaction intelligence | YES | Prevents generic action collapse and repeated evidence. |
| `src/features/maxxis/intelligence/maxxisDealIntelligence.test.js` | Maxxis unit coverage | TEST_ONLY | Validation only | NO | Already exercised on the validated branch; not required in the production bundle. |
| `src/lib/matchesEntitlement.js` | General Matches entitlement/identity behavior | APP_BEHAVIOR_CHANGE_NON_MAXXIS | Not required by selected Maxxis repair | NO | Would alter functional product behavior outside Maxxis. |
| `src/lib/matchesEntitlement.test.js` | General Matches entitlement tests | TEST_ONLY | None | NO | Accompanies an excluded non-Maxxis change. |
| `src/pages/MatchesPage.jsx` | Active-owner and portfolio behavior | APP_BEHAVIOR_CHANGE_NON_MAXXIS | Not required by selected Maxxis repair | NO | Sensitive general Matches/portfolio behavior; excluded by default. |
| `src/services/featureFlagService.js` | Bounded retry with fail-closed fallback | MAXXIS_REQUIRED | Restores Maxxis proactive flag resolution | YES | Required for Maxxis proactive availability; does not copy staging flags/preferences. |
| `src/services/featureFlagService.test.js` | Feature-flag retry tests | TEST_ONLY | Validation only | NO | Already exercised; production code is the isolated service delta. |
| `supabase/migrations/20260903000001_property_unlock_idempotency.sql` | Property unlock idempotency migration | RISKY | Not required for the Maxxis canary | NO | Changes global unlock behavior and database state. |

There are no `UNKNOWN` changes in the selected release set.

## Required promotion table

| COMPONENT | CHANGE | CLASS | PROMOTED | REASON |
|---|---|---|---|---|
| Maxxis core | Conversation display/semantic continuation stabilization; existing core retained | MAXXIS_REQUIRED | YES | Selected runtime changes extend the production Maxxis core without replacing its scope. |
| Gemini runtime | Existing production Edge runtime retained; no function source delta | MAXXIS_REQUIRED | YES (existing) | Production `maxxis-chat` remains the provider authority; unnecessary redeploy avoided. |
| Maxxis tools | Existing production tools retained; no entity/business-rule change | MAXXIS_REQUIRED | YES (existing) | Search/profile/property/deal tools remain available through the existing runtime. |
| Property context | Visible user message separated from internal instruction | MAXXIS_REQUIRED | YES | Correct property context remains internal while the UI shows safe user copy. |
| Next Interaction | Semantic action identity preserved | MAXXIS_REQUIRED | YES | Avoids generic snapshot collapse and retains action intent. |
| Proactive | Bounded flag recovery | MAXXIS_REQUIRED | YES | Recovers production flag state without copying staging preferences. |
| Bubble | Existing bubble retained plus reliable effective feature state | MAXXIS_REQUIRED | YES | Maxxis-only state recovery; no artificial signal/event. |
| Avatar | Preference hydration, sizing reserve and collision handling | MAXXIS_REQUIRED | YES | Confined to Maxxis components. |
| Deal Memory | Existing production runtime retained | MAXXIS_REQUIRED | YES (existing) | No memory schema or database delta was necessary. |
| Cross-surface context | Minimal property surface-to-Maxxis visible-message contract | MAXXIS_SUPPORTING_REQUIRED | YES | One isolated handoff; no general surface behavior change. |
| Matches changes | Active-owner/entitlement changes | APP_BEHAVIOR_CHANGE_NON_MAXXIS | NO | Excluded to preserve working production behavior. |
| Portfolio changes | General portfolio membership/visibility behavior | APP_BEHAVIOR_CHANGE_NON_MAXXIS | NO | Excluded; only a Maxxis message hunk is selected. |
| Unlock changes | Property unlock idempotency | RISKY | NO | Not necessary for Maxxis and changes a sensitive global contract. |
| Nuggets changes | None | UNRELATED | NO | Canary must have zero Nuggets delta. |
| Entitlement changes | Staging/test entitlement behavior | STAGING_ONLY | NO | Production entitlements remain authoritative. |
| Fixtures | R27/R27A and human-acceptance state | FIXTURE_ONLY | NO | Production data must not copy staging state. |
| Migrations | Property unlock migration | RISKY | NO | Default no-migration policy applies. |

## Final release diff against production

Promoted frontend files:

- `src/App.jsx`
- `src/components/matches/MatchesPortfolio.jsx`
- `src/components/maxxis/MaxxisAssistant.css`
- `src/components/maxxis/MaxxisAssistant.jsx`
- `src/features/maxxis/intelligence/maxxisDealIntelligence.js`
- `src/services/featureFlagService.js`

Release characteristics:

- Frontend changed: **YES**, Maxxis-only delta plus two minimal integration hunks.
- Edge functions changed/deployed: **NO**; source delta is empty.
- Database changed: **NO**.
- Migrations applied: **NONE**.
- Staging fixtures, users, relations, flags, balances and entitlements copied: **NO**.
- Stripe/billing changes: **NONE**.
- General Matches, portfolio and unlock behavior changes: **EXCLUDED**.

## Pre-deployment validation

| Gate | Result |
|---|---|
| `npm run lint` | PASS |
| `npm run audit:types` | PASS |
| `npm run audit:architecture` | PASS (known legacy line-count warnings only; zero cycles/boundary violations) |
| `npm run audit:feature-readiness` | PASS, 23/23 |
| `npm run test` | PASS, 80 files / 667 tests |
| `npm run build` | PASS, 894 modules |
| Diff allowlist review | PASS, six approved files only |

## Rollback anchor

If a mandatory rollback trigger occurs, restore production deployment `dpl_2XoKbvNbfsU7NDMVed7PE3kFoymh` (base SHA `63b2c134a22289bacd7a642dcf4f040ce5a6c1a7`). No database rollback is required because this canary applies no migration.
