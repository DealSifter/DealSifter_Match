# Current state / data-flow audit

HEAD/pushed 362108e9ce02b340749ac621cdf4ceeb93dd0a42; production frontend
06913dce671f805a89663d3a5a07f71d17c39785 (READY, alias verified).
maxxis-chat 83, public-parcel 9, property-intelligence 12, feature-flags 19;
all ACTIVE/JWT enforced. No reset or flag/source expansion.

Onboarding creates a UUID draft, geocodes and persists it through App's owner-scoped
handleValidatePortfolioProperties; publish is a separate operation. Editing uses the
same path. Stable save/step transition and explicit edit/review are the acquisition
triggers, not typing. Invalid geocodes remain drafts under existing publication rules.

propertyFactory already preserves nullable inputs, but onboarding parseCurrencyInput,
edit number fallbacks, App DB mapper/hydration and PropertyCard were turning blank
rehab/beds/baths into zero. DB columns also had NOT NULL/default-zero constraints.
The migration relaxes those OPTIONAL constraints/defaults without rewriting old rows.

Current canonical evidence projection and parcel-consensus-v1 remain the deterministic
read-model foundation. Reconciliation adds explicit user choices, not a provider ranking.
Existing scoped owner analysis clarifications are stored in ARV review contexts, subject
to financial consumers and an 8-KB limit; they cannot safely store publisher-managed
effective facts, immutable evidence decisions, public projection and grouped notifications.
The new owner-scoped sidecars therefore remain isolated from those financial inputs.

Existing notifications table, RLS, realtime backlog/read/deletion and Navbar system area
are reused, with one property_data category and unique property/evidence dedup index.
Existing Maxxis speech bubble/avatar timeline is reused; review is one global component,
desktop drawer/mobile sheet, entered from all five surfaces. No avatar/lens redesign.

Existing paid-provider wrapper is cache-only (allowProviderFallback=false) and retains
plan/unlock entitlement. Live RentCast usage added by this feature: zero. Public GIS
uses the existing authenticated public-parcel endpoint, approved-source checks, flags,
cache, source health, shared budget and timeouts. A signed already-acquired receipt can
avoid this lookup. Portfolio hydration reads sidecar metadata only, not N GIS requests.

Migration is additive apart from compatible optional-null/default relaxation and a
notification enum extension; no columns/rows removed, no publisher rewrite/backfill.
Local SQL/RLS is validated with isolated [PGlite PostgreSQL](https://pglite.dev/docs/),
which is a QA-only temporary installation, not a production dependency/framework.
