/** Operating evidence only. Pure, deterministic and deliberately NOT a financial calculator. */
export const FINANCIAL_DOMAINS = ['currentContractRent','otherActualIncome','providerMarketRentEstimate','investorRentAssumption',
  'propertyTax','insurance','hoa','propertyManagement','vacancy','maintenance','utilities','otherOperatingExpenses'] as const;
export type FinancialDomain = typeof FINANCIAL_DOMAINS[number];
export type FinancialClass = 'ACTUAL'|'USER_PROVIDED_ACTUAL'|'PUBLIC_RECORD'|'PROVIDER_ESTIMATE'|'BENCHMARK_ESTIMATE'|'INVESTOR_ASSUMPTION'|'CALCULATED'|'UNAVAILABLE'|'NOT_APPLICABLE';
export type FinancialCadence = 'MONTHLY'|'QUARTERLY'|'SEMIANNUAL'|'ANNUAL'|'ONE_TIME'|'UNKNOWN';
export type FinancialUsability = 'ACTUAL_CONFIRMED'|'ACTUAL_SINGLE_SOURCE'|'ESTIMATED_PROVIDER'|'ESTIMATED_BENCHMARK'|'USER_ASSUMPTION'|'CONFLICTED'|'UNAVAILABLE'|'NOT_APPLICABLE';
export type FinancialCandidate = {
  id:string; domain:FinancialDomain; value:number|null; unit:'USD'|'PERCENT'; cadence:FinancialCadence;
  evidenceClass:FinancialClass; sourceType:string; sourceId:string; sourceFamily:string; sourceAuthority:string;
  evidenceStatus:string; freshness:string; periodYear?:number|null; effectiveFrom?:string|null;
  retrievedAt?:string|null; sourceUpdatedAt?:string|null; userConfirmed?:boolean; userAccepted?:boolean;
  metadata?:{concept?:string; percentageBasis?:'SCHEDULED_RENT'|'EFFECTIVE_INCOME'; benchmarkName?:string;
    geography?:string; year?:number; method?:string; approved?:boolean; referenceCount?:number; rangeLow?:number|null; rangeHigh?:number|null;
    scope?:'PROPERTY'|'UNIT';requestFingerprint?:string;subjectProperty?:Record<string,unknown>|null};
};
export type FinancialDecision = {candidateId:string; evidenceHash:string; currentEvidenceHash:string; action:'KEEP_MY_VALUE'|'ACCEPT_EXTERNAL_VALUE'|'REVIEW_LATER'};
export type FinancialResolvedInput = {
  domain:FinancialDomain; value:number|null; unit:'USD'|'PERCENT'|null; cadence:FinancialCadence;
  annualizedValue:number|null; sourceClass:FinancialClass; source:FinancialCandidate|null;
  analyticalUsability:FinancialUsability; qualification:string[]; estimated:boolean; assumption:boolean;
  freshness:string; reasonCode:string; candidates:readonly FinancialCandidate[]; conflictPreserved:boolean;
};
export type FinancialEvidenceStack = {version:'FINANCIAL_EVIDENCE_STACK_V1'; propertyId:string;
  inputs:Record<FinancialDomain,FinancialResolvedInput>; occupancy:'OCCUPIED'|'VACANT'|'UNKNOWN'; leaseStatus:'LEASED'|'MONTH_TO_MONTH'|'VACANT'|'UNKNOWN'; providerCalls:0};
const actual = (c:FinancialCandidate) => ['ACTUAL','USER_PROVIDED_ACTUAL','PUBLIC_RECORD'].includes(c.evidenceClass);
const multiplier:Partial<Record<FinancialCadence,number>>={MONTHLY:12,QUARTERLY:4,SEMIANNUAL:2,ANNUAL:1};
export function annualizeFinancialAmount(value:number|null,cadence:FinancialCadence,unit:'USD'|'PERCENT'='USD') {
  const n=value===null||unit!=='USD'||!multiplier[cadence]?null:value*multiplier[cadence]!;
  return n!==null&&Number.isFinite(n)&&n>=0&&n*100<=Number.MAX_SAFE_INTEGER?n:null;
}
function valid(c:FinancialCandidate) {
  if(c.unit==='PERCENT'&&!['propertyManagement','vacancy','maintenance'].includes(c.domain))return false;
  if(typeof c.value!=='number'||!Number.isFinite(c.value)||c.value<0||c.value*100>Number.MAX_SAFE_INTEGER
    ||c.unit==='PERCENT'&&c.value>100||!c.sourceId||!c.sourceFamily||!c.sourceType||!c.sourceAuthority
    ||['EXPIRED_UNUSABLE','IDENTITY_MISMATCH','ABSENT','CORRUPT','UNAVAILABLE'].includes(c.freshness)
    ||['UNAVAILABLE','UNKNOWN','NOT_APPLICABLE'].includes(c.evidenceStatus))return false;
  if(c.periodYear!=null&&(!Number.isInteger(c.periodYear)||c.periodYear<1800||c.periodYear>2200))return false;
  if(c.evidenceClass==='BENCHMARK_ESTIMATE'&&!(c.metadata?.approved===true&&c.metadata.benchmarkName&&c.metadata.geography&&c.metadata.year&&c.metadata.method))return false;
  if(actual(c)&&['ESTIMATED','CALCULATED'].includes(c.evidenceStatus))return false;
  if(c.domain==='propertyTax'&&c.metadata?.concept!=='ANNUAL_RECORDED_TAX'&&actual(c))return false;
  if(c.unit==='PERCENT'&&!c.metadata?.percentageBasis)return false;
  return true;
}
/** Explicit per-domain tiers; no global actual/provider/benchmark/assumption ordering. */
function tiers(domain:FinancialDomain):FinancialClass[][] {
  switch(domain){
    case 'currentContractRent': case 'otherActualIncome': return [['ACTUAL','USER_PROVIDED_ACTUAL','PUBLIC_RECORD']];
    case 'providerMarketRentEstimate': return [['PROVIDER_ESTIMATE']];
    case 'investorRentAssumption': return [['INVESTOR_ASSUMPTION']];
    case 'propertyTax': return [['ACTUAL','USER_PROVIDED_ACTUAL','PUBLIC_RECORD'],['INVESTOR_ASSUMPTION'],['PROVIDER_ESTIMATE'],['BENCHMARK_ESTIMATE']];
    case 'hoa': return [['ACTUAL','USER_PROVIDED_ACTUAL','PUBLIC_RECORD'],['INVESTOR_ASSUMPTION']];
    case 'insurance': return [['ACTUAL','USER_PROVIDED_ACTUAL','PUBLIC_RECORD'],['INVESTOR_ASSUMPTION'],['BENCHMARK_ESTIMATE']];
    case 'vacancy': case 'maintenance': return [['ACTUAL','USER_PROVIDED_ACTUAL'],['INVESTOR_ASSUMPTION'],['BENCHMARK_ESTIMATE']];
    default: return [['ACTUAL','USER_PROVIDED_ACTUAL'],['INVESTOR_ASSUMPTION']];
  }
}
const equivalent=(a:FinancialCandidate,b:FinancialCandidate) => a.unit===b.unit&&a.periodYear===b.periodYear&&(
  a.cadence===b.cadence&&a.value===b.value||a.unit==='USD'&&annualizeFinancialAmount(a.value,a.cadence)!==null
  &&annualizeFinancialAmount(a.value,a.cadence)===annualizeFinancialAmount(b.value,b.cadence));
export function resolveFinancialEvidence(domain:FinancialDomain,context:{candidates:readonly FinancialCandidate[];decision?:FinancialDecision|null;unresolvedConflict?:boolean;notApplicable?:boolean}):FinancialResolvedInput {
  const candidates=structuredClone(context.candidates.filter(c=>c.domain===domain));
  const empty=(usability:FinancialUsability,reasonCode:string):FinancialResolvedInput=>({domain,value:null,unit:null,cadence:'UNKNOWN',annualizedValue:null,
    sourceClass:usability==='NOT_APPLICABLE'?'NOT_APPLICABLE':'UNAVAILABLE',source:null,analyticalUsability:usability,
    qualification:[],estimated:false,assumption:false,freshness:'UNAVAILABLE',reasonCode,candidates,conflictPreserved:usability==='CONFLICTED'});
  if(context.notApplicable)return empty('NOT_APPLICABLE','NOT_APPLICABLE');
  const eligible=candidates.filter(valid);
  const selectedTier=tiers(domain).map(tier=>eligible.filter(c=>tier.includes(c.evidenceClass))).find(rows=>rows.length)??[];
  const conflict=context.unresolvedConflict===true||selectedTier.some(c=>!equivalent(c,selectedTier[0]));
  const decision=context.decision;
  const chosen=decision&&decision.action!=='REVIEW_LATER'&&decision.evidenceHash&&decision.evidenceHash===decision.currentEvidenceHash
    ? selectedTier.find(c=>c.id===decision.candidateId):null;
  if(conflict&&!chosen)return empty('CONFLICTED',domain==='propertyTax'?'TAX_CONFLICT':'FINANCIAL_EVIDENCE_CONFLICT');
  const source=chosen??selectedTier[0];
  if(!source)return empty('UNAVAILABLE','EVIDENCE_UNAVAILABLE');
  const estimated=['PROVIDER_ESTIMATE','BENCHMARK_ESTIMATE'].includes(source.evidenceClass),assumption=source.evidenceClass==='INVESTOR_ASSUMPTION';
  // Agreement from aliases of one provider is never independent confirmation.
  const confirmed=!conflict&&selectedTier.every(c=>equivalent(c,source))&&new Set(selectedTier.map(c=>c.sourceFamily)).size>=2;
  const usability:FinancialUsability=estimated?(source.evidenceClass==='PROVIDER_ESTIMATE'?'ESTIMATED_PROVIDER':'ESTIMATED_BENCHMARK')
    :assumption?'USER_ASSUMPTION':confirmed?'ACTUAL_CONFIRMED':'ACTUAL_SINGLE_SOURCE';
  return {domain,value:source.value,unit:source.unit,cadence:source.cadence,annualizedValue:annualizeFinancialAmount(source.value,source.cadence,source.unit),
    sourceClass:source.evidenceClass,source,analyticalUsability:usability,estimated,assumption,freshness:source.freshness,
    reasonCode:estimated?'ESTIMATE_ONLY':assumption?'EXPLICIT_ASSUMPTION':domain==='propertyTax'?'ACTUAL_TAX_AVAILABLE':'ACTUAL_EVIDENCE_AVAILABLE',
    qualification:[...(source.cadence==='UNKNOWN'?['CADENCE_UNKNOWN']:[]),...(source.cadence==='ONE_TIME'?['NON_RECURRING']:[]),
      ...(source.freshness==='STALE_USABLE'?['STALE_EVIDENCE']:[]),...(source.freshness==='UNKNOWN'?['FRESHNESS_UNKNOWN']:[]),
      ...(chosen?['EXPLICIT_RECONCILIATION_CHOICE']:[])],candidates,conflictPreserved:conflict};
}
export function buildFinancialEvidenceStack(context:{propertyId:string;candidates:readonly FinancialCandidate[];decisions?:Partial<Record<FinancialDomain,FinancialDecision>>;conflicts?:FinancialDomain[];occupancy?:FinancialEvidenceStack['occupancy'];leaseStatus?:FinancialEvidenceStack['leaseStatus']}) : FinancialEvidenceStack {
  return {version:'FINANCIAL_EVIDENCE_STACK_V1',propertyId:context.propertyId,
    inputs:Object.fromEntries(FINANCIAL_DOMAINS.map(domain=>[domain,resolveFinancialEvidence(domain,{candidates:context.candidates,decision:context.decisions?.[domain],unresolvedConflict:context.conflicts?.includes(domain)})])) as FinancialEvidenceStack['inputs'],
    occupancy:context.occupancy??'UNKNOWN',leaseStatus:context.leaseStatus??'UNKNOWN',providerCalls:0};
}
