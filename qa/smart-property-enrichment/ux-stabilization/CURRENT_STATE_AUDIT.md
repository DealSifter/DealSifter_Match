# Current-state audit before implementation

- Branch: `fix/production-real-defects`.
- Local and pushed HEAD: `fb1e0412b37649118e97d05349342d9772b444d0`.
- Production runtime: `8c5e57aa652c90084a937aa7044df29833112c6c`; READY deployment `dpl_4SCsMwR52fnJyzXANPYQD9esvywx`, public alias verified. HEAD adds QA only; no rollback/reset performed.
- Existing worktree changes, preserved: six prior QA outputs under `qa/map-navigation-cleanup/` and `qa/runtime-orchestration-hardening/`.
- Active functions: property-fact-review 1; maxxis-chat 84; public-parcel 10; maxxis-deal-workflow 16; maxxis-provider-message-draft 19; feature-flags 19. JWT verification remains enabled.
- Latest migration: `20261014213000_smart_property_fact_review`; preceding guard `20261013000001`. Existing review/history tables, RLS and service-only store RPC verified. Migration for this work: NONE expected; stop before schema changes.
- Frontend: `src/features/propertyFacts/`, `src/services/propertyFactReviewService.js`; existing edit shell/form is in `src/pages/Onboarding.jsx` using `src/components/ui/Modal.jsx`.
- Persistence: service invokes `property-fact-review`; `runtime.ts` reconciles/decides and calls transactional service-only `ds_store_property_fact_review`, which versions state/history/public facts and deduplicates notifications.
- Portfolio: Onboarding rows and `src/components/matches/PortfolioPropertyFacts.jsx`; current warning counts use persisted summary while rows use an unrelated candidates/pending/adopted filter.
- Notifications: App maps private `property_data` records; `openPropertyFactReview` dispatches owner-scoped events. Maxxis uses the same CTA/event path.
- Bootstrap/loading: App wraps all modules in PropertyFactReviewProvider, eager-loads the standalone review/model; boot and hydration branches use AppLoadingScreen. Existing initial animated logo is in index.html and App.css. Map lifetime/camera sources remain untouched.

Observed code causes to validate: bounded per-property cache warmup at portfolio hydration; CHECK on edit; mandatory READ/CHECK before review enables; shared busy state disables close/choices; private owned-state updates trigger whole-public-inventory RPC reload; heavy reconciliation imports in the root UI provider; adopted/no-action rows render as saved decisions despite no pending alternative. Production SQL/function diagnostics and before/after network tests will determine additional persistence causes; none is assumed fixed yet.

Evidence: `production-before.json`, `backend-before.json`, `database-before.json`. These are read-only observations, with no real user session or property mutation.
