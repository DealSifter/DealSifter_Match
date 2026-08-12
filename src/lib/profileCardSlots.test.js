import { describe, expect, it } from 'vitest';
import { resolveProfileCardSlots } from './profileCardSlots';

describe('resolveProfileCardSlots', () => {
  it('keeps an explicit FSBO secondary card when the primary card comes from legacy fallback data', () => {
    expect(resolveProfileCardSlots({
      personal: '',
      secondary: '',
      fsbo: 'secondary',
    }, ['personal', 'fsbo'])).toEqual({
      explicitPrimaryProfileKey: null,
      primaryProfileKey: 'personal',
      secondaryProfileKey: 'fsbo',
    });
  });

  it('does not repeat the same profile in both slots', () => {
    expect(resolveProfileCardSlots({ fsbo: 'secondary' }, ['fsbo']).secondaryProfileKey).toBeNull();
  });
});
