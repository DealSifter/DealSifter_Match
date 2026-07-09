import { describe, expect, it } from 'vitest';
import { buildMapInventory } from './mapInventoryService';

const CURRENT_USER_ID = 'user-current';
const OTHER_USER_ID = 'user-other';

const baseCards = [
  {
    id: 'person-current',
    cardKind: 'person',
    ownerId: CURRENT_USER_ID,
    primaryProfile: 'professional',
    name: 'Current Person',
    category: 'investor',
    portfolioCount: 1,
    publishToConnections: true,
    lat: 35.1,
    lng: -90.1,
  },
  {
    id: 'service-current',
    cardKind: 'service',
    ownerId: CURRENT_USER_ID,
    primaryProfile: 'professional',
    name: 'Current Service',
    category: 'svc_photo',
    publishToConnections: true,
    lat: 35.2,
    lng: -90.2,
  },
  {
    id: 'property-current',
    cardKind: 'property',
    ownerId: CURRENT_USER_ID,
    primaryProfile: 'professional',
    address: '100 Current Ave',
    type: 'SFR',
    publishToShowcase: true,
    isActive: true,
    lat: 35.3,
    lng: -90.3,
  },
  {
    id: 'property-other',
    cardKind: 'property',
    ownerId: OTHER_USER_ID,
    primaryProfile: 'fsbo',
    address: '200 Other Ave',
    type: 'Multifamily',
    publishToShowcase: true,
    isActive: true,
    isSpotlight: true,
    lat: 36.3,
    lng: -91.3,
  },
  {
    id: 'person-other',
    cardKind: 'person',
    ownerId: OTHER_USER_ID,
    primaryProfile: 'fsbo',
    name: 'Other Person',
    category: 'fsbo',
    portfolioCount: 1,
    publishToConnections: true,
    isSpotlight: true,
    lat: 36.1,
    lng: -91.1,
  },
  {
    id: 'property-no-coords',
    cardKind: 'property',
    ownerId: CURRENT_USER_ID,
    primaryProfile: 'professional',
    address: 'No Coordinates',
    publishToShowcase: true,
    isActive: true,
  },
];

describe('mapInventoryService', () => {
  it('returns only current user properties for My PINs + Deals', () => {
    const inventory = buildMapInventory(baseCards, CURRENT_USER_ID, {
      showOnlyMyPins: true,
      showPeople: false,
      showDeals: true,
    });

    expect(inventory.allPins).toHaveLength(1);
    expect(inventory.allPins[0]).toMatchObject({
      cardId: 'property-current',
      itemType: 'property',
      ownerId: CURRENT_USER_ID,
      isOwnCard: true,
    });
  });

  it('returns only current user profiles and services for My PINs + People', () => {
    const inventory = buildMapInventory(baseCards, CURRENT_USER_ID, {
      showOnlyMyPins: true,
      showPeople: true,
      showDeals: false,
    });

    expect(inventory.allPins.map((pin) => pin.cardId).sort()).toEqual([
      'person-current',
      'service-current',
    ]);
    expect(inventory.allPins.every((pin) => pin.itemType === 'person')).toBe(true);
    expect(inventory.allPins.every((pin) => pin.ownerId === CURRENT_USER_ID)).toBe(true);
  });

  it('keeps Spotlight Cards as a subset of allPins', () => {
    const inventory = buildMapInventory(baseCards, CURRENT_USER_ID, {
      showPeople: true,
      showDeals: true,
    });
    const allPinIds = new Set(inventory.allPins.map((pin) => pin.pinId));

    expect(inventory.spotlightCards.length).toBeGreaterThan(0);
    expect(inventory.spotlightCards.every((pin) => allPinIds.has(pin.pinId))).toBe(true);
  });

  it('excludes cards without lat/lng from every subset', () => {
    const inventory = buildMapInventory(baseCards, CURRENT_USER_ID, {
      showPeople: true,
      showDeals: true,
    });

    const ids = [
      ...inventory.allPins,
      ...inventory.spotlightCards,
      ...inventory.myPins,
      ...inventory.clusterablePins,
    ].map((pin) => pin.cardId);

    expect(ids).not.toContain('property-no-coords');
  });

  it('deduplicates the same item in allPins', () => {
    const duplicate = { ...baseCards[2] };
    const inventory = buildMapInventory([...baseCards, duplicate], CURRENT_USER_ID, {
      showPeople: true,
      showDeals: true,
    });

    const duplicates = inventory.allPins.filter((pin) => pin.cardId === 'property-current');
    expect(duplicates).toHaveLength(1);
  });
});
