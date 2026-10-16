import { publisherLotCandidate } from '../parcel-evidence-consensus/adapters.ts';
import { resolveAnalysisPropertyType, propertyTypeFamily } from './canonicalFactSemantics.ts';
import { parseDealMetricNumber } from './dealMetrics.ts';
import type { ProjectedEvidenceField } from './canonicalEvidenceProjection.ts';
import type { AnalyticalDecision, AnalyticalEffectiveFact, AnalyticalPropertyInputs, AnalyticalDomain } from './analyticalPropertyFacts.ts';

type Values = Record<string, any>;
const domains = {LOT_AREA:'lotArea',LIVING_AREA:'buildingArea',BUILDING_AREA:'buildingArea'} as const;
const decisionFields = (decision: Values): AnalyticalDecision => ({action:decision.action,evidenceHash:decision.evidenceHash,
  value:decision.value,unit:decision.unit,source:decision.source,sourceId:decision.sourceId,status:decision.status,freshness:decision.freshness});

/** Only decision proof matching an already-authorized public effective fact.
 * Never exports reviewer identity, history, private candidates or raw snapshots. */
export function publicAnalyticalDecisionProofs(snapshot: Values, publicFacts: Values) {
  const proofs: Record<string,{decision:AnalyticalDecision;evidenceHash:string;projectionSummary?:unknown}> = {};
  for (const field of ['lotArea','buildingArea']) {
    const row=snapshot?.rows?.[field],fact=publicFacts?.[field],decision=row?.decision;
    if (!row || !fact || !decision || decision.evidenceHash !== row.evidenceHash
      || row.effective?.state !== fact.state || row.effective?.value !== fact.value || row.effective?.unit !== fact.unit
      || row.effective?.sourceType !== fact.sourceType) continue;
    proofs[field]={decision:decisionFields(decision),evidenceHash:row.evidenceHash,
      ...(row.projection?{projectionSummary:{field,consensusState:row.projection.consensusState,analyticalUsability:row.projection.analyticalUsability}}:{})};
  }
  return proofs;
}

/** Read-only adapter. Callers establish authorization; this function has no I/O. */
export function buildAnalyticalPropertyInputs({property,effectiveFacts={},projections={},reviewSnapshot=null,decisionProofs={},unavailableReason}:
  {property:Values;effectiveFacts?:Values;projections?:Values;reviewSnapshot?:Values|null;decisionProofs?:Values;unavailableReason?:string}):AnalyticalPropertyInputs {
  const propertyId=String(property.id??property.propertyId??'');
  if (reviewSnapshot?.propertyId && reviewSnapshot.propertyId !== propertyId) throw new Error('ANALYTICAL_PROPERTY_IDENTITY_MISMATCH');
  const resolved=resolveAnalysisPropertyType(property),propertyType=propertyTypeFamily(resolved)==='LAND'?'LAND':String(effectiveFacts.propertyType?.value??resolved??'UNKNOWN');
  const lot=publisherLotCandidate(typeof property.lot==='number'||typeof property.lot==='string'?property.lot:null);
  const rawSqft=typeof property.sqft==='number'?property.sqft:typeof property.sqft==='string'&&/^(?:\d+(?:\.\d+)?|\d{1,3}(?:,\d{3})+(?:\.\d+)?)$/.test(property.sqft.trim())?Number(property.sqft.replace(/,/g,'')):null;
  const raw: Record<string,AnalyticalEffectiveFact> = {
    lotArea:{value:lot.value,unit:lot.unit,state:lot.value===null?'UNAVAILABLE':'AVAILABLE',sourceType:'USER_PROVIDED',sourceId:'dealSifter',status:'USER_PROVIDED'},
    buildingArea:{value:rawSqft,unit:'SQFT',state:rawSqft===null?'UNAVAILABLE':'AVAILABLE',sourceType:'USER_PROVIDED',sourceId:'dealSifter',status:'USER_PROVIDED'},
  };
  const fields: AnalyticalPropertyInputs['fields']={};
  for (const [domain,field] of Object.entries(domains)) {
    const row=reviewSnapshot?.rows?.[field],proof=decisionProofs[field];
    fields[domain as AnalyticalDomain]={domain:domain as AnalyticalDomain,propertyType,
      effective:row?.effective??effectiveFacts[field]??raw[field],
      projection:(row?.projection??(proof?.projectionSummary?{...projections[field],...proof.projectionSummary}:projections[field])??null) as Partial<ProjectedEvidenceField>|null,
      unavailableReason,
      decision:row?.decision?decisionFields(row.decision):proof?.decision??null,evidenceHash:row?.evidenceHash??proof?.evidenceHash};
  }
  const price=typeof property.price==='number'||typeof property.price==='string'?parseDealMetricNumber(property.price,'money'):null;
  fields.PRICE={domain:'PRICE',effective:{value:price,unit:'USD',state:price===null?'UNAVAILABLE':'AVAILABLE',sourceType:'USER_PROVIDED',sourceId:'PROPERTY_CURRENT_ASKING_PRICE',status:'USER_PROVIDED'}};
  return {version:'ANALYTICAL_PROPERTY_INPUTS_V1',propertyId,fields};
}
