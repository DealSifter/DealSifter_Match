import { describe, expect, it } from 'vitest';
import {
  buildComparisonTradeoffs,
  buildDealGapsResponse,
  buildDealSnapshot,
  buildLocalDealIntelligenceReply,
  buildMaxxisDealGaps,
  buildMaxxisFollowUps,
  buildMaxxisInsights,
  enhanceMaxxisAssistantResponse,
} from './maxxisDealIntelligence';

const propertyDetails = {
  type: 'property_details',
  data: {
    property: {
      id: '11111111-1111-4111-8111-111111111111',
      type: 'SFR',
      city: 'Dallas',
      state: 'TX',
      price: 250000,
      sqft: 1850,
      bedrooms: 3,
      bathrooms: 2,
      objective: 'FSBO',
    },
    missingFields: ['description'],
    metrics: {
      metrics: {
        pricePerSqft: { calculable: true, value: 135.14, source: 'calculated' },
        acquisitionPlusRehab: { calculable: true, value: 275000, source: 'calculated' },
        capRate: { calculable: true, value: 6.5, source: 'stored' },
      },
      missingInputs: [],
    },
    analysis: {
      positiveSignals: ['property_published'],
      attentionPoints: ['cap_rate_reported_not_calculated'],
      missingInformation: ['description'],
      limitations: ['analysis_depends_on_submitted_data'],
    },
    serviceNeeds: [{ serviceType: 'General Contractor', priority: 'high', reasonCode: 'rehab_reported' }],
    serviceMatches: [{
      serviceType: 'General Contractor',
      services: [{
        id: '22222222-2222-4222-8222-222222222222',
        title: 'Rehab Partner',
        contactAccess: { status: 'locked', cost: 1, currency: 'nuggets' },
      }],
    }],
    workflow: {
      items: [
        { code: 'inspection_completed', status: 'pending', label: 'Inspection' },
        { code: 'provider_contacted', status: 'completed', label: 'Provider contacted' },
      ],
    },
    nextBestAction: {
      nextBestAction: {
        code: 'review_missing_property_data',
        priority: 'high',
        reasonCode: 'missing_property_data',
        actionable: true,
      },
    },
  },
};

describe('Maxxis interactive deal intelligence', () => {
  it('builds a contextual deal snapshot only from registered structured data', () => {
    const snapshot = buildDealSnapshot(propertyDetails, 'en');

    expect(snapshot.content).toContain('Deal snapshot');
    expect(snapshot.content).toContain('SFR - Dallas, TX');
    expect(snapshot.content).toContain('$250,000');
    expect(snapshot.content).toContain('$135/sqft');
    expect(snapshot.content).not.toMatch(/\b(arv|roi|profit|mao|forecast|probability)\b/i);
  });

  it('exposes deterministic insight contracts with evidence and source', () => {
    const insights = buildMaxxisInsights(propertyDetails);

    expect(insights.length).toBeGreaterThan(0);
    expect(insights[0]).toEqual(expect.objectContaining({
      code: expect.any(String),
      type: expect.any(String),
      priority: expect.any(String),
      titleKey: expect.any(String),
      evidence: expect.any(String),
      source: expect.any(String),
      actionable: expect.any(Boolean),
    }));
  });

  it('classifies deal gaps without writing or deciding anything', () => {
    const gaps = buildMaxxisDealGaps(propertyDetails);
    const categories = gaps.map((gap) => gap.category);

    expect(categories).toContain('DATA');
    expect(categories).toContain('DUE_DILIGENCE');
    expect(categories).toContain('PROVIDER');
    expect(categories).toContain('WORKFLOW');
    expect(buildDealGapsResponse(propertyDetails, 'pt').content).toContain('O que esta faltando');
  });

  it('adds controlled follow-ups inside the existing Maxxis response context', () => {
    const followUps = buildMaxxisFollowUps(propertyDetails, 'en');

    expect(followUps.map((item) => item.code)).toEqual(expect.arrayContaining([
      'why_current_signal',
      'deal_gaps',
      'show_providers',
      'explain_metrics',
      'review_next',
    ]));
    expect(followUps.every((item) => item.intent && item.requiredContext)).toBe(true);
  });

  it('answers follow-up clicks locally when a structured source is already loaded', () => {
    const reply = buildLocalDealIntelligenceReply({
      message: 'What is missing?',
      language: 'en',
      messages: [{ id: 'source', role: 'assistant', ...propertyDetails }],
      sourceMessageId: 'source',
      forcedIntent: 'deal_gaps',
    });

    expect(reply.type).toBe('deal_gaps');
    expect(reply.eventName).toBe('deal_gaps_requested');
    expect(reply.content).toContain('What is missing');
  });

  it('enhances backend property responses into snapshots only for snapshot intent', () => {
    const normal = enhanceMaxxisAssistantResponse({ message: 'show property details', result: propertyDetails, language: 'en' });
    const enhanced = enhanceMaxxisAssistantResponse({ message: 'how is this deal?', result: propertyDetails, language: 'en' });

    expect(normal.type).toBeUndefined();
    expect(normal.followUps).toEqual([]);
    expect(enhanced.type).toBe('deal_snapshot');
    expect(enhanced.content).toContain('Deal snapshot');
  });

  it('summarizes comparison trade-offs without winner, best, buy, or avoid language', () => {
    const response = buildComparisonTradeoffs({
      type: 'property_comparison',
      data: {
        properties: [
          { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' },
          { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2' },
        ],
        comparison: {
          price: { comparable: true, lowestPropertyIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'] },
          sqft: { comparable: true, highestPropertyIds: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'] },
        },
      },
    }, 'en');

    expect(response.content).toContain('Lowest price: A');
    expect(response.content).toContain('Largest sqft: B');
    expect(response.content).not.toMatch(/\b(winner|best|buy|avoid|recommended)\b/i);
  });
});
