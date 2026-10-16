import type { FinancialDomain, FinancialEvidenceStack, FinancialResolvedInput } from './financialEvidence.ts';
export type FinancialReadinessLevel='READY_ACTUAL'|'READY_MIXED'|'READY_ASSUMPTION_HEAVY'|'INCOMPLETE'|'BLOCKED_CONFLICT'|'NOT_APPLICABLE';
export type FinancialMetric='NOI'|'CAP_RATE'|'CASH_FLOW'|'COC'|'DSCR'|'ROI';
export const OPERATING_EXPENSE_DOMAINS:FinancialDomain[]=['propertyTax','insurance','hoa','vacancy','propertyManagement','maintenance','utilities','otherOperatingExpenses'];
export const FINANCIAL_METRIC_POLICY={NOI:['operatingIncome','recurringOperatingExpenses'],CAP_RATE:['NOI','explicitValueBasis'],
  CASH_FLOW:['NOI','debtService','recurringFinancingEffects'],COC:['annualPreTaxCashFlow','cashInvested'],DSCR:['NOI','debtService'],ROI:['explicitROIDefinition','definitionSpecificInputs']} as const;
const MISSING:Partial<Record<FinancialDomain,string>>={currentContractRent:'ACTUAL_RENT_MISSING',propertyTax:'PROPERTY_TAX_MISSING',insurance:'INSURANCE_MISSING',hoa:'HOA_MISSING',vacancy:'VACANCY_ASSUMPTION_MISSING',propertyManagement:'MANAGEMENT_ASSUMPTION_MISSING',maintenance:'MAINTENANCE_ASSUMPTION_MISSING',utilities:'UTILITIES_UNKNOWN'};
export function financialInputUsable(input:FinancialResolvedInput){
  return input.value!==null&&!['CONFLICTED','UNAVAILABLE','NOT_APPLICABLE'].includes(input.analyticalUsability)
    &&(input.annualizedValue!==null||input.unit==='PERCENT'&&!!input.source?.metadata?.percentageBasis&&input.cadence!=='ONE_TIME'&&input.cadence!=='UNKNOWN');
}
export function buildFinancialInputReadiness(stack:FinancialEvidenceStack,context:{propertyType?:string;strategy?:string;explicitRentalQuestion?:boolean;incomeBasis?:'CURRENT_ACTUAL'|'MARKET_SCENARIO'|'INVESTOR_SCENARIO';valueBasis?:{kind:'ASKING_PRICE'|'ACQUISITION_PRICE'|'MARKET_VALUE';value:number}}={}){
  const strategy=String(context.strategy??'').toUpperCase().replace(/[^A-Z]/g,'');
  const applicable=context.explicitRentalQuestion===true||['BUYANDHOLD','BUYHOLD','RENT','RENTAL','INCOME','ALUGAR','LOCACAO'].includes(strategy);
  const basis=context.incomeBasis??'CURRENT_ACTUAL';
  const incomeDomain:FinancialDomain=basis==='MARKET_SCENARIO'?'providerMarketRentEstimate':basis==='INVESTOR_SCENARIO'?'investorRentAssumption':'currentContractRent';
  const knownOtherIncome=!['UNAVAILABLE','NOT_APPLICABLE'].includes(stack.inputs.otherActualIncome.analyticalUsability);
  const required=[incomeDomain,...(knownOtherIncome?['otherActualIncome' as FinancialDomain]:[]),...OPERATING_EXPENSE_DOMAINS],inputs=required.map(domain=>stack.inputs[domain]);
  const conflicts=applicable?inputs.filter(i=>i.analyticalUsability==='CONFLICTED').map(i=>i.domain):[];
  const missing=applicable?inputs.filter(i=>!financialInputUsable(i)&&i.analyticalUsability!=='CONFLICTED').map(i=>i.domain):[];
  const estimated=Object.values(stack.inputs).filter(i=>i.estimated).map(i=>i.domain),assumed=Object.values(stack.inputs).filter(i=>i.assumption).map(i=>i.domain);
  const requiredEstimated=inputs.filter(i=>i.estimated),requiredAssumed=inputs.filter(i=>i.assumption);
  // Actual NOI requires a contractual income basis; estimates are only scenario inputs.
  const actualIncomeMissing=basis==='CURRENT_ACTUAL'&&!['ACTUAL_CONFIRMED','ACTUAL_SINGLE_SOURCE'].includes(stack.inputs.currentContractRent.analyticalUsability);
  if(applicable&&actualIncomeMissing&&!missing.includes('currentContractRent')&&!conflicts.includes('currentContractRent'))missing.unshift('currentContractRent');
  const level:FinancialReadinessLevel=!applicable?'NOT_APPLICABLE':conflicts.length?'BLOCKED_CONFLICT':missing.length?'INCOMPLETE'
    :requiredAssumed.length>inputs.length/2?'READY_ASSUMPTION_HEAVY':requiredAssumed.length||requiredEstimated.length?'READY_MIXED':'READY_ACTUAL';
  const expenseInputs=OPERATING_EXPENSE_DOMAINS.map(domain=>stack.inputs[domain]), incomeReady=financialInputUsable(stack.inputs[incomeDomain]);
  const reasonCodes=applicable?[...missing.map(d=>MISSING[d]??'REQUIRED_INPUT_MISSING'),...conflicts.map(d=>d==='propertyTax'?'TAX_CONFLICT':'FINANCIAL_EVIDENCE_CONFLICT'),
    ...(stack.inputs.providerMarketRentEstimate.value!==null?['MARKET_RENT_ESTIMATE_AVAILABLE']:[]),...estimated.map(()=> 'ESTIMATE_ONLY'),...assumed.map(()=> 'EXPLICIT_ASSUMPTION')]:['RENTAL_READINESS_NOT_APPLICABLE'];
  const valueBasisValid=context.valueBasis&&['ASKING_PRICE','ACQUISITION_PRICE','MARKET_VALUE'].includes(context.valueBasis.kind)
    &&Number.isFinite(context.valueBasis.value)&&context.valueBasis.value>0&&context.valueBasis.value<=Number.MAX_SAFE_INTEGER;
  const metrics=Object.fromEntries((Object.keys(FINANCIAL_METRIC_POLICY) as FinancialMetric[]).map(metric=>{
    const future=metric==='NOI'?[]:metric==='CAP_RATE'?(valueBasisValid?[]:['explicitValueBasis']):metric==='ROI'?['explicitROIDefinition','definitionSpecificInputs']:[...FINANCIAL_METRIC_POLICY[metric].filter(key=>key!=='NOI')];
    // ROI is definition-specific (including sell/flip), not automatically rental NOI.
    const readinessLevel=metric==='ROI'?'INCOMPLETE':level==='NOT_APPLICABLE'||level==='BLOCKED_CONFLICT'?level:level==='INCOMPLETE'||future.length?'INCOMPLETE':level;
    return [metric,{readinessLevel,missingCritical:metric==='ROI'?future:[...missing,...future],conflictedInputs:metric==='ROI'?[]:conflicts,policy:FINANCIAL_METRIC_POLICY[metric],calculationMigrated:false}];
  }));
  return {version:'FINANCIAL_INPUT_READINESS_V1',propertyId:stack.propertyId,incomeBasis:basis,readinessLevel:level,
    income:{status:!applicable?'NOT_APPLICABLE':incomeReady?'AVAILABLE':'INCOMPLETE',inputs:[incomeDomain,...(knownOtherIncome?['otherActualIncome']:[])]},
    operatingExpenses:{status:!applicable?'NOT_APPLICABLE':expenseInputs.some(i=>i.analyticalUsability==='CONFLICTED')?'BLOCKED_CONFLICT':expenseInputs.every(financialInputUsable)?'AVAILABLE':'INCOMPLETE',inputs:OPERATING_EXPENSE_DOMAINS},
    financing:{status:'NOT_EVALUATED',inputs:[]},missingCritical:missing,missingOptional:applicable&&stack.inputs.otherActualIncome.value===null?['otherActualIncome']:[],
    estimatedInputs:estimated,assumedInputs:assumed,conflictedInputs:conflicts,reasonCodes,nextGap:applicable?(conflicts[0]??missing[0]??null):null,metrics};
}
