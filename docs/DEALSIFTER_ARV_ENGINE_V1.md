# DealSifter ARV Engine v1

## Purpose

The DealSifter ARV Engine v1 is a deterministic, condition-aware valuation foundation. It produces a range-first ARV reference from recorded sold evidence selected by the existing Weighted Appraisal-Style Comp Policy. It runs outside Gemini and may return `ARV_UNAVAILABLE` instead of forcing a number.

It does not implement MAO, offer price, profit, ROI, cash flow, rental underwriting, image analysis, or a report generator.

## Eligibility and valuation set

The engine accepts only records explicitly marked `ARV_COMP_CANDIDATE`. Every candidate is rechecked for:

- passed structural hard gates;
- stable provider comp identity;
- no corrupt or ambiguous transaction record;
- structural score of at least 80;
- data completeness of at least 65;
- valid recorded sale price and date;
- usable comp living area;
- user condition review when valuation participation is requested.

The core set contains at most five highest-ranked eligible candidates. It prioritizes structural score, then distance and stable identity. Price never participates in candidate selection or ranking.

Condition policy:

- `MATCHES_TARGET`: primary core candidate.
- `PARTIAL_MATCH`: supporting only by default. A policy option exists for future controlled inclusion with reduced influence.
- `SUPERIOR_TO_TARGET` / `INFERIOR_TO_TARGET`: supporting only; no guessed monetary adjustment.
- `DIFFERENT_PRODUCT_CLASS`, `NOT_COMPARABLE`, `UNKNOWN`, and unreviewed: excluded from core math but retained with explicit reasons.

Two core candidates are the configured minimum. Quality remains preferable to quantity.

## Valuation methodology

For every core comp, the engine calculates recorded sale price per sqft from verified recorded sale price and comp living area. Listing prices and provider AVM values are not substituted.

The primary central reference is:

`subject living area × median eligible recorded sale price per sqft`

The engine also reports mean price/sqft and a diagnostic weighted reference. The weighted reference is not silently substituted for the median reference.

## Transparent valuation weights

Raw influence is derived only from non-price factors:

- structural comparability: 55%;
- data completeness: 25%;
- recorded-sale recency: 10%;
- objective proximity: 10%.

Weights are normalized across the included core set. A partial-match multiplier of 0.65 exists but is inert under the default policy because partial matches are supporting only. Provider correlation, AVM, desired ARV, desired profit, and price proximity are excluded.

## Range logic

The ARV range is based on eligible price/sqft evidence applied to subject sqft, never raw min/max sale prices.

- Two comps: observed eligible price/sqft interval.
- Three to five with low/moderate dispersion: interpolated 25th–75th percentile price/sqft interval.
- Three to five with high dispersion: observed eligible price/sqft interval, preserving the uncertainty instead of hiding it.

No arbitrary widening percentage is used. The method names and thresholds are part of the versioned policy.

## Dispersion and confidence

Metrics:

- minimum, maximum, median, and mean price/sqft;
- range ratio;
- population coefficient of variation;
- median absolute deviation.

Policy thresholds:

| Level | Range ratio | Coefficient of variation |
|---|---:|---:|
| Moderate | 1.25 | 0.15 |
| High | 1.50 | 0.25 |
| Extreme | 2.25 | 0.50 |

Moderate/high dispersion emits `VALUATION_DISPERSION_WARNING` and `POSSIBLE_UNMODELED_FACTOR`. High dispersion penalizes and caps confidence. Extreme dispersion returns `ARV_UNAVAILABLE` with null monetary outputs.

Confidence is independent from structural score and is categorical: `LOW`, `MODERATE`, or `HIGH`. It considers core comp count, average structural quality, average completeness, dispersion, and transaction-quality uncertainty. Two comps, high dispersion, low completeness, or material unknowns constrain the result. Current unknown transaction quality prevents unsupported arms-length claims and caps otherwise high confidence.

## Status contract

- `ARV_UNAVAILABLE`: fewer than two condition-compatible comps, missing subject sqft, unusable inputs, or extreme dispersion. Monetary outputs are null, never zero.
- `ARV_LIMITED`: viable computation with only two comps, high dispersion, low completeness, or low confidence.
- `ARV_AVAILABLE`: at least three adequate compatible comps, acceptable completeness and dispersion, and non-low confidence.

`ARV_AVAILABLE` is not a guarantee of accuracy.

## Provenance and unknowns

- Recorded sale: `VERIFIED_RECORD`.
- Structural score and price/sqft: `CALCULATED`.
- Condition review: `USER_PROVIDED`.
- ARV range, reference, and confidence: `CALCULATED`.
- Provider AVM: `ESTIMATED`.

Unknown remains unknown. Missing subdivision, road relation, style, pool, garage, traffic, condition, or transaction-quality evidence is never converted to pass, fail, or match.

## Provider AVM and inactive adjustments

A cached provider AVM may be classified as within, above, or below the DealSifter range. It is diagnostic only. It is never averaged or blended with DealSifter ARV and cannot trigger a provider request.

Previously documented monetary adjustment references remain `BASE_REFERENCE_PARAMETERS_ONLY`. All pool, garage, bedroom, traffic, freeway, and condition monetary adjustments remain inactive and uncalibrated. Applied monetary adjustment is zero.

## Maxxis integration

The existing visual-review endpoint recomputes the result from cached structural candidates, subject sqft, target condition, and persisted user reviews. Maxxis renders range first, central reference second, visible confidence, counts, warnings, and expandable per-comp evidence. Gemini does not select comps, calculate price/sqft, assign weights, build ranges, or create financial values.

## Honolulu TEST/FIXTURE validation

These are local fixture outputs, not a production ARV and not persisted user reviews. Subject sqft is 2,333. Candidate inputs use the previously validated recorded sales for 436 Kekauluohi, 777 Kumukahi, and 7304 Kauhako.

| Fixture scenario | Status | Eligible | Central | Range | Confidence | Warnings |
|---|---|---:|---:|---:|---|---|
| 0 reviewed | `ARV_UNAVAILABLE` | 0 | null | null | LOW | none |
| 1 matching | `ARV_UNAVAILABLE` | 1 | null | null | LOW | none |
| 2 matching | `ARV_LIMITED` | 2 | $2,541,676 | $2,020,196–$3,063,156 | LOW | dispersion; possible unmodeled factor |
| 3 matching | `ARV_LIMITED` | 3 | $2,020,196 | $1,822,656–$3,063,156 | LOW | dispersion; possible unmodeled factor; central-reference divergence |

The $2.45M recorded comp is not removed because of its price. Its effect appears transparently as dispersion after eligibility.

## Limitations and future integration

- No condition monetary adjustment exists.
- Arms-length transaction quality is unknown.
- Small sample sizes intentionally avoid false statistical precision.
- ARV results are ephemeral and recomputable; no ARV snapshot table is added.
- The output contract includes the evidence and methodology fields needed by a future Maxxis Deal Intelligence Report.
- A future MAO Engine may consume this result only after checking ARV status and confidence. No MAO rule exists in v1.
