import { describe, expect, it } from 'vitest';
import { orderDeck } from './orderFeedDeck.js';

const baseCards = [
  { id: 'own-1', ownerId: 'user-1', name: 'Own', portfolioCount: 1, cat: 'owner', state: 'TX', cardKind: 'person' },
  { id: 'other-1', ownerId: 'user-2', name: 'Other 1', portfolioCount: 1, cat: 'buyer', state: 'TX', cardKind: 'person' },
  { id: 'other-2', ownerId: 'user-3', name: 'Other 2', portfolioCount: 1, cat: 'owner', state: 'CA', cardKind: 'person' },
];

const ids = (cards) => cards.map((card) => card.id);

describe('orderFeedDeck', () => {
  it.each(['random', 'recent', 'name_asc', 'price_asc', 'price_desc'])('puts match before the %s preset', sortPreference => {
    const cards = [
      { id: 'low', cardKind: 'property', name: 'A', price: 1, createdAt: '2026-11-24', match: 20 },
      { id: 'high', cardKind: 'property', name: 'Z', price: 900000, createdAt: '2020-01-01', match: 95 },
      { id: 'unknown', cardKind: 'property', name: '0', price: 0, match: null },
    ];
    expect(ids(orderDeck(cards, { sortPreference, getMatchScore: card => card.match }))).toEqual(['high', 'low', 'unknown']);
  });
  it.each([
    ['recent', ['b', 'a', 'c']], ['name_asc', ['c', 'b', 'a']],
    ['price_asc', ['a', 'c', 'b']], ['price_desc', ['b', 'c', 'a']],
  ])('uses %s to order equal match scores', (sortPreference, expected) => {
    const cards = [
      { id: 'a', name: 'Z', price: 0, createdAt: '2025-01-01', cardKind: 'property' },
      { id: 'b', name: 'B', price: 500000, createdAt: '2026-01-01', cardKind: 'property' },
      { id: 'c', name: 'A', price: 100000, createdAt: '2020-01-01', cardKind: 'property' },
    ];
    expect(ids(orderDeck(cards, { sortPreference, getMatchScore: () => 80 }))).toEqual(expected);
  });
  it('preserves sponsored placement and orders by match within that group', () => {
    const cards = [
      { id: 'organic', cardKind: 'property', match: 100 },
      { id: 'sponsor-low', cardKind: 'property', isSpotlight: true, match: 30 },
      { id: 'sponsor-high', cardKind: 'property', isSpotlight: true, match: 80 },
    ];
    expect(ids(orderDeck(cards, { getMatchScore: card => card.match }))).toEqual(['sponsor-high', 'sponsor-low', 'organic']);
  });
  it('supports the gated own-card preset without changing the default own placement', () => {
    expect(orderDeck(baseCards, { currentUserId: 'user-1', sortPreference: 'my_cards_first' })[0].id).toBe('own-1');
  });
  it('keeps own cards last in default mode', () => {
    const ordered = orderDeck(baseCards, {
      currentUserId: 'user-1',
      sessionSeed: 10,
      sortPreference: 'default',
    });

    expect(ordered.at(-1).id).toBe('own-1');
  });

  it('does not let own spotlight cards jump ahead of third-party cards', () => {
    const ordered = orderDeck([
      { id: 'own-spotlight', ownerId: 'user-1', portfolioCount: 1, isSpotlight: true, cardKind: 'person' },
      { id: 'other-regular', ownerId: 'user-2', portfolioCount: 1, cardKind: 'person' },
      { id: 'other-spotlight', ownerId: 'user-3', portfolioCount: 1, isSpotlight: true, cardKind: 'person' },
    ], {
      currentUserId: 'user-1',
      sessionSeed: 4,
      sortPreference: 'default',
    });

    expect(ids(ordered).slice(0, 2).sort()).toEqual(['other-regular', 'other-spotlight'].sort());
    expect(ordered.at(-1).id).toBe('own-spotlight');
  });

  it('produces deterministic order for the same seed', () => {
    const first = ids(orderDeck(baseCards, { currentUserId: 'user-1', sessionSeed: 42, sortPreference: 'default' }));
    const second = ids(orderDeck(baseCards, { currentUserId: 'user-1', sessionSeed: 42, sortPreference: 'default' }));

    expect(first).toEqual(second);
  });

  it('filters cards by active category and state', () => {
    const ordered = orderDeck(baseCards, {
      currentUserId: 'user-1',
      activeFilters: { category: 'owner', state: ['CA'] },
      sessionSeed: 2,
      sortPreference: 'default',
    });

    expect(ids(ordered)).toEqual(['other-2']);
  });

  it('treats FSBO cards as owner/seller category in feed filters', () => {
    const ordered = orderDeck([
      { id: 'fsbo-1', ownerId: 'user-2', name: 'FSBO Owner', portfolioCount: 1, cat: 'fsbo', state: 'HI', cardKind: 'person' },
      { id: 'buyer-1', ownerId: 'user-3', name: 'Buyer', portfolioCount: 1, cat: 'buyer', state: 'HI', cardKind: 'person' },
    ], {
      currentUserId: 'user-1',
      activeFilters: { category: 'seller' },
      sessionSeed: 3,
      sortPreference: 'default',
    });

    expect(ids(ordered)).toEqual(['fsbo-1']);
  });
});
