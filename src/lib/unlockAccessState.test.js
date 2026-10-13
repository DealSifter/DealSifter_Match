import { describe, expect, it } from 'vitest';
import { buildMapInventory } from '../services/mapInventoryService';
import { getContactUnlockKeys, resolveContactUnlockState, resolvePropertyUnlockState } from './unlockAccessState';

const property = { id: 'paid-property', ownerId: 'seller', primaryProfile: 'fsbo',
  geocodeStatus: 'resolved', geocodeSource: 'census', geocodedAt: '2026-10-13T01:00:00Z' };
const contact = { ownerId: 'seller', primaryProfile: 'fsbo', unlockScope: 'property', unlockedPropertyIds: ['paid-property'] };
const grants = new Map([['seller:fsbo', contact]]);
const ids = new Set(['seller']);

describe('shared Matches and Map unlock state', () => {
  it('reads canonical contact access without requiring the legacy ID array', () => {
    expect(resolveContactUnlockState(property, grants, new Set())).toBe(true);
    expect(resolveContactUnlockState({ ownerId: 'seller', primaryProfile: 'professional' }, grants, new Set())).toBe(false);
  });
  it('normalizes legacy contact aliases and numeric IDs', () => {
    expect(getContactUnlockKeys({ owner_id: 42, id: 'card', contactId: ' 42 ' })).toEqual(['42', 'card']);
    expect(resolveContactUnlockState({ ownerId: 42 }, new Map(), new Set(['42']))).toBe(true);
    expect(resolveContactUnlockState(null, grants, ids)).toBe(false);
  });
  it('does not grant all assets just because their contact was unlocked', () => {
    expect(resolvePropertyUnlockState(property, grants)).toBe(true);
    expect(resolvePropertyUnlockState({ ...property, id: 'locked-property' }, grants)).toBe(false);
    expect(resolvePropertyUnlockState({ ...property, primaryProfile: 'professional' }, grants)).toBe(false);
    expect(resolvePropertyUnlockState({ ...property, isUnlocked: true }, new Map())).toBe(false);
  });
  it.each(['contact', 'reciprocal'])('allows the portfolio when the canonical grant is %s', unlockScope => {
    expect(resolvePropertyUnlockState({ ...property, id: 'other-property' }, new Map([['seller:fsbo', { ...contact, unlockScope }]]))).toBe(true);
  });
  it('supports canonical portfolio item grants and property ID aliases', () => {
    const map = new Map([['seller:fsbo', { ...contact, unlockedPropertyIds: [], portfolio: [{ itemId: 'paid-property', itemType: 'property', isUnlocked: true }] }]]);
    expect(resolvePropertyUnlockState({ owner_id: 'seller', property_id: 'paid-property', primary_profile: 'fsbo' }, map)).toBe(true);
  });
  it('filters inventory by access and honors People, Deals and My PINs independently', () => {
    const cards = [
      { ...property, cardKind: 'property', lat: 32, lng: -99, isUnlocked: true },
      { ...property, id: 'locked', cardKind: 'property', lat: 32.01, lng: -99 },
      { id: 'contact', ownerId: 'seller', cardKind: 'person', lat: 32.02, lng: -99, isUnlocked: true },
      { ...property, id: 'own', ownerId: 'viewer', cardKind: 'property', lat: 32.03, lng: -99 },
    ];
    const unlocked = buildMapInventory(cards, 'viewer', { showOnlyUnlocked: true });
    expect(unlocked.allPins.map(pin => pin.cardId)).toEqual(['paid-property', 'contact']);
    expect(buildMapInventory(cards, 'viewer', { showOnlyUnlocked: true, showPeople: false }).allPins.map(pin => pin.cardId)).toEqual(['paid-property']);
    expect(buildMapInventory(cards, 'viewer', { showOnlyUnlocked: true, showDeals: false }).allPins.map(pin => pin.cardId)).toEqual(['contact']);
    expect(buildMapInventory(cards, 'viewer', { showOnlyMyPins: true }).allPins.map(pin => pin.cardId)).toEqual(['own']);
  });
  it('propagates canonical access through source normalization before filtering pins', () => {
    const inventory = buildMapInventory({
      showcaseProperties: ['paid-property', 'locked-property'].map(id => ({ ...property, id, address: id, type: 'SFR', lat: 32, lng: -99, isUnlocked: true,
        ownerPreview: { id: 'seller', name: 'Seller', type: 'FSBO', loc: 'TX' } })),
      getRecordProfileScope: card => card.primaryProfile,
      getStateCodeFromMarket: () => 'TX', stateCenters: { TX: { lat: 32, lng: -99 } },
      getPortfolioPartsForOwner: () => ({ properties: [property], services: [] }),
      resolvePropertyDisplayCoords: card => ({ lat: card.lat, lng: card.lng }),
      isPersonUnlocked: card => resolveContactUnlockState(card, grants, new Set()),
      isPropertyUnlocked: card => resolvePropertyUnlockState(card, grants),
    }, 'viewer', { showOnlyUnlocked: true });
    expect(inventory.allPins.filter(pin => pin.itemType === 'property').map(pin => pin.cardId)).toEqual(['paid-property']);
    expect(inventory.allPins.filter(pin => pin.itemType === 'person').map(pin => pin.ownerId)).toEqual(['seller']);
  });
});
