# Rent pipeline

Existing: RentCast supplemental provider → normalized `RentEstimateEvidence` (`rent`, `rangeLow`, `rangeHigh`, `comparables`, retrievedAt, queryFingerprint, PROVIDER_ESTIMATE) → `rent_estimate_evidence` cache → `SupplementalEvidenceService` → `getDealInsightContext` rentalEvidence/providerMarketContext. Property-record canonical direct facts previously omitted this separate cache; no contractual-rent field exists in their whitelist. Thus “no basis” in that route did not establish absence from the supplemental cache.

Added: financial question → authenticated Maxxis runtime/property gate → existing canonical cached evidence → entitlement-controlled supplemental `getCached` → pure financial adapter → providerMarketRentEstimate. Source date unavailable upstream stays null; retrieval date and reference count/ranges are retained. TTL 72 hours and retained STALE_USABLE are preserved, never silently refreshed.

CurrentContractRent remains a different domain. Existing private `rent`/`expectedRent` inputs map only to investorRentAssumption, scoped by the current authenticated reviewer and property. Another property's active scenario is ignored. No inferred occupied→rent, market→contract or listing→contract conversion exists. No new rent input persistence or automatic strategy change occurs.

For an income question with current rent missing and a market estimate available, PT/EN/ES explicitly describe the missing contract rent and the qualified provider estimate. Existing report/explicit save/simulate/concept requests are not intercepted. No Gemini arbitration or new acquisition occurs.
