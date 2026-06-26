import { genId } from './id';

export function isFsboPropertyRecord(property) {
  if (!property) return false;
  return (
    property.dealTag === 'FSBO'
    || property.ownerAccountType === 'fsbo_owner'
    || property.source === 'fsbo'
  );
}

export function createFsboProperty(input) {
  const beds = Number(input.beds);
  const baths = Number(input.baths);
  const rehab = Number(input.rehab);
  const capRate = Number(input.capRate);
  // FSBO properties default to 'fsbo' scope; never fall back to 'personal'
  const primaryProfile = input.primaryProfileScope === 'professional'
    ? 'professional'
    : (input.primaryProfileScope === 'personal' ? 'personal' : 'fsbo');

  return {
    id: genId(),
    ownerId: input.ownerId,
    type: input.type || 'SFR',
    address: input.address || '',
    city: input.city || '',
    zip: input.zip || '',
    price: input.price,
    beds: Number.isFinite(beds) ? beds : 0,
    baths: Number.isFinite(baths) ? baths : 0,
    sqft: input.sqft || '',
    improvement: input.improvement || '',
    lot: input.lot || '',
    dealTag: primaryProfile === 'fsbo' ? 'FSBO' : 'Portfolio',
    images: Array.isArray(input.images) ? input.images : [],
    video: input.video || '',
    objective: input.objective || 'Sell',
    rehab: Number.isFinite(rehab) ? rehab : 0,
    capRate: Number.isFinite(capRate) ? capRate : 0,
    markets: Array.isArray(input.markets) ? input.markets : [],
    state: (Array.isArray(input.markets) && input.markets[0]) ? String(input.markets[0]).trim() : '',
    description: input.description || 'Portfolio property published from onboarding.',
    primaryProfile,
    primaryProfileId: primaryProfile === 'professional' ? 'B' : (primaryProfile === 'fsbo' ? 'C' : 'A'),
    isActive: true,
    publishToShowcase: true,
    source: 'portfolio',
    ownerAccountType: '',
    includeInPreview: true,
  };
}

export function createProfessionalProperty(input) {
  const beds = Number(input.beds);
  const baths = Number(input.baths);
  const rehab = Number(input.rehab);
  const capRate = Number(input.capRate);
  const primaryProfile = input.primaryProfileScope === 'professional'
    ? 'professional'
    : (input.primaryProfileScope === 'fsbo' ? 'fsbo' : 'personal');

  return {
    id: genId(),
    ownerId: input.ownerId,
    type: input.type || 'SFR',
    address: input.address || '',
    city: input.city || '',
    zip: input.zip || '',
    price: input.price,
    beds: Number.isFinite(beds) ? beds : 0,
    baths: Number.isFinite(baths) ? baths : 0,
    sqft: input.sqft || '',
    improvement: input.improvement || '',
    lot: input.lot || '',
    dealTag: primaryProfile === 'fsbo' ? 'FSBO' : 'Portfolio',
    images: Array.isArray(input.images) ? input.images : [],
    video: input.video || '',
    objective: input.objective || 'Sell',
    rehab: Number.isFinite(rehab) ? rehab : 0,
    capRate: Number.isFinite(capRate) ? capRate : 0,
    markets: Array.isArray(input.markets) ? input.markets : [],
    state: (Array.isArray(input.markets) && input.markets[0]) ? String(input.markets[0]).trim() : '',
    description: input.description || 'Portfolio property published from Business onboarding.',
    primaryProfile,
    primaryProfileId: primaryProfile === 'professional' ? 'B' : (primaryProfile === 'fsbo' ? 'C' : 'A'),
    isActive: true,
    publishToShowcase: true,
    source: 'portfolio',
    ownerAccountType: '',
    includeInPreview: true,
  };
}
