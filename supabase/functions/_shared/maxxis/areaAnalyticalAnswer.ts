import { calculateAreaMetrics, type AreaPriceMetric } from './areaMetrics.ts';
import { resolveAnalyticalPropertyFact, type AnalyticalPropertyInputs } from './analyticalPropertyFacts.ts';
import { SQFT_PER_ACRE } from './propertyAreaUnits.ts';

export function detectAreaAnalyticalQuestion(message:unknown) {
  const text=String(message??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if (/\b(?:report|relatorio|pdf|exportar|reporte|informe)\b/.test(text)) return null;
  if (!/\b(?:price|preco|precio|paying|pagando|pago|cost|custo|cuesta|valor)\b/.test(text) || !/(?:acre|sqft|sq\.\s*ft|square\s+f(?:oot|eet)|pe[s]?\s+quadrad|pie[s]?\s+cuadrad)/.test(text)) return null;
  if (/acre/.test(text)) return 'pricePerAcre' as const;
  if (/lote|lot\b|terreno|land\b|parcel/.test(text)) return 'pricePerLotSqft' as const;
  if (/living|building|construid|area util|habitavel|habitable|residen/.test(text)) return 'pricePerLivingSqft' as const;
  return 'pricePerSqft' as const;
}

export function buildAreaAnalyticalAnswer(message:unknown,context:AnalyticalPropertyInputs,language='en') {
  const intent=detectAreaAnalyticalQuestion(message);if(!intent)return null;
  const land=resolveAnalyticalPropertyFact(context.fields.LIVING_AREA??{domain:'LIVING_AREA'}).inputResolution==='NOT_APPLICABLE';
  const key=intent==='pricePerSqft'?(land?'pricePerLotSqft':'pricePerLivingSqft'):intent;
  const metric=calculateAreaMetrics(context)[key];
  return {answer:formatAreaPriceMetric(metric,key,language),metric,key,reviewField:key==='pricePerLivingSqft'?'buildingArea':'lotArea',providerCalls:0,arithmeticSource:'DETERMINISTIC_AREA_ENGINE' as const};
}

export function formatAreaPriceMetric(metric:AreaPriceMetric,key:'pricePerAcre'|'pricePerLotSqft'|'pricePerLivingSqft',language='en') {
  const t=(pt:string,en:string,es:string)=>language.startsWith('pt')?pt:language.startsWith('es')?es:en;
  const locale=language.startsWith('pt')?'pt-BR':language.startsWith('es')?'es-US':'en-US';
  const money=(value:number)=>new Intl.NumberFormat(locale,{style:'currency',currency:'USD',maximumFractionDigits:2}).format(value);
  const area=(value:number)=>new Intl.NumberFormat(locale,{maximumFractionDigits:4}).format(key==='pricePerAcre'?value/SQFT_PER_ACRE:value);
  const unit=key==='pricePerAcre'?'acre':key==='pricePerLotSqft'?t('sqft do lote','lot sqft','sqft del lote'):t('sqft de área útil','living sqft','sqft habitable');
  let answer:string;
  if(metric.inputResolution==='NOT_APPLICABLE')answer=t('Esta métrica de área útil não se aplica ao imóvel atual.','This living-area metric does not apply to the current property.','Esta métrica de área habitable no se aplica al inmueble actual.');
  else if(metric.reasonCode==='PRICE_INPUT_UNAVAILABLE')answer=t('O preço pedido atual não está disponível para este cálculo. Valor fiscal e AVM não substituem o preço pedido.','The current asking price is unavailable for this calculation. Assessed value and AVM do not replace asking price.','El precio pedido actual no está disponible para este cálculo. El valor fiscal y el AVM no sustituyen el precio pedido.');
  else if(metric.inputResolution==='BLOCK_CONFLICT')answer=t('Ainda não há uma área definida para análise porque as fontes divergem. Revise os dados do imóvel antes de calcular.','An analytical area is not yet resolved because sources disagree. Review the property facts before calculating.','Aún no hay un área definida para analizar porque las fuentes divergen. Revise los datos del inmueble antes de calcular.');
  else if(!metric.calculable)answer=t('Não há uma área válida disponível para este cálculo. Não substituí o dado ausente por zero.','A valid area is unavailable for this calculation. Missing data was not replaced with zero.','No hay un área válida para este cálculo. El dato ausente no se sustituyó por cero.');
  else {
    const value=metric.range?`${money(metric.range.min)}–${money(metric.range.max)}`:money(metric.value!);
    const input=metric.inputFact;
    const source=input.inputSource.sourceType==='RENTCAST'?'RentCast':input.inputSource.sourceType==='USER_PROVIDED'?t('cadastro','listing','registro'):t('GIS/registro público','public GIS/record','GIS/registro público');
    const areaText=`${input.range?`${area(input.range.min)}–${area(input.range.max)}`:area(input.value!)} ${key==='pricePerAcre'?'ac':'sqft'}`;
    const qualification=metric.provisional?t(`intervalo provisório de área ${areaText}; sem escolher um ponto médio`,`provisional area range ${areaText}; no midpoint selected`,`intervalo provisional de área ${areaText}; sin elegir un punto medio`)
      :input.userAccepted?t(`usando a área ${areaText} aceita no cadastro a partir de ${source}; a divergência original permanece registrada`,`using area ${areaText} accepted from ${source}; the original disagreement remains recorded`,`usando el área ${areaText} aceptada de ${source}; la divergencia original se conserva`)
      :input.userConfirmed?t(`usando a área ${areaText} confirmada no cadastro; não é confirmação independente entre fontes`,`using area ${areaText} confirmed in the listing; not independent cross-source confirmation`,`usando el área ${areaText} confirmada en el registro; no es confirmación independiente entre fuentes`)
      :input.inputResolution==='ALLOW_CONFIRMED'?t('área consistente entre fontes','area consistent across sources','área consistente entre fuentes')
      :t(`área ${areaText}, fonte ${source}, sem confirmação independente`,`area ${areaText}, source ${source}, without independent confirmation`,`área ${areaText}, fuente ${source}, sin confirmación independiente`);
    answer=`${t('Preço pedido por','Asking price per','Precio pedido por')} ${unit}: ${value}. ${qualification}.`;
    if(input.qualification.includes('STALE_USABLE_INPUT'))answer+=` ${t('Evidência antiga ainda utilizável; cálculo qualificado.','Stale but usable evidence; qualified calculation.','Evidencia antigua aún utilizable; cálculo calificado.')}`;
  }
  return answer;
}
