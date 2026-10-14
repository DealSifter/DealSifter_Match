# Deterministic resolution policy v1

This is an **unconsumed read-only library**, not a new canonical precedence rule.
The engine receives an already-authorized subject bundle. Acquisition, entitlements,
identity verification, provider budgets and authentication remain upstream.
No endpoint, DB write, LLM, provider request, private-context cache or production UI is added.

## Units and thresholds

Lot area is normalized to square feet with independent acres = sqft / 43,560.
Original values/units remain candidates; no presentation rounding is used.
Publisher numeric/unqualified `properties.lot` retains the existing sqft convention;
explicit acre suffixes are parsed without the older presentation-rounding step.
Ambiguous/freeform text stays insufficient, not zero. Building area is a separate domain.

The existing GIS cross-check thresholds are centralized in `public-parcel/areaPolicy.ts`:
relative difference = abs(a-b) / max(abs(a),abs(b)); <= 2% consistent,
> 2% and <= 10% minor variance, > 10% material conflict.
Eight binary machine epsilons protect exact threshold boundaries from floating-point
round-off (e.g. 0.98 vs 1); they are not a presentation-rounding or business tolerance.
Custom thresholds must be finite, nonnegative, consistent <= minor < 1.
Money/year values use exact agreement, not acreage tolerances. Explicit recorded tax/
assessment/rent zero is permitted; zero land area is invalid. Unknown/missing is never coerced to zero.

## Specialization, not universal ranking

`policy.ts` describes domain-specific specialization. Public cadastral GIS specializes
in boundaries, APN and lot area; zoning authority in zoning; tax authority in actual
annual tax; assessor in assessment/building/year/owner; RentCast in market rent/sales;
publisher in current rent, occupancy and condition. Documented, confirmed user evidence
can carry specialized context. Other evidence is contextual/relevant/unspecified, not
automatically inferior. These labels explain domain relevance; **they never pick a winner**.
Future providers enter as explicit candidates without a blanket priority.
VERIFIED_RECORD describes provider-reported evidence, not infallibility.
Public GIS boundaries are not a professional survey. Geometry comparison/overlay
is not implemented in this phase; original geometry may be retained as non-comparable
future-domain evidence, never asserted as survey truth.

## Independence and internal consistency

An underlying `sourceFamily` is one vote. Raw/normalized/cached RentCast is forcibly
RENTCAST. Publisher derivatives are PUBLISHER. GIS adapter records/geometry derivatives
are grouped by the same county lineage (`COUNTY_GIS:<FIPS>`), conservatively even when
republished through different state/municipal services. Future upstream callers must
provide the real lineage, not invent a family per response. Explicit candidates preserve
source IDs, source authority, timestamps, freshness, original values and confirmations.
Duplicates remain inspectable but do not multiply votes or weight the provisional median.
Conflicts between correlated candidates flag SOURCE_INTERNAL_CONFLICT and prevent
automatic confirmation, even for an official source.

## Field-level states and clusters

No property-wide truth status is assigned. Each field has its own state/candidates.
UNAVAILABLE means no available evidence; UNKNOWN/invalid/non-comparable evidence is
INSUFFICIENT_EVIDENCE. NOT_APPLICABLE requires all supplied candidates to explicitly
say so. One usable independent family is SINGLE_SOURCE, with no cross-source resolution.

Outliers require at least three independent families, a **unique strict-majority**
pairwise-compatible cluster (each pair within minor tolerance, including derivatives),
and every outsider materially different from every cluster member. Tied clusters,
non-majorities and overlapping agreement chains stay MATERIAL_CONFLICT / unresolved.
Internal family conflicts are not disguised as outliers.

## Provisional output

For agreement/minor variance across at least two independent sources, return the
median of family medians (deduplicated normalized values within each family).
Categorical agreement returns the shared normalized identifier/text. This is a
**provisional read-only suggestion**, not an uncontested fact or persisted analytical input.
Specialization is not a winner-selection tie breaker. Source provenance is never erased.
MATERIAL_CONFLICT never resolves. OUTLIER_DETECTED defaults to **no provisional value**;
an explicit policy opt-in permits a majority-family median while retaining materialConflict,
supporting/conflicting sources and all outlier IDs. The normal bundle adapter does not opt in.

## Temporal/equivalence rules

Assessment compares only ASSESSED_VALUE for the same known fiscal year; actual property
tax compares ANNUAL_RECORDED_TAX for the same known year. Different or missing years/
concepts => insufficient, not direct contradiction. AVM/market/asking/sale values and
estimated tax benchmarks are excluded from these domains, even when supplied mistakenly.
Explicitly different ownership effective dates do not establish a current conflict.
Other unknown timestamps are retained; no invented freshness/confidence is produced.
STALE_USABLE can participate with its stale label intact. Expired, corrupt, identity-
mismatched, absent/unavailable references are retained but excluded from comparison.

## Conservative identifiers and text

APNs are strings, retain leading zeros and raw presentation. Case/whitespace normalize
without numeric coercion. Separator removal requires explicit county/source formatting
policy and known county. Different known jurisdictions are insufficient, not a direct
identity contradiction. No global canonical APN format is assumed.
Owner comparison normalizes only case, whitespace, comma/period presentation;
owner sets sort/deduplicate exact normalized names. No fuzzy matching/entity aliases.
Distinct owners/LLCs remain conflicts. Property-type aliases are explicit; LAND vs
RentCast Single Family is a documented conflict, never a change to the existing LAND lock.

## Recompute, localization and isolation

Compute on read. No consensus cache, sourceHash invalidation scheme, clock or DB needed;
every call sees changed publisher/provider/GIS evidence. Candidate sourceHash metadata,
when supplied, remains visible. Inputs are cloned, outputs sorted deterministically;
one user's private input cannot bleed into another user's output through shared state.
Reason codes are stable internal identifiers, not hardcoded presentation prose.
Maxxis, canonical, reports, scenarios and normal Parcel Lens do not import the library.
Only the existing public-parcel geometry helper imports the centralized area policy.
Migration = NONE; dependency closure for deployment = public-parcel and the frontend
(MapView already shares the geometry helper), not feature-flags or Maxxis. The consensus library remains ready
for a later authorized integration, not consumed in production.
