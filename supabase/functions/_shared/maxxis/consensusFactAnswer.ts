import type { ProjectedEvidenceField, ProjectedField } from './canonicalEvidenceProjection.ts';
import { PROJECTED_FIELDS } from './canonicalEvidenceProjection.ts';
import type { EvidenceCandidate } from '../parcel-evidence-consensus/types.ts';
type Language='pt'|'en'|'es';
const copy={
 pt:{confirmed:'As fontes disponíveis são consistentes.',provisional:'Faixa provisória apoiada por fontes independentes.',single:'Há apenas uma fonte independente; não é uma confirmação cruzada.',conflict:'Há divergência ou falta de comparabilidade entre as fontes; nenhuma medida foi escolhida como confirmada.',unavailable:'Evidência disponível insuficiente para informar este dado.',na:'Este dado não se aplica.',outlier:'Valor fora do grupo de concordância:',stale:'Esta evidência é antiga e reutilizável, não uma verificação recente.',gis:'Não há evidência parcelária pública aprovada disponível neste contexto; isso não significa que não existam registros.',survey:'GIS público é informação cadastral; não substitui levantamento topográfico.',type:'Tipo usado na análise:',publisher:'Cadastro do imóvel',rentcast:'RentCast',public:'GIS / registro público',geometry:'Área calculada da geometria',lock:'A classificação divergente do provedor não altera o tipo definido no DealSifter.'},
 en:{confirmed:'The available sources are consistent.',provisional:'Provisional range supported by independent sources.',single:'Only one independent source is available; this is not cross-source confirmation.',conflict:'Sources disagree or lack comparability; no value has been chosen as confirmed.',unavailable:'Available evidence is insufficient to report this fact.',na:'This field does not apply.',outlier:'Value outside the agreement cluster:',stale:'This is older reusable evidence, not a fresh verification.',gis:'No approved public parcel evidence is available in this context; this does not mean no records exist.',survey:'Public GIS is cadastral information, not a professional survey.',type:'Analysis property type:',publisher:'Property listing',rentcast:'RentCast',public:'Public GIS / record',geometry:'Geometry-calculated area',lock:'The differing provider classification does not change the DealSifter subject type.'},
 es:{confirmed:'Las fuentes disponibles son consistentes.',provisional:'Rango provisional respaldado por fuentes independientes.',single:'Solo hay una fuente independiente; no es confirmación cruzada.',conflict:'Las fuentes difieren o no son comparables; no se eligió un valor como confirmado.',unavailable:'La evidencia disponible es insuficiente para informar este dato.',na:'Este dato no se aplica.',outlier:'Valor fuera del grupo de concordancia:',stale:'Es evidencia antigua reutilizable, no una verificación reciente.',gis:'No hay evidencia parcelaria pública aprobada disponible en este contexto; no significa que no existan registros.',survey:'El GIS público es información catastral; no sustituye un levantamiento topográfico.',type:'Tipo usado en el análisis:',publisher:'Registro del inmueble',rentcast:'RentCast',public:'GIS / registro público',geometry:'Área calculada de la geometría',lock:'La clasificación distinta del proveedor no cambia el tipo definido en DealSifter.'},
};
const labels:Record<Language,Record<ProjectedField,string>>={
 pt:{lotArea:'Área do lote',apn:'APN',owner:'Proprietário no registro',assessedValue:'Valor fiscal avaliado',propertyTax:'Imposto predial registrado',zoning:'Zoneamento',propertyType:'Tipo do imóvel'},
 en:{lotArea:'Lot area',apn:'APN',owner:'Recorded owner',assessedValue:'Assessed value',propertyTax:'Recorded property tax',zoning:'Zoning',propertyType:'Property type'},
 es:{lotArea:'Área del lote',apn:'APN',owner:'Propietario registrado',assessedValue:'Valor fiscal evaluado',propertyTax:'Impuesto predial registrado',zoning:'Zonificación',propertyType:'Tipo de inmueble'},
};
const safe=(value:unknown)=>String(value??'').replace(/<[^>]*>/g,'').replace(/[\u0000-\u001f]/g,' ').trim();
function typeLabel(value:unknown,lang:Language){const key=safe(value).toUpperCase();return key==='LAND'?{pt:'Terreno',en:'Land',es:'Terreno'}[lang]:key==='SFR'||key==='SINGLE FAMILY'?{pt:'Residencial unifamiliar',en:'Single-family home',es:'Vivienda unifamiliar'}[lang]:safe(value);}
function valueLabel(value:number|string,field:ProjectedField,lang:Language){
 const locale=lang==='pt'?'pt-BR':lang==='es'?'es-US':'en-US';
 if(field==='lotArea'&&typeof value==='number')return `${new Intl.NumberFormat(locale,{maximumFractionDigits:4}).format(value/43560)} ac`;
 if((field==='assessedValue'||field==='propertyTax')&&typeof value==='number')return new Intl.NumberFormat(locale,{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
 if(field==='propertyType')return typeLabel(value,lang);
 if(field==='owner'&&typeof value==='string'&&value.startsWith('OWNER_SET:')){
   try{return (JSON.parse(value.slice(10)) as string[]).map(safe).join(' · ');}catch{return safe(value);}
 }
 return safe(value);
}
function sourceLabel(candidate:EvidenceCandidate,lang:Language){return candidate.sourceType==='USER_PROVIDED'?copy[lang].publisher:candidate.sourceType==='RENTCAST'?copy[lang].rentcast:candidate.sourceType==='CALCULATED_GEOMETRY'?copy[lang].geometry:copy[lang].public;}
export function formatConsensusFactAnswer(fields:Record<ProjectedField,ProjectedEvidenceField>,requested:readonly string[],language:unknown,analysisType:unknown,publicAvailable:boolean){
 const lang:Language=language==='pt'||language==='es'?language:'en',c=copy[lang];
 const names:Record<string,ProjectedField>={lotSizeSqft:'lotArea',assessorId:'apn',ownership:'owner',assessedValue:'assessedValue',annualPropertyTax:'propertyTax',zoning:'zoning',propertyType:'propertyType'};
 const selected=[...new Set(requested.map(name=>names[name]??name).filter(name=>PROJECTED_FIELDS.includes(name as ProjectedField)))] as ProjectedField[];
 return selected.map(name=>{
   const field=fields[name],lines=[`${labels[lang][name]}: ${field.value!==null?valueLabel(field.value,name,lang):field.range?`${valueLabel(field.range.min,name,lang)}–${valueLabel(field.range.max,name,lang)}`:''}`.trim()];
   const statusText={CONFIRMED:c.confirmed,PROVISIONAL:c.provisional,SINGLE_SOURCE:c.single,CONFLICTED:c.conflict,UNAVAILABLE:c.unavailable,NOT_APPLICABLE:c.na};
   lines.push(statusText[field.analyticalUsability]);
   // Keep candidate fiscal periods and provenance; no raw enums, prompt instructions or internal IDs.
   const visible=field.candidates.filter(row=>row.comparable);
   const seen=new Set<string>();
   for(const candidate of visible){
     const year=candidate.metadata?.year, text=`${sourceLabel(candidate,lang)}: ${valueLabel(candidate.normalizedValue!,name,lang)}${year?` (${year})`:''}${candidate.sourceAuthority&&candidate.sourceType!=='USER_PROVIDED'&&candidate.sourceType!=='RENTCAST'?` · ${safe(candidate.sourceAuthority)}`:''}.`;
     if(seen.has(text))continue;seen.add(text);
     lines.push(`${field.outliers.some(o=>o.candidateId===candidate.candidateId)?`${c.outlier} `:''}${text}`);
   }
   if(name==='propertyType'&&analysisType){lines.unshift(`${c.type} ${typeLabel(analysisType,lang)}.`);if(field.consensusState==='MATERIAL_CONFLICT')lines.push(c.lock);}
   if(field.sourceFreshness.some(source=>source.freshness==='STALE_USABLE'))lines.push(c.stale);
   if(!publicAvailable&&name==='lotArea')lines.push(c.gis);
   if(publicAvailable&&name==='lotArea')lines.push(c.survey);
   return lines.join('\n');
 }).join('\n\n');
}
