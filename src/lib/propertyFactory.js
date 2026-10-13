import { genId } from './id';
import { toKnownFiniteNumber } from '../../supabase/functions/_shared/maxxis/canonicalFactSemantics.ts';

function normalizePrimaryProfileScope(scope, fallback = '') {
  const normalized = String(scope || '').trim().toLowerCase();
  if (normalized === 'personal' || normalized === 'primary' || normalized === 'a') return 'personal';
  if (
    normalized === 'professional'
    || normalized === 'business'
    || normalized === 'secondary'
    || normalized === 'operation'
    || normalized === 'operations'
    || normalized === 'b'
  ) return 'professional';
  if (normalized === 'fsbo' || normalized === 'c') return 'fsbo';
  return fallback;
}

export function isFsboPropertyRecord(property) {
  if (!property) return false;
  return (
    property.dealTag === 'FSBO'
    || property.ownerAccountType === 'fsbo_owner'
    || property.source === 'fsbo'
  );
}

export function createProfessionalProperty(input) {
  const beds = toKnownFiniteNumber(input.beds);
  const baths = toKnownFiniteNumber(input.baths);
  const rehab = toKnownFiniteNumber(input.rehab);
  const capRate = toKnownFiniteNumber(input.capRate);
  const primaryProfile = normalizePrimaryProfileScope(input.primaryProfileScope, '');

  return {
    id: genId(),
    ownerId: input.ownerId,
    type: input.type || 'SFR',
    address: input.address || '',
    city: input.city || '',
    zip: input.zip || '',
    price: input.price,
    beds,
    baths,
    sqft: input.sqft || '',
    improvement: input.improvement || '',
    lot: input.lot || '',
    dealTag: primaryProfile === 'fsbo' ? 'FSBO' : 'Portfolio',
    images: Array.isArray(input.images) ? input.images : [],
    video: input.video || '',
    objective: input.objective || 'Sell',
    rehab,
    capRate,
    markets: Array.isArray(input.markets) ? input.markets : [],
    state: (Array.isArray(input.markets) && input.markets[0]) ? String(input.markets[0]).trim() : '',
    description: input.description || 'Portfolio property published from unified onboarding.',
    primaryProfile,
    primaryProfileId: primaryProfile === 'professional' ? 'B' : (primaryProfile === 'fsbo' ? 'C' : (primaryProfile === 'personal' ? 'A' : '')),
    isActive: false,
    geocodeStatus: 'pending',
    publishToShowcase: false,
    source: 'portfolio',
    ownerAccountType: '',
    includeInPreview: true,
    hideStreetAddressOnCard: input.hideStreetAddressOnCard === true,
  };
}
