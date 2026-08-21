import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeDealFacts } from './dealAdvisor.ts';
import { calculateDealMetrics } from './dealMetrics.ts';
import {
  CANONICAL_PROPERTY_SERVICE_TYPES,
  identifyPropertyServiceNeeds,
} from './propertyServiceNeeds.ts';
import type { IdentifyPropertyServiceNeedsInput } from './propertyServiceNeeds.ts';
import type { MaxxisPropertyDetails } from './types.ts';

type InputOverrides = {
  property?: Partial<MaxxisPropertyDetails>;
  missingFields?: string[];
};

function input(overrides: InputOverrides = {}): IdentifyPropertyServiceNeedsInput {
  const property: MaxxisPropertyDetails = {
    id: '11111111-1111-4111-8111-111111111111',
    type: 'SFR',
    city: 'Dallas',
    state: 'TX',
    zip: '75201',
    price: 125_000,
    beds: 3,
    baths: 2,
    sqft: '1500',
    improvement: '',
    lot: '',
    dealTag: '',
    objective: 'Partner',
    rehab: null,
    capRate: null,
    description: 'Published property description.',
    markets: ['TX'],
    images: ['https://cdn.example.com/property.jpg'],
    published: true,
    dealClosed: false,
    ...overrides.property,
  };
  const metrics = calculateDealMetrics({
    price: property.price,
    sqft: property.sqft,
    rehab: property.rehab,
    capRate: property.capRate,
  });
  const missingFields = overrides.missingFields || (property.rehab === null ? ['rehab', 'cap_rate'] : ['cap_rate']);
  const analysis = analyzeDealFacts({ property, metrics, missingFields });
  return { property, metrics, analysis };
}

describe('Phase 3F identifyPropertyServiceNeeds', () => {
  it('returns canonical service needs for an objectively reported rehab', () => {
    const result = identifyPropertyServiceNeeds(input({ property: { rehab: 25_000 } }));
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ serviceType: 'General Contractor', reasonCode: 'rehab_reported', confidence: 'high' }),
      expect.objectContaining({ serviceType: 'Rehab Staff', reasonCode: 'rehab_reported', confidence: 'medium' }),
    ]));
  });

  it('returns an empty list when no objective rule applies', () => {
    expect(identifyPropertyServiceNeeds(input())).toEqual([]);
  });

  it('consolidates two rules that point to General Contractor', () => {
    const result = identifyPropertyServiceNeeds(input({
      property: { rehab: 25_000, objective: 'New Construction' },
    }));
    const contractorNeeds = result.filter((need) => need.serviceType === 'General Contractor');
    expect(contractorNeeds).toHaveLength(1);
    expect(contractorNeeds[0].confidence).toBe('high');
    expect(contractorNeeds[0].sourceSignals).toEqual(expect.arrayContaining([
      'property.rehab',
      'property.objective.new_construction',
    ]));
  });

  it('does not invent a Survey need when the structured objective is absent', () => {
    const result = identifyPropertyServiceNeeds(input({ property: { type: 'Land', objective: '' } }));
    expect(result.some((need) => need.serviceType === 'Survey')).toBe(false);
  });

  it('ignores service names that appear only in free-form description', () => {
    const result = identifyPropertyServiceNeeds(input({
      property: { description: 'Hire a photographer, attorney, plumber and inspector.' },
    }));
    expect(result).toEqual([]);
  });

  it('never emits a category outside the real product taxonomy', () => {
    const result = identifyPropertyServiceNeeds(input({
      property: { rehab: 25_000, description: 'Plumber and electrician requested.' },
    }));
    result.forEach((need) => expect(CANONICAL_PROPERTY_SERVICE_TYPES).toContain(need.serviceType));
    expect(result.some((need) => String(need.serviceType).match(/plumb|electric/i))).toBe(false);
  });

  it('keeps Gemini from creating or changing service needs', () => {
    const chatSource = readFileSync(new URL('../../maxxis-chat/index.ts', import.meta.url), 'utf8');
    expect(chatSource).toContain('Never create, remove, or reclassify Deal Advisor signals');
    expect(chatSource).toContain('Never add a service, remove a service, change service confidence');
    expect(chatSource).toContain('choose a provider');
  });

  it('does not call searchServices from property analysis', () => {
    const engineSource = readFileSync(new URL('./propertyServiceNeeds.ts', import.meta.url), 'utf8');
    const detailsSource = readFileSync(new URL('./propertyDetails.ts', import.meta.url), 'utf8');
    expect(engineSource).not.toContain("from './searchServices.ts'");
    expect(detailsSource).not.toContain('searchServices(');
    expect(detailsSource).toContain('identifyPropertyServiceNeeds({');
  });

  it('leaves the factual Deal Advisor output unchanged', () => {
    const advisorInput = input({ property: { rehab: 25_000, capRate: 7.25 }, missingFields: [] });
    expect(advisorInput.analysis.positiveSignals).toEqual([
      'property_published',
      'basic_details_complete',
      'price_per_sqft_calculable',
      'acquisition_plus_rehab_calculable',
      'rehab_reported',
      'cap_rate_reported',
    ]);
    expect(advisorInput.analysis.limitations).toContain('cap_rate_not_independently_verified');
  });

  it('returns no provider, contact, owner, price, or unlock data', () => {
    const serviceInput = input({ property: { rehab: 25_000 } });
    Object.assign(serviceInput.property, {
      ownerName: 'Private Owner',
      email: 'private@example.com',
      phone: '+15555555555',
      unlockCost: 30,
    });
    const result = identifyPropertyServiceNeeds(serviceInput);
    result.forEach((need) => {
      expect(Object.keys(need)).toEqual(['serviceType', 'reasonCode', 'confidence', 'sourceSignals']);
    });
    expect(JSON.stringify(result)).not.toMatch(/provider|contact|owner|private|unlock|price/i);
  });
});
