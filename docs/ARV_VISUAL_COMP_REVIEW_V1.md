# ARV Visual Comp Review v1

## Purpose

This phase connects existing recorded-sale structural candidates to a user-guided condition review in the Maxxis Deal AI chat. It does not calculate ARV, MAO, offer price, profit, ROI, or cash flow.

The contract is:

`recorded sold evidence → calculated structural candidate → USER_PROVIDED condition review → review-set readiness`

`READY_FOR_ARV_EVALUATION` means only that a later engine may attempt an evaluation. It is not a valuation or a confirmed ARV.

## Architecture

- The existing Weighted Appraisal-Style Comp Policy remains the sole producer of structural candidates and scores.
- The authenticated `arv-visual-comp-review` function loads only cached sold evidence through `getCachedSoldEvidence`. Its property-data mode is forced to `disabled`; the flow cannot acquire provider data.
- An explicit Property Intelligence entitlement is required. The public Property Intelligence flag remains unchanged and OFF.
- Maxxis detects a contextual ARV question and renders structured controls in the existing chat.
- Review navigation is isolated in `ExternalCompReviewLinkResolver`-equivalent frontend logic and does not enter the evidence domain.

## Data model and ownership

`property_arv_review_contexts` stores one target condition per subject property and reviewer.

`property_comp_condition_reviews` stores one current review per subject, reviewer, and stable provider comp identifier. The uniqueness key makes repeat saves idempotent; an edit updates the existing row instead of creating an unbounded duplicate stream.

Both tables:

- require `reviewer_user_id = auth.uid()` through RLS;
- require an explicit Property Intelligence entitlement for the subject;
- deny anonymous access;
- expose no delete permission to authenticated clients;
- always constrain manual evidence to `USER_PROVIDED`.

Sold comps do not have a trustworthy local property UUID, so the persisted identity is the existing stable provider property identifier. No internal identity is fabricated.

## Target and observed condition

The same canonical condition taxonomy is used for the subject target and the user's observed comp condition:

- `AS_IS`
- `LIGHT_REHAB`
- `STANDARD_RENOVATION`
- `FULL_RENOVATION`
- `HIGH_END`
- `TURN_KEY`
- `NEW_CONSTRUCTION`
- `UNKNOWN`

Target condition and observed condition remain distinct fields. `TURN_KEY`, `HIGH_END`, and `NEW_CONSTRUCTION` remain distinct categories. A target loaded from persistence is reused; the user can confirm or change it. A changed target does not silently reuse reviews made against another target.

## Compatibility and provenance

Compatibility values are:

- `MATCHES_TARGET`
- `PARTIAL_MATCH`
- `SUPERIOR_TO_TARGET`
- `INFERIOR_TO_TARGET`
- `DIFFERENT_PRODUCT_CLASS`
- `NOT_COMPARABLE`
- `UNKNOWN`

Notes are optional. `UNKNOWN` remains unknown; it is neither a match nor a failure. Every saved review carries `USER_PROVIDED`, reviewer identity, subject ID, stable comp identifier, target, observation, compatibility, timestamps, and `ARV_VISUAL_COMP_REVIEW_V1` policy version.

The structural score remains `CALCULATED`. Rejecting or marking a comp unknown never deletes or rewrites its structural score.

## External navigation

Zillow and Redfin are external visual aids only. Links open in a new tab with `target="_blank"` and `rel="noopener noreferrer"`.

The resolver supports:

1. a canonical HTTPS direct URL only when its hostname matches the requested provider; and
2. an address-search fallback generated from the URL-encoded full comp address.

The link is labeled `SYSTEM_GENERATED_NAVIGATION`; it is not property evidence. There is no iframe, proxy, scraping, photo import, return detection, provider parsing, or automatic visual analysis.

## Readiness semantics

The default compatible-comp threshold is configurable and currently `2`.

- zero reviews → `NOT_STARTED`;
- some reviews, below threshold, with remaining candidates → `IN_PROGRESS`;
- at least two `MATCHES_TARGET` or `PARTIAL_MATCH` reviews → `READY_FOR_ARV_EVALUATION`;
- all candidates reviewed but fewer than two compatible → `INSUFFICIENT_CONDITION_EVIDENCE`.

Per-candidate states preserve pending, match, partial match, mismatch, different product class, unknown, and not comparable outcomes.

## Real cached subject

The controlled cached subject is `e86dd292-429d-4b51-9b02-bc60a3e9068f` (7081 Kalanianaole Hwy). The review payload is derived from the current weighted primary structural candidates and is expected to include:

- 436 Kekauluohi St — structural 84.50, completeness 70;
- 777 Kumukahi Pl — structural 81.79, completeness 70;
- 7304 Kauhako St — structural 80.00, completeness 70.

No review was written to production during implementation, and no RentCast request was made.

## Limitations and next stage

- The user must inspect external pages and supply condition evidence manually.
- The app does not verify availability or content of external provider pages.
- No computer vision or AI condition inference is present.
- No review history ledger is introduced; v1 preserves the current idempotent review row and timestamps.
- The later ARV Engine may consume only structurally eligible candidates with compatible user condition evidence, and must retain conservative provenance and confidence rules.
