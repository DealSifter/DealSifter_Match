import {evidenceAbsenceReason,evidenceAbsenceCopy} from './evidenceAbsence.ts';
/** Provider AVM comparables are listing references, never recorded-sale inputs. */
export function projectProviderListingReferences(input: unknown) {
  const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : null;
  const text = (v: unknown) => typeof v === 'string' ? v.trim() : '';
  const seen = new Set<string>();
  const normalize = (v: unknown) => text(v).toUpperCase().replace(/[^A-Z0-9#]/g, '');
  return (Array.isArray(input) ? input : []).flatMap((raw: unknown) => {
    if (!raw || typeof raw !== 'object') return [];
    const row = raw as Record<string, unknown>, address = text(row.formattedAddress || row.address || row.addressLine1);
    const price = number(row.price);
    if (row.priceSemantic !== 'PROVIDER_LISTING_PRICE' || !address || price === null || price <= 0) return [];
    const providerPropertyId = text(row.providerPropertyId), assessorId = text(row.assessorId);
    // City aliases are not identity. Require street + state + ZIP + exact
    // coordinates + matching structural attributes; retain unit identifiers.
    const street = text(row.addressLine1), zip = text(row.zipCode), state = text(row.state);
    const geoIdentity = street && zip && state && number(row.latitude) !== null && number(row.longitude) !== null
      && number(row.livingAreaSqft) !== null && number(row.bedrooms) !== null && number(row.bathrooms) !== null
      ? JSON.stringify([normalize(street), normalize(state), zip, row.latitude, row.longitude, row.livingAreaSqft, row.bedrooms, row.bathrooms]) : '';
    const keys = [`address:${normalize(address)}`, ...(providerPropertyId ? [`id:${providerPropertyId}`] : []),
      ...(assessorId && state && zip ? [`apn:${normalize(state)}:${zip}:${normalize(assessorId)}`] : []), ...(geoIdentity ? [`geo:${geoIdentity}`] : [])];
    if (keys.some(key => seen.has(key))) return [];
    keys.forEach(key => seen.add(key));
    return [{ address, providerPropertyId, assessorId, addressLine1: street, zipCode: zip, state, listingStatus: text(row.listingStatus),
      price, priceSemantic: 'PROVIDER_LISTING_PRICE' as const, latitude: number(row.latitude), longitude: number(row.longitude),
      bedrooms: number(row.bedrooms), bathrooms: number(row.bathrooms), livingAreaSqft: number(row.livingAreaSqft),
      distanceMiles: number(row.distanceMiles), providerCorrelation: number(row.providerCorrelation), lastSeenDate: text(row.lastSeenDate) }];
  }).sort((a, b) => (b.providerCorrelation ?? -1) - (a.providerCorrelation ?? -1)).slice(0, 5);
}

/** Presentation ordering only; does not promote supporting evidence into ARV. */
export function rankReportComparables<T extends Record<string, unknown>>(rows: T[]): T[] {
  const score = (row: T) => {
    const raw = row.similarity ?? row.structuralComparabilityScore ?? row.providerCorrelation;
    return typeof raw === 'number' && Number.isFinite(raw) ? raw <= 1 ? raw * 100 : raw : -1;
  };
  return [...rows].sort((a, b) => score(b) - score(a));
}

/** Bounded delivery receipt, from actual execution telemetry, not listing counts. */
export function projectSoldDelivery(trace: Record<string, unknown> = {}) {
  const count = (key:string) => typeof trace[key] === 'number' && Number.isFinite(trace[key]) ? Math.max(0, Number(trace[key])) : null;
  const loaded = ['HIT','MISS_REFRESHED'].includes(String(trace.soldEvidence));
  const returned = loaded ? count('soldRawCandidateCount') : null;
  const normalized = loaded ? count('soldNormalizedCandidateCount') : null;
  const eligible = loaded ? count('arvEligibleCount') : null;
  const structural = loaded ? count('structuralCandidateCount') : null;
  const recorded = typeof trace.soldProviderAttempted === 'boolean' || loaded;
  const status = !recorded ? 'UNKNOWN_EXECUTION' : !loaded ? 'NOT_QUERIED' : returned === 0 ? 'NO_PROVIDER_RESULTS'
    : normalized === 0 ? 'NO_SOLD_RECORDS' : structural === 0 ? 'FILTERED_OUT'
      : ['ARV_AVAILABLE','ARV_LIMITED'].includes(String(trace.arvStatus)) && (eligible ?? 0) > 0 ? 'ELIGIBLE_FOR_ARV'
        : trace.targetConditionConfirmed === false || (structural ?? 0) > 0 && eligible === 0 ? 'CONDITION_UNCONFIRMED' : 'INSUFFICIENT_ELIGIBLE_COMPS';
  return Object.freeze({ status, queryExecuted: typeof trace.soldProviderAttempted === 'boolean' ? trace.soldProviderAttempted : loaded ? !Boolean(trace.soldEvidence === 'HIT') : null, cacheHit: trace.soldEvidence === 'HIT',
    reason: String(trace.soldEvidenceReason || 'EXECUTION_NOT_RECORDED'), absenceReason: loaded ? null : evidenceAbsenceReason(trace.soldEvidenceReason), returned, normalized,
    hardGatePass: loaded ? count('hardGatePassCount') : null, structural, eligible,
    supporting: loaded ? count('supportingCandidateCount') : null, excluded: loaded ? count('excludedCandidateCount') : null,
    arvStatus: String(trace.arvStatus || 'UNAVAILABLE'), blockers: Array.isArray(trace.arvBlockers)?trace.arvBlockers.filter(v=>typeof v==='string'):[] });
}

export function soldDeliveryAnswer(receipt: ReturnType<typeof projectSoldDelivery>, language:string) {
  const i=language==='pt'?0:language==='es'?2:1;
  if(!receipt.cacheHit&&receipt.absenceReason)return evidenceAbsenceCopy(receipt.absenceReason,language);
  if(receipt.returned===null)return evidenceAbsenceCopy(evidenceAbsenceReason(receipt.reason),language);
  const returned=receipt.returned,eligible=receipt.eligible??0;
  const counts=[
    'Vendas retornadas: '+returned+'; aptas para estimar o valor após reforma: '+eligible+'.',
    'Sales returned: '+returned+'; eligible to estimate after-repair value: '+eligible+'.',
    'Ventas devueltas: '+returned+'; aptas para estimar el valor después de la reforma: '+eligible+'.'
  ][i];
  if(receipt.status==='ELIGIBLE_FOR_ARV')return counts;
  const reason=receipt.status==='CONDITION_UNCONFIRMED'?'USER_INPUT_REQUIRED':'NO_COVERAGE';
  const condition=receipt.status==='CONDITION_UNCONFIRMED'?[
    'Confirme a condição após reforma e a condição dos imóveis comparáveis.',
    'Confirm the target after-repair condition and the condition of the comparable properties.',
    'Confirme la condición después de la reforma y la de los inmuebles comparables.'
  ][i]:'';
  return [counts,condition||evidenceAbsenceCopy(reason,language)].join(' ');
}
