# Official contract

Verified 2026-10-16 against [Rent Estimate](https://developers.rentcast.io/reference/rent-estimate-long-term),
[AVM behavior](https://developers.rentcast.io/reference/property-valuation), and
[rate limits](https://developers.rentcast.io/reference/rate-limits).
Backend GET `/v1/avm/rent/long-term`, X-Api-Key, address lookup. Optional explicit
type/beds/baths/living-sqft override automatic subject lookup, which remains true.
Central website-compatible policy: 5mi, 270days, 20comps. Result is monthly provider
market estimate, never current contract income or an investor assumption.
Normalized rent/range, returned subject, comparables, request identity and date are
retained; raw provider payloads, agents and contacts are not.

The key ceiling is 20 requests/sec. New Market Rent requests use the existing
database lease as a shared serial gate with minimum 250ms residence (at most four
starts/sec for this capability). Monthly hard cap 45 and plan/bucket limits remain
unchanged. No automatic retries or alternate provider fallback.
