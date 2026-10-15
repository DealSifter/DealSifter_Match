import { computeParcelEvidenceConsensus } from '../parcel-evidence-consensus/engine.ts';
import type { CandidateInput, ConsensusField, ConsensusStatus, EvidenceCandidate, FieldEvidenceConsensus } from '../parcel-evidence-consensus/types.ts';
import { buildCanonicalPropertyFacts } from './propertyEvidenceProjection.ts';
import { resolveAnalysisPropertyType } from './canonicalFactSemantics.ts';
export type AnalyticalUsability = 'CONFIRMED' | 'PROVISIONAL' | 'SINGLE_SOURCE' | 'CONFLICTED' | 'UNAVAILABLE' | 'NOT_APPLICABLE';
export const PROJECTED_FIELDS = ['lotArea','apn','owner','assessedValue','propertyTax','zoning','propertyType'] as const;
export type ProjectedField = typeof PROJECTED_FIELDS[number];
export type ProjectionDomain = ProjectedField | 'buildingArea' | 'yearBuilt' | 'beds' | 'baths' | 'subdivision' | 'legalDescription';
export const ANALYTICAL_FIELD_POLICY = Object.freeze({
  lotArea: { minor: 'PROVISIONAL', range: true }, apn: { minor: 'CONFIRMED', range: false },
  owner: { minor: 'PROVISIONAL', range: false }, assessedValue: { minor: 'PROVISIONAL', range: true },
  propertyTax: { minor: 'PROVISIONAL', range: true }, zoning: { minor: 'PROVISIONAL', range: false },
  propertyType: { minor: 'PROVISIONAL', range: false },
  buildingArea: { minor: 'PROVISIONAL', range: true }, yearBuilt: { minor: 'PROVISIONAL', range: false },
  beds: { minor: 'PROVISIONAL', range: false }, baths: { minor: 'PROVISIONAL', range: false },
  subdivision: { minor: 'PROVISIONAL', range: false }, legalDescription: { minor: 'PROVISIONAL', range: false },
} as const);
export type ProjectedEvidenceField = {
  field: ProjectionDomain; consensusState: ConsensusStatus; analyticalUsability: AnalyticalUsability;
  value: number|string|null; unit: string|null; range: { min:number; max:number }|null;
  provisional: boolean; candidates: EvidenceCandidate[]; supportingCandidates: EvidenceCandidate[];
  conflictingCandidates: EvidenceCandidate[]; outliers: EvidenceCandidate[];
  sourceFreshness: { sourceId:string; freshness:string; retrievedAt:string|null; sourceUpdatedAt:string|null }[];
  resolutionBasis:string|null; reasonCode:string; requiresQualification:boolean;
};
export function analyticalUsability(field:ProjectionDomain,result:FieldEvidenceConsensus):AnalyticalUsability {
  if(result.status==='NOT_APPLICABLE')return 'NOT_APPLICABLE';
  if(result.status==='UNAVAILABLE')return 'UNAVAILABLE';
  if(result.status==='MATERIAL_CONFLICT')return 'CONFLICTED';
  if(result.status==='OUTLIER_DETECTED')return result.supportingSources.length>=2&&result.agreementCluster.length>=2?'PROVISIONAL':'CONFLICTED';
  if(result.status==='SINGLE_SOURCE')return 'SINGLE_SOURCE';
  if(result.status==='INSUFFICIENT_EVIDENCE'){
    const usable=result.candidates.filter(c=>c.comparable);
    return usable.length===0?'UNAVAILABLE':new Set(usable.map(c=>c.sourceFamily)).size===1?'SINGLE_SOURCE':'CONFLICTED';
  }
  return result.status==='MINOR_VARIANCE'?ANALYTICAL_FIELD_POLICY[field].minor:'CONFIRMED';
}
export function projectConsensusField(field:ProjectionDomain,result:FieldEvidenceConsensus):ProjectedEvidenceField {
  const usability=analyticalUsability(field,result), candidates=structuredClone(result.candidates);
  const supporting=candidates.filter(c=>c.comparable&&(result.agreementCluster.length?result.agreementCluster.includes(c.candidateId):usability==='SINGLE_SOURCE'));
  let value:number|string|null=null,range:{min:number;max:number}|null=null;
  if(!['CONFLICTED','UNAVAILABLE','NOT_APPLICABLE'].includes(usability)&&supporting.length){
    const values=[...new Set(supporting.map(c=>c.normalizedValue))];
    // Only an observed unanimous value, never the phase-2 family median.
    if(values.length===1&&usability!=='PROVISIONAL')value=values[0];
    else if(ANALYTICAL_FIELD_POLICY[field].range&&values.every(v=>typeof v==='number')){
      range={min:Math.min(...values as number[]),max:Math.max(...values as number[])};
    }
  }
  return {field,consensusState:result.status,analyticalUsability:usability,value,unit:result.normalizedUnit,range,
    provisional:usability==='PROVISIONAL',candidates,supportingCandidates:supporting,
    conflictingCandidates:candidates.filter(c=>result.conflictingSources.includes(c.sourceFamily)),
    outliers:candidates.filter(c=>result.outliers.includes(c.candidateId)),
    sourceFreshness:candidates.map(c=>({sourceId:c.sourceId,freshness:c.freshness??'UNKNOWN',retrievedAt:c.retrievedAt??null,sourceUpdatedAt:c.sourceUpdatedAt??null})),
    resolutionBasis:range?'OBSERVED_AGREEMENT_RANGE':value!==null?'OBSERVED_SOURCE_VALUE':null,
    reasonCode:result.reasonCode,requiresQualification:true};
}
/** Additive canonical read model. No legacy scalar, report or financial input is replaced. */
export function buildConsensusAwareCanonicalReadModel(property:Record<string,unknown>, inputs:readonly CandidateInput[], context:Parameters<typeof buildCanonicalPropertyFacts>[1]=null) {
  // Calculated/estimated benchmarks are never equivalent to recorded fiscal facts.
  const prepared=inputs.map(c=>(c.field==='propertyTax'||c.field==='assessedValue')&&c.evidenceStatus==='CALCULATED'
    ? {...c,evidenceStatus:'ESTIMATED' as const,metadata:{...c.metadata,concept:'NON_RECORDED_BENCHMARK'}}:c);
  const consensus=computeParcelEvidenceConsensus(prepared);
  const fields=Object.fromEntries(PROJECTED_FIELDS.map(field=>[field,projectConsensusField(field,consensus.fields[field])])) as Record<ProjectedField,ProjectedEvidenceField>;
  return Object.freeze({...buildCanonicalPropertyFacts(property,context),
    analyticalEvidence:Object.freeze({version:'CANONICAL_EVIDENCE_PROJECTION_V1',fields,
      resolvedAnalysisPropertyType:resolveAnalysisPropertyType(property),
      legacyConsumersMigrated:false,reportConsumption:0,financialConsumption:0})});
}
