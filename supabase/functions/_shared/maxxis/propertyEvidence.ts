import { presentPropertyIntelligence } from '../property-data/propertyIntelligenceAccess.ts';
import type { PropertyEvidenceResult } from '../property-data/propertyEvidenceTypes.ts';
import { resolvePropertyDetailsInput } from './propertyDetails.ts';

export type MaxxisPropertyEvidenceResult = {
  type: 'property_evidence';
  propertyId: string;
  state: 'available' | 'locked' | 'not_loaded' | 'unavailable' | 'not_found';
  entitlementState: 'authorized' | 'not_authorized';
  cacheState: 'hit' | 'miss' | 'invalid' | 'unknown';
  evidence?: ReturnType<typeof presentPropertyIntelligence> & { internalFields: Record<string, unknown> };
};

const evidenceValue = <T>(evidence: { value: T | null; status: string; source: string | null; retrievedAt: string | null; effectiveDate: string | null }) => ({
  value: evidence.value,
  status: evidence.status,
  source: evidence.source,
  retrievedAt: evidence.retrievedAt,
  effectiveDate: evidence.effectiveDate,
});

export function presentPropertyEvidenceForMaxxis(result: PropertyEvidenceResult) {
  const internal = result.internalData;
  return {
    ...presentPropertyIntelligence(result),
    internalFields: {
      propertyType: evidenceValue(internal.characteristics.propertyType),
      bedrooms: evidenceValue(internal.characteristics.bedrooms),
      bathrooms: evidenceValue(internal.characteristics.bathrooms),
      livingAreaSqft: evidenceValue(internal.characteristics.livingAreaSqft),
      lotSizeSqft: evidenceValue(internal.characteristics.lotSizeSqft),
      yearBuilt: evidenceValue(internal.characteristics.yearBuilt),
      askingPrice: evidenceValue(internal.listing.askingPrice),
    },
  };
}

export async function getPropertyEvidenceWithDependencies(options: {
  propertyId: string;
  contextPropertyId?: string;
  userId: string;
  hasEntitlement: (propertyId: string) => Promise<boolean>;
  loadCachedEvidence: (propertyId: string, userId: string) => Promise<PropertyEvidenceResult>;
}): Promise<MaxxisPropertyEvidenceResult> {
  const input = resolvePropertyDetailsInput({ propertyId: options.propertyId }, options.contextPropertyId);
  let entitled = false;
  try {
    entitled = await options.hasEntitlement(input.propertyId);
  } catch {
    return { type: 'property_evidence', propertyId: input.propertyId, state: 'unavailable', entitlementState: 'not_authorized', cacheState: 'unknown' };
  }
  if (!entitled) {
    return { type: 'property_evidence', propertyId: input.propertyId, state: 'locked', entitlementState: 'not_authorized', cacheState: 'unknown' };
  }
  try {
    const evidence = await options.loadCachedEvidence(input.propertyId, options.userId);
    return {
      type: 'property_evidence', propertyId: input.propertyId, state: 'available',
      entitlementState: 'authorized', cacheState: 'hit', evidence: presentPropertyEvidenceForMaxxis(evidence),
    };
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'PROPERTY_NOT_FOUND') {
      return { type: 'property_evidence', propertyId: input.propertyId, state: 'not_found', entitlementState: 'authorized', cacheState: 'unknown' };
    }
    if (code === 'PROPERTY_EVIDENCE_CACHE_MISS') {
      return { type: 'property_evidence', propertyId: input.propertyId, state: 'not_loaded', entitlementState: 'authorized', cacheState: 'miss' };
    }
    if (code === 'PROPERTY_EVIDENCE_CACHE_INVALID') {
      return { type: 'property_evidence', propertyId: input.propertyId, state: 'not_loaded', entitlementState: 'authorized', cacheState: 'invalid' };
    }
    return { type: 'property_evidence', propertyId: input.propertyId, state: 'unavailable', entitlementState: 'authorized', cacheState: 'unknown' };
  }
}
