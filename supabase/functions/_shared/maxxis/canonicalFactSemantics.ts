/** Portable semantic contract. No I/O; shared by Edge and browser consumers. */
export type FactSemanticState = 'KNOWN' | 'UNKNOWN' | 'UNAVAILABLE' | 'NOT_APPLICABLE' | 'NOT_EVALUATED' | 'CONFLICT';
const ABSENT_STATES = new Set(['UNKNOWN', 'UNAVAILABLE', 'NOT_APPLICABLE', 'NOT_EVALUATED']);
export function isMaterialValue(value: unknown): boolean {
  return value !== null && value !== undefined && !(typeof value === 'string' && value.trim() === '');
}
export function canonicalFactValue(fact: unknown): unknown {
  if (!fact || typeof fact !== 'object' || Array.isArray(fact)) return null;
  const record = fact as Record<string, unknown>;
  if (ABSENT_STATES.has(String(record.semanticState || record.status))) return null;
  return isMaterialValue(record.value) ? record.value : null;
}
export function toKnownFiniteNumber(input: unknown): number | null {
  const value = input && typeof input === 'object' ? canonicalFactValue(input) : input;
  if (!isMaterialValue(value) || !['number', 'string'].includes(typeof value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
export function factSemanticState(value: unknown, status?: unknown, conflict?: unknown): FactSemanticState {
  if (ABSENT_STATES.has(String(status))) return String(status) as FactSemanticState;
  if (!isMaterialValue(value)) return 'UNKNOWN';
  return conflict ? 'CONFLICT' : 'KNOWN';
}
export function propertyTypeFamily(value: unknown): string {
  const token = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (['sfr', 'singlefamily', 'singlefamilyresidence', 'detached'].includes(token)) return 'SINGLE_FAMILY';
  if (['land', 'lot', 'vacantland', 'vacantlot', 'residentialland', 'commercialland', 'acreage', 'undevelopedland', 'terreno', 'lote', 'terrenobaldio', 'solar'].includes(token)) return 'LAND';
  return token.toUpperCase();
}
export function resolveAnalysisPropertyType(property: Record<string, unknown> | null | undefined): unknown {
  const source = property || {};
  const facts = source.canonicalPropertyFacts as { physical?: { propertyType?: unknown } } | undefined;
  for (const value of [canonicalFactValue(facts?.physical?.propertyType), source.type, source.propertyType, source.resolvedAnalysisPropertyType]) {
    if (isMaterialValue(value)) return value;
  }
  return null;
}
export function resolveAnalysisStrategy(type: unknown, objective: unknown): string {
  if (propertyTypeFamily(type) === 'LAND') return 'LAND';
  const strategy = String(objective || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  if (/\b(?:sub to|subject to|subto)\b/.test(strategy)) return 'SUB_TO';
  if (/\b(?:seller financ\w*|owner financ\w*|owner carry)\b/.test(strategy)) return 'SELLER_FINANCING';
  if (/\b(?:wholesale|assignment)\b/.test(strategy)) return 'WHOLESALE';
  if (/\b(?:buy and hold|buy hold|rental|hold)\b/.test(strategy)) return 'BUY_AND_HOLD';
  if (/\b(?:flip|fix and flip|rehab and sell)\b/.test(strategy)) return 'FLIP';
  return 'GENERIC_SELL';
}
