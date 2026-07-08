import { describe, expect, it, vi } from 'vitest';
import { normalizeCard } from './normalizeFeedCard';

const baseCard = (overrides = {}) => ({
  id: 'owner-1',
  owner_id: 'owner-1',
  primary_profile: 'personal',
  cardKind: 'person',
  name: 'Valid Owner',
  portfolioCount: 1,
  ownerPreview: {
    primaryProfile: 'personal',
    name: 'Valid Owner',
    photo: 'https://cdn.example.com/avatar.jpg',
    type: 'Investor',
    loc: 'FL',
  },
  ...overrides,
});

describe('normalizeCard public security invariant', () => {
  it('removes email returned by the feed RPC raw data', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const card = normalizeCard(baseCard({ email: 'owner@example.com' }), 'viewer-1');

    expect(card).not.toHaveProperty('email');
    warn.mockRestore();
  });

  it('removes phone from ownerPreview', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const card = normalizeCard(baseCard({
      ownerPreview: {
        primaryProfile: 'personal',
        name: 'Valid Owner',
        phone: '+15551234567',
        primaryPhone: '+15557654321',
      },
    }), 'viewer-1');

    expect(card.ownerPreview).not.toHaveProperty('phone');
    expect(card.ownerPreview).not.toHaveProperty('primaryPhone');
    warn.mockRestore();
  });

  it('returns a valid published card with public identity and badges', () => {
    const card = normalizeCard(baseCard({
      isNew: true,
      isHot: true,
      isTrending: true,
      isExclusive: true,
      isSpotlight: true,
      isVerified: true,
    }), 'viewer-1');

    expect(card).toMatchObject({
      name: 'Valid Owner',
      type: 'Investor',
      loc: 'FL',
      isNew: true,
      isHot: true,
      isTrending: true,
      isExclusive: true,
      isSpotlight: true,
      isVerified: true,
    });
    expect(card.photo).toBeTruthy();
  });

  it('returns null for suspicious names', () => {
    expect(normalizeCard(baseCard({ name: 'Owner', ownerPreview: null }), 'viewer-1')).toBeNull();
  });

  it('returns null for person cards without a published portfolio', () => {
    expect(normalizeCard(baseCard({ portfolioCount: 0, linkedProperties: [], linkedServices: [] }), 'viewer-1')).toBeNull();
  });

  it('sets isOwnCard when owner_id matches currentUserId', () => {
    const card = normalizeCard(baseCard(), 'owner-1');

    expect(card.isOwnCard).toBe(true);
  });
});
