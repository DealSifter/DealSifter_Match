import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => {
  const stores = new Map();
  const createStore = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const values = stores.get(name);
    return {
      getItem: vi.fn(async (key) => values.get(key) ?? null),
      setItem: vi.fn(async (key, value) => { values.set(key, value); return value; }),
      removeItem: vi.fn(async (key) => { values.delete(key); }),
      keys: vi.fn(async () => [...values.keys()]),
      clear: vi.fn(async () => { values.clear(); }),
    };
  };
  return { stores, createStore };
});

vi.mock('localforage', () => {
  const defaultStore = storage.createStore('temp_uploads');
  return {
    default: {
      ...defaultStore,
      config: vi.fn(),
      createInstance: vi.fn(({ storeName }) => storage.createStore(storeName)),
    },
  };
});

import {
  buildUserScopedStorageKey,
  clearUserData,
  getPortfolioFull,
  setPortfolioFull,
} from './localforageHelper';

describe('localforageHelper account isolation', () => {
  beforeEach(() => {
    storage.stores.forEach((store) => store.clear());
  });

  it('builds distinct keys for the same record owned by different accounts', () => {
    expect(buildUserScopedStorageKey('user-a', 'propertyPortfolio')).toBe('user-a::propertyPortfolio');
    expect(buildUserScopedStorageKey('user-b', 'propertyPortfolio')).toBe('user-b::propertyPortfolio');
  });

  it('never rehydrates one account portfolio into another account', async () => {
    await setPortfolioFull('propertyPortfolio', [{ id: 'private-a' }], 'user-a');
    await setPortfolioFull('propertyPortfolio', [{ id: 'private-b' }], 'user-b');

    await expect(getPortfolioFull('propertyPortfolio', 'user-a')).resolves.toEqual([{ id: 'private-a' }]);
    await expect(getPortfolioFull('propertyPortfolio', 'user-b')).resolves.toEqual([{ id: 'private-b' }]);
    await expect(getPortfolioFull('propertyPortfolio', 'user-c')).resolves.toBeNull();
  });

  it('clears only the account that signed out', async () => {
    await setPortfolioFull('servicePortfolio', [{ id: 'service-a' }], 'user-a');
    await setPortfolioFull('servicePortfolio', [{ id: 'service-b' }], 'user-b');

    await clearUserData('user-a');

    await expect(getPortfolioFull('servicePortfolio', 'user-a')).resolves.toBeNull();
    await expect(getPortfolioFull('servicePortfolio', 'user-b')).resolves.toEqual([{ id: 'service-b' }]);
  });
});
