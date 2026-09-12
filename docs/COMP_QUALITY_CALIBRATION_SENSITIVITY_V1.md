# Comp Quality Calibration + Sensitivity Analysis v1

## Decision

The recorded-sold-comp policy was too binary. A candidate could miss a single secondary threshold and lose strong eligibility even when the complete structural evidence remained defensible. The calibrated policy preserves hard evidence requirements, makes proximity safety explicit, grades secondary signals, and separates individual quality from set sufficiency.

This is an initial DealSifter product policy, not an appraisal, USPAP, or universal industry standard. No price or price-per-square-foot value participates in quality classification or ranking.

## Subject baseline

Property `e86dd292-429d-4b51-9b02-bc60a3e9068f`:

| Field | Internal/listing | Property record | AVM/Comp Engine |
|---|---:|---:|---:|
| Type | SFR, user-provided | Single Family, verified | Single Family, estimated |
| Beds | 5, user-provided | 5, verified | 5, estimated |
| Baths | 3, user-provided | 3, verified | 3, estimated |
| Living sqft | 2,333, user-provided | 2,333, verified | 2,333, estimated |
| Lot sqft | unavailable | 10,995, verified | 10,995, estimated |
| Year built | unavailable | 1976, verified | 1976, estimated |
| Coordinates | unavailable internally | 21.277997, -157.707698, verified | same values, estimated |

`SFR` and `Single Family` are an explicitly normalized equivalence. No conflicting available values were found. Internal lot/year absence is surfaced rather than treated as a conflict. The Comp Engine uses the cached AVM subject baseline, which agrees with the verified property record on all available structural fields.

No normalized special characteristics such as pool, garage, waterfront, view, HOA, or condition exist in the cached sold-record contract. They were not inferred or acquired.

## Previous policy map

- Fundamentals: compatible supported type, positive price and living sqft.
- Distance: positive at <=1 mile; penalty above 3 miles.
- Recency: positive at <=90 days; penalty above 180 days.
- Living area: positive at <=20%; penalty above 40%.
- Bedrooms/bathrooms: penalty when difference exceeds 1.
- Lot: penalty above 50% variance.
- Year built: penalty above 20 years.
- Strong: no penalty and at least three positive signals, plus direct-selection core limits of <=3 miles, <=40% living-area variance, and <=270 days.
- Acceptable: no hard invalidation or penalty but fewer than three positive signals.
- Weak: soft penalty or failed core similarity.

This created an excessive AND-like result: 0 strong, 7 acceptable, 53 weak, 0 invalid.

## Calibrated DealSifter Comp Policy v1

Fundamental requirements remain mandatory: verified recorded price/date, usable record, compatible property type, positive living area, and no corrupt/ambiguous transaction.

Proximity:

- <=0.5 mile: preferred;
- >0.5 to 1 mile: strong-proximity eligible;
- >1 to 3 miles: secondary/supporting only;
- >3 miles: weak under the default policy, with no silent expansion.

Recency bands: <=90 very recent, 91-180 recent, 181-270 older, >270 stale/outside the acquired window. Living-area bands: <=15% preferred, <=25% strong-compatible, <=40% usable. Bedrooms, bathrooms, SFR lot variance, and year-built differences are graded signals rather than single automatic demotions.

The multi-check score uses only structural/temporal signals. Strong requires <=1 mile, <=180 days, <=25% living-area variance, and score >=11. `GOOD` was added because it materially separates strong-proximity candidates with limitations from secondary acceptable context. It is not a cosmetic rename and does not count toward the strong reference-set threshold.

Reference-set classes:

- 0-1 strong: `INSUFFICIENT`;
- 2 strong: `MINIMUM` / conditional reference set;
- 3 strong: `ACCEPTABLE`;
- 4 strong: `ROBUST`;
- 5+ strong: `PREFERRED`.

## Real distributions — 60 cached sales

Penalty frequency, all 60: distance 26, recency 33, living area 18, bedrooms 26, bathrooms 6, lot 8, year 10, property type 0, special attributes 0, structural missing data 1.

Penalty frequency, current-policy Top 15: distance 3, recency 6, living area 0, bedrooms 2, bathrooms 0, lot 0, year 1, property type 0, special attributes 0, missing data 0.

Distributions:

- Distance: <=0.5: 0; >0.5-1: 11; >1-2: 12; >2-3: 11; >3: 26.
- Recorded-sale recency: 0-90: 4; 91-180: 23; 181-270: 33; 271+: 0.
- Living-area variance: <=10%: 6; >10-15%: 3; >15-20%: 5; >20-25%: 9; >25-30%: 3; >30%: 34.
- Bedroom delta: same 5; <=1: 29; >=2: 26.
- Bathroom delta: same 8; <=1: 46; >1: 6.
- Year-built delta: <=5: 20; 6-10: 17; 11-20: 13; >20: 10.
- SFR lot variance: <=25%: 17; >25-50%: 34; >50%: 8; unavailable: 1.

## Seven previously acceptable candidates

The old strong blocker was insufficient positive-signal count, not hard-invalid evidence:

1. 436 Kekauluohi: 0.64 mi, 157 days, 23.27% sqft variance, bed/bath deltas 0/1, lot 39.85%, year 4. The old policy missed recent <=90 and sqft <=20; calibrated `STRONG`.
2. 777 Kumukahi: 0.92 mi, 152 days, 20.02% sqft variance, bed/bath deltas 1/0.5, lot 34.55%, year 8. It missed both old cutoffs narrowly; calibrated `STRONG`.
3. 945 Wainiha: 2.06 mi, 81 days, 23.15% sqft variance; calibrated `ACCEPTABLE`, blocked from strong by secondary proximity.
4. 7533 Kamaomao: 2.87 mi, 148 days, 15.30% sqft variance; calibrated `ACCEPTABLE`, blocked by secondary proximity.
5. 685 Kealahou: 2.93 mi, 103 days, 13.42% sqft variance; calibrated `ACCEPTABLE`, blocked by secondary proximity.
6. 7227 Pikoni: 1.45 mi, 171 days, 38.11% sqft variance; calibrated `ACCEPTABLE`, with secondary proximity and weaker area similarity.
7. 7540 Puumahoe: 2.85 mi, 165 days, 33.13% sqft variance; calibrated `ACCEPTABLE`, with secondary proximity and weaker area similarity.

## Sensitivity scenarios

| Scenario | Strong | Good | Acceptable | Weak | Invalid | Leading candidates |
|---|---:|---:|---:|---:|---:|---|
| A — previous/current | 0 | 0 | 7 | 53 | 0 | 945 Wainiha; 436 Kekauluohi; 777 Kumukahi |
| B — multi-check balanced | 2 | 4 | 17 | 37 | 0 | 436 Kekauluohi; 777 Kumukahi; 7304 Kauhako |
| C — locality priority | 0 | 6 | 17 | 37 | 0 | 436 Kekauluohi; 777 Kumukahi; 7304 Kauhako |
| D — structural priority | 2 | 4 | 17 | 37 | 0 | 436 Kekauluohi; 777 Kumukahi; 7304 Kauhako |

Scenario C intentionally requires <=0.5 mile for strong; the real pool has zero records in that band. It therefore does not expand radius or promote >0.5-mile candidates to strong. Scenarios B and D independently converge on the same two strong candidates.

## Consensus and stability

1. 436 Kekauluohi — Top 5 in 4/4 scenarios, strong in 2; 0.64 mi, 23.27% sqft variance, 157 days.
2. 777 Kumukahi — Top 5 in 4/4, strong in 2; 0.92 mi, 20.02%, 152 days.
3. 7304 Kauhako — Top 5 in 3/4, strong in 0; 0.56 mi, 23.19%, 232 days; `GOOD` because of older sale.
4. 542 Kekupua — Top 5 in 3/4, strong in 0; 0.79 mi, 18.09%, 246 days; `GOOD`, older sale and bath delta.
5. 860 Kaahue — Top 5 in 3/4, strong in 0; 0.93 mi, 33.48%, 264 days; `GOOD`, older sale and weaker area similarity.

Mean Top-5 Jaccard overlap is 0.625, producing `MEDIUM` ranking stability. Consensus strong count is 2, so the calibrated set is `MINIMUM`, not acceptable/robust/preferred.

## Price dispersion — diagnostic only

Across the five consensus candidates: median sale price $1,550,000; average $1,547,000; range $635,000-$2,450,000; median recorded $/sqft $865.92; average $877.56.

This dispersion is not used in selection. It triggers `VALUATION_DISPERSION_WARNING` and `POSSIBLE_UNMODELED_FACTOR`. Cached evidence cannot identify the cause; condition, transaction quality, special characteristics, and micro-location remain possible but unverified explanations.

## Result and boundaries

Before: 0 strong, 0 good, 7 acceptable, 53 weak, 0 invalid.

After: 2 strong, 4 good, 17 acceptable, 37 weak, 0 invalid.

The policy change is applied because it is generalizable, price-independent, property-type-aware, preserves fundamentals, and maintains the <=1-mile strong safety rule. Readiness for building the DealSifter ARV Engine is `CONDITIONAL`: the engine may support 2-5 primary references but must degrade confidence/range and return unavailable when evidence is insufficient. No ARV was calculated.

Validation used the existing cache only. RentCast calls: 0. Usage Guard: 4/45 -> 4/45. Public Property Intelligence remains off; Nuggets and Stripe were untouched.
