import { describe, expect, it } from 'vitest';
import { orderDeck } from './orderFeedDeck.js';

const baseCards = [
  { id: 'own-1', ownerId: 'user-1', name: 'Own', portfolioCount: 1, cat: 'owner', state: 'TX', cardKind: 'person' },
  { id: 'other-1', ownerId: 'user-2', name: 'Other 1', portfolioCount: 1, cat: 'buyer', state: 'TX', cardKind: 'person' },
  { id: 'other-2', ownerId: 'user-3', name: 'Other 2', portfolioCount: 1, cat: 'owner', state: 'CA', cardKind: 'person' },
];

const ids = (cards) => cards.map((card) => card.id);

describe('orderFeedDeck', () => {
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
});
