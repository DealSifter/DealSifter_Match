import type { ProjectedEvidenceField } from './canonicalEvidenceProjection.ts';
import { SQFT_PER_ACRE } from './propertyAreaUnits.ts';

export type AnalyticalDomain = 'LOT_AREA' | 'LIVING_AREA' | 'BUILDING_AREA' | 'PRICE';
export type AnalyticalInputResolution = 'ALLOW_CONFIRMED' | 'ALLOW_QUALIFIED' | 'ALLOW_RANGE' | 'BLOCK_CONFLICT' | 'BLOCK_UNAVAILABLE' | 'NOT_APPLICABLE';
export type AnalyticalEffectiveFact = { value: unknown; unit?: string | null; state?: string; sourceType?: string | null; sourceId?: string; status?: string; freshness?: string; adopted?: boolean; userConfirmed?: boolean };
export type AnalyticalDecision = { action: string; evidenceHash?: string; value: unknown; unit?: string | null; source?: string; sourceId?: string; status?: string; freshness?: string };
export type AnalyticalFactInput = { domain: AnalyticalDomain; effective?: AnalyticalEffectiveFact | null; projection?: Partial<ProjectedEvidenceField> | null;
  decision?: AnalyticalDecision | null; evidenceHash?: string; propertyType?: string; unavailableReason?: string };
export type AnalyticalPropertyInputs = { version: 'ANALYTICAL_PROPERTY_INPUTS_V1'; propertyId: string; fields: Partial<Record<AnalyticalDomain, AnalyticalFactInput>> };
export type ResolvedAnalyticalFact = Readonly<{ domain: AnalyticalDomain; inputResolution: AnalyticalInputResolution; value: number | null;
  range: { min: number; max: number } | null; unit: 'SQFT' | 'USD'; consensusState: string | null; analyticalUsability: string | null;
  inputSource: { sourceType: string | null; sourceId: string | null; status: string | null; freshness: string | null };
  userDecision: string | null; userAccepted: boolean; userConfirmed: boolean; provisional: boolean; reasonCode: string;
  qualification: readonly string[]; outliers: readonly { sourceType: string; sourceId: string; value: number | string | null; unit: string | null }[] }>;

const sources = new Set(['USER_PROVIDED','PUBLIC_PARCEL_GIS','PUBLIC_ASSESSOR','RENTCAST','CALCULATED_GEOMETRY']);
const unusable = new Set(['EXPIRED','EXPIRED_UNUSABLE','IDENTITY_MISMATCH','CORRUPT','ABSENT','UNAVAILABLE']);
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= Number.MAX_SAFE_INTEGER;
const fieldFor = (domain: AnalyticalDomain) => domain === 'LOT_AREA' ? 'lotArea' : domain === 'PRICE' ? 'price' : 'buildingArea';
const convert = (value: unknown, unit: string | null | undefined, domain: AnalyticalDomain) => {
  if (!positive(value)) return null;
  if (domain === 'PRICE') return unit === 'USD' ? value : null;
  const result = unit === 'SQFT' ? value : domain === 'LOT_AREA' && unit === 'ACRES' ? value * SQFT_PER_ACRE : null;
  return positive(result) ? result : null;
};

/** Pure permission policy: never acquires evidence, mutates facts, or rewrites consensus. */
export function resolveAnalyticalPropertyFact(input: AnalyticalFactInput): ResolvedAnalyticalFact {
  const {domain, projection, effective, decision} = input;
  const base = { domain, unit: domain === 'PRICE' ? 'USD' as const : 'SQFT' as const,
    consensusState: projection?.consensusState ?? null, analyticalUsability: projection?.analyticalUsability ?? null,
    inputSource: {sourceType:null,sourceId:null,status:null,freshness:null} as ResolvedAnalyticalFact['inputSource'],
    userDecision: null as string | null, userAccepted:false,userConfirmed:false,provisional:false,
    outliers: (projection?.outliers ?? []).map(row=>({sourceType:row.sourceType,sourceId:row.sourceId,value:row.normalizedValue,unit:row.normalizedUnit})),
  };
  const result = (inputResolution: AnalyticalInputResolution, reasonCode: string, value: number | null = null,
    range: {min:number;max:number}|null = null, metadata: Partial<typeof base> = {}): ResolvedAnalyticalFact =>
    Object.freeze({...base,...metadata,inputResolution,reasonCode,value,range,qualification:Object.freeze([reasonCode,
      ...(metadata.inputSource?.freshness === 'STALE_USABLE' ? ['STALE_USABLE_INPUT'] : [])])});
  if (projection?.field && projection.field !== fieldFor(domain)) return result('BLOCK_UNAVAILABLE','INPUT_DOMAIN_MISMATCH');
  if ((domain === 'LIVING_AREA' || domain === 'BUILDING_AREA') && /^(?:land|lot|vacant\s+land|terreno|solar)$/i.test(input.propertyType ?? '')
    || effective?.state === 'NOT_APPLICABLE' || projection?.analyticalUsability === 'NOT_APPLICABLE') return result('NOT_APPLICABLE','INPUT_NOT_APPLICABLE');
  if(input.unavailableReason)return result('BLOCK_UNAVAILABLE',input.unavailableReason);
  const validDecision = decision && ['KEEP_MY_VALUE','ACCEPT_EXTERNAL_VALUE'].includes(decision.action)
    && Boolean(input.evidenceHash) && decision.evidenceHash === input.evidenceHash && effective?.state === 'AVAILABLE'
    && decision.source === effective.sourceType && convert(decision.value,decision.unit,domain) === convert(effective.value,effective.unit,domain)
    && (!decision.sourceId || !effective.sourceId || decision.sourceId === effective.sourceId);
  // A display/status marker alone is not proof of a current, explicit decision.
  if (!validDecision && ['USER_CONFIRMED','USER_ACCEPTED_EXTERNAL'].includes(effective?.status ?? ''))
    return result('BLOCK_CONFLICT','INVALID_USER_DECISION_PROOF',null,null,{userDecision:decision?.action??null});
  if (validDecision) {
    const value = convert(effective?.value,effective?.unit,domain), sourceType = effective?.sourceType ?? null;
    if (value === null || !sourceType || !sources.has(sourceType) || unusable.has(effective?.freshness ?? '')) return result('BLOCK_UNAVAILABLE','INPUT_UNAVAILABLE');
    const accepted = decision?.action === 'ACCEPT_EXTERNAL_VALUE' || effective?.status === 'USER_ACCEPTED_EXTERNAL';
    const amidConflict = projection?.analyticalUsability === 'CONFLICTED' || projection?.consensusState === 'MATERIAL_CONFLICT';
    return result('ALLOW_QUALIFIED',accepted?'USER_ACCEPTED_EXTERNAL_INPUT':amidConflict?'USER_CONFIRMED_AMID_CONFLICT':'USER_CONFIRMED_INPUT',value,null,{
      userDecision:accepted?'ACCEPT_EXTERNAL_VALUE':'KEEP_MY_VALUE',userAccepted:accepted,userConfirmed:!accepted,
      inputSource:{sourceType,sourceId:effective?.sourceId??null,status:effective?.status??null,freshness:effective?.freshness??null},
    });
  }
  if (projection?.analyticalUsability === 'CONFLICTED' || projection?.consensusState === 'MATERIAL_CONFLICT'
    || effective?.state==='CONFLICTED'&&projection?.analyticalUsability!=='PROVISIONAL'
    || !projection && decision?.action==='REVIEW_LATER') return result('BLOCK_CONFLICT','UNRESOLVED_INPUT_CONFLICT',null,null,{userDecision:decision?.action??null});
  if (projection?.analyticalUsability === 'PROVISIONAL') {
    const min = convert(projection.range?.min,projection.unit,domain), max = convert(projection.range?.max,projection.unit,domain);
    const families = new Set((projection.supportingCandidates ?? []).filter(row=>row.comparable && sources.has(row.sourceType) && !unusable.has(row.freshness??'')).map(row=>row.sourceFamily));
    if (domain !== 'PRICE' && min !== null && max !== null && min <= max && families.size >= 2) return result('ALLOW_RANGE','PROVISIONAL_INPUT_RANGE',null,{min,max},{provisional:true});
    return result('BLOCK_UNAVAILABLE','INPUT_RANGE_UNAVAILABLE');
  }
  if (projection && ['UNAVAILABLE','NOT_APPLICABLE'].includes(projection.analyticalUsability ?? '')) return result('BLOCK_UNAVAILABLE','INPUT_UNAVAILABLE');
  if (!projection && effective?.state === 'CONFLICTED' || effective?.status === 'REVIEW_LATER') return result('BLOCK_CONFLICT','UNRESOLVED_INPUT_CONFLICT');
  const observed = (projection?.supportingCandidates ?? []).find(row=>row.comparable && sources.has(row.sourceType) && !unusable.has(row.freshness??''));
  const projectedValue = projection ? convert(projection.value,projection.unit,domain) : null;
  const effectiveValue=effective?.state==='AVAILABLE'?convert(effective.value,effective.unit,domain):null;
  if(projectedValue!==null&&effectiveValue!==null&&Math.abs(projectedValue-effectiveValue)>Math.max(1,projectedValue,effectiveValue)*1e-12)
    return result('BLOCK_CONFLICT','UNRESOLVED_INPUT_CONFLICT');
  const useProjection = projectedValue !== null;
  const value = useProjection ? projectedValue : projection ? null : effective?.state === 'AVAILABLE' ? convert(effective.value,effective.unit,domain) : null;
  const sourceType = useProjection ? observed?.sourceType : effective?.sourceType;
  const freshness = useProjection ? observed?.freshness : effective?.freshness;
  if (value === null || !sourceType || !sources.has(sourceType) || unusable.has(freshness??'')) return result('BLOCK_UNAVAILABLE','INPUT_UNAVAILABLE');
  const confirmed = projection?.analyticalUsability === 'CONFIRMED';
  return result(confirmed?'ALLOW_CONFIRMED':'ALLOW_QUALIFIED',confirmed?'CONFIRMED_INPUT':sourceType==='USER_PROVIDED'?'PUBLISHER_PROVIDED_INPUT':'SINGLE_SOURCE_INPUT',value,null,{
    inputSource:{sourceType,sourceId:useProjection?observed?.sourceId??null:effective?.sourceId??null,status:useProjection?observed?.evidenceStatus??null:effective?.status??null,freshness:freshness??null},
  });
}

export function resolveAnalyticalInputs(context: AnalyticalPropertyInputs) {
  return Object.fromEntries((['LOT_AREA','LIVING_AREA','BUILDING_AREA','PRICE'] as const).map(domain=>[domain,
    resolveAnalyticalPropertyFact(context.fields[domain] ?? {domain})])) as Record<AnalyticalDomain,ResolvedAnalyticalFact>;
}
