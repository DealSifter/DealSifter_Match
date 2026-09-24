import { describe, expect, it } from 'vitest';
import { explainMaxxisEvidenceList, explainMaxxisEvidenceState } from './maxxisUserFacingEvidence';

describe('Maxxis user-facing evidence copy', () => {
  it.each([
    ['MISSING_REHAB', 'Rehabilitation scope'],
    ['arv_not_structured', 'defensible ARV'],
    ['property_data_not_independently_verified', 'independently verified'],
    ['cap_rate_not_independently_verified', 'capitalization rate'],
    ['roi_not_calculated', 'ROI cannot yet be calculated'],
  ])('translates %s without exposing a system code', (code, expected) => {
    const output = explainMaxxisEvidenceState(code);
    expect(output).toContain(expected);
    expect(output).not.toContain(code);
  });

  it('deduplicates translated output', () => {
    expect(explainMaxxisEvidenceList(['MISSING_REHAB', 'MISSING_REHAB'])).toHaveLength(1);
  });
});
