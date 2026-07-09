import { describe, expect, it } from 'vitest';
import {
  canonicalContactToDisplayCard,
  resolveCanonicalContactCardFromMap,
} from './matchesEntitlement';
import {
  isOwnerUnlocked,
  isPropertyUnlocked,
} from '../services/unlockedContactService';

const ownerContact = {
  ownerId: 'owner-1',
  primaryProfile: 'professional',
  unlockScope: 'contact',
  contact: {
    name: 'Unlocked Owner',
    email: 'owner@example.com',
    phonePrimary: '+15551230001',
    contactMethods: ['email', 'phone'],
  },
  portfolio: [
    { itemId: 'property-1', itemType: 'property', isUnlocked: true },
    { itemId: 'property-2', itemType: 'property', isUnlocked: true },
  ],
  unlockedPropertyIds: ['property-1', 'property-2'],
  exclusiveStatus: 'none',
};

const propertyContact = {
  ownerId: 'owner-2',
  primaryProfile: 'fsbo',
  unlockScope: 'property',
  contact: {
    name: 'Property Owner',
    email: 'property-owner@example.com',
    phonePrimary: '+15551230002',
    contactMethods: ['email'],
  },
  portfolio: [
    { itemId: 'property-3', itemType: 'property', isUnlocked: true },
    { itemId: 'property-4', itemType: 'property', isUnlocked: false },
  ],
  unlockedPropertyIds: ['property-3'],
  exclusiveStatus: 'none',
};

const exclusiveOtherContact = {
  ownerId: 'owner-3',
  primaryProfile: 'personal',
  unlockScope: 'property',
  contact: {
    name: 'Blocked Exclusive Owner',
    email: null,
    phonePrimary: null,
    contactMethods: [],
  },
  portfolio: [
    { itemId: 'property-5', itemType: 'property', isUnlocked: false, isExclusive: true },
  ],
  unlockedPropertyIds: [],
  exclusiveStatus: 'active_other',
  exclusiveExpiresAt: '2026-08-01T00:00:00Z',
};

describe('matches entitlement canonical contact flow', () => {
  it('resolves an unlocked owner only from unlockedContactMap', () => {
    const map = new Map([['owner-1', ownerContact]]);
    const contact = resolveCanonicalContactCardFromMap(map, { ownerId: 'owner-1', email: 'stale@example.com' });

    expect(contact).toMatchObject({
      ownerId: 'owner-1',
      email: 'owner@example.com',
      primaryPhone: '+15551230001',
    });
    expect(isOwnerUnlocked(map, 'owner-1')).toBe(true);
  });

  it('resolves a property unlock with owner contact only for that property', () => {
    const map = new Map([['owner-2', propertyContact]]);
    const contact = resolveCanonicalContactCardFromMap(map, { ownerId: 'owner-2' });

    expect(contact.email).toBe('property-owner@example.com');
    expect(isPropertyUnlocked(map, 'owner-2', 'property-3')).toBe(true);
    expect(isPropertyUnlocked(map, 'owner-2', 'property-4')).toBe(false);
  });

  it('treats owner contact unlock as entitlement for linked properties', () => {
    const map = new Map([['owner-1', ownerContact]]);

    expect(isPropertyUnlocked(map, 'owner-1', 'property-1')).toBe(true);
    expect(isPropertyUnlocked(map, 'owner-1', 'property-2')).toBe(true);
  });

  it('does not synthesize contact fields when exclusivity belongs to another user', () => {
    const map = new Map([['owner-3', exclusiveOtherContact]]);
    const contact = canonicalContactToDisplayCard(exclusiveOtherContact);

    expect(contact.exclusiveStatus).toBe('active_other');
    expect(contact.email).toBe('');
    expect(contact.primaryPhone).toBe('');
    expect(isPropertyUnlocked(map, 'owner-3', 'property-5')).toBe(false);
  });

  it('returns null when owner is absent from unlockedContactMap', () => {
    const contact = resolveCanonicalContactCardFromMap(new Map(), {
      ownerId: 'owner-missing',
      ownerPreview: { email: 'leak@example.com' },
      email: 'leak@example.com',
    });

    expect(contact).toBeNull();
  });
});
