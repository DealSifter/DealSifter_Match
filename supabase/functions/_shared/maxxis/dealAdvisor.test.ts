import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calculateDealMetrics } from './dealMetrics.ts';
import { analyzeDealFacts } from './dealAdvisor.ts';
import type { AnalyzeDealFactsInput } from './dealAdvisor.ts';

function input(overrides: Partial<AnalyzeDealFactsInput> = {}): AnalyzeDealFactsInput {
  const property = {
    id: '11111111-1111-4111-8111-111111111111',
    type: 'Single Family',
    city: 'Dallas',
    state: 'TX',
    zip: '75201',
    price: 125_000,
    beds: 3,
    baths: 2,
    sqft: '1500',
    improvement: 'Updated kitchen',
    lot: '0.2 acre',
    dealTag: 'Wholesale',
    objective: 'Fix & Flip',
    rehab: 25_000,
    capRate: 7.25,
    description: 'Published property description.',
    markets: ['Dallas, TX'],
    images: ['https://cdn.example.com/property.jpg'],
    published: true,
    dealClosed: false,
    ...(overrides.property || {}),
  };
  const metrics = overrides.metrics || calculateDealMetrics({
    price: property.price,
    sqft: property.sqft,
    rehab: property.rehab,
    capRate: property.capRate,
  });
  return {
    property,
    metrics,
    missingFields: overrides.missingFields || [],
  };
}

describe('Phase 3E analyzeDealFacts', () => {
  it('returns only relevant factual signals for a complete property', () => {
    const result = analyzeDealFacts(input());
    expect(result.positiveSignals).toEqual([
      'property_published',
      'basic_details_complete',
      'price_per_sqft_calculable',
      'acquisition_plus_rehab_calculable',
      'rehab_reported',
      'cap_rate_reported',
    ]);
    expect(result.missingInformation).toEqual([]);
  });

  it('reports missing sqft as attention and missing information', () => {
    const result = analyzeDealFacts(input({
      property: { sqft: '' } as AnalyzeDealFactsInput['property'],
      missingFields: ['sqft'],
    }));
    expect(result.attentionPoints).toContain('sqft_missing_or_invalid');
    expect(result.attentionPoints).toContain('price_per_sqft_unavailable');
    expect(result.missingInformation).toContain('sqft');
  });

  it('reports missing rehab without creating an acquisition signal', () => {
    const result = analyzeDealFacts(input({
      property: { rehab: null } as AnalyzeDealFactsInput['property'],
      missingFields: ['rehab'],
    }));
    expect(result.attentionPoints).toContain('rehab_missing_or_invalid');
    expect(result.attentionPoints).toContain('acquisition_plus_rehab_unavailable');
    expect(result.positiveSignals).not.toContain('rehab_reported');
    expect(result.positiveSignals).not.toContain('acquisition_plus_rehab_calculable');
  });

  it('marks a reported cap rate as stored and not independently verified', () => {
    const result = analyzeDealFacts(input());
    expect(result.positiveSignals).toContain('cap_rate_reported');
    expect(result.attentionPoints).toContain('cap_rate_reported_not_calculated');
    expect(result.limitations).toContain('cap_rate_not_independently_verified');
  });

  it('does not invent positive signals when facts and metrics are insufficient', () => {
    const result = analyzeDealFacts(input({
      property: {
        type: '', city: '', state: '', zip: '', price: null, sqft: '', rehab: null,
        capRate: null, published: false, dealClosed: false,
      } as AnalyzeDealFactsInput['property'],
      missingFields: ['type', 'city', 'state', 'zip', 'price', 'sqft', 'rehab', 'cap_rate'],
    }));
    expect(result.positiveSignals).toEqual([]);
  });

  it('consolidates missingFields and metric missingInputs without duplicates', () => {
    const result = analyzeDealFacts(input({
      property: { price: null, sqft: '', rehab: null, capRate: null } as AnalyzeDealFactsInput['property'],
      missingFields: ['price', 'sqft', 'sqft', 'rehab', 'cap_rate'],
    }));
    expect(result.missingInformation).toEqual(['price', 'sqft', 'rehab', 'capRate']);
    expect(new Set(result.missingInformation).size).toBe(result.missingInformation.length);
  });

  it('never emits prohibited decision language', () => {
    const serialized = JSON.stringify(analyzeDealFacts(input())).toLowerCase();
    ['buy', 'avoid', 'recommended', 'best deal'].forEach((term) => expect(serialized).not.toContain(term));
  });

  it('keeps signal creation in code and out of Gemini', () => {
    const detailsSource = readFileSync(new URL('./propertyDetails.ts', import.meta.url), 'utf8');
    const chatSource = readFileSync(new URL('../../maxxis-chat/index.ts', import.meta.url), 'utf8');
    expect(detailsSource).toContain('analyzeDealFacts({');
    expect(chatSource).toContain('analysis: result.analysis');
    expect(chatSource).toContain('Never create, remove, or reclassify Deal Advisor signals');
  });

  it('cannot expose protected fields through its code-only output', () => {
    const advisorInput = input();
    Object.assign(advisorInput.property, {
      address: '123 Private Street',
      email: 'private@example.com',
      ownerName: 'Private Owner',
      unlockCost: 30,
    });
    const serialized = JSON.stringify(analyzeDealFacts(advisorInput));
    expect(serialized).not.toContain('Private');
    expect(serialized).not.toContain('private@example.com');
    expect(serialized).not.toContain('unlockCost');
  });

  it('does not create any score or grade field', () => {
    const result = analyzeDealFacts(input()) as unknown as Record<string, unknown>;
    expect(Object.keys(result)).toEqual(['positiveSignals', 'attentionPoints', 'missingInformation', 'limitations']);
    expect(JSON.stringify(result)).not.toMatch(/score|grade/i);
  });
});
