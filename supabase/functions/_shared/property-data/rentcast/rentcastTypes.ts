export type RentCastTaxAssessmentRaw = {
  year?: unknown;
  value?: unknown;
};

export type RentCastPropertyTaxRaw = {
  year?: unknown;
  total?: unknown;
};

export type RentCastSaleHistoryRaw = {
  event?: unknown;
  date?: unknown;
  price?: unknown;
};

export type RentCastPropertyRecordRaw = {
  id?: unknown;
  formattedAddress?: unknown;
  addressLine1?: unknown;
  city?: unknown;
  state?: unknown;
  zipCode?: unknown;
  county?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  propertyType?: unknown;
  bedrooms?: unknown;
  bathrooms?: unknown;
  squareFootage?: unknown;
  lotSize?: unknown;
  yearBuilt?: unknown;
  lastSaleDate?: unknown;
  lastSalePrice?: unknown;
  taxAssessments?: Record<string, RentCastTaxAssessmentRaw> | null;
  propertyTaxes?: Record<string, RentCastPropertyTaxRaw> | null;
  history?: Record<string, RentCastSaleHistoryRaw> | null;
  owner?: { names?: unknown } | null;
  ownerOccupied?: unknown;
};

export type RentCastLookupResult = {
  record: RentCastPropertyRecordRaw | null;
  httpStatus: 200;
  billableSuccess: true;
};
