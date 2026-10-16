import { SQFT_PER_ACRE } from './propertyAreaUnits.ts';
export { SQFT_PER_ACRE } from './propertyAreaUnits.ts';
import { resolveAnalyticalPropertyFact, type AnalyticalPropertyInputs } from './analyticalPropertyFacts.ts';
import { calculateAreaMetrics } from './areaMetrics.ts';
import { parseDealMetricNumber } from './dealMetrics.ts';

export type CanonicalLotArea = Readonly<{
  lotSizeSqft: number | null;
  lotSizeAcres: number | null;
  sourceUnit: 'ACRES' | 'SQFT' | 'UNKNOWN';
}>;

function positive(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function localizedNumber(value: string) {
  const cleaned = value.trim().replace(/\s+/g, '');
  if (!cleaned) return null;
  const comma = cleaned.lastIndexOf(',');
  const dot = cleaned.lastIndexOf('.');
  let normalized = cleaned;
  if (comma >= 0 && dot >= 0) {
    normalized = comma > dot
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (comma >= 0) {
    normalized = /^\d{1,3}(?:,\d{3})+$/.test(cleaned) ? cleaned.replace(/,/g, '') : cleaned.replace(',', '.');
  } else if (dot >= 0 && /^\d{1,3}(?:\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, '');
  }
  return positive(normalized);
}

export function parseCanonicalLotArea(value: unknown): CanonicalLotArea {
  if (typeof value === 'number') {
    const sqft = positive(value);
    return Object.freeze({ lotSizeSqft: sqft, lotSizeAcres: sqft ? sqft / SQFT_PER_ACRE : null, sourceUnit: sqft ? 'SQFT' : 'UNKNOWN' });
  }
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return Object.freeze({ lotSizeSqft: null, lotSizeAcres: null, sourceUnit: 'UNKNOWN' });
  const match = raw.match(/[-+]?\d[\d.,\s]*/);
  const number = match ? localizedNumber(match[0]) : null;
  if (!number) return Object.freeze({ lotSizeSqft: null, lotSizeAcres: null, sourceUnit: 'UNKNOWN' });
  const acres = /(?:ac(?:re|res)?|acre|acres)\b/i.test(raw);
  if (acres) {
    return Object.freeze({
      lotSizeSqft: Math.round(number * SQFT_PER_ACRE * 100) / 100,
      lotSizeAcres: Math.round(number * 1_000_000) / 1_000_000,
      sourceUnit: 'ACRES',
    });
  }
  return Object.freeze({
    lotSizeSqft: Math.round(number * 100) / 100,
    lotSizeAcres: Math.round((number / SQFT_PER_ACRE) * 1_000_000) / 1_000_000,
    sourceUnit: 'SQFT',
  });
}

export type LandUnitMetrics = ReturnType<typeof resolveLotDimensions> & {pricePerLotSqft:number|null;pricePerAcre:number|null;
  pricePerLotSqftRange?:{min:number;max:number}|null;pricePerAcreRange?:{min:number;max:number}|null;areaMetrics?:ReturnType<typeof calculateAreaMetrics>};
export function calculateLandUnitMetrics(priceInput: unknown, lotInput: unknown):Readonly<LandUnitMetrics> {
  const context = lotInput && typeof lotInput === 'object' ? (lotInput as {analyticalPropertyInputs?:AnalyticalPropertyInputs}).analyticalPropertyInputs : null;
  if (context?.version === 'ANALYTICAL_PROPERTY_INPUTS_V1') {
    const price=typeof priceInput==='number'||typeof priceInput==='string'?parseDealMetricNumber(priceInput,'money'):null;
    const inputs:AnalyticalPropertyInputs={...context,fields:{...context.fields,PRICE:{domain:'PRICE',effective:{value:price,unit:'USD',state:price===null?'UNAVAILABLE':'AVAILABLE',sourceType:'USER_PROVIDED',sourceId:'CURRENT_EXPLICIT_PRICE_INPUT',status:'USER_PROVIDED'}}}};
    const areaMetrics=calculateAreaMetrics(inputs),lot=resolveLotDimensions({analyticalPropertyInputs:inputs});
    return Object.freeze({...lot,pricePerLotSqft:areaMetrics.pricePerLotSqft.value,pricePerAcre:areaMetrics.pricePerAcre.value,
      pricePerLotSqftRange:areaMetrics.pricePerLotSqft.range,pricePerAcreRange:areaMetrics.pricePerAcre.range,areaMetrics});
  }
  const price = positive(priceInput);
  const lot = resolveLotDimensions(lotInput);
  const pricePerLotSqft = price && lot.lotSizeSqft
    ? Math.round((price / lot.lotSizeSqft) * 100) / 100 : null;
  const pricePerAcre = price && lot.lotSizeAcres
    ? Math.round((price / lot.lotSizeAcres) * 100) / 100 : null;
  return Object.freeze({ ...lot, pricePerLotSqft, pricePerAcre });
}

/** Resolve the parcel once. Independent units are evidence, never independent outputs. */
export function resolveLotDimensions(input: unknown) {
  const row = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const context=row.analyticalPropertyInputs as AnalyticalPropertyInputs|undefined;
  if(context?.version==='ANALYTICAL_PROPERTY_INPUTS_V1'){
    const analyticalInput=resolveAnalyticalPropertyFact(context.fields.LOT_AREA??{domain:'LOT_AREA'}),sqft=analyticalInput.value,acres=sqft===null?null:sqft/SQFT_PER_ACRE;
    const result={...resolveParcelDimensions(null,null),resolvedSqft:sqft,resolvedAcres:acres,lotSizeSqft:sqft,lotSizeAcres:acres,
      sourceUnit:sqft===null?'UNKNOWN' as const:'SQFT' as const,source:analyticalInput.inputSource.sourceId,evidenceStatus:analyticalInput.inputSource.status??'UNKNOWN',
      acresStatus:acres===null?'UNKNOWN':'CALCULATED',sqftStatus:sqft===null?'UNKNOWN':analyticalInput.inputSource.status??'UNKNOWN',analyticalInput};
    // Internal context is reusable by the next engine, not duplicated in JSON/report/scenario persistence.
    Object.defineProperty(result,'analyticalPropertyInputs',{value:context,enumerable:false});
    return Object.freeze(result);
  }
  const physical = (row.canonicalPropertyFacts as { physical?: Record<string, unknown> } | undefined)?.physical;
  const canonical = row.canonicalPropertyFacts as { resolvedLotDimensions?: unknown } | undefined;
  const retained = (row.resolvedLotDimensions || canonical?.resolvedLotDimensions || (row.resolvedSqft ? row : null)) as ReturnType<typeof resolveParcelDimensions> | undefined;
  if (retained?.resolvedSqft && Math.abs((retained.resolvedAcres || 0) - retained.resolvedSqft / SQFT_PER_ACRE) < 1e-9) return retained;
  const parsed = parseCanonicalLotArea(Object.keys(row).length ? row.lot : input);
  return resolveParcelDimensions(physical?.lotSizeAcres ?? row.lotSizeAcres ?? (parsed.sourceUnit === 'ACRES' ? parsed.lotSizeAcres : null),
    physical?.lotSizeSqft ?? row.lotSizeSqft ?? (parsed.sourceUnit === 'SQFT' ? parsed.lotSizeSqft : null), row.fieldProvenance as Record<string, string> | undefined);
}

export function resolveParcelDimensions(acresInput: unknown, sqftInput: unknown, provenance: Record<string, string> = {}) {
  const evidence = (input: unknown, unit: 'ACRES' | 'SQFT') => {
    const fact = input && typeof input === 'object' ? input as Record<string, unknown> : {};
    const value = positive('value' in fact ? fact.value : input);
    const status = String(fact.status || 'USER_PROVIDED');
    const rank = ({ VERIFIED_RECORD: 4, USER_PROVIDED: 3, ESTIMATED: 2, CALCULATED: 1 } as Record<string, number>)[status] || 0;
    return { value, unit, status, source: String(fact.source || provenance[unit === 'ACRES' ? 'lotSizeAcres' : 'lotSizeSqft'] || 'PROPERTY_APP_VALUE'),
      confidence: positive(fact.confidence), rank };
  };
  const acres = evidence(acresInput, 'ACRES'); const sqft = evidence(sqftInput, 'SQFT');
  const candidates = [sqft, acres].filter(item => item.value !== null && item.rank > 0)
    .sort((a, b) => b.rank - a.rank || (b.confidence || 0) - (a.confidence || 0));
  const chosen = candidates[0];
  const resolvedSqft = chosen ? chosen.unit === 'SQFT' ? chosen.value! : Math.round(chosen.value! * SQFT_PER_ACRE * 1e6) / 1e6 : null;
  const resolvedAcres = resolvedSqft === null ? null : chosen?.unit === 'ACRES' ? chosen.value : resolvedSqft / SQFT_PER_ACRE;
  const discrepancy = acres.value && sqft.value ? Math.abs(acres.value * SQFT_PER_ACRE - sqft.value) / Math.max(acres.value * SQFT_PER_ACRE, sqft.value) : 0;
  const conflict = discrepancy > 0.02 && acres.status !== 'CALCULATED' && sqft.status !== 'CALCULATED'
    ? { code: 'LOT_DIMENSION_CONFLICT', sourceAcres: acres, sourceSqft: sqft, relativeDifference: discrepancy, selectedUnit: chosen?.unit } : null;
  return Object.freeze({ resolvedSqft, resolvedAcres, lotSizeSqft: resolvedSqft, lotSizeAcres: resolvedAcres,
    sourceUnit: chosen?.unit || 'UNKNOWN', source: chosen?.source || null, evidenceStatus: chosen?.status || 'UNKNOWN',
    confidence: chosen?.confidence || null, sourceAcres: acres, sourceSqft: sqft, conflict,
    acresStatus: chosen?.unit === 'ACRES' ? chosen.status : resolvedAcres === null ? 'UNKNOWN' : 'CALCULATED',
    sqftStatus: chosen?.unit === 'SQFT' ? chosen.status : resolvedSqft === null ? 'UNKNOWN' : 'CALCULATED' });
}
