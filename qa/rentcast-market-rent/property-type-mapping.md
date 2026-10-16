# Rent AVM types

SFR/SFH/Single Family → Single Family; Condo/Condominium → Condo;
Townhouse/Townhome → Townhouse; Manufactured/Mobile Home → Manufactured;
MF/Multi-Family → Multi-Family; Apartment → Apartment.
LAND/Lot/Terreno/Vacant Land → NOT_APPLICABLE, no call.
Known unmapped type → UNSUPPORTED_TYPE, no call.
Genuinely missing type may use provider lookup; a returned multifamily subject
without explicit unit context cannot be presented as building rent.
