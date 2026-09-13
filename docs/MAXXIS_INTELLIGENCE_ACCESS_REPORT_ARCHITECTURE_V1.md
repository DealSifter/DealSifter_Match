# Maxxis Intelligence Access + Report Architecture v1

## Purpose

This phase separates the report being requested from the method that grants access. It is an access and presentation foundation only: it does not add calculations, provider calls, report rendering, payments, or Nugget transactions.

```text
USER REQUEST
  -> ENTITLEMENT CHECK (fail closed)
  -> REPORT LEVEL
  -> ALLOWLISTED CONTENT
```

## Report levels

| Level | Report type | Included by plan | Content boundary |
| --- | --- | --- | --- |
| 1 | `PROPERTY_RELEASE` | Free, Pro, Enterprise | Property-card fields and photos supplied by the user (`USER_PROVIDED`) |
| 2 | `MAXXIS_ANALYSIS` | Pro, Enterprise | Level 1 plus Maxxis interpretation and investor context |
| 3 | `DEAL_INTELLIGENCE` | Enterprise | Level 2 plus authorized evidence, valuation-engine outputs, confidence, warnings, limitations, and decision-support signals |

Level 1 cannot contain Maxxis insights, Match Score, investment profile, evidence, ARV, comps, risk analysis, or recommendations. Level 2 cannot contain professional ARV, sold comps, valuation evidence, or appraisal-style analysis. Level 3 cannot guarantee returns, recommend a purchase, or present a definitive value.

The content allowlists are explicit. An unknown report type produces an empty payload and a denied access decision.

## Access model

`IntelligenceAccessLevel` has `FREE`, `PRO`, `ENTERPRISE`, and `NUGGET_UNLOCK`. The first three describe subscription access; `NUGGET_UNLOCK` identifies a point entitlement and never changes the user's subscription plan.

`ReportEntitlement` contains:

```json
{
  "reportType": "DEAL_INTELLIGENCE",
  "accessSource": "NUGGET_UNLOCK",
  "expires": null
}
```

An active, unexpired entitlement grants only its exact report type. Unknown, malformed, or expired entitlements do not grant access. Re-reading an entitled report has zero charge.

## Plan matrix

| Request | Free | Pro | Enterprise |
| --- | --- | --- | --- |
| Property Release | Included | Included | Included |
| Maxxis Analysis | Nugget unlock | Included (allowance foundation) | Included |
| Deal Intelligence | Nugget unlock | Nugget unlock/upgrade | Included |

The Professional allowance, overage rules, exact Nugget prices, and Enterprise fair-use thresholds remain undefined. Consequently, `paidUnlockEnabled` is `false` and both premium costs are `null`. The UI may present the future unlock intention, but cannot debit Nuggets or grant an entitlement.

## Export popup

- Free: PDF and email produce only `PROPERTY_RELEASE`. “Analyze with Maxxis” opens a level chooser and shows both Nugget unlock paths.
- Pro: PDF and email produce only `PROPERTY_RELEASE`. “Analyze with Maxxis” opens `MAXXIS_ANALYSIS` directly. A deeper request is gated inside chat.
- Enterprise: PDF and email produce only `PROPERTY_RELEASE`. “Analyze with Maxxis” opens `DEAL_INTELLIGENCE` directly.

The existing release PDF remains a Level 1 renderer. No premium PDF was added.

## Chat upgrade behavior

The chat access guard recognizes only an explicit, property-scoped analysis request or an explicit report type supplied by the controlled export flow. General Maxxis help, Tax Deed/Wholesale questions, navigation, and ordinary conversation remain outside this gate.

When a requested report exceeds plan access, the request stops before local intelligence or provider execution. Chat shows “Unlock deeper intelligence” and creates a controlled unlock intent. With pricing disabled, the intent explains that no charge is possible. It never performs pay-per-question, pay-per-field, or pay-per-answer behavior.

## Backend foundation

The backend contract mirrors report types, plan rules, point-entitlement semantics, and content allowlists. It is deliberately not wired to a new API, database write, paid point-entitlement lookup, or the existing `maxxis-chat` endpoint in this phase. Existing Property Intelligence entitlements remain separate and are not silently reinterpreted as report entitlements. A future report endpoint must apply this server-side guard before any provider or report renderer is called; public activation is prohibited until that enforcement exists.

A future backend transaction must be server-authoritative and atomic:

1. Resolve subscription and existing report entitlement.
2. Return exact configured Nugget price.
3. Receive explicit confirmation.
4. Reserve Nuggets atomically.
5. Produce/reuse authorized evidence and persist the entitlement.
6. Capture the reservation, or release it on failure.

The frontend must never grant access. Cache state must never grant entitlement.

## Future Stripe integration

Stripe may fund subscriptions or Nugget balances later, but Stripe is not a report entitlement itself. Webhooks update server-authoritative commercial state; a separate backend transaction grants the exact report entitlement. No Stripe integration was changed in v1.

## Explicit non-goals

- Premium PDF rendering or final report generation
- MAO, ROI, cash-flow, or any new calculation
- RentCast or other provider calls
- Nugget debit, refund, or balance mutation
- Stripe calls or configuration
- Public feature deployment
