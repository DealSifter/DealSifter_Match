import type {FinancialResolvedInput} from './financialEvidence.ts';
export function formatFinancialEvidenceSource(input:FinancialResolvedInput,language:string){
  const lang=language==='pt'?'pt':language==='es'?'es':'en';
  const copy={pt:{user:'Informado por você',publisher:'Informado pelo publicador',provider:'Registro do provedor',public:'Registro público',estimate:'Estimativa de mercado',assumption:'Premissa privada do investidor',single:'fonte única, sem confirmação independente',confirmed:'confirmado por fontes independentes',notActual:'não é aluguel contratual atual',stale:'evidência antiga',unknown:'atualidade não confirmada'},
    en:{user:'Provided by you',publisher:'Provided by the publisher',provider:'Provider record',public:'Public record',estimate:'Market estimate',assumption:'Private investor assumption',single:'single source, without independent confirmation',confirmed:'confirmed across independent sources',notActual:'not current contract rent',stale:'older evidence',unknown:'freshness not confirmed'},
    es:{user:'Informado por usted',publisher:'Informado por el publicador',provider:'Registro del proveedor',public:'Registro público',estimate:'Estimación de mercado',assumption:'Supuesto privado del inversor',single:'fuente única, sin confirmación independiente',confirmed:'confirmado por fuentes independientes',notActual:'no es el alquiler contractual actual',stale:'evidencia antigua',unknown:'actualidad no confirmada'}}[lang];
  const source=input.source;
  if(!source)return '';
  const provider=source.sourceType==='RENTCAST';
  const user=source.sourceType==='USER_PROVIDED'&&!provider;
  const authority=provider?'RentCast':!user&&!/^[A-Z0-9_:]+$/.test(source.sourceAuthority)?source.sourceAuthority:'';
  const label=input.assumption?copy.assumption:input.estimated?copy.estimate:provider?copy.provider:user?(source.sourceFamily==='CURRENT_INVESTOR'?copy.user:copy.publisher):copy.public;
  return [label,authority,source.periodYear??'',input.analyticalUsability==='ACTUAL_CONFIRMED'?copy.confirmed:!input.estimated&&!input.assumption?copy.single:'',
    input.domain==='providerMarketRentEstimate'?copy.notActual:'',input.freshness==='STALE_USABLE'?copy.stale:input.freshness==='UNKNOWN'?copy.unknown:''].filter(v=>v!=='').join(' · ');
}
