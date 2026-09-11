import type { PropertyEvidenceResult } from './propertyEvidenceTypes.ts';
import type { Evidence } from './types.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type EvidenceView = Pick<Evidence<unknown>, 'value' | 'status' | 'source' | 'retrievedAt' | 'effectiveDate'>;

function evidenceView<T>(evidence: Evidence<T>): EvidenceView {
  return {
    value: evidence.value,
    status: evidence.status,
    source: evidence.source,
    retrievedAt: evidence.retrievedAt,
    effectiveDate: evidence.effectiveDate,
  };
}

function ownerPresence(evidence: Evidence<string[]>): EvidenceView {
  if (evidence.status === 'UNAVAILABLE' || evidence.value === null) return evidenceView(evidence);
  return { ...evidenceView(evidence), value: evidence.value.length > 0 };
}

export function presentPropertyIntelligence(result: PropertyEvidenceResult) {
  const external = result.externalData;
  return {
    propertyId: result.propertyId,
    fields: {
      propertyType: evidenceView(external.characteristics.propertyType),
      bedrooms: evidenceView(external.characteristics.bedrooms),
      bathrooms: evidenceView(external.characteristics.bathrooms),
      livingAreaSqft: evidenceView(external.characteristics.livingAreaSqft),
      lotSizeSqft: evidenceView(external.characteristics.lotSizeSqft),
      yearBuilt: evidenceView(external.characteristics.yearBuilt),
      county: evidenceView(external.address.county),
      latitude: evidenceView(external.address.latitude),
      longitude: evidenceView(external.address.longitude),
      assessedValue: evidenceView(external.tax.assessedValue),
      assessmentYear: evidenceView(external.tax.assessmentYear),
      annualPropertyTax: evidenceView(external.tax.annualPropertyTax),
      propertyTaxYear: evidenceView(external.tax.propertyTaxYear),
      latestSalePrice: evidenceView(external.lastSale.price),
      latestSaleDate: evidenceView(external.lastSale.date),
      ownerOccupied: evidenceView(external.ownership.ownerOccupied),
      ownershipRecordPresent: ownerPresence(external.ownership.ownerNames),
    },
    conflicts: result.conflicts.map((conflict) => ({
      field: conflict.field,
      dealSifterValue: conflict.internalValue,
      publicRecordValue: conflict.externalValue,
      severity: conflict.severity,
    })),
    missingFields: [...result.missingFields],
    source: {
      label: 'Public property records via RentCast',
      updatedAt: result.retrievedAt,
    },
    cacheHit: result.cacheHit,
  };
}

export async function resolvePropertyIntelligenceAccess(options: {
  dataMode?: 'live' | 'disabled';
  userId: string | null;
  propertyId: string;
  hasEntitlement: (userId: string, propertyId: string) => Promise<boolean>;
  loadEvidence: (propertyId: string, userId: string) => Promise<PropertyEvidenceResult>;
}) {
  const userId = String(options.userId || '').trim();
  const propertyId = String(options.propertyId || '').trim();
  if (!UUID_PATTERN.test(propertyId)) {
    return { success: false as const, state: 'unavailable' as const, error: 'INVALID_PROPERTY' };
  }
  if (!userId) {
    return { success: true as const, state: 'locked' as const, entitled: false, authRequired: true };
  }
  // Exposure is not entitlement. Stop before evidence service/provider construction.
  if (options.dataMode === 'disabled') {
    return { success: true as const, state: 'locked' as const, entitled: false, authRequired: false };
  }
  const entitled = await options.hasEntitlement(userId, propertyId);
  if (!entitled) {
    return { success: true as const, state: 'locked' as const, entitled: false, authRequired: false };
  }
  try {
    const evidence = await options.loadEvidence(propertyId, userId);
    return {
      success: true as const,
      state: 'unlocked' as const,
      entitled: true,
      intelligence: presentPropertyIntelligence(evidence),
    };
  } catch {
    return {
      success: false as const,
      state: 'unavailable' as const,
      entitled: true,
      error: 'PROPERTY_INTELLIGENCE_UNAVAILABLE',
    };
  }
}
