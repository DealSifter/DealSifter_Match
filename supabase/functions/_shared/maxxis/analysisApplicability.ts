export const CANONICAL_TARGET_CONDITIONS = Object.freeze([
  'AS_IS', 'LIGHT_REHAB', 'STANDARD_RENOVATION', 'FULL_RENOVATION',
  'HIGH_END', 'TURN_KEY', 'NEW_CONSTRUCTION',
] as const);

export type CanonicalTargetCondition = typeof CANONICAL_TARGET_CONDITIONS[number];

const normalizeToken = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const TARGET_CONDITION_ALIASES: Record<string, CanonicalTargetCondition> = {
  AS_IS: 'AS_IS',
  NO_ESTADO_ATUAL: 'AS_IS',
  ESTADO_ATUAL: 'AS_IS',
  TAL_COMO_ESTA: 'AS_IS',
  LIGHT_REHAB: 'LIGHT_REHAB',
  LIGHT_RENOVATION: 'LIGHT_REHAB',
  REFORMA_LEVE: 'LIGHT_REHAB',
  RENOVACION_LIGERA: 'LIGHT_REHAB',
  STANDARD_RENOVATION: 'STANDARD_RENOVATION',
  STANDARD_REHAB: 'STANDARD_RENOVATION',
  REFORMA_PADRAO: 'STANDARD_RENOVATION',
  REFORMA_MEDIA: 'STANDARD_RENOVATION',
  RENOVACION_ESTANDAR: 'STANDARD_RENOVATION',
  FULL_RENOVATION: 'FULL_RENOVATION',
  FULL_REHAB: 'FULL_RENOVATION',
  REFORMA_COMPLETA: 'FULL_RENOVATION',
  RENOVACION_COMPLETA: 'FULL_RENOVATION',
  HIGH_END: 'HIGH_END',
  ALTO_PADRAO: 'HIGH_END',
  ALTA_GAMA: 'HIGH_END',
  TURN_KEY: 'TURN_KEY',
  TURNKEY: 'TURN_KEY',
  PRONTO_PARA_USO: 'TURN_KEY',
  PRONTO_PARA_MORAR: 'TURN_KEY',
  LLAVE_EN_MANO: 'TURN_KEY',
  NEW_CONSTRUCTION: 'NEW_CONSTRUCTION',
  NOVA_CONSTRUCAO: 'NEW_CONSTRUCTION',
  CONSTRUCCION_NUEVA: 'NEW_CONSTRUCTION',
};

const LAND_TYPES = new Set([
  'LAND', 'LOT', 'VACANT_LAND', 'VACANT_LOT', 'RESIDENTIAL_LAND',
  'COMMERCIAL_LAND', 'ACREAGE', 'TERRENO', 'LOTE', 'TERRENO_BALDIO',
]);

const NO_CONSTRUCTION = /\b(no construction|without construction|nao havera construcao|sem construcao|no habra construccion|sin construccion)\b/i;
const PLANNED_CONSTRUCTION = /\b(new construction|planned construction|build(?:ing)?|construct(?:ion|ing)?|nova construcao|construir|edificar|construccion nueva|construir)\b/i;

export function normalizeTargetCondition(value: unknown): CanonicalTargetCondition | null {
  return TARGET_CONDITION_ALIASES[normalizeToken(value)] || null;
}

export function normalizePropertyType(value: unknown) {
  return normalizeToken(value);
}

export function isVacantLandProperty(property: Record<string, unknown> | null | undefined) {
  const type = normalizePropertyType(property?.propertyType ?? property?.type ?? property?.property_type);
  return LAND_TYPES.has(type) || type.startsWith('VACANT_LAND_') || type.endsWith('_VACANT_LAND');
}

export function hasPlannedConstruction(assumptions: Record<string, unknown> = {}) {
  const scope = String(assumptions.renovationScope || assumptions.scope || '').trim();
  if (NO_CONSTRUCTION.test(scope.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) return false;
  return normalizeTargetCondition(assumptions.targetCondition) === 'NEW_CONSTRUCTION'
    || PLANNED_CONSTRUCTION.test(scope.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
}

export function classifyAnalysisApplicability(
  property: Record<string, unknown> | null | undefined,
  assumptions: Record<string, unknown> = {},
) {
  const vacantLand = isVacantLandProperty(property);
  const constructionPlanned = vacantLand && hasPlannedConstruction(assumptions);
  // A proposed house is an exit product, not an existing residential ARV/rehab.
  const residentialScenarioApplicable = !vacantLand;
  return Object.freeze({
    propertyCategory: vacantLand ? 'VACANT_LAND' as const : 'IMPROVED_PROPERTY' as const,
    constructionPlanned,
    rehab: residentialScenarioApplicable ? 'APPLICABLE' as const : 'NOT_APPLICABLE' as const,
    residentialArv: residentialScenarioApplicable ? 'APPLICABLE' as const : 'NOT_APPLICABLE' as const,
  });
}
