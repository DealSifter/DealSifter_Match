# Per-unit safety

Multi-Family/Apartment is never whole-building rent. Without explicit unit ID and
unit beds/baths/living area, return UNIT_CONTEXT_REQUIRED and no acquisition.
The pure resolver accepts an explicit authorized unit context and replaces building
totals with unit-level overrides; scope/unit identity are fingerprinted and the
result is labeled per unit. No representative unit is invented. Existing app data
has no generalized per-unit collection form; no new form is introduced here, so
ordinary building-level records remain blocked and Maxxis explains the requirement.

If automatic lookup reveals multifamily after a missing-type request, the normalized
attempt retains returned subject metadata but no usable rent, preventing whole-
building interpretation. Unit subject attributes never enter property reconciliation.
