import { describe, expect, it } from 'vitest';
import {
  canonicalContactToDisplayCard,
  getProfilePresentationKey,
  hasSameProfileIdentity,
  resolveCanonicalContactCardFromMap,
  resolveDisplayContactCardFromMap,
} from './matchesEntitlement';
import {
  isOwnerUnlocked,
  isPropertyUnlocked,
} from '../services/unlockedContactService';
import { buildProfileEntitlementKey } from './profileScope';

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
    const map = new Map([[buildProfileEntitlementKey('owner-1', 'professional'), ownerContact]]);
    const contact = resolveCanonicalContactCardFromMap(map, {
      ownerId: 'owner-1',
      primaryProfile: 'professional',
      email: 'stale@example.com',
    });

    expect(contact).toMatchObject({
      ownerId: 'owner-1',
      email: 'owner@example.com',
      primaryPhone: '+15551230001',
    });
    expect(isOwnerUnlocked(map, 'owner-1', 'professional')).toBe(true);
    expect(isOwnerUnlocked(map, 'owner-1', 'fsbo')).toBe(false);
  });

  it('resolves a property unlock with owner contact only for that property', () => {
    const map = new Map([[buildProfileEntitlementKey('owner-2', 'fsbo'), propertyContact]]);
    const contact = resolveCanonicalContactCardFromMap(map, { ownerId: 'owner-2', primaryProfile: 'fsbo' });

    expect(contact.email).toBe('property-owner@example.com');
    expect(isPropertyUnlocked(map, 'owner-2', 'property-3', 'fsbo')).toBe(true);
    expect(isPropertyUnlocked(map, 'owner-2', 'property-4', 'fsbo')).toBe(false);
  });

  it('treats owner contact unlock as entitlement for linked properties', () => {
    const map = new Map([[buildProfileEntitlementKey('owner-1', 'professional'), ownerContact]]);

    expect(isPropertyUnlocked(map, 'owner-1', 'property-1', 'professional')).toBe(true);
    expect(isPropertyUnlocked(map, 'owner-1', 'property-2', 'professional')).toBe(true);
  });

  it('does not synthesize contact fields when exclusivity belongs to another user', () => {
    const map = new Map([[buildProfileEntitlementKey('owner-3', 'personal'), exclusiveOtherContact]]);
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

  it('keeps two profile scopes from one account distinct in presentation', () => {
    const fsbo = { ownerId: 'owner-1', primaryProfile: 'fsbo', name: 'Dr. Dree' };
    const professional = { ownerId: 'owner-1', primaryProfile: 'professional', name: 'DealSifter' };

    expect(getProfilePresentationKey(fsbo)).toBe('owner-1:fsbo');
    expect(getProfilePresentationKey(professional)).toBe('owner-1:professional');
    expect(hasSameProfileIdentity(fsbo, professional)).toBe(false);
    expect(hasSameProfileIdentity(fsbo, { ownerId: 'owner-1', primary_profile: 'fsbo' })).toBe(true);
  });

  it('keeps the canonical owner UUID separate from a locked presentation id', () => {
    expect(resolveDisplayContactCardFromMap(new Map(), {
      id: 'presentation-only',
      ownerId: 'owner-1',
      primaryProfile: 'fsbo',
      name: 'Dr. Dree',
    })).toMatchObject({
      id: 'owner-1:fsbo',
      ownerId: 'owner-1',
      unlockOwnerId: 'owner-1',
      primaryProfile: 'fsbo',
    });
  });
});
