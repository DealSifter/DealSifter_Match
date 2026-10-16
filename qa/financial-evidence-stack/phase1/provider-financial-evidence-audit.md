# Existing provider evidence, not API capability promises

Audited code paths: `property-data/rentcast/rentcastTypes.ts`, `rentcastMapper.ts`, `types.ts`, `propertyIntelligenceAccess.ts`, `supplementalEvidenceTypes.ts`, `supplementalEvidenceCache.ts`, `maxxis/propertyEvidence.ts`.

Property-record cache exposes annualPropertyTax/propertyTaxYear, assessedValue/assessmentYear, hoaFee (cadence absent), ownerOccupied, sale price/date/history. The supplemental cache separately exposes market rent/ranges/comparables and rental listings. Owner occupancy does not establish leased/vacant status or contract income. Listing prices and ZIP aggregates are not contract rent.

No normalized contract rent, insurance quote/policy, management contract, vacancy history, maintenance history or owner utility expense is supplied by this current adapter. Their absence remains unavailable. No actual customer payloads were copied into QA, and no paid provider requests were made to inspect the cache. Existing normalized shapes/fixtures, not vendor documentation, define these capabilities.

The new opt-in loader uses the existing property-record entitlement gate (PRO/ENTERPRISE or property-record unlock), the authenticated public-property gate, and supplemental `getCached(..., 'rentEstimate')` only. Address/query fingerprint and retained-freshness validation remain in the existing cache implementation. Instantiating the backend service does not acquire evidence; its provider `get` methods are never called on this route. No shared cache writes or private assumption persistence are introduced.

Actual tax already fits Fact Review. Current contractual rent and HOA do not yet have complete review domains/cadence/UI contracts; this phase does not expand them or add an onboarding form. Pure financial contracts accept those evidence classes for future authorized adapters and deterministic QA.
