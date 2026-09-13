# Maxxis Deal Intelligence Context v1

## Purpose

`DealIntelligenceContext` is a deterministic orchestration and decision-support contract for Maxxis Deal AI. It connects existing DealSifter outputs so Maxxis can explain what the available evidence means for the authenticated investor’s configured strategy.

It does not create a new valuation, financial calculator, deal score, recommendation or data source.

## Architecture

The required flow is:

```text
DATA → ANALYSIS → CONTEXT → EXPLANATION

Property / profile / cached evidence
        ↓
Existing Match, Deal Metrics and ARV engines
        ↓
buildDealIntelligenceContext()
        ↓
Structured Maxxis response
        ↓
Gemini explanation using exact returned facts only
```

Calculation ownership remains with existing deterministic engines. The context builder classifies and organizes their results. Maxxis explains them in the order **answer first → why → risks → next steps**.

## Connected sources

- Property fields from the current DealSifter property.
- Cached Property Evidence already authorized for the user.
- Authenticated user’s existing Investment Profile.
- Existing profile-fit Match Score and reason factors.
- Existing deterministic Deal Metrics.
- Existing deterministic `ArvEvaluationResult` loaded from cached sold evidence and persisted user reviews.
- Existing Deal Advisor limitations and missing-information codes.

The cached ARV loader is fail-closed: it stops without entitlement, does not initiate provider work and returns `null` when cached evidence or required review context is absent.

## Contract

The versioned context contains:

- `propertyContext`;
- `investorContext`;
- `evidenceSummary`;
- `valuationContext`;
- `comparableEvidence`;
- `matchContext`;
- `dealMetrics`;
- `fitAnalysis`;
- `risks`;
- `opportunities`;
- `limitations`;
- `recommendedActions`;
- an answer-first `response`;
- future report compatibility metadata.

## Property evidence and unknown handling

Every consolidated property field retains one of three provenance states:

- `VERIFIED_RECORD`;
- `USER_PROVIDED`;
- `UNKNOWN`.

Verified evidence takes precedence over a user-provided value for presentation, but conflicts remain explicit. Missing fields stay `null/UNKNOWN`; the builder never fills gaps. The current property contract does not expose a safe street address, so address remains unknown rather than being inferred.

## Evidence strength

Evidence strength is categorical (`HIGH`, `MEDIUM`, `LOW`), not a percentage. It is determined from the existing count of verified fields, unknown fields and unresolved conflicts:

- `HIGH`: at least five verified fields, no conflict and at most one unknown field;
- `MEDIUM`: at least two verified fields, at most one conflict and at most four unknown fields;
- `LOW`: all other cases.

This classification describes data support only. It is not deal quality, probability or investment confidence.

## Investor fit

The builder preserves the authenticated Investment Profile’s target markets, property types, strategies, price range and acceptable-condition preferences. The existing Match Score is copied with the explicit semantic label `PROFILE_FIT_ONLY`.

Match Score is never presented as deal quality, valuation confidence or a purchase recommendation.

## Valuation context

Only an existing `ArvEvaluationResult` is accepted. The builder copies:

- `ARV_AVAILABLE`, `ARV_LIMITED` or `ARV_UNAVAILABLE`;
- range;
- central reference;
- confidence;
- comps used;
- warnings;
- provenance and methodology version.

When ARV is unavailable or not loaded, range and central reference remain `null`. No fallback value is generated. Comparable evidence preserves inclusion status, recorded sale, condition compatibility, structural/completeness scores, weight and reason codes.

## Risks

Risk signals are categorical explanations based solely on existing context:

- `DATA_RISK`: unknown fields, conflicts, missing rehab information or unknown condition;
- `MARKET_RISK`: existing Match reasons showing target market or price-range mismatch;
- `VALUATION_RISK`: unavailable/limited ARV or existing comparable-dispersion warning;
- `EXECUTION_RISK`: missing critical property information.

Each risk has `LOW`, `MEDIUM` or `HIGH` severity. These severities prioritize verification needs and are not financial-loss probabilities.

## Opportunity signals

Opportunity signals are limited to observable alignment and evidence availability, such as a matched property type, matched target market, verified property evidence or available comparable valuation evidence.

The builder never emits claims about high profit, upside, guaranteed return or a “good deal.”

## Gemini semantic boundary

The Gemini-safe payload is allowlisted. For an existing ARV it may repeat only the exact status, range, central reference, confidence, comps, warnings and provenance. It may not calculate, interpolate, adjust, blend or replace any value.

Maxxis must not:

- guarantee return or sale price;
- recommend buying or passing;
- recommend an offer price;
- create MAO, ROI, cash flow, rental analysis or profit;
- treat Match Score as deal quality;
- replace professional analysis.

## Frontend

The existing chat renders a compact `MaxxisDealIntelligenceResponse` without redesigning the application. It exposes:

1. Initial assessment.
2. Profile fit and ARV evidence state.
3. Why.
4. Main risks with severity.
5. Evidence-based positive factors.
6. Limitations.
7. Suggested verification steps.

Unavailable monetary fields render as `Unavailable`, never `$0`.

## Future Deal Intelligence Report

The context is structured for future sections covering Executive Summary, Property Analysis, Valuation Evidence, Investor Fit, Risk Assessment and Action Plan. This version does not implement export or report generation.

## Safety invariants

- Existing ARV, Comp, Match, Property Evidence and Deal Metrics engines unchanged.
- No provider call or new endpoint.
- No persistent fixture or database migration.
- No MAO, financial calculator, pricing, Nuggets or Stripe.
- No deployment.
