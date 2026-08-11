import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  getPropertyDetailsWithClient,
  normalizePropertyDetails,
  resolvePropertyDetailsInput,
  validateGetPropertyDetailsInput,
} from './propertyDetails.ts';

const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_PROPERTY_ID = '22222222-2222-4222-8222-222222222222';

const completeRow = {
  id: PROPERTY_ID,
  type: 'Single Family',
  city: 'Dallas',
  state: 'TX',
  zip: '75201',
  price: 175_000,
  beds: 3,
  baths: 2,
  sqft: '1450',
  improvement: 'Renovated kitchen',
  lot: '0.18 acre',
  deal_tag: 'Wholesale',
  objective: 'Fix & Flip',
  rehab: 35_000,
  cap_rate: 7.2,
  description: 'Published property description.',
  markets: ['Dallas, TX'],
  is_active: true,
  publish_to_showcase: true,
  deal_closed: false,
};

function clientWith(property: Record<string, unknown> | null, images: Array<Record<string, unknown>> = []) {
  const propertyEq = vi.fn();
  const imageEq = vi.fn();
  const propertyQuery: any = {
    select: vi.fn(() => propertyQuery),
    eq: propertyEq.mockImplementation(() => propertyQuery),
    or: vi.fn(() => propertyQuery),
    maybeSingle: vi.fn(async () => ({ data: property, error: null })),
  };
  const imageQuery: any = {
    select: vi.fn(() => imageQuery),
    eq: imageEq.mockImplementation(() => imageQuery),
    order: vi.fn(() => imageQuery),
    limit: vi.fn(async () => ({ data: images, error: null })),
  };
  const from = vi.fn((table: string) => table === 'properties' ? propertyQuery : imageQuery);
  return { client: { from }, from, propertyEq, imageEq };
}

describe('getPropertyDetails', () => {
  it('returns normalized details for a valid visible property', async () => {
    const { client, propertyEq } = clientWith(completeRow, [
      { image_url: 'https://cdn.example.com/property.jpg', sort_order: 0 },
    ]);
    const result = await getPropertyDetailsWithClient({ propertyId: PROPERTY_ID }, client);
    expect(result).toEqual({
      found: true,
      property: expect.objectContaining({
        id: PROPERTY_ID,
        type: 'Single Family',
        city: 'Dallas',
        state: 'TX',
        price: 175_000,
        images: ['https://cdn.example.com/property.jpg'],
        published: true,
        dealClosed: false,
      }),
      missingFields: [],
      metrics: expect.objectContaining({
        metrics: expect.objectContaining({
          pricePerSqft: expect.objectContaining({ calculable: true, source: 'calculated' }),
          acquisitionPlusRehab: expect.objectContaining({ calculable: true, source: 'calculated' }),
          capRate: expect.objectContaining({ value: 7.2, calculable: true, source: 'stored' }),
        }),
      }),
      analysis: expect.objectContaining({
        positiveSignals: expect.arrayContaining(['property_published', 'price_per_sqft_calculable']),
        attentionPoints: expect.arrayContaining(['cap_rate_reported_not_calculated']),
        missingInformation: [],
        limitations: expect.arrayContaining(['cap_rate_not_independently_verified']),
      }),
      serviceNeeds: expect.arrayContaining([
        expect.objectContaining({ serviceType: 'General Contractor', confidence: 'high' }),
        expect.objectContaining({ serviceType: 'Rehab Staff', confidence: 'medium' }),
      ]),
      serviceMatches: null,
    });
    expect(propertyEq).toHaveBeenCalledWith('is_active', true);
    expect(propertyEq).toHaveBeenCalledWith('publish_to_showcase', true);
  });

  it('returns the same safe empty result for a nonexistent property', async () => {
    const { client, from } = clientWith(null);
    await expect(getPropertyDetailsWithClient({ propertyId: PROPERTY_ID }, client)).resolves.toEqual({
      found: false,
      property: null,
      missingFields: [],
      metrics: null,
      analysis: null,
      serviceNeeds: [],
      serviceMatches: null,
    });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('does not distinguish a row hidden by RLS from a nonexistent row', async () => {
    const rlsVisibleRow = null;
    const { client, from } = clientWith(rlsVisibleRow);
    const result = await getPropertyDetailsWithClient({ propertyId: PROPERTY_ID }, client);
    expect(result).toEqual({ found: false, property: null, missingFields: [], metrics: null, analysis: null, serviceNeeds: [], serviceMatches: null });
    expect(from).not.toHaveBeenCalledWith('users');
    expect(from).not.toHaveBeenCalledWith('property_unlocks');
  });

  it('reports only relevant real schema fields as missing', () => {
    const result = normalizePropertyDetails({
      ...completeRow,
      zip: '',
      price: 0,
      sqft: '',
      objective: '',
      rehab: 0,
      cap_rate: null,
      description: '',
    });
    expect(result.missingFields).toEqual([
      'zip', 'price', 'sqft', 'objective', 'rehab', 'cap_rate', 'description', 'images',
    ]);
  });

  it('never returns protected, contact, owner, unlock, address, or signed-link fields', () => {
    const result = normalizePropertyDetails({
      ...completeRow,
      address: '123 Private Street',
      owner_id: OTHER_PROPERTY_ID,
      owner_name: 'Private Owner',
      email: 'private@example.com',
      phone: '+15555555555',
      whatsapp: '+15555555555',
      unlock_cost: 20,
      lat: 32.7,
      lng: -96.8,
      source: 'admin',
      description: 'Call +1 (555) 555-5555 or private@example.com and visit https://private.example.com/deal',
    }, [
      { image_url: 'https://cdn.example.com/public.jpg' },
      { image_url: 'https://project.supabase.co/storage/v1/object/sign/private/file.jpg?token=secret' },
    ]);
    const property = result.property as Record<string, unknown>;
    expect(property.images).toEqual(['https://cdn.example.com/public.jpg']);
    expect(property.description).not.toContain('555');
    expect(property.description).not.toContain('private@example.com');
    expect(property.description).not.toContain('https://private.example.com');
    ['address', 'owner_id', 'owner_name', 'email', 'phone', 'whatsapp', 'unlock_cost', 'lat', 'lng', 'source']
      .forEach((field) => expect(property).not.toHaveProperty(field));
  });

  it('accepts only propertyId and rejects arbitrary or ownership inputs', () => {
    expect(validateGetPropertyDetailsInput({ propertyId: PROPERTY_ID })).toEqual({ propertyId: PROPERTY_ID });
    expect(validateGetPropertyDetailsInput({ propertyId: PROPERTY_ID, includeServiceMatches: true }))
      .toEqual({ propertyId: PROPERTY_ID, includeServiceMatches: true });
    expect(validateGetPropertyDetailsInput({ propertyId: PROPERTY_ID, includeOperationalContext: true }))
      .toEqual({ propertyId: PROPERTY_ID, includeOperationalContext: true });
    expect(() => validateGetPropertyDetailsInput({ propertyId: PROPERTY_ID, includeServiceMatches: 'true' }))
      .toThrow('INVALID_PROPERTY_DETAILS_INPUT');
    expect(() => validateGetPropertyDetailsInput({ propertyId: PROPERTY_ID, includeOperationalContext: 'true' }))
      .toThrow('INVALID_PROPERTY_DETAILS_INPUT');
    expect(() => validateGetPropertyDetailsInput({ propertyId: PROPERTY_ID, ownerId: OTHER_PROPERTY_ID })).toThrow('INVALID_PROPERTY_DETAILS_INPUT');
    expect(() => validateGetPropertyDetailsInput({ propertyId: PROPERTY_ID, sql: 'select *' })).toThrow('INVALID_PROPERTY_DETAILS_INPUT');
  });

  it('prevents Gemini from inventing or substituting a propertyId', () => {
    expect(resolvePropertyDetailsInput({ propertyId: PROPERTY_ID }, PROPERTY_ID)).toEqual({ propertyId: PROPERTY_ID });
    expect(resolvePropertyDetailsInput({ propertyId: PROPERTY_ID, includeServiceMatches: true }, PROPERTY_ID))
      .toEqual({ propertyId: PROPERTY_ID, includeServiceMatches: true });
    expect(() => resolvePropertyDetailsInput({ propertyId: OTHER_PROPERTY_ID }, PROPERTY_ID)).toThrow('PROPERTY_CONTEXT_MISMATCH');
    expect(() => resolvePropertyDetailsInput({ propertyId: PROPERTY_ID }, '')).toThrow('PROPERTY_CONTEXT_REQUIRED');
  });
});

describe('Phase 3A integration contracts', () => {
  const registrySource = readFileSync(new URL('./toolRegistry.ts', import.meta.url), 'utf8');
  const chatSource = readFileSync(new URL('../../maxxis-chat/index.ts', import.meta.url), 'utf8');

  it('keeps the existing tools registered while adding the Deal Copilot overview tool', () => {
    const names = Array.from(registrySource.matchAll(/\n\s+name: '([^']+)'/g), (match) => match[1]);
    expect(names).toEqual(['searchProperties', 'searchServices', 'getMyInvestmentProfile', 'getPropertyDetails', 'getDealCopilotOverview', 'compareProperties']);
    expect(registrySource).toContain("if (name === 'searchProperties')");
    expect(registrySource).toContain('searchMatchedProperties(args, authHeader)');
    expect(registrySource).toContain("if (name === 'searchServices')");
    expect(registrySource).toContain('searchServices(filters, authHeader)');
    expect(registrySource).toContain("if (name === 'compareProperties')");
    expect(registrySource).toContain('resolveComparePropertiesInput(args, context.propertyIds)');
  });

  it('keeps the HTTP 401 authentication gate before Gemini and tool execution', () => {
    const unauthorizedAt = chatSource.indexOf("error: 'UNAUTHORIZED' }, 401");
    expect(unauthorizedAt).toBeGreaterThan(-1);
    expect(unauthorizedAt).toBeLessThan(chatSource.indexOf('callGemini('));
    expect(unauthorizedAt).toBeLessThan(chatSource.indexOf('executeMaxxisTool('));
  });
});

describe('Phase 3C property details and deal metrics integration', () => {
  const chatSource = readFileSync(new URL('../../maxxis-chat/index.ts', import.meta.url), 'utf8');
  const propertyDetailsSource = readFileSync(new URL('./propertyDetails.ts', import.meta.url), 'utf8');
  const assistantSource = readFileSync(new URL('../../../../src/components/maxxis/MaxxisAssistant.jsx', import.meta.url), 'utf8');

  it('returns the three deterministic metrics with their exact sources', async () => {
    const { client } = clientWith({
      ...completeRow,
      price: 125_000,
      sqft: '1500',
      rehab: 25_000,
      cap_rate: 7.25,
    });
    const result = await getPropertyDetailsWithClient({ propertyId: PROPERTY_ID }, client);
    expect(result.metrics).toEqual({
      metrics: {
        pricePerSqft: { value: 83.33, calculable: true, source: 'calculated', missingInputs: [], reason: null },
        acquisitionPlusRehab: { value: 150_000, calculable: true, source: 'calculated', missingInputs: [], reason: null },
        capRate: { value: 7.25, calculable: true, source: 'stored', missingInputs: [], reason: null },
      },
      missingInputs: [],
    });
  });

  it('marks price per sqft unavailable when sqft is absent', async () => {
    const { client } = clientWith({ ...completeRow, price: 125_000, sqft: null });
    const result = await getPropertyDetailsWithClient({ propertyId: PROPERTY_ID }, client);
    expect(result.metrics?.metrics.pricePerSqft).toEqual(expect.objectContaining({
      calculable: false,
      missingInputs: ['sqft'],
      reason: 'missing_inputs',
    }));
  });

  it('marks acquisition plus rehab unavailable when rehab is absent', async () => {
    const { client } = clientWith({ ...completeRow, price: 125_000, rehab: null });
    const result = await getPropertyDetailsWithClient({ propertyId: PROPERTY_ID }, client);
    expect(result.metrics?.metrics.acquisitionPlusRehab).toEqual(expect.objectContaining({
      calculable: false,
      missingInputs: ['rehab'],
      reason: 'missing_inputs',
    }));
  });

  it('marks stored cap rate unavailable when capRate is absent', async () => {
    const { client } = clientWith({ ...completeRow, cap_rate: null });
    const result = await getPropertyDetailsWithClient({ propertyId: PROPERTY_ID }, client);
    expect(result.metrics?.metrics.capRate).toEqual({
      value: null,
      calculable: false,
      source: null,
      missingInputs: ['capRate'],
      reason: 'missing_inputs',
    });
  });

  it('does not expose protected property data through any metric', async () => {
    const { client } = clientWith({
      ...completeRow,
      address: '123 Private Street',
      owner_name: 'Private Owner',
      email: 'private@example.com',
      phone: '+15555555555',
      unlock_cost: 20,
    });
    const result = await getPropertyDetailsWithClient({ propertyId: PROPERTY_ID }, client);
    const serializedMetrics = JSON.stringify(result.metrics);
    expect(serializedMetrics).not.toContain('Private');
    expect(serializedMetrics).not.toContain('private@example.com');
    expect(serializedMetrics).not.toContain('5555555555');
    expect(serializedMetrics).not.toContain('unlock');
  });

  it('continues to reject a propertyId that diverges from trusted context', () => {
    expect(() => resolvePropertyDetailsInput({ propertyId: OTHER_PROPERTY_ID }, PROPERTY_ID))
      .toThrow('PROPERTY_CONTEXT_MISMATCH');
  });

  it('keeps the HTTP 401 gate before Gemini and tool execution', () => {
    const unauthorizedAt = chatSource.indexOf("error: 'UNAUTHORIZED' }, 401");
    expect(unauthorizedAt).toBeGreaterThan(-1);
    expect(unauthorizedAt).toBeLessThan(chatSource.indexOf('callGemini('));
    expect(unauthorizedAt).toBeLessThan(chatSource.indexOf('executeMaxxisTool('));
  });

  it('sources metric values exclusively from DealMetricsResult instead of Gemini or the frontend', () => {
    expect(propertyDetailsSource).toContain('const metrics = property ? calculateDealMetrics({');
    expect(propertyDetailsSource).toContain('price: property.price');
    expect(propertyDetailsSource).toContain('sqft: property.sqft');
    expect(propertyDetailsSource).toContain('rehab: property.rehab');
    expect(propertyDetailsSource).toContain('capRate: property.capRate');
    expect(chatSource).toContain('metrics: result.metrics');
    expect(chatSource).toContain('Never calculate, derive, estimate, verify, or judge any additional metric');
    expect(assistantSource).not.toContain('calculateDealMetrics');
  });
});

describe('Phase 3E factual Deal Advisor integration', () => {
  const registrySource = readFileSync(new URL('./toolRegistry.ts', import.meta.url), 'utf8');
  const comparisonSource = readFileSync(new URL('./compareProperties.ts', import.meta.url), 'utf8');

  it('adds code-only analysis after safe normalization without exposing protected data', async () => {
    const { client } = clientWith({
      ...completeRow,
      address: '123 Private Street',
      owner_name: 'Private Owner',
      email: 'private@example.com',
      phone: '+15555555555',
      unlock_cost: 20,
    });
    const result = await getPropertyDetailsWithClient({ propertyId: PROPERTY_ID }, client);
    expect(result.analysis).toEqual(expect.objectContaining({
      positiveSignals: expect.any(Array),
      attentionPoints: expect.any(Array),
      missingInformation: expect.any(Array),
      limitations: expect.any(Array),
    }));
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('123 Private Street');
    expect(serialized).not.toContain('Private Owner');
    expect(serialized).not.toContain('private@example.com');
    expect(serialized).not.toContain('5555555555');
    expect(serialized).not.toContain('unlock_cost');
  });

  it('keeps the established tools and compareProperties module unchanged by Deal Advisor', () => {
    const names = Array.from(registrySource.matchAll(/\n\s+name: '([^']+)'/g), (match) => match[1]);
    expect(names).toEqual(['searchProperties', 'searchServices', 'getMyInvestmentProfile', 'getPropertyDetails', 'getDealCopilotOverview', 'compareProperties']);
    expect(comparisonSource).not.toContain('analyzeDealFacts');
  });
});
