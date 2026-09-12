# Closed-Sale Evidence + Comp Cross-Validation v1

## Scope

This backend-only phase adds recorded closed-sale evidence to the existing RentCast AVM comparable candidates. It does not calculate or expose a DealSifter ARV. The architectural baselines are [RentCast Intelligence Capability Audit](./RENTCAST_INTELLIGENCE_CAPABILITY_AUDIT_2026-09-12.md) and [Sale Comparables + Valuation Evidence v1](./SALE_COMPARABLES_VALUATION_EVIDENCE_V1.md).

## Provider request and cost

- Endpoint: `GET /v1/properties`.
- One bulk request using `address`, `radius`, `saleDateRange`, `propertyType`, and `limit`.
- Initial revisable DealSifter policy: 5-mile radius, 270-day recorded-sale window, subject property type, limit 100.
- No per-comparable provider calls and no automatic fallback endpoints.
- Existing AVM evidence must already be present in valid address-bound cache; this service never reacquires AVM.
- Usage operation: `property_sold_search`; aggregate RentCast hard limit remains 45.

## Cache

- Independent data type: `property_sold_record_pool`, schema version 1.
- Bound to property id and address fingerprint.
- Query fingerprint includes address fingerprint, radius, sale-date window, property type, and limit.
- Default DealSifter TTL: 720 hours, configurable with `SOLD_RECORD_POOL_CACHE_TTL_HOURS`.
- Invalid, expired, address-mismatched, or query-mismatched payloads are safe misses.
- The existing database-backed single-flight lease serializes concurrent cache misses.

The TTL is a DealSifter freshness policy, not a statement about RentCast licensing or retention rights.

## Evidence semantics

- Valid `history` sale entries and valid `lastSaleDate`/`lastSalePrice` from RentCast property records are `VERIFIED_RECORD`.
- Future dates, invalid dates, non-sale events, and non-positive prices are rejected.
- The latest valid transaction within the configured window is selected deterministically; same-date conflicting prices are flagged as ambiguous.
- AVM/listing price remains separate and is never promoted to recorded sale price.
- Recorded sale $/sqft is `CALCULATED` only when recorded sale price and property-record living sqft are positive.
- Transaction quality remains `UNKNOWN`; renovation/condition remains unavailable.

## Cross-validation and qualification

Matching order is deterministic:

1. exact RentCast property id;
2. exact normalized street/state/ZIP;
3. unique close geographic match plus compatible type and living area;
4. otherwise `AMBIGUOUS` or `NO_MATCH`.

An exact provider id is not accepted blindly when both payloads expose conflicting unit identifiers; that case becomes `AMBIGUOUS` with `IDENTITY_ADDRESS_CONFLICT`.

A candidate becomes a Qualified Sold Comp only with an `EXACT` or `STRONG` identity and a valid recorded sale. Structural quality reuses the existing Comp Engine diagnostics and adds recorded-sale recency, location relevance, living-area similarity, and match strength. Provider correlation remains a separate provider signal.

## Initial five-comp sufficiency rule

- `SUFFICIENT`: at least five strong Qualified Sold Comps.
- `CONDITIONAL`: qualified evidence exists, but fewer than five are strong or material limitations remain.
- `INSUFFICIENT`: no qualified recorded-sale evidence.

Five total or five weak comps are not sufficient. Lot size is a quality signal and missing lot data does not universally reject residential comps. Renovation/condition and transaction-quality uncertainty are retained for a future confidence model and do not fabricate certainty.

## Safety boundaries

- No final DealSifter ARV, formula selection, weighting, or outlier methodology.
- No frontend or public export.
- Public Property Intelligence remains OFF.
- Maxxis remains a consumer of authorized cached evidence and cannot call RentCast directly.
- Nuggets, entitlements, Stripe, pricing, and provider overage are unchanged.

## Controlled live validation

Subject: property `e86dd292-429d-4b51-9b02-bc60a3e9068f`, `7081 Kalanianaole Hwy, Honolulu, HI 96825`.

The validation is cache-first, allows at most one live sold-property bulk search, forbids another AVM request, and requires the second sold-evidence service lookup to be a cache hit. Actual results are appended only after the controlled run.

### Production result — 2026-09-12

- Sold-search cache before: MISS.
- Provider acquisition: one bulk request, HTTP 200; no AVM request.
- Sold records: 60 returned, 60 normalized, 60 with valid recorded price/date in the configured window.
- AVM candidates cross-validated: 20.
- Identity outcomes: 1 exact, 0 strong geographic, 1 ambiguous, 18 no-match.
- Qualified Sold Comps: 1 strong, 0 conditional after identity hardening.
- Sold pool lot coverage: 59/60.
- Second service lookup: cache hit, zero additional provider calls.
- Usage Guard: 3/45 before and 4/45 after.
- Sold Comp Set Sufficiency: `CONDITIONAL`; five-strong threshold not met.

Strong Qualified Sold Comp:

| Address | Distance | Recorded sale | Recorded price | Living sqft | Recorded $/sqft | Beds/baths | Lot | Year | Match |
| --- | ---: | --- | ---: | ---: | ---: | --- | ---: | ---: | --- |
| 777 Kumukahi Pl, Honolulu, HI 96825 | 0.9198 mi | 2026-04-13 | $2,450,000 | 1,866 | $1,312.97 | 4 / 2.5 | 7,196 | 1968 | EXACT |

Reasons: `EXACT_PROPERTY_MATCH`, `RECORDED_SALE_CONFIRMED`, `RECORDED_SALE_RECENT`. Limitations: `TRANSACTION_QUALITY_UNKNOWN`, `RENOVATION_CONDITION_UNKNOWN`.

Material exclusions:

- `520 Lunalilo Home Rd`: AVM candidate identifies `Unit ER126`, while the sold record identifies `Unit 6202`. It is `AMBIGUOUS` with `IDENTITY_ADDRESS_CONFLICT` and is not qualified.
- 18 other AVM candidates have `NO_SOLD_RECORD_MATCH` within this single controlled query; examples include 379 Ainahou St, 6703 Hawaii Kai Dr, 315 Hanakoa St, 502 Kekupua St, and 7157 Makaa St.

Decision: the bulk sold-record response has excellent transaction-field coverage, but cross-over with the AVM candidate set is insufficient. There are not five strong Qualified Sold Comps. The project is not ready to implement a defensible DealSifter ARV from this evidence set without first revisiting candidate acquisition/cross-validation strategy or adding another verified sold-evidence source. No filters were retuned and no second provider request was made to force a pass.
