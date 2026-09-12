# DealSifter Weighted Appraisal-Style Comp Policy v1

## Positioning and boundaries

This policy is a deterministic, explainable analytical starting point. DealSifter and Maxxis Deal AI are not appraisers and do not present a structural candidate, user review, or future value analysis as an official appraisal. Structural comparability is not ARV-comp confirmation, structural score is not valuation confidence, and structural score is not a future monetary weight.

This phase uses cached evidence only. It does not calculate ARV or MAO, select by price, analyze images, or activate public UI.

## Four independent layers

1. **Hard gates:** valid recorded sale price/date, usable property record, compatible property type, sufficient living-area evidence, and non-corrupt/unambiguous record.
2. **Structural comparability:** normalized weighted score from 0–100 over checks that can actually be evaluated.
3. **Data completeness:** available applicable weight divided by total applicable weight. Unknown does not earn or lose structural points; it reduces completeness.
4. **Condition/renovation review:** separate state, initially `UNREVIEWED`, required before a candidate can ever be treated as condition-suitable for ARV.

A hard-gate failure makes the candidate `INVALID`. A score of at least 80, completeness of at least 65, hard-gate pass, and local eligibility makes it an `ARV_COMP_CANDIDATE`, never a confirmed ARV comp.

## Configurable balanced weights

| Check | Weight |
|---|---:|
| Subdivision/micro-location | 10 |
| Major-road barrier | 5 |
| Distance | 12 |
| Property type | 12 |
| Story/style | 5 |
| Living area | 15 |
| Year built | 7 |
| Lot, when material | 6 |
| Bedrooms | 5 |
| Bathrooms | 5 |
| Pool | 3 |
| Garage | 3 |
| Other verified features | 2 |
| Recorded-sale recency | 8 |
| Traffic/freeway relation | 2 |

The total is 100. `APPRAISAL_STYLE_STRICT` places more weight on local/structural conformity. `LOCALITY_TIME_TRAVEL` places 18 on subdivision and only 2 on recency, implementing “better to time travel than leave the subdivision” only when subdivision evidence is actually known.

## Graded checks

- Distance: <=0.5 mile preferred; >0.5–1 local; >1 secondary unless the same micro-market is verified. There is no silent radius expansion.
- Living area: <=200 sqft receives full credit; >200 is progressively reduced. It is not an automatic rejection while sufficient evidence remains.
- Year: <=5 years receives full credit; larger differences are graded.
- SFR lot: <=2,500 sqft receives full credit; larger differences are graded. Lot is `NOT_APPLICABLE` for property types such as condo.
- Bedrooms/bathrooms: exact match is preferred, with progressive rather than binary penalties.
- Recency: only `recordedSaleDate` is used; <=90 is very recent, <=180 recent, <=270 older.
- Subdivision, story, roads, pool, garage, features, and traffic are scored only when evidenced. Unknown is never silently converted into mismatch.

Price, price/sqft, asking price, AVM, and expected ARV do not enter these checks or the ranking.

## Real cache-only analysis — Honolulu subject

Subject: `e86dd292-429d-4b51-9b02-bc60a3e9068f`, 7081 Kalanianaole Hwy, Honolulu, HI 96825.

Available and aligned across the cached record/AVM/Comp Engine: Single Family, 5 beds, 3 baths, 2,333 sqft, 10,995 sqft lot, year 1976, coordinates 21.277997/-157.707698. Internal listing agrees on type/beds/baths/sqft; its lot/year/coordinates are absent. No conflicts were found. Story/style, subdivision, pool, garage, road relation, traffic/freeway exposure, condition, and other special characteristics are unknown.

The recommended minimum completeness is **65**. The balanced scenario reaches 70 from the eight known material checks. This avoids false 100% while still allowing complete public-record fundamentals to be assessed. The locality scenario reaches only 62 because its most important evidence—subdivision and barriers—is unknown; it correctly cannot grant primary eligibility on locality assumptions.

## Real scenarios

| Scenario | Excellent | Valid | Supporting | Weak | Invalid | Primary |
|---|---:|---:|---:|---:|---:|---:|
| A — current calibrated policy | — | 2 strong + 4 good | 17 acceptable | 37 | 0 | 2 strong |
| B — weighted balanced | 0 | 5 | 10 | 45 | 0 | 3 |
| C — appraisal-style strict | 0 | 1 | 5 | 54 | 0 | 0 |
| D — locality/time-travel | 0 | 4 | 3 | 53 | 0 | 0 |

Strict/locality scenarios are diagnostics, not production fallback policies. Scenario C withholds the local candidates under stricter ±200/year/local conformity. Scenario D withholds them because subdivision/barrier evidence is absent and completeness is 62. Neither scenario fabricates evidence or expands the radius.

Threshold sensitivity under the balanced policy: 75 = 3 primary candidates; 80 = 3; 85 = 0. The justified initial threshold remains **80**: lowering it to 75 adds no primary candidates in this evidence set, while 85 removes all three otherwise coherent and stable local candidates.

## Consensus primary structural candidates

All three pass every hard gate, have 70 completeness, appear in the Top 5 of all three weighted scenarios, have condition `UNREVIEWED`, and are visually review-ready because identifiers, address, sale evidence, and basic structural facts are available.

| Candidate | Sale date | Distance | Score | Sqft delta | Year delta | Lot delta | Beds/baths delta |
|---|---|---:|---:|---:|---:|---:|---:|
| 436 Kekauluohi St | 2026-04-08 | 0.64 mi | 84.50 | 543 | 4 | 4,381 | 0 / 1 |
| 777 Kumukahi Pl | 2026-04-13 | 0.92 mi | 81.79 | 467 | 8 | 3,799 | 1 / 0.5 |
| 7304 Kauhako St | 2026-01-23 | 0.56 mi | 80.00 | 541 | 10 | 4,875 | 1 / 0 |

The structural reference set is `ACCEPTABLE` (3). Condition-verified ARV comps remain 0, as required.

After structural selection only, sale-price median is $1,550,000, average $1,800,000, range $1,400,000–$2,450,000 (ratio 1.75). Recorded price/sqft median is $865.92, average $986.71, range $781.25–$1,312.97 (ratio 1.68). The configurable diagnostic ratio of 1.5 triggers `VALUATION_DISPERSION_WARNING` and `POSSIBLE_UNMODELED_FACTOR`. Price did not influence selection. Condition is one possible unknown, not an asserted cause.

## ARV condition/renovation review foundation

Target and observed condition preserve eight distinct values: `AS_IS`, `LIGHT_REHAB`, `STANDARD_RENOVATION`, `FULL_RENOVATION`, `HIGH_END`, `TURN_KEY`, `NEW_CONSTRUCTION`, and `UNKNOWN`.

`TURN_KEY` means ready for occupancy without material immediate rehab; it does not imply luxury or `HIGH_END`. `NEW_CONSTRUCTION` remains a distinct product/condition class and is not automatically equivalent to renovated existing housing, `FULL_RENOVATION`, `HIGH_END`, or `TURN_KEY`.

Review states are `UNREVIEWED`, `UNKNOWN`, `VISUALLY_SIMILAR`, `PARTIALLY_SIMILAR`, `SUPERIOR_TO_TARGET`, `INFERIOR_TO_TARGET`, and `NOT_COMPARABLE`. Compatibility separately supports `MATCHES_TARGET`, `PARTIAL_MATCH`, `SUPERIOR_TO_TARGET`, `INFERIOR_TO_TARGET`, `DIFFERENT_PRODUCT_CLASS`, and `UNKNOWN`.

Future review flow:

```text
Maxxis presents evidence-based structural candidate
  -> user independently reviews visible condition
  -> user selects observed and target condition
  -> system records USER_PROVIDED review, timestamp and optional notes
  -> condition compatibility changes ARV-use eligibility
  -> original structural score remains unchanged
```

The future checklist may include kitchen, bathrooms, flooring, finishes, windows, visible roof/HVAC, exterior, pool, garage, landscaping, modernization, finish quality, occupancy readiness, and new-construction characteristics. Missing visual information remains unknown. No automatic image analysis is implemented.

Maxxis should say: “These are the structurally closest comparables based on available evidence. Condition/renovation still requires confirmation.” It must not say they are definitively correct comps or an appraisal.

## Monetary adjustment foundation — inactive

The code stores only configurable base-reference parameters and explicitly disables production valuation logic: pool $10k, garage $10k, bedroom $5k, side/rear traffic below $250k $10k, front traffic below $250k $15k, traffic above $500k 20%, freeway $20k, and the no-local-±200-sqft fallback $20k.

These are not national values. Future use requires market, price-band, local-evidence, effective-date, and seasonality calibration, and must adjust comp toward subject only after selection and condition review. The $250k–$500k traffic band is undefined. Image-only bathroom/carport/basement rules remain pending confirmation. Text controls where image/text conflict: traffic low band $250k and bedroom $5k.

No monetary adjustment is applied in this phase.

## Readiness

- Visual user review: **YES**, for the three candidates.
- DealSifter ARV Engine v1: **CONDITIONAL**. It may proceed only as a range/confidence/limitations engine that accepts 2–5 candidates, consumes condition review, degrades confidence for unknowns, and can return unavailable.
- Final DealSifter ARV: **NOT IMPLEMENTED**.
