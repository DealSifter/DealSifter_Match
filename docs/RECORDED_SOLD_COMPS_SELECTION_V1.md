# Recorded Sold Comps Selection v1

## Decision

Recorded property sales are now eligible for deterministic DealSifter comparable analysis without first belonging to the RentCast AVM comparable set. The AVM set remains independent secondary evidence. An overlap can increase explainability, but it is not required and it does not alter the recorded-sale evidence status.

No DealSifter ARV, recommended value, valuation weight, outlier exclusion, provider acquisition, UI, entitlement, Nugget, Stripe, or Maxxis tool was added in this phase.

## Architecture

```text
address-bound sold-record cache
  -> SoldPropertyRecord (VERIFIED_RECORD)
  -> recorded-sale adapter (RECORDED_SALE_PRICE)
  -> existing DealSifter Comp Engine policies and diagnostics
  -> STRONG / ACCEPTABLE / WEAK / HARD_INVALID
  -> deterministic ranking
  -> Top 5 strong evidence set

cached AVM candidates
  -> optional local identity overlap diagnostic
  -> EXACT / STRONG / AMBIGUOUS / NO_MATCH
```

`recordMatchStrength` describes only the relationship with an AVM candidate. `compQuality` describes direct valuation comparability. The two dimensions are deliberately separate.

## Evidence and calculations

- Sale price and date come only from the normalized property-record transaction and remain `VERIFIED_RECORD`.
- Distance from the subject, days since sale, absolute/percentage living-area differences, structural differences, and recorded sale price per living square foot are deterministic `CALCULATED` evidence.
- Listing, asking, AVM, and assessment values never substitute for a recorded sale price.
- Provider correlation is nullable and is preserved only when a real AVM overlap exists. Missing correlation carries no penalty.
- Lot size remains an optional, property-type-aware quality signal.
- Unknown transaction quality and renovation/condition remain explicit limitations.

## Quality policy

The selector calls the existing Comp Engine for the same property-type, distance, recency, living-area, beds/baths, lot, and year-built signals. A direct recorded candidate is:

- `HARD_INVALID` for objective defects such as missing/invalid recorded sale evidence, invalid living area, incompatible property type, or an ambiguous transaction;
- `STRONG` only when the existing engine classifies it strong and the core sold policy is also met: at most 3 miles, at most 40% living-area variance, and at most 270 days since recorded sale;
- `ACCEPTABLE` when core sold limits are met but the existing engine does not produce enough positive signals for strong quality;
- `WEAK` when soft penalties or insufficient core similarity remain.

Sufficiency is `SUFFICIENT` only with at least five strong candidates. Five acceptable candidates yield `CONDITIONAL`; weak candidates do not satisfy quantity by themselves. Ranking uses quality class, penalties, positive signals, distance, living-area variance, recency, and a stable identity tie-breaker. It is not an ARV weighting model.

## Controlled production cache reanalysis

Property: `e86dd292-429d-4b51-9b02-bc60a3e9068f`.

- Sold-record cache: HIT.
- Records reused: 60.
- Recorded price/date coverage: 60/60 and 60/60.
- Lot coverage: 59/60.
- New RentCast calls: 0.
- Usage Guard: 4/45 -> 4/45.
- Direct candidates: 60.
- Hard invalid: 0.
- Weak/down-ranked: 53.
- Acceptable: 7.
- Strong: 0.
- Top 5 strong: none.
- Sufficiency: `CONDITIONAL` because at least five candidates are usable, but none meets strong quality.

The five highest-ranked usable candidates (all `ACCEPTABLE`, not strong) were:

1. 436 Kekauluohi St — 0.64 mi, sold 2026-04-08 for $1,550,000, 1,790 sqft.
2. 777 Kumukahi Pl — 0.92 mi, sold 2026-04-13 for $2,450,000, 1,866 sqft; exact AVM overlap with provider correlation 0.8541.
3. 945 Wainiha St — 2.06 mi, sold 2026-06-23 for $650,000, 1,793 sqft.
4. 7533 Kamaomao Pl — 2.87 mi, sold 2026-04-17 for $1,650,000, 1,976 sqft.
5. 685 Kealahou St — 2.93 mi, sold 2026-06-01 for $1,540,000, 2,020 sqft.

Descriptive statistics for those five usable candidates, not an ARV:

- Median recorded sale price: $1,550,000.
- Recorded sale price range: $650,000-$2,450,000.
- Median recorded sale price per sqft: $835.02.
- Average recorded sale price per sqft: $827.76.

There is no Top 5 strong set, so AVM overlap among Top 5 strong is 0/5. Among the five diagnostic usable candidates, overlap is 1/5. The evidence is useful but does not yet support the strong-five product threshold. Readiness for the DealSifter ARV Engine v1 is therefore `NO` under the current reviewed policy.

## Boundaries

The prior AVM cross-validation remains intact as an independent convergence diagnostic. This phase made no provider request and used a fail-fast provider during validation, so any accidental acquisition attempt would have failed. Public Property Intelligence remains off.
