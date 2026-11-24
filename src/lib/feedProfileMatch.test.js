import { describe, expect, it } from 'vitest';
import { calculatePropertyMatch } from '../../supabase/functions/_shared/maxxis/calculatePropertyMatch.ts';
import { buildFeedMatchProfile, getFeedProfileMatch } from './feedProfileMatch';

const profile = { targetMarkets: ['FL'], propertyTypes: ['Single Family'], strategies: ['Fix & Flip'], priceRange: '100_200k', lookingFor: ['Contractors'] };
const property = { id: 'property', cardKind: 'property', state: 'FL', price: 150000, type: 'SFR', objective: 'Fix & Flip' };

describe('feed profile compatibility', () => {
  it('reuses the existing property match engine without changing its weights', () => {
    expect(getFeedProfileMatch(property, profile)).toBe(calculatePropertyMatch(profile, property).score);
    expect(getFeedProfileMatch(property, profile)).toBe(100);
    expect(getFeedProfileMatch({ ...property, state: 'TX', price: 800000 }, profile)).toBeLessThan(100);
  });
  it('keeps missing criteria unknown instead of assigning a fake score', () => {
    expect(getFeedProfileMatch({ cardKind: 'property' }, {})).toBeNull();
    expect(getFeedProfileMatch({ cardKind: 'person', cat: 'lender' }, {})).toBeNull();
    expect(getFeedProfileMatch(null, profile)).toBeNull();
  });
  it('uses requested roles and location for contacts and services, including category aliases', () => {
    expect(getFeedProfileMatch({ cardKind: 'person', cat: 'gc', state: 'FL' }, profile)).toBe(100);
    expect(getFeedProfileMatch({ cardKind: 'service', category: 'General Contractor', state: 'FL' }, profile)).toBe(100);
    expect(getFeedProfileMatch({ cardKind: 'service', category: 'svc_photo', state: 'FL' }, profile)).toBe(35);
  });
  it('does not use popularity, freshness, login identity or made-up profile criteria as compatibility', () => {
    const card = { cardKind: 'person', cat: 'gc', state: 'FL' };
    expect(getFeedProfileMatch({ ...card, hotScore: 999, unlockCount: 999, verified: true }, profile)).toBe(getFeedProfileMatch(card, profile));
  });
  it('keeps investment criteria and markets scoped to the active profile', () => {
    const profiles = { professionalProfile: { investmentProfile: profile, markets: ['FL'], marketsB: ['TX'] }, personalProfile: { marketsFsbo: ['CA'] } };
    expect(buildFeedMatchProfile('personal', profiles).targetMarkets).toEqual(['FL']);
    const b = buildFeedMatchProfile('professional', profiles);
    expect(b.targetMarkets).toEqual(['TX']);
    expect(b.priceRange).toBeUndefined();
    expect(b.lookingFor).toBeUndefined();
    expect(buildFeedMatchProfile('fsbo', profiles).targetMarkets).toEqual(['CA']);
  });
  it('uses a matching property from the same published portfolio', () => {
    const card = { ownerId: 'owner', primaryProfile: 'personal', cardKind: 'person', linkedProperties: [{ ...property, ownerId: 'owner', primaryProfile: 'personal' }] };
    expect(getFeedProfileMatch(card, profile)).toBe(100);
    for (const change of [{ ownerId: 'another' }, { primaryProfile: 'professional' }, { publishToShowcase: false }, { dealClosed: true }]) {
      expect(getFeedProfileMatch({ ...card, linkedProperties: [{ ...card.linkedProperties[0], ...change }] }, profile)).toBeNull();
    }
  });
  it('does not advertise another owner/profile or unpublished service as a matching skill', () => {
    const card = { ownerId: 'owner', primaryProfile: 'professional', cardKind: 'person', cat: 'services', linkedServices: [{ ownerId: 'owner', primaryProfile: 'professional', category: 'ff_gc' }] };
    expect(getFeedProfileMatch(card, { lookingFor: ['Contractors'] })).toBe(100);
    for (const change of [{ ownerId: 'another' }, { primaryProfile: 'personal' }, { publishToConnections: false }]) {
      expect(getFeedProfileMatch({ ...card, linkedServices: [{ ...card.linkedServices[0], ...change }] }, { lookingFor: ['Contractors'] })).toBe(0);
    }
  });
});
