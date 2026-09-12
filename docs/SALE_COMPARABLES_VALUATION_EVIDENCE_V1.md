# Sale Comparables + Valuation Evidence v1

## Scope and semantics

This backend-only phase integrates RentCast `GET /v1/avm/value` as **valuation evidence**. RentCast AVM is not DealSifter ARV. Provider estimate and range are `ESTIMATED`; locally derived differences and $/sqft are `CALCULATED`. No raw provider response reaches frontend, Gemini, Maxxis, or logs.

The architectural baseline is [RENTCAST_INTELLIGENCE_CAPABILITY_AUDIT_2026-09-12.md](./RENTCAST_INTELLIGENCE_CAPABILITY_AUDIT_2026-09-12.md).

## Request and provider policy

- Backend key: existing `RENTCAST_API_KEY` only.
- Initial DealSifter search policy: `maxRadius=5`, `daysOld=270`, `compCount=20`, `lookupSubjectAttributes=true`.
- These are configurable initial product parameters, not an industry standard.
- No automatic retry and no sold-record, rent, listing, or market fallback.
- A successful HTTP 200 is finalized as provider usage even if normalization later rejects the body.

## Cache and cost controls

- Independent data type: `property_value_avm`, schema version 1.
- Address-fingerprint bound and property-id bound.
- Configurable valuation freshness policy, default 72 hours. This is a DealSifter policy, not a RentCast licensing guarantee.
- Corrupt, incompatible, expired, or fingerprint-mismatched entries are safe misses.
- Valid hits create no provider request and no Usage Guard reservation.
- Existing database single-flight lease is reused; a miss rechecks cache after acquiring the lease.
- Usage Guard operation: `property_value_avm`; the aggregate hard limit remains 45 successful/reserved RentCast requests per month.
- Provider overage remains disabled. Nuggets, entitlements, and Stripe are unchanged.

## Comparable normalization and deterministic diagnostics

Normalized candidates preserve provider id, safe address/location fields, property type, beds/baths, living and lot sqft, year built, listing price/status/type/dates, distance, days old, days on market, and provider correlation when supplied. Missing values remain null.

DealSifter derives only auditable diagnostics: price/sqft, structural differences, eligibility, quality class, reason codes, and descriptive statistics. Hard-invalid candidates are separated from imperfect but usable/down-ranked candidates. Provider correlation is preserved but not used as a DealSifter score.

Permanent limitations surfaced on every candidate set:

- `RENOVATION_CONDITION_UNAVAILABLE`
- `ARMS_LENGTH_DISTRESS_UNAVAILABLE`
- `PROVIDER_LISTING_PRICE_IS_NOT_CONFIRMED_SALE_PRICE`

The initial configurable DealSifter quality policy is validation scaffolding, not an industry-standard valuation rule. Residential methodology is limited to Single Family, Condo, and Townhouse; unsupported or incompatible types fail safely.

## Intentionally deferred

No final/recommended DealSifter ARV is calculated or exposed. Renovation condition, arm's-length/distress status, non-disclosure coverage, sale-price confirmation, outlier methodology, weighting, confidence, and market context must be resolved in the future ARV design. Maxxis remains cache-only and cannot initiate this provider call. Public Property Intelligence remains OFF.

## Live validation

Controlled property: `e86dd292-429d-4b51-9b02-bc60a3e9068f` (`7081 Kalanianaole Hwy, Honolulu, HI 96825`). Validation is cache-first, permits at most one live AVM request, and requires the second service lookup to be a cache hit. Real result and field-quality decision are recorded in the phase closeout report.

### Production result — 2026-09-12

- Cache before: MISS.
- RentCast calls: 1; HTTP 200.
- Provider estimate: $2,516,000 (`ESTIMATED`).
- Provider 85% range: $1,864,000–$3,168,000 (`ESTIMATED`).
- Comparables: 20 returned and 20 normalized.
- Deterministic classifications: 9 structurally strong, 3 usable, 8 down-ranked, 0 hard-rejected.
- Field coverage: price 20/20; distance 20/20; recency 20/20; type 20/20; beds/baths 20/20; living sqft 20/20; lot 8/20; year built 20/20; provider correlation 20/20.
- Second service lookup: cache hit; 0 additional RentCast calls.
- Usage Guard: consumption changed from 2/45 to 3/45 exactly once.

Representative diagnostics:

| Comparable | Distance | Age | Price | Sqft | Provider correlation | DealSifter diagnostic |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 502 Kekupua St | 0.868 mi | 1 day | $1,450,000 | 2,339 | 0.9021 | Structurally strong: same type, close, recent, similar living area |
| 6703 Hawaii Kai Dr | 1.0435 mi | 1 day | $3,200,000 | 2,842 | 0.9277 | Usable: same type and recent |
| 379 Ainahou St | 0.5989 mi | 1 day | $1,799,000 | 2,488 | 0.9523 | Down-ranked: year-built variance |
| 315 Hanakoa St | 0.5592 mi | 158 days | $1,980,000 | 2,854 | 0.9077 | Down-ranked: lot-size and year-built variance |

Quality decision: **CONDITIONAL**. The payload is sufficiently complete to validate provider AVM ingestion, normalization, caching, structural comparison, and explainable diagnostics. It is not sufficient for a defensible DealSifter ARV because the comparable `price` is retained as provider listing-price evidence rather than asserted as a confirmed closed-sale price, lot size is absent in 12/20 records, and renovation condition plus arm's-length/distress status are unavailable. No value is fabricated to close those gaps.
