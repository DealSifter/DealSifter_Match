# Canonical evidence projection policy

This is an additive, compute-on-read view. Existing canonical scalars remain compatible;
only the new factual tool consumes analyticalEvidence. No property/profile/listing/cache
row writes, schema migration, report consumption or financial-engine migration.

| Domain | Minor variance | Observed range | Additional restriction |
| --- | --- | --- | --- |
| Lot area | Provisional | Yes | Unanimous observed scalar only; no midpoint |
| APN | Confirmed comparability, qualified | No | Preserve identifier formatting and county context |
| Public owner | Provisional | No | Public record/own clarification, never locked seller contacts |
| Assessment | Provisional | Yes | Same fiscal year/concept; not market value |
| Property tax | Provisional | Yes | Recorded actual tax; calculated benchmarks excluded |
| Zoning | Provisional | No | No inferred legal entitlement |
| Property type | Provisional | No | Existing explicit LAND analysis lock preserved |

Consistent => CONFIRMED; minor variance => per-field policy; outlier => PROVISIONAL
only with a compatible independent-family cluster; material conflict => CONFLICTED;
insufficient evidence => structure-dependent CONFLICTED/SINGLE_SOURCE/UNAVAILABLE;
single source => SINGLE_SOURCE; unavailable => UNAVAILABLE; not applicable =>
NOT_APPLICABLE. Consensus and analytical usability are separate contracts.
Freshness remains per candidate: confirmation is not a claim of recent verification.
Duplicate source-family observations do not manufacture cross-confirmation.
Zero actual recorded tax remains zero; unknown never becomes zero.

Gable: publisher 1.14 acres vs RentCast 23,854 sqft remains analytical value null,
CONFLICTED. Synthetic approved GIS 1.23 acres yields observed provisional range
1.14–1.23 acres and RentCast outlier. No midpoint/mean/median is projected.
The publisher-only fixture retains legacy 1.14 acres. With an existing provider context,
legacy resolvedLotDimensions retains the old builder's context-dependent precedence;
it is not redefined as consensus truth. The separate analytical value remains unresolved.

## Already-acquired public evidence handoff

The existing GIS cache is isolate-local. Rather than querying GIS again, successful
query-point acquisition optionally issues an HMAC-signed receipt using the existing
server credential with a dedicated namespace. No new secret or provider acquisition.
The receipt is opaque client transport, not client authority. It contains only selected
public facts and provenance, no polygon, profile contacts or unrelated legal attributes.
The frontend retains at most eight receipts in memory, partitioned by authenticated
actor/property; no localStorage or DB persistence.

Maxxis first authorizes the current subject using the existing sanitized public RPC,
then validates signature, authenticated actor, exact authorized coordinates, county,
current approved source policy, freshness/expiry and feature kill switch. Hidden-address
RPC coordinates cannot authorize a receipt. Unavailable/invalid receipts are evidence
absence, never evidence of absence of a public record. Public GIS is available without
an asset unlock; cached paid-provider evidence still requires existing entitlement.
Own clarifications are read only from the current subject/current user's existing row.

Receipts expire seven days after original retrieval; FRESH ends at existing response
expiry or 24 hours, whichever is earlier. Older still-valid data is STALE_USABLE and
explicitly qualified, never newly verified. This deliberately does not extend cache
retention. Current registry/source/license policy is checked again on consumption.

## Isolation and release acceptance

Direct PT/EN/ES factual questions precede pending financing gaps and Gemini. Generic
evidence/conflict inspection uses the same seven fields. No factual arbitration through
Gemini. Reports and financial, scenario, sales, ARV, MAO, NOI, cap-rate and ROI engines
retain their existing inputs and behavior. Lens UI, diameter 0.20 mi, source registry,
public flags and pricing are unchanged. No migration, source expansion or live provider
calls in deterministic tests. Authenticated production acceptance requires a real session;
fixtures/anonymous smoke are not substitutes.

Broad Maxxis Deno check has existing baseline diagnostics. The differential receipt
preserves those errors and proves zero new diagnostics without suppressing them; scoped
new modules/public-parcel and frontend contracts must independently typecheck cleanly.
