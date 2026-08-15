import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  findServicesForPropertyNeeds,
  type ServiceSearch,
} from './findServicesForPropertyNeeds.ts';
import type {
  MaxxisServiceResult,
  PropertyServiceNeed,
  PropertyServiceNeedConfidence,
  PropertyServiceType,
} from './types.ts';

vi.mock('./searchServices.ts', () => ({ searchServices: vi.fn(), searchServicesBatch: vi.fn() }));

function serviceNeed(
  serviceType: PropertyServiceType,
  confidence: PropertyServiceNeedConfidence = 'high',
): PropertyServiceNeed {
  return {
    serviceType,
    confidence,
    reasonCode: 'rehab_reported',
    sourceSignals: ['property.rehab'],
  };
}

function service(id: string, serviceType = 'General Contractor'): MaxxisServiceResult {
  return {
    id,
    title: `Published service ${id}`,
    serviceType,
    description: 'Public service description.',
    price: 500,
    markets: ['Dallas, TX'],
    image: 'https://cdn.example.com/service.jpg',
  };
}

describe('Phase 3G findServicesForPropertyNeeds', () => {
  it('returns a compatible published provider from the existing service search', async () => {
    const search: ServiceSearch = vi.fn(async () => [service('service-1')]);
    const result = await findServicesForPropertyNeeds({
      property: { city: 'Dallas', state: 'TX' },
      serviceNeeds: [serviceNeed('General Contractor')],
      authHeader: 'Bearer test',
    }, search);
    expect(result.serviceMatches[0]).toEqual({
      serviceType: 'General Contractor',
      confidence: 'high',
      services: [{
        ...service('service-1'),
        contactAccess: undefined,
        fit: expect.objectContaining({ score: 100, classification: 'strong_fit', calculable: true }),
      }],
    });
    expect(search).toHaveBeenCalledWith({ category: 'General Contractor', city: 'Dallas', state: 'TX', limit: 3 }, 'Bearer test');
  });

  it('keeps the service need match with an empty services list', async () => {
    const search: ServiceSearch = vi.fn(async () => []);
    const result = await findServicesForPropertyNeeds({
      property: { city: '', state: 'TX' },
      serviceNeeds: [serviceNeed('Inspections')],
      authHeader: 'Bearer test',
    }, search);
    expect(result.serviceMatches).toEqual([{
      serviceType: 'Inspections',
      confidence: 'high',
      services: [],
    }]);
  });

  it('falls back from city and state to state when the city has no result', async () => {
    const search: ServiceSearch = vi.fn(async (filters) => (
      filters.city ? [] : [service('state-service')]
    ));
    const result = await findServicesForPropertyNeeds({
      property: { city: 'Dallas', state: 'TX' },
      serviceNeeds: [serviceNeed('General Contractor')],
      authHeader: 'Bearer test',
    }, search);
    expect(search).toHaveBeenCalledTimes(2);
    expect(search).toHaveBeenNthCalledWith(2, { category: 'General Contractor', state: 'TX', limit: 3 }, 'Bearer test');
    expect(result.serviceMatches[0].services).toHaveLength(1);
    expect(result.summary.cityToStateFallbackUsed).toBe(true);
  });

  it('processes high confidence before medium while preserving deterministic order', async () => {
    const categories: string[] = [];
    const search: ServiceSearch = vi.fn(async (filters) => {
      categories.push(String(filters.category));
      return [];
    });
    await findServicesForPropertyNeeds({
      property: { city: '', state: '' },
      serviceNeeds: [
        serviceNeed('Rehab Staff', 'medium'),
        serviceNeed('Photography', 'high'),
        serviceNeed('Survey', 'high'),
      ],
      authHeader: 'Bearer test',
    }, search);
    expect(categories).toEqual(['Photography', 'Survey', 'Rehab Staff']);
  });

  it('processes no more than three unique service needs', async () => {
    const search: ServiceSearch = vi.fn(async () => []);
    const result = await findServicesForPropertyNeeds({
      property: { city: '', state: '' },
      serviceNeeds: [
        serviceNeed('General Contractor'),
        serviceNeed('Photography'),
        serviceNeed('Survey'),
        serviceNeed('Inspections'),
      ],
      authHeader: 'Bearer test',
    }, search);
    expect(result.serviceMatches).toHaveLength(3);
    expect(result.summary.searchesPerformed).toBe(3);
  });

  it('limits every service match to three providers', async () => {
    const search: ServiceSearch = vi.fn(async () => [
      service('1'), service('2'), service('3'), service('4'), service('5'),
    ]);
    const result = await findServicesForPropertyNeeds({
      property: { city: '', state: '' },
      serviceNeeds: [serviceNeed('General Contractor')],
      authHeader: 'Bearer test',
    }, search);
    expect(result.serviceMatches[0].services.map((item) => item.id)).toEqual(['1', '2', '3']);
  });

  it('projects only fields already authorized by searchServices', async () => {
    const unsafe = {
      ...service('safe'),
      phone: '+15555555555',
      email: 'private@example.com',
      whatsapp: '+15555555555',
      owner: { id: 'private-owner' },
      unlockCost: 30,
      privateAddress: '123 Private Street',
    };
    const search: ServiceSearch = vi.fn(async () => [unsafe]);
    const result = await findServicesForPropertyNeeds({
      property: { city: '', state: '' },
      serviceNeeds: [serviceNeed('General Contractor')],
      authHeader: 'Bearer test',
    }, search);
    expect(Object.keys(result.serviceMatches[0].services[0])).toEqual([
      'id', 'title', 'serviceType', 'description', 'price', 'markets', 'image', 'contactAccess', 'fit',
    ]);
    expect(JSON.stringify(result.serviceMatches)).not.toMatch(/phone|email|whatsapp|owner|privateAddress/i);
  });

  it('prevents Gemini from inventing categories, providers, or provider ranking', () => {
    const chatSource = readFileSync(new URL('../../maxxis-chat/index.ts', import.meta.url), 'utf8');
    const registrySource = readFileSync(new URL('./toolRegistry.ts', import.meta.url), 'utf8');
    expect(chatSource).toContain('Never create, remove, or reclassify Deal Advisor signals');
    expect(chatSource).toContain('service needs, categories, or providers');
    expect(chatSource).toContain('Never add a service, remove a service, change service confidence');
    expect(registrySource).toContain('the backend alone derives the categories from serviceNeeds');
  });

  it('uses the batched search service as the sole real provider source without a table query', () => {
    const source = readFileSync(new URL('./findServicesForPropertyNeeds.ts', import.meta.url), 'utf8');
    expect(source).toContain('searchServicesBatch');
    expect(source).toContain('searchServicesBatch(primaryFilters');
    expect(source).toContain('serviceSearch(primaryFilters, input.authHeader)');
    expect(source).not.toContain(".from('services')");
    expect(source).not.toContain('.from("services")');
  });

  it('does not consume Nuggets or expand the registered tool surface while carrying safe contact access state', () => {
    const source = readFileSync(new URL('./findServicesForPropertyNeeds.ts', import.meta.url), 'utf8');
    const registrySource = readFileSync(new URL('./toolRegistry.ts', import.meta.url), 'utf8');
    const names = Array.from(registrySource.matchAll(/\n\s+name: '([^']+)'/g), (match) => match[1]);
    expect(source).toContain('contactAccess');
    expect(source).not.toMatch(/consume|purchase|ds_purchase|intent/i);
    expect(names).toEqual(['searchProperties', 'searchServices', 'getMyInvestmentProfile', 'getPropertyDetails', 'getDealCopilotOverview', 'compareProperties']);
  });
});
