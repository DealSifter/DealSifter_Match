# Maxxis ARV Result Experience v1

## Purpose

This layer turns an existing deterministic `ArvEvaluationResult` into an evidence-based Maxxis explanation. It does not select comparables, calculate price per square foot, alter weights, create adjustments, or produce a new valuation.

The governing contract is:

> Engine calculates. Maxxis explains.

## Separation of responsibilities

- `arvEngine.ts` remains the sole valuation authority.
- `createArvExplanationContext()` accepts only the completed engine result and creates presentation semantics.
- `MaxxisArvResultExperience` renders the range, confidence, evidence and limitations without performing valuation arithmetic.
- Gemini is not part of the calculation or transformation path and cannot replace or modify engine numbers.

The presentation context preserves raw values for future structured consumers. Formatting as currency, dates and labels occurs only at render time.

## Presentation order

1. ARV status.
2. Estimated range, when available.
3. Central median-based reference.
4. Confidence.
5. Number of comparables used.
6. Why the result was produced.
7. Warnings and limitations.
8. Recommended next action.

The UI deliberately uses evidence language such as “The current evidence supports…” and does not state that a property “is worth” a specific amount.

## Statuses

### ARV_AVAILABLE

Shows the evidence-supported range, central reference, engine confidence, comps used, reasons and limitations. Availability is not represented as a guarantee of market or sale value.

### ARV_LIMITED

Displays `LIMITED CONFIDENCE` prominently. The engine confidence is preserved without upgrading it. Low comp count, dispersion and other constraints remain visible. The next action recommends reviewing additional condition-compatible recorded sales.

### ARV_UNAVAILABLE

Displays `Not available yet`. Range and central reference remain absent. It never renders `$0` or synthesizes a range. The engine reason is translated into an evidence limitation and the user is directed to review more comparable evidence.

## Evidence expansion

The expandable evidence section separates:

- valuation comparables used by the engine;
- supporting or excluded comparables not included in calculation;
- methodology and provenance;
- an optional cached external provider estimate.

For each comparable it can show address, recorded sale price/date, distance, structural score, completeness, user-reviewed condition compatibility, valuation weight, inclusion/exclusion reason and evidence status.

No excluded comparable is hidden merely to simplify the interface.

## Warnings and limitations

Engine warnings are preserved verbatim as codes. The presentation also exposes facts already present in `ArvEvaluationResult` as user-visible warning codes:

- `VALUATION_DISPERSION_WARNING`;
- `POSSIBLE_UNMODELED_FACTOR`;
- `LOW_COMP_COUNT`;
- `UNKNOWN_TRANSACTION_QUALITY`;
- `UNKNOWN_CONDITION`.

This mapping changes no valuation number or confidence. Limitations such as inactive monetary adjustments and unknown transaction quality are displayed rather than suppressed.

## Provider AVM separation

A cached RentCast value with `ESTIMATED` provenance is shown only under **External Provider Estimate**. It is not averaged, blended or used to create an adjusted ARV. The DealSifter range and central reference remain the exact values returned by the deterministic engine.

No provider call is made by this presentation layer.

## Provenance

The context preserves explicit evidence labels:

- Recorded sale: `VERIFIED_RECORD`.
- Structural score: `CALCULATED`.
- Condition review: `USER_PROVIDED`.
- ARV: `CALCULATED` or `UNAVAILABLE`.
- Provider AVM: `ESTIMATED` or `UNAVAILABLE`.

## Future Maxxis Deal Intelligence Report

`ArvExplanationContext` is versioned and structured into valuation summary, methodology, used/excluded comps, limitations, confidence, warnings and provenance. A future report generator can consume these fields without asking Gemini to recalculate or reconstruct valuation evidence.

Report export, MAO, ROI, cash flow, rental underwriting, pricing and monetary adjustments are outside this version.

## Safety invariants

- No ARV Engine changes.
- No Gemini calculation.
- No invented values or condition inference.
- No live RentCast calls.
- No Nuggets or Stripe interaction.
- No persistence or database migration.
- No production deployment.
