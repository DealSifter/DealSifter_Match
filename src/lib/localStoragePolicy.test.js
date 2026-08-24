import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearSensitiveCache, clearUserScopedCache, isSensitiveLocalStorageKey } from './localStoragePolicy';

function createMemoryStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(String(key)) ? values.get(String(key)) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
  };
}

describe('local storage account isolation', () => {
  beforeEach(() => {
    globalThis.window = { localStorage: createMemoryStorage() };
  });

  afterEach(() => {
    delete globalThis.window;
  });

  it('recognizes canonical unlocked-contact caches as sensitive', () => {
    expect(isSensitiveLocalStorageKey('ds_canonical_contact_cards:user-a')).toBe(true);
  });

  it('clears all sensitive prefixes instead of only the active user suffix', () => {
    window.localStorage.setItem('ds_canonical_contact_cards:user-a', 'contacts-a');
    window.localStorage.setItem('ds_canonical_contact_cards:user-b', 'contacts-b');
    window.localStorage.setItem('theme', 'dark');
    clearSensitiveCache('user-a');
    expect(window.localStorage.getItem('ds_canonical_contact_cards:user-a')).toBeNull();
    expect(window.localStorage.getItem('ds_canonical_contact_cards:user-b')).toBeNull();
    expect(window.localStorage.getItem('theme')).toBe('dark');
  });

  it('removes user state while preserving device preferences and legal consent', () => {
    window.localStorage.setItem('professionalProfile', '{"name":"Account A"}');
    window.localStorage.setItem('chatSeenIncomingByContact', '{"owner":2}');
    window.localStorage.setItem('ds_guidetips_progress:user-a', '{}');
    window.localStorage.setItem('ds_maxxis_deal_memory_v1:user-a', '{"version":1}');
    window.localStorage.setItem('authSession', '{"userId":"user-b"}');
    window.localStorage.setItem('theme', 'light');
    window.localStorage.setItem('mapViewPanelWidth', '480');
    window.localStorage.setItem('ds_cookie_consent', '1');

    clearUserScopedCache('user-a');

    expect(window.localStorage.getItem('professionalProfile')).toBeNull();
    expect(window.localStorage.getItem('chatSeenIncomingByContact')).toBeNull();
    expect(window.localStorage.getItem('ds_guidetips_progress:user-a')).toBeNull();
    expect(window.localStorage.getItem('ds_maxxis_deal_memory_v1:user-a')).toBeNull();
    expect(window.localStorage.getItem('authSession')).toBe('{"userId":"user-b"}');
    expect(window.localStorage.getItem('theme')).toBe('light');
    expect(window.localStorage.getItem('mapViewPanelWidth')).toBe('480');
    expect(window.localStorage.getItem('ds_cookie_consent')).toBe('1');
  });
});
