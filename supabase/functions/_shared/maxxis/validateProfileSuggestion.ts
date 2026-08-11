import type { ValidatedProfileSuggestion } from './types.ts';

const STATE_NAMES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC',
};
const STATE_CODES = new Set(Object.values(STATE_NAMES));
const PROPERTY_TYPES = [
  'Single Family',
  'Multi-Family 2-4',
  'Multi-Family 5+',
  'Condo / Townhouse',
  'Land',
  'Commercial',
  'Mixed-Use',
  'Mobile / Manufactured',
];
const STRATEGIES = [
  'Buy & Hold',
  'Fix & Flip',
  'BRRRR',
  'Wholesale',
  'Wholetail',
  'Short-Term Rental',
  'Mid-Term Rental',
  'Development',
  'Value-Add',
  'Creative Finance',
  'Distressed Assets',
  'Tax Strategies',
  'Notes / Paper',
];

const normalizeText = (value: unknown) => String(value || '').trim().replace(/\s+/g, ' ');
const comparable = (value: unknown) => normalizeText(value).toLowerCase();
const canonicalFromList = (value: unknown, allowed: string[]) => {
  const normalized = comparable(value);
  return allowed.find((item) => comparable(item) === normalized) || '';
};

export type ProfileSuggestionValidationResult =
  | { valid: true; suggestion: ValidatedProfileSuggestion }
  | { valid: false; error: 'INVALID_SUGGESTION' | 'OPERATION_NOT_ALLOWED' | 'DIMENSION_MISMATCH' | 'VALUE_NOT_ALLOWED' };

export function validateProfileSuggestion(input: unknown): ProfileSuggestionValidationResult {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const operation = normalizeText(raw.operation).toLowerCase();
  const dimension = normalizeText(raw.dimension).toLowerCase();
  const value = normalizeText(raw.suggestedValue);
  if (!operation || !dimension || !value) return { valid: false, error: 'INVALID_SUGGESTION' };

  if (operation === 'add_market') {
    if (dimension !== 'market') return { valid: false, error: 'DIMENSION_MISMATCH' };
    const canonical = STATE_NAMES[comparable(value)] || value.toUpperCase();
    if (!STATE_CODES.has(canonical)) return { valid: false, error: 'VALUE_NOT_ALLOWED' };
    return { valid: true, suggestion: { operation, dimension, suggestedValue: canonical } };
  }
  if (operation === 'add_property_type') {
    if (dimension !== 'property_type') return { valid: false, error: 'DIMENSION_MISMATCH' };
    const canonical = canonicalFromList(value, PROPERTY_TYPES);
    if (!canonical) return { valid: false, error: 'VALUE_NOT_ALLOWED' };
    return { valid: true, suggestion: { operation, dimension, suggestedValue: canonical } };
  }
  if (operation === 'add_strategy') {
    if (dimension !== 'strategy') return { valid: false, error: 'DIMENSION_MISMATCH' };
    const canonical = canonicalFromList(value, STRATEGIES);
    if (!canonical) return { valid: false, error: 'VALUE_NOT_ALLOWED' };
    return { valid: true, suggestion: { operation, dimension, suggestedValue: canonical } };
  }
  return { valid: false, error: 'OPERATION_NOT_ALLOWED' };
}

export const MAXXIS_PROFILE_SUGGESTION_VOCABULARY = Object.freeze({
  propertyTypes: [...PROPERTY_TYPES],
  strategies: [...STRATEGIES],
  stateCodes: [...STATE_CODES],
});
