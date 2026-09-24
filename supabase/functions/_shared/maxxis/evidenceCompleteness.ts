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
  const property = rejected(trace)
    ? result('REJECTED', 'ADDRESS_MISMATCH', propertyCacheChecked, Boolean(trace.propertyProviderAttempted))
    : evidenceState === 'available'
      ? result('AVAILABLE', trace.propertyEvidence === 'HIT' ? 'CACHE_HIT' : 'PROPERTY_EVIDENCE_ASSEMBLED', propertyCacheChecked, Boolean(trace.propertyProviderAttempted))
      : result('INSUFFICIENT', evidenceState === 'not_found' ? 'PROPERTY_NOT_FOUND' : 'PROPERTY_EVIDENCE_INCOMPLETE', propertyCacheChecked, Boolean(trace.propertyProviderAttempted));

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
  const sold = rejected(trace)
    ? result('REJECTED', 'ADDRESS_MISMATCH', soldCacheChecked, Boolean(trace.soldProviderAttempted))
    : comps.length
      ? result('AVAILABLE', 'RECORDED_SALES_AVAILABLE', soldCacheChecked, Boolean(trace.soldProviderAttempted))
      : soldCacheChecked
        ? result('UNAVAILABLE', trace.soldProviderAttempted ? 'PROVIDER_NO_RESULTS' : 'CACHE_NO_RESULTS', true, Boolean(trace.soldProviderAttempted))
        : result('NOT_REQUESTED', 'SOLD_EVIDENCE_NOT_CHECKED', false, false);
  const valuation = rejected(trace)
    ? result('REJECTED', 'ADDRESS_MISMATCH', valuationCacheChecked, Boolean(trace.valuationProviderAttempted))
    : valuationContext.status && valuationContext.status !== 'ARV_UNAVAILABLE'
      ? result('AVAILABLE', 'DETERMINISTIC_ARV_AVAILABLE', valuationCacheChecked, Boolean(trace.valuationProviderAttempted))
      : valuationCacheChecked
        ? result('INSUFFICIENT', valuationContext.providerEstimate?.value
          ? 'PROVIDER_AVM_AVAILABLE_ARV_GATES_NOT_MET' : 'ARV_GATES_NOT_MET', true, Boolean(trace.valuationProviderAttempted))
        : result('NOT_REQUESTED', 'VALUATION_EVIDENCE_NOT_CHECKED', false, false);
  return Object.freeze({
    complete: property.status === 'AVAILABLE' && sold.status !== 'NOT_REQUESTED' && valuation.status !== 'NOT_REQUESTED',
    property,
    sold,
    valuation,
  });
}
