import {buildFinancialInputReadiness,type FinancialMetric} from './financialReadiness.ts';
import type {FinancialDomain,FinancialEvidenceStack,FinancialResolvedInput} from './financialEvidence.ts';
type Language='pt'|'en'|'es';
export type FinancialQuestion={domain?:FinancialDomain;metric?:FinancialMetric;listMissing?:boolean};
export function detectFinancialEvidenceQuestion(message:unknown):FinancialQuestion|null {
  const text=String(message??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/\b(?:report|relatorio|pdf|export|reporte|informe|salvar|save|guardar|alterar|change|mude|assuma|assume|simule|simulate|simulacao|scenario|cenario|escenario)\b/.test(text)||/\b(?:what if|e se|y si)\b/.test(text))return null;
  // Numeric declarations belong to the existing user-input/gap workflow, not a read-only lookup.
  if(/\d/.test(text)&&!/[?¿]/.test(text)&&!/^\s*(?:qual|quanto|what|how|cual|cuanto|is|does|can|tem)\b/.test(text))return null;
  if(/\b(?:what is|o que e|que es)\b/.test(text)&&!/(?:deste|desse|this property|esta propiedad|imovel)/.test(text))return null;
  const metric=/\bnoi\b/.test(text)?'NOI':/\bcap rate\b/.test(text)?'CAP_RATE':/\bdscr\b/.test(text)?'DSCR':/\b(?:coc|cash on cash)\b/.test(text)?'COC':/\broi\b/.test(text)?'ROI':/\b(?:cash flow|fluxo de caixa|flujo de caja)\b/.test(text)?'CASH_FLOW':null;
  if(metric){
    // Readiness questions only. Existing stored/calculated metric lookups keep their legacy route.
    if(!/\b(?:falta|faltam|missing|need|ready|readiness|pronto|prontidao|can|calcular|calculate|calculo|calculation|posso|podemos|puede|podemos|listo)\b/.test(text))return null;
    return {metric,listMissing:/\b(?:falta|faltam|missing|what.*need|que falta)\b/.test(text)};
  }
  if(/\b(?:aluguel|rent|renta|alquiler)\b/.test(text))return {domain:/\b(?:mercado|market|estimad[oa]|estimate)\b/.test(text)?'providerMarketRentEstimate':/\b(?:premissa|assumption|supuesto|investidor|investor)\b/.test(text)?'investorRentAssumption':'currentContractRent'};
  if(/\b(?:property tax|annual tax|imposto predial|imposto anual|impuesto predial)\b/.test(text))return {domain:'propertyTax'};
  if(/\b(?:hoa|poa|condominio|asociacion)\b/.test(text))return {domain:'hoa'};
  return null;
}
const LABELS:Record<Language,Record<FinancialDomain,string>>={
  pt:{currentContractRent:'Aluguel contratual atual',otherActualIncome:'Outras receitas efetivas',providerMarketRentEstimate:'Aluguel de mercado estimado',investorRentAssumption:'Premissa de aluguel',propertyTax:'Imposto predial',insurance:'Seguro',hoa:'HOA / associação',propertyManagement:'Administração',vacancy:'Vacância',maintenance:'Manutenção / reserva',utilities:'Serviços pagos pelo proprietário',otherOperatingExpenses:'Outras despesas operacionais'},
  en:{currentContractRent:'Current contract rent',otherActualIncome:'Other actual income',providerMarketRentEstimate:'Estimated market rent',investorRentAssumption:'Investor rent assumption',propertyTax:'Property tax',insurance:'Insurance',hoa:'HOA / association',propertyManagement:'Management',vacancy:'Vacancy',maintenance:'Maintenance / reserve',utilities:'Owner-paid utilities',otherOperatingExpenses:'Other operating expenses'},
  es:{currentContractRent:'Alquiler contractual actual',otherActualIncome:'Otros ingresos reales',providerMarketRentEstimate:'Alquiler de mercado estimado',investorRentAssumption:'Supuesto de alquiler',propertyTax:'Impuesto predial',insurance:'Seguro',hoa:'HOA / asociación',propertyManagement:'Administración',vacancy:'Vacancia',maintenance:'Mantenimiento / reserva',utilities:'Servicios pagados por el propietario',otherOperatingExpenses:'Otros gastos operativos'},
};
const COPY={
  pt:{missing:'Não disponível nas evidências autorizadas.',conflict:'As fontes divergem; não escolhi um valor automaticamente.',actual:'registro / dado declarado, sem confirmação independente',confirmed:'registros concordantes',estimate:'estimativa, não valor contratual ou despesa efetiva',assumption:'premissa privada do investidor, não fato do imóvel',stale:'evidência antiga mantida para referência',unknownFreshness:'atualidade não confirmada',cadence:'frequência não informada; não foi anualizado',oneTime:'despesa pontual, fora das despesas recorrentes',currentMissing:'Não tenho um aluguel contratual atual confirmado.',notApplicable:'A avaliação operacional de aluguel não se aplica à estratégia atual.',incomplete:'Ainda não há dados suficientes para calcular com confiabilidade.',blocked:'Há divergências pendentes nas evidências.',ready:'Os dados operacionais estão disponíveis, com as qualificações indicadas. As fórmulas financeiras ainda não foram migradas nesta fase.',next:'Próximo dado prioritário',missingList:'Faltam',scenario:'Há aluguel de mercado estimado, mas ele não substitui o aluguel contratual.',future:'Esta métrica também depende de entradas específicas ainda não avaliadas (valor-base, financiamento ou definição do retorno).',choice:'escolha explícita no cadastro; a divergência histórica foi preservada'},
  en:{missing:'Unavailable in authorized evidence.',conflict:'Sources disagree; no value was chosen automatically.',actual:'record / declared input, without independent confirmation',confirmed:'agreeing records',estimate:'estimate, not contractual rent or actual expense',assumption:'private investor assumption, not a property fact',stale:'retained older evidence',unknownFreshness:'freshness not confirmed',cadence:'frequency unknown; not annualized',oneTime:'one-time expense, excluded from recurring expenses',currentMissing:'I do not have confirmed current contract rent.',notApplicable:'Rental operating readiness does not apply to the current strategy.',incomplete:'There are not enough inputs for a reliable calculation yet.',blocked:'There are unresolved evidence conflicts.',ready:'Operating inputs are available with the stated qualifications. Financial formulas have not been migrated in this phase.',next:'Next priority input',missingList:'Missing',scenario:'An estimated market rent is available, but it does not replace contract rent.',future:'This metric also needs specific inputs not evaluated yet (value basis, financing or return definition).',choice:'explicit choice in the property record; historical disagreement preserved'},
  es:{missing:'No disponible en las evidencias autorizadas.',conflict:'Las fuentes difieren; no elegí un valor automáticamente.',actual:'registro / dato declarado, sin confirmación independiente',confirmed:'registros concordantes',estimate:'estimación, no alquiler contractual ni gasto real',assumption:'supuesto privado del inversor, no dato del inmueble',stale:'evidencia antigua conservada como referencia',unknownFreshness:'actualidad no confirmada',cadence:'frecuencia desconocida; no se anualizó',oneTime:'gasto puntual, excluido de los gastos recurrentes',currentMissing:'No tengo un alquiler contractual actual confirmado.',notApplicable:'La evaluación operativa de alquiler no se aplica a la estrategia actual.',incomplete:'Aún faltan datos para calcular con fiabilidad.',blocked:'Hay divergencias pendientes en las evidencias.',ready:'Los datos operativos están disponibles con sus calificaciones. Las fórmulas financieras no se migraron en esta fase.',next:'Próximo dato prioritario',missingList:'Faltan',scenario:'Existe alquiler de mercado estimado, pero no sustituye el alquiler contractual.',future:'Esta métrica requiere datos específicos aún no evaluados (base de valor, financiación o definición de retorno).',choice:'elección explícita en el registro; se conserva la divergencia histórica'},
};
const FUTURE_INPUTS={
  pt:{CAP_RATE:'É necessária uma base de valor explícita: preço pedido, preço de aquisição ou valor de mercado. Não exige financiamento.',CASH_FLOW:'Serviço da dívida e efeitos financeiros recorrentes ainda não foram avaliados.',COC:'Fluxo de caixa anual antes de impostos e capital investido ainda não foram avaliados.',DSCR:'O serviço da dívida ainda não foi avaliado.',ROI:'É preciso definir o tipo de retorno e seus dados específicos.'},
  en:{CAP_RATE:'An explicit value basis is required: asking price, acquisition price or market value. Financing is not required.',CASH_FLOW:'Debt service and recurring financing effects have not been evaluated yet.',COC:'Annual pre-tax cash flow and cash invested have not been evaluated yet.',DSCR:'Debt service has not been evaluated yet.',ROI:'The return definition and its specific inputs must be established.'},
  es:{CAP_RATE:'Se requiere una base de valor explícita: precio pedido, de adquisición o valor de mercado. No requiere financiación.',CASH_FLOW:'El servicio de deuda y los efectos financieros recurrentes aún no se evaluaron.',COC:'El flujo de caja anual antes de impuestos y el capital invertido aún no se evaluaron.',DSCR:'El servicio de deuda aún no se evaluó.',ROI:'Se debe definir el tipo de retorno y sus datos específicos.'},
};
function describe(input:FinancialResolvedInput,lang:Language){
  const t=COPY[lang],label=LABELS[lang][input.domain];
  if(input.analyticalUsability==='CONFLICTED')return `${label}: ${t.conflict}`;
  if(input.value===null)return `${label}: ${t.missing}`;
  const amount=input.unit==='PERCENT'?`${input.value}%`:new Intl.NumberFormat(lang==='pt'?'pt-BR':lang==='es'?'es-US':'en-US',{style:'currency',currency:'USD'}).format(input.value);
  const cadenceLabels={pt:{MONTHLY:'mês',QUARTERLY:'trimestre',SEMIANNUAL:'semestre',ANNUAL:'ano',ONE_TIME:'pontual',UNKNOWN:''},en:{MONTHLY:'month',QUARTERLY:'quarter',SEMIANNUAL:'half-year',ANNUAL:'year',ONE_TIME:'one-time',UNKNOWN:''},es:{MONTHLY:'mes',QUARTERLY:'trimestre',SEMIANNUAL:'semestre',ANNUAL:'año',ONE_TIME:'puntual',UNKNOWN:''}};
  const declared={pt:'Declarado pelo publicador',en:'Publisher declaration',es:'Declarado por el publicador'};
  const privateSource={pt:'Premissa privada',en:'Private assumption',es:'Supuesto privado'};
  const publicSource={pt:'Registro público',en:'Public record',es:'Registro público'};
  const authority=input.source?.sourceAuthority??'';
  const sourceLabel=input.source?.sourceType==='USER_PROVIDED'?(input.assumption?privateSource[lang]:declared[lang])
    :input.source?.sourceType==='RENTCAST'?'RentCast':/^[A-Z0-9_:]+$/.test(authority)?publicSource[lang]:authority;
  const notes=[input.estimated?t.estimate:input.assumption?t.assumption:input.analyticalUsability==='ACTUAL_CONFIRMED'?t.confirmed:t.actual,
    sourceLabel,input.source?.periodYear?String(input.source.periodYear):'',
    ...(input.qualification.includes('STALE_EVIDENCE')?[t.stale]:[]),...(input.freshness==='UNKNOWN'?[t.unknownFreshness]:[]),
    ...(input.cadence==='UNKNOWN'?[t.cadence]:[]),...(input.cadence==='ONE_TIME'?[t.oneTime]:[]),
    ...(input.conflictPreserved?[t.choice]:[])].filter(Boolean);
  return `${label}: ${amount}${cadenceLabels[lang][input.cadence]?` / ${cadenceLabels[lang][input.cadence]}`:''}. ${notes.join(' · ')}.`;
}
export function buildFinancialEvidenceAnswer(question:FinancialQuestion,stack:FinancialEvidenceStack,language:string,context:Parameters<typeof buildFinancialInputReadiness>[1]={}){
  const lang:Language=language==='pt'?'pt':language==='es'?'es':'en',t=COPY[lang];
  if(question.domain){
    const input=stack.inputs[question.domain];
    const text=question.domain==='currentContractRent'&&input.value===null&&input.analyticalUsability!=='CONFLICTED'
      ?`${t.currentMissing}${stack.inputs.providerMarketRentEstimate.value!==null?` ${describe(stack.inputs.providerMarketRentEstimate,lang)}`:''}`:describe(input,lang);
    return {answer:text,readiness:null,input};
  }
  const metric=question.metric??'NOI';
  const readiness=buildFinancialInputReadiness(stack,{...context,explicitRentalQuestion:metric!=='ROI'||context.explicitRentalQuestion===true});
  const evaluation=readiness.metrics[metric],level=evaluation.readinessLevel;
  const metricLabel=metric==='CAP_RATE'?'Cap Rate':metric==='CASH_FLOW'?(lang==='pt'?'Fluxo de caixa':lang==='es'?'Flujo de caja':'Cash flow'):metric==='COC'?'CoC':metric;
  const gap=metric==='ROI'?null:readiness.nextGap,missing=metric==='ROI'?[]:readiness.missingCritical;
  const reasons=question.listMissing&&missing.length?`${t.missingList}: ${missing.map(d=>LABELS[lang][d]).join(', ')}.`:'';
  const text=[`${metricLabel}: ${level==='BLOCKED_CONFLICT'?t.blocked:level==='INCOMPLETE'?t.incomplete:level==='NOT_APPLICABLE'?t.notApplicable:t.ready}`,
    readiness.estimatedInputs.length?readiness.estimatedInputs.map(d=>describe(stack.inputs[d],lang)).join('\n'):'',
    stack.inputs.currentContractRent.value===null&&stack.inputs.providerMarketRentEstimate.value!==null?t.scenario:'',reasons,
    ...(readiness.assumedInputs.length?[readiness.assumedInputs.map(d=>describe(stack.inputs[d],lang)).join('\n')]:[]),
    metric!=='NOI'?FUTURE_INPUTS[lang][metric]:'',gap?`${t.next}: ${LABELS[lang][gap]}.`:''].filter(Boolean).join('\n\n');
  return {answer:text,readiness,input:null};
}
