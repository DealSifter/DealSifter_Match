import { resolveAnalyticalInputs, type AnalyticalPropertyInputs, type ResolvedAnalyticalFact } from './analyticalPropertyFacts.ts';
import { SQFT_PER_ACRE } from './propertyAreaUnits.ts';
import { calculateDealMetrics } from './dealMetrics.ts';

export type AreaPriceMetric = Readonly<{value:number|null;range:{min:number;max:number}|null;calculable:boolean;provisional:boolean;
  unit:'USD_PER_ACRE'|'USD_PER_LOT_SQFT'|'USD_PER_LIVING_SQFT';inputResolution:ResolvedAnalyticalFact['inputResolution'];
  inputFact:ResolvedAnalyticalFact;priceInput:ResolvedAnalyticalFact;inputSource:ResolvedAnalyticalFact['inputSource'];
  qualification:readonly string[];reasonCode:string}>;

function divide(price:ResolvedAnalyticalFact,area:ResolvedAnalyticalFact,unit:AreaPriceMetric['unit']):AreaPriceMetric {
  const factor=unit==='USD_PER_ACRE'?SQFT_PER_ACRE:1;
  let value:number|null=null,range:{min:number;max:number}|null=null;
  let reasonCode=area.reasonCode,inputResolution=area.inputResolution;
  if (price.value===null || !['ALLOW_CONFIRMED','ALLOW_QUALIFIED'].includes(price.inputResolution)) {
    reasonCode='PRICE_INPUT_UNAVAILABLE';inputResolution='BLOCK_UNAVAILABLE';
  } else if (['ALLOW_CONFIRMED','ALLOW_QUALIFIED'].includes(area.inputResolution)&&area.value!==null) {
    value=price.value/(area.value/factor);
  } else if (area.inputResolution==='ALLOW_RANGE'&&area.range) {
    range={min:price.value/(area.range.max/factor),max:price.value/(area.range.min/factor)};
  }
  const safe=(number:number)=>Number.isFinite(number)&&number>=0&&number<=Number.MAX_SAFE_INTEGER;
  if (value!==null&&!safe(value) || range&&(!safe(range.min)||!safe(range.max)||range.min>range.max)) {
    value=null;range=null;inputResolution='BLOCK_UNAVAILABLE';reasonCode='UNSAFE_ANALYTICAL_RESULT';
  }
  return Object.freeze({value,range,calculable:value!==null||range!==null,provisional:range!==null,unit,inputResolution,
    inputFact:area,priceInput:price,inputSource:area.inputSource,qualification:area.qualification,reasonCode});
}

/** No display rounding, midpoint selection, fallback valuation or mutation. */
export function calculateAreaMetrics(context:AnalyticalPropertyInputs) {
  const inputs=resolveAnalyticalInputs(context);
  // Reuse the existing living-area metric with its explicit input-policy opt-in.
  // Acquisition + rehab and stored cap rate remain outside the area policy.
  const living=divide(inputs.PRICE,inputs.LIVING_AREA,'USD_PER_LIVING_SQFT');
  const compatibility=calculateDealMetrics({price:inputs.PRICE.value,sqft:null,rehab:null,capRate:null,analyticalInputs:context}).metrics.pricePerSqft;
  return Object.freeze({inputs,
    pricePerAcre:divide(inputs.PRICE,inputs.LOT_AREA,'USD_PER_ACRE'),
    pricePerLotSqft:divide(inputs.PRICE,inputs.LOT_AREA,'USD_PER_LOT_SQFT'),
    pricePerLivingSqft:Object.freeze({...living,value:living.value===null?null:compatibility.value})});
}
