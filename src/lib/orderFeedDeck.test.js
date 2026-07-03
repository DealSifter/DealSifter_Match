import assert from 'node:assert/strict';
import { orderDeck } from './orderFeedDeck.js';

const baseCards = [
  { id: 'own-1', ownerId: 'user-1', name: 'Own', portfolioCount: 1, cat: 'owner', state: 'TX', cardKind: 'person' },
  { id: 'other-1', ownerId: 'user-2', name: 'Other 1', portfolioCount: 1, cat: 'buyer', state: 'TX', cardKind: 'person' },
  { id: 'other-2', ownerId: 'user-3', name: 'Other 2', portfolioCount: 1, cat: 'owner', state: 'CA', cardKind: 'person' },
];

const ids = (cards) => cards.map((card) => card.id);

{
  const ordered = orderDeck(baseCards, {
    currentUserId: 'user-1',
    sessionSeed: 10,
    sortPreference: 'default',
  });
  assert.equal(ordered.at(-1).id, 'own-1', 'own cards must stay last in default mode');
}

{
  const ordered = orderDeck([
    { id: 'own-spotlight', ownerId: 'user-1', portfolioCount: 1, isSpotlight: true, cardKind: 'person' },
    { id: 'other-regular', ownerId: 'user-2', portfolioCount: 1, cardKind: 'person' },
    { id: 'other-spotlight', ownerId: 'user-3', portfolioCount: 1, isSpotlight: true, cardKind: 'person' },
  ], {
    currentUserId: 'user-1',
    sessionSeed: 4,
    sortPreference: 'default',
  });
  assert.deepEqual(ids(ordered).slice(0, 2).sort(), ['other-regular', 'other-spotlight'].sort(), 'own spotlight must not jump ahead of third-party cards');
  assert.equal(ordered.at(-1).id, 'own-spotlight', 'own spotlight still belongs to own-card group');
}

{
  const first = ids(orderDeck(baseCards, { currentUserId: 'user-1', sessionSeed: 42, sortPreference: 'default' }));
  const second = ids(orderDeck(baseCards, { currentUserId: 'user-1', sessionSeed: 42, sortPreference: 'default' }));
  assert.deepEqual(first, second, 'same seed must produce same order');
}

{
  const ordered = orderDeck(baseCards, {
    currentUserId: 'user-1',
    activeFilters: { category: 'owner', state: ['CA'] },
    sessionSeed: 2,
    sortPreference: 'default',
  });
  assert.deepEqual(ids(ordered), ['other-2'], 'active filters must remove non-matching cards');
}

console.log('orderFeedDeck tests passed');
