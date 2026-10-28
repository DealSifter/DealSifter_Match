import { describe, expect, it } from 'vitest';
import { projectSoldDelivery, soldDeliveryAnswer } from '../../../../supabase/functions/_shared/maxxis/reportMarketReferences';
import { resolveRentAvmSubjectAttributes } from '../../../../supabase/functions/_shared/property-data/rentAvmSubject';
import { reportMarketRentSubject } from '../../../../supabase/functions/_shared/maxxis/reportMarketRentPolicy';
import { marketRentStateAnswer, detectFinancialEvidenceQuestion } from '../../../../supabase/functions/_shared/maxxis/financialEvidenceAnswer';
import { orchestrateDealInsightContext } from '../../../../supabase/functions/_shared/maxxis/dealInsightContext';
import { calculatePropertyMatch } from '../../../../supabase/functions/_shared/maxxis/calculatePropertyMatch';
import { calculateDealMetrics } from '../../../../supabase/functions/_shared/maxxis/dealMetrics';
import { evaluateArv } from '../../../../supabase/functions/_shared/property-data/arvEngine';
import { projectMaxxisDealIntelligenceResponse } from '../intelligence/maxxisDealIntelligenceReport';
import { projectMaxxisAnalysisResponse } from '../intelligence/maxxisAnalysisReport';
import { buildStrictReportViewModel } from './reportIntegrityViewModel';

const property={id:'11111111-1111-4111-8111-111111111111',address:'4724 W 26th St',city:'Little Rock',state:'AR',zip:'72204',type:'SFR',objective:'Sell',price:90000,beds:3,baths:1,sqft:806,rehab:35000,latitude:34.7285,longitude:-92.3311};
const candidates=Array.from({length:5},(_,i)=>({source:'ARV_COMP_CANDIDATE',compIdentifier:`synthetic-${i}`,address:`${100+i} Synthetic Sold St`,recordedSalePrice:110000+i*1000,recordedSaleDate:'2026-08-01',recordedSaleEvidenceStatus:'VERIFIED_RECORD',livingAreaSqft:806,
 structuralComparabilityScore:95,dataCompletenessScore:90,hardGatesPass:true,recordAmbiguousOrCorrupt:false,distanceMiles:.2,daysSinceSale:60,transactionQuality:'ARMS_LENGTH',conditionCompatibility:'MATCHES_TARGET',conditionEvidenceStatus:'USER_PROVIDED',latitude:34.73+i*.001,longitude:-92.33+i*.001}));
async function response(profile){
 const arv=evaluateArv({subjectPropertyId:property.id,subjectLivingAreaSqft:806,targetCondition:'TURN_KEY',candidates,calculatedAt:'2026-10-18T00:00:00Z'});
 const result=await orchestrateDealInsightContext({propertyId:property.id,
  loadPropertyDetails:async()=>({found:true,property,missingFields:[],metrics:calculateDealMetrics(property),analysis:{positiveSignals:[],attentionPoints:[],missingInformation:[],limitations:[]}}),
  loadInvestmentProfile:async()=>({profile,exists:!!profile,complete:!!profile}),calculateMatch:calculatePropertyMatch,
  loadPropertyEvidence:async()=>({state:'available',propertyId:property.id,entitlementState:'authorized',evidence:{fields:{},internalFields:{},conflicts:[],missingFields:[]}}),
  loadArvEvaluation:async()=>arv});
 const soldDelivery=projectSoldDelivery({soldEvidence:'HIT',soldRawCandidateCount:5,soldNormalizedCandidateCount:5,structuralCandidateCount:5,arvEligibleCount:arv.eligibleCompCount,arvStatus:arv.status,targetConditionConfirmed:true});
 return {data:{...result,intelligenceSnapshot:{propertyFacts:property,investmentProfile:result.investmentProfile,matchScore:result.match,soldDelivery}}};
}
describe('analytical delivery recovery — deterministic integration, no live provider',()=>{
 it.each([
  [{},'UNKNOWN_EXECUTION'],
  [{soldProviderAttempted:false,soldEvidence:'NOT_REQUIRED'},'NOT_QUERIED'],
  [{soldEvidence:'HIT',soldRawCandidateCount:0},'NO_PROVIDER_RESULTS'],
  [{soldEvidence:'HIT',soldRawCandidateCount:4,soldNormalizedCandidateCount:0},'NO_SOLD_RECORDS'],
  [{soldEvidence:'HIT',soldRawCandidateCount:4,soldNormalizedCandidateCount:4,structuralCandidateCount:0},'FILTERED_OUT'],
  [{soldEvidence:'HIT',soldRawCandidateCount:4,soldNormalizedCandidateCount:4,structuralCandidateCount:4,arvEligibleCount:0,targetConditionConfirmed:false},'CONDITION_UNCONFIRMED'],
  [{soldEvidence:'HIT',soldRawCandidateCount:4,soldNormalizedCandidateCount:4,structuralCandidateCount:4,arvEligibleCount:1,targetConditionConfirmed:true},'INSUFFICIENT_ELIGIBLE_COMPS'],
  [{soldEvidence:'HIT',soldRawCandidateCount:4,soldNormalizedCandidateCount:4,structuralCandidateCount:4,arvEligibleCount:4,arvStatus:'ARV_AVAILABLE'},'ELIGIBLE_FOR_ARV'],
 ])('retains SOLD stage distinctions: %s', (trace,status)=>expect(projectSoldDelivery(trace).status).toBe(status));
 it('does not manufacture zero counts or a provider query for historical absence of telemetry',()=>{
  expect(projectSoldDelivery()).toMatchObject({queryExecuted:null,returned:null,normalized:null,eligible:null});
 });
 it('explains a recorded cache prerequisite failure instead of claiming no sales',()=>{
  const receipt=projectSoldDelivery({soldEvidence:'UNAVAILABLE',soldProviderAttempted:false,soldEvidenceReason:'VALUATION_EVIDENCE_CACHE_REQUIRED'});
  expect(soldDeliveryAnswer(receipt,'pt')).toContain('subject AVM compatível ausente no cache');
  expect(receipt.returned).toBeNull();
 });
 it('reports every critical conflict but never blocks rent for lot area alone',()=>{
  const projections={lotArea:{analyticalUsability:'CONFLICTED'},baths:{analyticalUsability:'CONFLICTED'},buildingArea:{analyticalUsability:'CONFLICTED'}};
  const subject=reportMarketRentSubject(resolveRentAvmSubjectAttributes({property,projections}));
  expect(subject).toMatchObject({state:'RENT_AVM_REVIEW_REQUIRED',reviewFields:['baths','buildingArea']});
  expect(marketRentStateAnswer({...subject,providerCalls:0},'pt')).toContain('banheiros, área construída');
  expect(resolveRentAvmSubjectAttributes({property,projections:{lotArea:projections.lotArea}}).state).toBe('READY');
 });
 it('preserves optional missing attributes and routes explicit rental comps deterministically',()=>{
  const subject=resolveRentAvmSubjectAttributes({property:{...property,beds:null,baths:null,sqft:null}});
  expect(subject.state).toBe('READY');expect(subject.overrides).not.toHaveProperty('squareFootage');
  expect(detectFinancialEvidenceQuestion('Quais os Rental Comps?')).toMatchObject({domain:'providerMarketRentEstimate',listComparables:true});
 });
 it('existing ARV engine → context → preparation → L3 retains sold evidence and receipt',async()=>{
  const raw=await response(null),projected=projectMaxxisDealIntelligenceResponse(raw),model=buildStrictReportViewModel({schema:projected.data.maxxisReport,language:'pt'});
  expect(projected.data.maxxisDealIntelligence.valuationIntelligence.status).toMatch(/ARV_AVAILABLE|ARV_LIMITED/);
  const table=model.sections.find(s=>s.id==='sales-comparables');
  expect(table.table.rows).toHaveLength(5);expect(table.table.rows.every(row=>row.includes('SOLD'))).toBe(true);
  expect(table.map.points.filter(p=>p.id!=='subject')).toHaveLength(5);
  const receipt=raw.data.intelligenceSnapshot.soldDelivery;
  expect(model.sections.find(s=>s.id==='sold-delivery').text).toBe(soldDeliveryAnswer(receipt,'pt'));
 });
 it.each([true,false])('current profile → unchanged match engine → L2/L3, profile present=%s',async present=>{
  const profile=present?{status:'complete',targetMarkets:['AR'],priceRange:'lt_100k',propertyTypes:['Single Family'],strategies:['Fix & Flip']}:null;
  const raw=await response(profile);
  for(const project of [projectMaxxisAnalysisResponse,projectMaxxisDealIntelligenceResponse]){
   const result=project(raw),model=buildStrictReportViewModel({schema:result.data.maxxisReport,language:'pt'}),fit=model.sections.find(s=>s.id==='profile-fit');
   if(present){expect(fit.gauge.value).toBe(raw.data.match.score);expect(JSON.stringify(model.sections.find(s=>s.id==='investor-profile'))).toContain('AR');}
   else {expect(fit).toBeUndefined();expect(model.sections.find(s=>s.id==='profile-criteria')).toBeUndefined();expect(JSON.stringify(model)).toContain('Perfil de investimento não configurado');}
  }
 });
});
