# Maxxis report field lineage v1

This matrix documents the canonical path used by reports and chat. `—` means the stage intentionally does not display the field; it does not mean the canonical value was discarded.

| Field family | App/user | Provider normalization/cache | Snapshot | Decision context | Level 1 | Level 2 | Level 3 | Chat | Visibility |
|---|---|---|---|---|---|---|---|---|---|
| Address, city, state, ZIP | Master property record | Identity cross-check | `propertyFacts` | `propertyContext.fields` | Yes | Yes | Yes | Yes | Always |
| County | Fallback | Verified record | `propertyFacts.county` | Verified datum | Yes | Yes | Yes | Yes | Always if available |
| State/county FIPS | Fallback | Verified record | Preserved | Verified datum | — | — | — | Available to logic | Internal only |
| Coordinates | Master fallback | Verified record | Preserved | Verified datum | Map | Map | Maps | Available | Relevant |
| Property type | Master record is analytical authority | Provider type retained separately | `resolvedAnalysisPropertyType`, `providerPropertyType`, conflict | Exact resolved type drives playbook | Yes | Yes | Yes | Yes | Always |
| Strategy/objective | User/master authority | Provider does not replace it | `resolvedAnalysisStrategy` | Exact resolved strategy drives thesis/actions | Yes | Yes | Yes | Yes | Always |
| Beds, baths, living area | App fallback | Verified record | Preserved for improved property | Verified datum | Relevant | Relevant | Relevant | Yes | Relevant; hidden for land |
| Lot sqft/acres | App value plus canonical conversion | Verified lot preferred | Both units preserved | Land metrics | Yes | Yes | Yes | Yes | Relevant |
| Year built | App fallback | Verified record | Preserved | Verified datum | Yes | Yes | Yes | Yes | Relevant |
| APN / assessor ID | — or app fallback | Verified record | Preserved with provenance | Verified datum | Yes | Yes | Yes | Yes | Relevant |
| Legal description | App fallback | Verified record | Preserved | Verified datum | When available/space | Context | Detail | Yes | Relevant/detail |
| Subdivision, zoning | App fallback | Verified record | Preserved | Verified datum | Yes | Yes | Yes | Yes | Relevant |
| Ownership/occupancy | Authorized app owner fallback | Verified occupancy/record | Preserved; identity remains authorization-bound | Verified datum | Yes | Yes | Yes | Yes | Relevant |
| Latest sale/history | App fallback | Verified record/cache | Preserved | Verified/market datum | Latest sale | Latest sale | Latest sale/history | Yes | Relevant |
| Assessment/tax and years | App fallback | Verified record preferred | Preserved | Verified datum | Yes | Yes | Yes | Yes | Relevant |
| HOA | App fallback | Verified record preferred | Preserved, including explicit zero | Relevant datum | Relevant | Relevant | Relevant | Yes | Relevant |
| User notes | Card `notes` projected as `propertyUserNotes` | Never replaced by provider, legacy description, or generated prose | `propertyUserNotes` | User-provided datum | Notes | Notes | Notes | Yes | Always if available |
| Maxxis summary/commentary | Generated analytical output | — | Separate from notes | Analysis | — | Labeled analysis | Labeled analysis | Yes | Product-level |
| Property features | App fallback | Normalized provider features | Strategy-filtered `materialPropertyFeatures` | Evidence | Relevant | Relevant | Relevant | Yes | Relevant |
| Recent-sales estimate | — | Cached sold evidence and deterministic engine | Full estimate | Market reference | — | Summary where allowed | Pages 2–3 | Yes | Product-level |
| Provider AVM | — | Cached valuation evidence | Separate reference | Market reference or quarantined | — | Summary where allowed | Separate block | Yes | Relevant; never ARV |

## Canonical precedence

- Identity and analytical type: DealSifter master value; provider value remains evidence and conflicts remain explicit.
- Tax, assessment, sale, county, APN, zoning and subdivision: verified provider value wins when present.
- Notes and deal assumptions: user/card value wins.
- Owner identity/contact: only data already authorized by the current app surface; provider occupancy/record facts may supplement it.
- Missing, unknown, unavailable, not evaluated, not applicable, conflict and explicit zero remain distinct states.

## Previously identified loss points

1. Level 2 built its report property from the raw app property instead of `intelligenceSnapshot.propertyFacts`.
2. A blanket provider-first merge allowed provider property type to replace the canonical DealSifter type.
3. PDF and preview fallbacks put generated property prose in the Notes section.
4. Page 2 counted only ARV comps while the Recent-Sales engine's valuation comps were kept in another branch.
5. Page 3 gated its primary valuation block on ARV status, hiding an available Recent-Sales estimate.
6. Chat's compact property summary used the raw property instead of the enriched snapshot.
