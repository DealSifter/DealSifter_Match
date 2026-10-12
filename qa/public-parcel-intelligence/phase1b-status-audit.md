# Phase 1B: source status audit before promotion

Baseline: `970c5d6dd47c5ecc0b8594922e097be50f31fa97`. Reviewed 2026-10-12.

| Source | Authority | Technical observation in Phase 1 | License | Registry | Why not ACTIVE |
| --- | --- | --- | --- | --- | --- |
| us-wa-king-parcels / WA / King | King County GIS | Polygon, point and APN passed | LICENSE_REVIEW_REQUIRED | LICENSE_REVIEW_REQUIRED | Distribution/resale restriction was not cleared for this product |
| us-ut-salt-lake-parcels / UT / Salt Lake | Utah UGRC / county | Polygon, point and APN passed | LICENSE_REVIEW_REQUIRED | LICENSE_REVIEW_REQUIRED | LIR dataset terms had not been reviewed sufficiently |
| us-ca-sonoma-parcels / CA / Sonoma | County GIS / Assessor | Polygon, point and APN passed | LICENSE_REVIEW_REQUIRED | LICENSE_REVIEW_REQUIRED | Public versus internal-only attributes and redistribution permission remained unclear |
| us-nc-wake-parcels / NC / Wake | Wake County GIS | Endpoint timed out, schema provisional | CLEAR_FOR_USE (CC-BY-4.0) | DISCOVERED | A clear license alone does not demonstrate queryable geometry/schema |
| us-al-jefferson-parcels / AL / Jefferson | County Enterprise GIS | HTTP 403 HTML | LICENSE_REVIEW_REQUIRED | LICENSE_REVIEW_REQUIRED | Runtime inaccessible and data-use terms unresolved |

Technical success is not legal approval. Three technically successful sources and zero ACTIVE sources were consistent with the conjunctive activation policy, not a resolver defect. Wake is the previous license-cleared source; its original URL may only be promoted after live technical validation. An alternative state source does not retroactively validate that URL.

Phase 1B will record official authority/terms, live schema/geometry/APN/viewport evidence and explicit status reasons before changing activation. General public exposure remains OFF.
