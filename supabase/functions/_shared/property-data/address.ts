import { PropertyDataError, type PropertyLookupInput } from './types.ts';

const STATE_CODES: Record<string, string> = {
  ALABAMA: 'AL', ALASKA: 'AK', ARIZONA: 'AZ', ARKANSAS: 'AR', CALIFORNIA: 'CA', COLORADO: 'CO',
  CONNECTICUT: 'CT', DELAWARE: 'DE', FLORIDA: 'FL', GEORGIA: 'GA', HAWAII: 'HI', IDAHO: 'ID',
  ILLINOIS: 'IL', INDIANA: 'IN', IOWA: 'IA', KANSAS: 'KS', KENTUCKY: 'KY', LOUISIANA: 'LA',
  MAINE: 'ME', MARYLAND: 'MD', MASSACHUSETTS: 'MA', MICHIGAN: 'MI', MINNESOTA: 'MN',
  MISSISSIPPI: 'MS', MISSOURI: 'MO', MONTANA: 'MT', NEBRASKA: 'NE', NEVADA: 'NV',
  'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY',
  'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', OHIO: 'OH', OKLAHOMA: 'OK', OREGON: 'OR',
  PENNSYLVANIA: 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC', 'SOUTH DAKOTA': 'SD',
  TENNESSEE: 'TN', TEXAS: 'TX', UTAH: 'UT', VERMONT: 'VT', VIRGINIA: 'VA', WASHINGTON: 'WA',
  'WEST VIRGINIA': 'WV', WISCONSIN: 'WI', WYOMING: 'WY', 'DISTRICT OF COLUMBIA': 'DC',
};

const STREET_SUFFIXES: Record<string, string> = {
  STREET: 'ST', AVENUE: 'AVE', ROAD: 'RD', DRIVE: 'DR', LANE: 'LN', BOULEVARD: 'BLVD',
  COURT: 'CT', CIRCLE: 'CIR', HIGHWAY: 'HWY', PARKWAY: 'PKWY', PLACE: 'PL', TERRACE: 'TER',
};

const clean = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ');

export async function propertyAddressFingerprint(input: PropertyLookupInput) {
  const value = validatePropertyLookupInput(input);
  const canonical = JSON.stringify([normalizeStreet(value.street), value.city.toUpperCase(), value.state, value.zipCode]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
}

export function normalizeState(value: unknown) {
  const normalized = clean(value).replace(/[^A-Za-z ]/g, '').toUpperCase();
  if (/^[A-Z]{2}$/.test(normalized)) return normalized;
  return STATE_CODES[normalized] || '';
}

export function normalizeZipCode(value: unknown) {
  return clean(value).match(/^\s*(\d{5})(?:-\d{4})?\s*$/)?.[1] || '';
}

export function normalizeStreet(value: unknown) {
  const tokens = clean(value)
    .toUpperCase()
    .replace(/[^A-Z0-9# ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  return tokens.map((token) => STREET_SUFFIXES[token] || token).join(' ');
}

export function validatePropertyLookupInput(input: PropertyLookupInput) {
  const street = clean(input?.street);
  const city = clean(input?.city);
  const state = normalizeState(input?.state);
  const zipCode = normalizeZipCode(input?.zipCode);
  if (!street || !city || !state || !zipCode) throw new PropertyDataError('INVALID_PROPERTY_LOOKUP');
  return {
    street,
    city,
    state,
    zipCode,
    propertyId: clean(input?.propertyId) || null,
    userId: clean(input?.userId) || null,
  };
}

export function formatPropertyLookupAddress(input: PropertyLookupInput) {
  const normalized = validatePropertyLookupInput(input);
  return `${normalized.street}, ${normalized.city}, ${normalized.state}, ${normalized.zipCode}`;
}

export function rentCastAddressMatches(
  input: PropertyLookupInput,
  returned: { addressLine1?: unknown; state?: unknown; zipCode?: unknown },
) {
  const expected = validatePropertyLookupInput(input);
  return normalizeStreet(expected.street) === normalizeStreet(returned.addressLine1)
    && expected.state === normalizeState(returned.state)
    && expected.zipCode === normalizeZipCode(returned.zipCode);
}
