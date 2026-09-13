import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MaxxisArvResultExperience } from './MaxxisArvResultExperience';

const base = {
  status: 'ARV_LIMITED', arvRangeLow: 2020196, arvRangeHigh: 3063156, centralReference: 2541676,
  confidence: 'LOW', eligibleCompCount: 2, limitations: ['TRANSACTION_QUALITY_UNKNOWN'],
  warnings: ['VALUATION_DISPERSION_WARNING', 'POSSIBLE_UNMODELED_FACTOR'],
  confidenceReasons: ['ELIGIBLE_COMP_COUNT_2'], evidenceSummary: { recordedSale: 'VERIFIED_RECORD',
    structuralScore: 'CALCULATED', conditionReview: 'USER_PROVIDED', arv: 'CALCULATED', confidence: 'CALCULATED' },
  valuationSet: [{ compIdentifier: 'fixture-comp', address: '436 Kekauluohi St', recordedSalePrice: 1550000,
    recordedSaleDate: '2026-04-08', distanceMiles: 0.64, structuralComparabilityScore: 84.5,
    dataCompletenessScore: 70, conditionCompatibility: 'MATCHES_TARGET', conditionEvidenceStatus: 'USER_PROVIDED',
    valuationWeight: 0.52, valuationRole: 'PRIMARY', valuationEligibility: 'INCLUDED',
    inclusionReason: 'CONDITION_MATCH', recordedSaleEvidenceStatus: 'VERIFIED_RECORD' }],
  providerAvmCrossCheck: { status: 'PROVIDER_ESTIMATE_UNAVAILABLE', value: null, evidenceStatus: 'UNAVAILABLE' },
};

describe('Maxxis ARV result experience', () => {
  it('renders range-first limited evidence, confidence, warnings and expandable evidence', () => {
    const html = renderToStaticMarkup(<MaxxisArvResultExperience evaluation={base} />);
    expect(html).toContain('$2,020,196 – $3,063,156');
    expect(html).toContain('LIMITED CONFIDENCE');
    expect(html).toContain('Confidence <strong>LOW</strong>');
    expect(html).toContain('VALUATION DISPERSION WARNING');
    expect(html).toContain('View evidence');
    expect(html).toContain('Valuation comps used');
    expect(html).toContain('Reason included:');
  });

  it('renders unavailable without zero, range, or invented provider estimate', () => {
    const html = renderToStaticMarkup(<MaxxisArvResultExperience evaluation={{ ...base,
      status: 'ARV_UNAVAILABLE', arvRangeLow: null, arvRangeHigh: null, centralReference: null,
      eligibleCompCount: 0, evidenceSummary: { ...base.evidenceSummary, arv: 'UNAVAILABLE' } }} />);
    expect(html).toContain('Not available yet');
    expect(html).not.toContain('$0');
    expect(html).not.toContain('External Provider Estimate');
  });

  it('displays a cached provider estimate in a distinct evidence section', () => {
    const html = renderToStaticMarkup(<MaxxisArvResultExperience evaluation={{ ...base,
      providerAvmCrossCheck: { status: 'PROVIDER_ESTIMATE_WITHIN_RANGE', value: 2500000, evidenceStatus: 'ESTIMATED' } }} />);
    expect(html).toContain('External Provider Estimate');
    expect(html).toContain('$2,500,000');
    expect(html).toContain('Source: RentCast');
    expect(html).toContain('not blended with the DealSifter ARV');
  });
});
