# Market Rent baseline — 2026-10-16

Before implementation: branch `fix/production-real-defects`; HEAD and pushed remote
`e6f13b759238a21de1ca6b1367dd17ade46bc657`. Only subsequent commit over production
`97692d0ac00834e4b083a2f9bf3db3df9bec8bde` is QA receipt e6f13b7. Production READY,
exact SHA and public alias verified. Edge: maxxis-chat 87, workflow 18, message-draft
21, fact-review 5, property-intelligence 13, public-parcel 10. Latest migration
20261014213000; previous 20261013000001. Schema/RLS audit is read-only. Six existing
dirty QA files are user-owned and excluded from this implementation.

Provider: RentCastClient.estimateRent already uses backend X-Api-Key and the rent
endpoint, but supplemental request had no subject overrides and daysOld 180.
SupplementalEvidenceService fingerprints address + type + filters, not beds/baths/
sqft. SupabaseSupplementalEvidenceCache is persistent JSONB via existing privileged
RPCs, keyed property/provider/family/schema; payload can hold full request identity
and normalized evidence without a migration. Rent estimate TTL is 72 hours;
retained stale evidence remains qualified and may refresh only with explicit intent.
SupabasePropertySingleFlight is a database lease shared across Edge isolates.
UsageGuard enforces application ceiling 45/month plus plan/bucket budget; no increase.
Provider transport has 8s default timeout and availability circuit, no retries.
PropertyEvidenceService/repository loads internal row and cached normalized provider
records, through existing authorized property/entitlement gates.

FinancialEvidenceStack is pure: current rent, market estimate and investor assumption
are distinct domains. FinancialEvidenceContext projects rent only from cached
rent_estimate evidence. Maxxis direct routing was always cache-only/providerCalls 0.
Readiness already separates CURRENT_ACTUAL/MARKET_SCENARIO/INVESTOR_SCENARIO but
describes all missing expense domains coarsely. The label formatter combined a
generic record/declared string with provider authority, causing the reported tax
contradiction. No financial calculator or report migration is in scope.

Official references checked before implementation:
- https://developers.rentcast.io/reference/rent-estimate-long-term
- https://developers.rentcast.io/reference/property-valuation
- https://developers.rentcast.io/reference/rate-limits

API contract: address enables automatic subject lookup; explicit supported subject
attributes override lookup values. Website-compatible filters 5mi/270days/20comps.
Multi-Family/Apartment rental estimates are per unit. Hard key limit 20 requests/sec;
existing stricter budgets remain authoritative.
