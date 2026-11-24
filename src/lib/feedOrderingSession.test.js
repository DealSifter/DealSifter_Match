import { describe, expect, it } from 'vitest';
import { clearFeedOrderingSession, readFeedOrderingOverride, resolveFeedOrderingOverride, writeFeedOrderingOverride } from './feedOrderingSession';

const storage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
};
describe('mobile feed session ordering', () => {
  it('keeps sidebar choices across navigation/reload without updating the master', () => {
    const s = storage();
    writeFeedOrderingOverride('qa', 'recent', 'price_asc', s);
    expect(resolveFeedOrderingOverride(readFeedOrderingOverride(s), 'qa', 'recent')).toBe('price_asc');
  });
  it('uses the master for another account, changed default, or a new login', () => {
    const s = storage();
    const choice = writeFeedOrderingOverride('qa', 'recent', 'price_desc', s);
    expect(resolveFeedOrderingOverride(choice, 'another', 'recent')).toBe('recent');
    expect(resolveFeedOrderingOverride(choice, 'qa', 'name_asc')).toBe('name_asc');
    clearFeedOrderingSession(s);
    expect(resolveFeedOrderingOverride(readFeedOrderingOverride(s), 'qa', 'recent')).toBe('recent');
  });
  it('normalizes corrupted or unsupported ordering values', () => {
    expect(resolveFeedOrderingOverride({ owner: 'qa', master: 'recent', value: 'bad' }, 'qa', 'recent')).toBe('recent');
    expect(readFeedOrderingOverride({ getItem: () => '{' })).toBeNull();
  });
});
