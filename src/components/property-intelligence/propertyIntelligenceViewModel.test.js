import { describe, expect, it } from 'vitest';
import {
  LOCKED_INTELLIGENCE_FIELDS,
  buildIntelligenceRows,
  conflictsByField,
  formatIntelligenceValue,
} from './propertyIntelligenceViewModel';

describe('Property Intelligence presentation model', () => {
  it('uses label-only locked placeholders and never advertises an AVM estimate', () => {
    expect(LOCKED_INTELLIGENCE_FIELDS).not.toContain('estimatedValue');
    expect(JSON.stringify(LOCKED_INTELLIGENCE_FIELDS)).not.toMatch(/avm|rent estimate|comps|arv|mao/i);
  });

  it('renders missing data as Unavailable rather than a false zero', () => {
    expect(formatIntelligenceValue('assessedValue', { value: null, status: 'UNAVAILABLE' })).toBe('Unavailable');
    expect(formatIntelligenceValue('ownerOccupied', { value: null, status: 'UNAVAILABLE' })).toBe('Unavailable');
    expect(formatIntelligenceValue('annualPropertyTax', { value: 0, status: 'VERIFIED_RECORD' })).toBe('$0');
  });

  it('preserves evidence status and both conflict sources for display', () => {
    const intelligence = {
      fields: { livingAreaSqft: { value: 1218, status: 'VERIFIED_RECORD' } },
      conflicts: [{ field: 'livingAreaSqft', dealSifterValue: 1450, publicRecordValue: 1218, severity: 'WARNING' }],
    };
    expect(buildIntelligenceRows(intelligence).find((row) => row.field === 'livingAreaSqft')).toMatchObject({
      value: '1,218 sqft', status: 'VERIFIED_RECORD',
    });
    expect(conflictsByField(intelligence).get('livingAreaSqft')).toEqual(intelligence.conflicts[0]);
  });
});
