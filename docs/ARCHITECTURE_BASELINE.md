# Phase 5F architecture baseline

Date: 2026-08-15

Scope: frontend architecture on `release/maxxis-mvp`. No production or database changes.

## Before extraction

| File | Lines | Imports | `useState` | `useEffect` | `useCallback` | DB calls | Subscriptions | Storage accesses | Supabase accesses |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `src/App.jsx` | 5,963 | 41 | 69 | 57 | 34 | 28 | 8 | 86 | 8 |
| `src/pages/MatchesPage.jsx` | 4,912 | 32 | 45 | 22 | 42 | 5 | 0 | 25 | 1 |
| `src/pages/Onboarding.jsx` | 5,363 | 26 | 93 | 24 | 9 | 10 | 0 | 12 | 0 |
| `src/components/maxxis/MaxxisAssistant.jsx` | 2,622 | 9 | 18 | 7 | 0 | 1 | 0 | 3 | 0 |
| `src/pages/Dashboard.jsx` | 4,821 | 34 | 41 | 20 | 33 | 13 | 0 | 20 | 1 |

Counts are lexical architecture indicators, not runtime call counts. DB calls count `.from()`
and `.rpc()` occurrences; direct Supabase accesses count `supabase.*` occurrences.

## Responsibilities before extraction

- `App.jsx`: shell, lazy routes, navigation, auth/session orchestration, profile and portfolio
  synchronization, realtime lifecycles, feed hydration, chat, unlocks, payments, consent,
  persistence and cross-page prop wiring.
- `MatchesPage.jsx`: match filtering, contact entitlements, portfolio/property presentation,
  export, human chat state, chat authorization, storage, responsive panes and archive actions.
- `Onboarding.jsx`: 93 form states, validation, current/legacy profile payload generation,
  persistence, concurrency-aware parent updates, portfolio/services, uploads, draft recovery,
  navigation, preview and verification.
- `MaxxisAssistant.jsx`: widget shell, conversation state, response discrimination, all capability
  cards, action confirmations, provider actions, workflow actions, dragging and persistence.
- `Dashboard.jsx`: feed assembly and filtering, card stack presentation, property/service loading,
  entitlements, map/feed coordination and responsive behavior.

## Dependency baseline

- Initial cycle scan: 0 cycles.
- Initial forbidden boundary violations: 0.
- Modules with direct Supabase API access: 15.
- Existing direction is predominantly `pages -> components/hooks/services -> lib`; it was not
  previously enforced automatically.
- High-risk coupling: page components contain domain normalization/storage logic, while Maxxis
  response rendering and action state share one component.

## Domain map

| Domain | Current owners before extraction |
| --- | --- |
| AUTH / SESSION | `App.jsx`, `useAuthSession` |
| PROFILE | `App.jsx`, `Onboarding.jsx`, `useProfileSync`, profile services/libs |
| FEED | `App.jsx`, `Dashboard.jsx`, feed services |
| MATCHES / CHAT | `MatchesPage.jsx`, `useChatRealtime`, chat services |
| MAXXIS / WORKFLOW | `MaxxisAssistant.jsx`, `maxxisService.js` |
| NAVIGATION | `App.jsx`, navbar/bottom navigation |
| REALTIME / CACHE | `App.jsx`, realtime lifecycle, storage helpers |
| PAYMENTS | `App.jsx`, checkout/plan services |
| PROPERTIES / SERVICES | `App.jsx`, Dashboard, Matches, Onboarding and domain libs |

The extraction target is incremental: move pure domain rules, data access and large presentation
capabilities behind explicit modules while keeping every public component contract unchanged.

## Other large files observed

`translations.js` (4,060), `MapView.jsx` (2,851), `Settings.jsx` (1,899),
`AdminDashboard.jsx` (1,798), `Landing.jsx` (1,109), `SwipeCard.jsx` (1,031),
`PropertyCard.jsx` (958) and `Navbar.jsx` (958). They are recorded but are outside the required
extraction scope unless a dependency boundary demands a small compatible change.

## Automated baseline result

`node scripts/audit-architecture.mjs` initially reported 0 cycles, 0 forbidden boundaries,
15 direct-Supabase modules and warnings for the four historical hotspots targeted by Phase 5F.
## After extraction

| File | Before | After | Reduction | Extracted responsibility |
| --- | ---: | ---: | ---: | --- |
| `src/App.jsx` | 5,963 | 5,742 | 221 | session lifecycle, security audit/rate limit and user preferences |
| `src/pages/MatchesPage.jsx` | 4,912 | 2,750 | 2,162 | portfolio/property presentation and chat access query |
| `src/pages/Onboarding.jsx` | 5,363 | 5,320 | 43 | required profile and mobile-step validation rules |
| `src/components/maxxis/MaxxisAssistant.jsx` | 2,622 | 793 | 1,829 | response cards, discriminators and capability presentation |
| `src/pages/Dashboard.jsx` | 4,821 | 4,821 | 0 | audited; no low-risk extraction was required in this phase |

Final gate: 0 dependency cycles, 0 forbidden boundaries, 15 modules with direct Supabase access,
0 budget warnings and 0 budget failures. Existing public component contracts, backend endpoints,
database schema and RLS were preserved.

The large Maxxis service remains a compatibility facade: response normalization moved to the
domain registry, while splitting every endpoint wrapper into tiny clients was intentionally
deferred because it would add indirection without reducing coupling in this phase.
