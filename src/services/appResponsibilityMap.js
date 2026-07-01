/**
 * @file App.jsx responsibility map for the staged service extraction.
 *
 * This file is documentation only. Do not import it into runtime code yet.
 * The goal is to freeze the extraction boundaries before moving logic out of
 * App.jsx, so future refactors can be done in small, testable steps.
 *
 * ## 1. Route Orchestration - stays in App.jsx
 *
 * Responsibilities:
 * - Lazy route/component loading with retry and chunk recovery.
 * - Top-level page state: page, prevPage, protected-page redirects, last-page persistence.
 * - Shell rendering: Navbar, mobile bottom nav, Suspense, Activity keep-alive wrappers.
 * - Modal orchestration: auth, admin auth, unlock, spotlight, embedded checkout.
 * - Passing already-derived state and callbacks into Dashboard, MapView, MatchesPage,
 *   Onboarding, Pricing, Settings, AdminDashboard, Terms and Privacy.
 * - Blocking/sync overlays and mobile orientation guard display.
 * - Auth modal opening and page-level tab routing helpers.
 *
 * Current App.jsx blocks:
 * - safeSession* helpers and lazyWithRetry/ChunkRecoveryScreen are app-shell helpers.
 * - setPage wrapper and renderPageContent are route orchestration.
 * - keep-alive page rendering belongs in App.jsx for now.
 *
 * ## 2. Global Feed Logic - extract to feedService.js
 *
 * Responsibilities currently in App.jsx:
 * - DB/local mapping helpers used by feed inventory: mapDbPropertyToLocal,
 *   mapDbServiceToLocal, buildDbOwnerPreview, owner preview resolution.
 * - Global feed inventory hydration from ds_get_global_feed_inventory and table fallback.
 * - Normalization and validation of global showcase properties and connection services.
 * - Global feed identity index used to canonicalize matched/interested feed actions.
 * - Feed action payload stripping, row creation, merge keys, richness scoring and merging.
 * - Remote user_feed_actions hydration, realtime subscription and debounced sync.
 * - Global feed realtime refresh subscriptions across properties, services, profiles,
 *   property_images and card_spotlights.
 * - Spotlight candidate hydration, active spotlight key resolution and spotlight purchase
 *   RPC input shaping.
 *
 * Should remain in App.jsx after extraction:
 * - useState ownership for rendered arrays until a later hook extraction.
 * - React effects that call the service and set React state.
 * - addToast/page/modal decisions after service results.
 *
 * ## 3. Plan Usage Logic - extract to planUsageService.js
 *
 * Responsibilities currently in App.jsx:
 * - Initial local mock subscription and nugget state defaults.
 * - Hydrating nuggets, plan_id and subscription row during profile hydration.
 * - Mapping DB subscription row + PLANS definition into access subscription shape.
 * - Persisting local mock nuggets/subscription for non-Supabase mode.
 * - Admin access subscription override.
 * - Plan limit error classification and plan-gate event tracking around unlock failures.
 * - Nugget-cost feature purchases that affect balance, especially spotlight activation.
 *
 * Should remain in App.jsx after extraction:
 * - React state setters for nuggets/subscription.
 * - UI routing into Pricing or Settings after a plan gate.
 * - Checkout flow hook usage, because it already lives in useCheckoutFlow.
 *
 * ## 4. Consent/Cookies Logic - extract to consentService.js
 *
 * Responsibilities currently in App.jsx:
 * - Cookie consent read/write with version and TTL.
 * - LGPD consent read/write/clear per user and legacy key fallback.
 * - Server-side consent proof insertion into consent_records.
 * - Remote consent verification and local backfill.
 * - Anonymous consent linking after login.
 * - Consent revocation by setting revoked_at.
 *
 * Related but not in this service:
 * - PWA install prompt state currently sits next to consent code, but it is not consent.
 *   Keep it in App.jsx for now or extract later to a small pwaInstallService/usePwaInstall hook.
 *
 * ## 5. Session Hydration - already in hooks, verify duplication
 *
 * Already extracted:
 * - useAuthSession handles Supabase auth bootstrapping, login/signup/forgot password and
 *   session restoration callbacks.
 * - useProfileSync and usePortfolioSync hold sync status refs/debounce scaffolding.
 * - useCheckoutFlow handles Stripe checkout modal/portal/continuation orchestration.
 *
 * Duplication still present in App.jsx:
 * - Local authSession initialization from localStorage.
 * - app-session token generation, ds_register_app_session/ds_touch_app_session heartbeat,
 *   replaced-session handling and idle sign-out.
 * - security audit/session localStorage helpers.
 * - public users row bootstrap after auth.
 * - profile and portfolio hydration/persistence effects still live in App.jsx, even though
 *   sync hooks track their status. These are not part of this requested extraction, but they
 *   are future candidates for profileService/portfolioService or dedicated hooks.
 */

