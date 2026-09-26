export type EvidenceFamilyStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'REJECTED' | 'NOT_AUTHORIZED'
  | 'NOT_REQUESTED' | 'INSUFFICIENT' | 'STALE';

export type EvidenceFamilyResult = Readonly<{
  status: EvidenceFamilyStatus;
  reason: string;
  cacheChecked: boolean;
  providerAttempted: boolean;
}>;

type Trace = Record<string, any>;
type Context = Record<string, any>;

const result = (status: EvidenceFamilyStatus, reason: string, cacheChecked: boolean, providerAttempted: boolean): EvidenceFamilyResult =>
  Object.freeze({ status, reason, cacheChecked, providerAttempted });

function rejected(trace: Trace) {
  return trace.addressValidation === 'REJECTED' || trace.stopReason === 'ADDRESS_MISMATCH';
}

export function buildEvidenceCompleteness({ reportType, evidenceState, context, trace }: {
  reportType: string;
  evidenceState: string;
  context: Context | null;
  trace: Trace;
}) {
  const enterprise = reportType === 'DEAL_INTELLIGENCE';
  const propertyCacheChecked = trace.propertyEvidence !== 'UNKNOWN';
  const propertyReason = String(trace.propertyEvidenceReason || 'PROPERTY_EVIDENCE_INCOMPLETE');
  const property = rejected(trace)
    ? result('REJECTED', 'ADDRESS_MISMATCH', propertyCacheChecked, Boolean(trace.propertyProviderAttempted))
    : evidenceState === 'available'
      ? result('AVAILABLE', trace.propertyEvidence === 'HIT' ? 'CACHE_HIT' : 'PROPERTY_EVIDENCE_ASSEMBLED', propertyCacheChecked, Boolean(trace.propertyProviderAttempted))
      : evidenceState === 'locked'
        ? result('NOT_AUTHORIZED', propertyReason, propertyCacheChecked, false)
        : result(evidenceState === 'not_found' ? 'UNAVAILABLE' : 'INSUFFICIENT', propertyReason, propertyCacheChecked, Boolean(trace.propertyProviderAttempted));

  if (!enterprise) {
    return Object.freeze({
      complete: property.status === 'AVAILABLE',
      property,
      sold: result('NOT_AUTHORIZED', 'CAPABILITY_DOES_NOT_INCLUDE_SOLD_EVIDENCE', false, false),
      valuation: result('NOT_AUTHORIZED', 'CAPABILITY_DOES_NOT_INCLUDE_VALUATION_EVIDENCE', false, false),
    });
  }

  const comps = Array.isArray(context?.comparableEvidence) ? context.comparableEvidence : [];
  const valuationContext = context?.valuationContext && typeof context.valuationContext === 'object'
    ? context.valuationContext : {};
  const soldCacheChecked = !['UNKNOWN', 'NOT_REQUIRED'].includes(String(trace.soldEvidence || ''));
  const valuationCacheChecked = !['UNKNOWN', 'NOT_REQUIRED'].includes(String(trace.valuationEvidence || ''));
  const propertyBlocksDependentEvidence = property.status !== 'AVAILABLE';
  const sold = rejected(trace)
    ? result('REJECTED', 'ADDRESS_MISMATCH', soldCacheChecked, Boolean(trace.soldProviderAttempted))
    : propertyBlocksDependentEvidence && !soldCacheChecked
      ? result('NOT_REQUESTED', `PROPERTY_EVIDENCE_REQUIRED:${property.reason}`, false, false)
    : Number(trace.soldNormalizedCandidateCount || trace.candidateCount || 0) > 0
      ? result('AVAILABLE', 'RECORDED_SALES_AVAILABLE', soldCacheChecked, Boolean(trace.soldProviderAttempted))
      : soldCacheChecked
        ? result('UNAVAILABLE', String(trace.soldEvidenceReason || (trace.soldProviderAttempted ? 'PROVIDER_NO_RESULTS' : 'CACHE_NO_RESULTS')), true, Boolean(trace.soldProviderAttempted))
        : result('NOT_REQUESTED', 'SOLD_EVIDENCE_NOT_CHECKED', false, false);
  const valuation = rejected(trace)
    ? result('REJECTED', 'ADDRESS_MISMATCH', valuationCacheChecked, Boolean(trace.valuationProviderAttempted))
    : propertyBlocksDependentEvidence && !valuationCacheChecked
      ? result('NOT_REQUESTED', `PROPERTY_EVIDENCE_REQUIRED:${property.reason}`, false, false)
    : valuationContext.status && valuationContext.status !== 'ARV_UNAVAILABLE'
      ? result('AVAILABLE', 'DETERMINISTIC_ARV_AVAILABLE', valuationCacheChecked, Boolean(trace.valuationProviderAttempted))
      : valuationCacheChecked
        ? result('INSUFFICIENT', String(trace.valuationEvidenceReason || (valuationContext.providerEstimate?.value
          ? 'PROVIDER_AVM_AVAILABLE_ARV_GATES_NOT_MET' : 'ARV_GATES_NOT_MET')), true, Boolean(trace.valuationProviderAttempted))
        : result('NOT_REQUESTED', 'VALUATION_EVIDENCE_NOT_CHECKED', false, false);
  return Object.freeze({
    complete: property.status === 'AVAILABLE' && sold.status !== 'NOT_REQUESTED' && valuation.status !== 'NOT_REQUESTED',
    property,
    sold,
    valuation,
  });
}
