import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  composeDealCopilotOverview,
  orchestrateDealCopilotOverview,
  type DealCopilotDetails,
} from './dealCopilotContextRules.ts';

const contextSource = readFileSync(new URL('./dealCopilotContext.ts', import.meta.url), 'utf8');
const propertyDetailsSource = readFileSync(new URL('./getPropertyDetails.ts', import.meta.url), 'utf8');
const rulesSource = readFileSync(new URL('./dealCopilotContextRules.ts', import.meta.url), 'utf8');
const registrySource = readFileSync(new URL('./toolRegistry.ts', import.meta.url), 'utf8');
const typesSource = readFileSync(new URL('./types.ts', import.meta.url), 'utf8');
const chatSource = readFileSync(new URL('../../maxxis-chat/index.ts', import.meta.url), 'utf8');
const assistantSource = [
  readFileSync(new URL('../../../../src/components/maxxis/MaxxisAssistant.jsx', import.meta.url), 'utf8'),
  readFileSync(new URL('../../../../src/components/maxxis/MaxxisCapabilities.jsx', import.meta.url), 'utf8'),
].join('\n')
  .replace(/\r\n?/g, '\n');
const serviceSource = [
  readFileSync(new URL('../../../../src/services/maxxisService.js', import.meta.url), 'utf8'),
  readFileSync(new URL('../../../../src/domain/maxxis/responseTypes.js', import.meta.url), 'utf8'),
].join('\n');

const propertyId = '11111111-1111-4111-8111-111111111111';
const property = {
  id: propertyId,
  type: 'Single Family',
  city: 'Dallas',
  state: 'TX',
  zip: '75201',
  price: 250000,
  beds: 3,
  baths: 2,
  sqft: '1500',
  improvement: '',
  lot: '',
  dealTag: 'Off Market',
  objective: 'Fix and Flip',
  rehab: 50000,
  capRate: null,
  description: '',
  markets: ['Dallas, TX'],
  images: [],
  published: true,
  dealClosed: false,
};
const metrics = {
  metrics: {
    pricePerSqft: { value: 166.67, calculable: true, source: 'calculated', reason: null, missingInputs: [] },
    acquisitionPlusRehab: { value: 300000, calculable: true, source: 'calculated', reason: null, missingInputs: [] },
    capRate: { value: null, calculable: false, source: 'stored', reason: 'missing_input', missingInputs: ['capRate'] },
  },
  availableMetrics: ['pricePerSqft', 'acquisitionPlusRehab'],
  unavailableMetrics: ['capRate'],
} as DealCopilotDetails['metrics'];
const analysis = {
  positiveSignals: ['rehab_reported'],
  attentionPoints: ['cap_rate_missing'],
  missingInformation: ['capRate'],
  limitations: [],
} as DealCopilotDetails['analysis'];
const workflow = {
  items: [{ propertyId, code: 'property_reviewed', status: 'completed', source: 'system', metadata: {} }],
  completed: 1,
  pending: 0,
  total: 1,
  progressLabel: '1/1',
} as DealCopilotDetails['workflow'];
const nextBestAction = {
  nextBestAction: {
    code: 'review_deal_progress',
    priority: 'low',
    reasonCode: 'workflow_available',
    reason: 'Review the current operational progress.',
    actionable: true,
    requiresConfirmation: false,
    target: { propertyId },
  },
  alternativeActions: [],
  conversationState: 'no_conversation',
} as DealCopilotDetails['nextBestAction'];
const serviceNeeds = [{
  serviceType: 'General Contractor',
  reasonCode: 'rehab_reported',
  confidence: 'high',
  sourceSignals: ['property.rehab'],
}] as DealCopilotDetails['serviceNeeds'];

function details(overrides: Partial<DealCopilotDetails> = {}): DealCopilotDetails {
  return {
    found: true,
    property,
    metrics,
    analysis,
    workflow,
    nextBestAction,
    serviceNeeds,
    ...overrides,
  };
}

describe('Phase 4C Maxxis Deal AI Deal Copilot', () => {
  it('consolidates property details and workflow without replacing either source', () => {
    const result = composeDealCopilotOverview(details());
    expect(result?.propertySummary).toMatchObject({ id: propertyId, city: 'Dallas', price: 250000 });
    expect(result?.metricsSummary).toBe(metrics);
    expect(result?.workflow).toBe(workflow);
  });

  it('keeps the deterministic Next Best Action as the principal item in the overview', () => {
    const result = composeDealCopilotOverview(details());
    const nextBestActionCardIndex = assistantSource.search(
      /<NextBestActionCard\b[^>]*\bresult=\{data\.nextBestAction\}[^>]*\/>/,
    );
    const dealProgressCardIndex = assistantSource.search(
      /<DealProgressCard\b[\s\S]*?\bworkflow=\{data\.workflow\}[\s\S]*?\/>/,
    );
    expect(result?.nextBestAction).toBe(nextBestAction);
    expect(nextBestActionCardIndex).toBeGreaterThanOrEqual(0);
    expect(dealProgressCardIndex).toBeGreaterThanOrEqual(0);
    expect(nextBestActionCardIndex).toBeLessThan(dealProgressCardIndex);
  });

  it('does not invent providers when only service needs exist', () => {
    const result = composeDealCopilotOverview(details(), { conversationSummary: null, providers: [] });
    expect(result?.serviceSummary?.needs).toEqual(serviceNeeds);
    expect(result?.serviceSummary?.providers).toEqual([]);
    expect(result?.capabilitiesLoaded).not.toContain('provider_summary');
  });

  it('includes only existing provider and conversation facts when available', () => {
    const conversation = { summary: 'Provider replied.', facts: ['Available Friday'], openItems: ['Confirm time'], providerReplyFound: true, messageCount: 2 };
    const providers = [{ serviceId: '22222222-2222-4222-8222-222222222222', title: 'Dallas Rehab', serviceType: 'General Contractor' }];
    const result = composeDealCopilotOverview(details(), { conversationSummary: conversation, providers, queryCount: 2 });
    expect(result?.serviceSummary?.providers).toBe(providers);
    expect(result?.conversationSummary).toBe(conversation);
    expect(result?.queryCount).toBe(6);
  });

  it('returns a partial overview when optional conversation context fails', async () => {
    const result = await orchestrateDealCopilotOverview({
      propertyId,
      loadDetails: async () => details(),
      loadOptionalContext: async () => { throw new Error('offline'); },
    });
    expect(result?.propertySummary.id).toBe(propertyId);
    expect(result?.conversationSummary).toBeNull();
    expect(result?.capabilitiesUnavailable).toContain('provider_conversation_analysis');
  });

  it('rejects an invalid context and returns no overview for a missing property', async () => {
    await expect(orchestrateDealCopilotOverview({ propertyId: 'invented', loadDetails: async () => details() })).rejects.toThrow('INVALID_PROPERTY_ID');
    await expect(orchestrateDealCopilotOverview({
      propertyId,
      loadDetails: async () => details({ found: false, property: null }),
    })).resolves.toBeNull();
  });

  it('routes a simple metric or focused question to getPropertyDetails instead of Copilot', () => {
    expect(registrySource).toContain('Do not use for a single metric');
    expect(chatSource).toContain('For one metric or a focused property question, use getPropertyDetails and do not load the overview.');
    expect(chatSource).toContain('For one metric or a focused property question, omit includeOperationalContext.');
    expect(propertyDetailsSource).toContain('if (!validated.includeOperationalContext');
    expect(contextSource).toContain('includeOperationalContext: true');
  });

  it('never recalculates Match Score and only passes through an existing match result', () => {
    const match = { score: 84, classification: 'good', source: 'existing_match_engine' };
    expect(composeDealCopilotOverview(details({ match }))?.match).toBe(match);
    expect(`${contextSource}\n${rulesSource}`).not.toContain('calculatePropertyMatch');
  });

  it('does not mutate workflow or execute operational actions', () => {
    expect(contextSource).not.toMatch(/setMaxxisDealWorkflowManualItem|set_deal_workflow_manual_item|\.rpc\(/);
    expect(registrySource).toContain('This tool aggregates existing results and never executes actions.');
    expect(assistantSource).toMatch(/function DealCopilotOverviewCard[\s\S]*?<DealProgressCard[\s\S]*?readOnly/);
  });

  it('does not consume Nuggets', () => {
    expect(`${contextSource}\n${rulesSource}`).not.toMatch(/consume|debit|deduct|nugget/i);
    expect(chatSource).toContain('consume Nuggets');
  });

  it('does not send or create messages', () => {
    expect(contextSource).not.toMatch(/\.insert\(|\.upsert\(|sendProvider|message-send|pending_message_send/);
    expect(chatSource).toContain('or send a message');
  });

  it('limits Gemini to routing and explanation of backend outputs', () => {
    expect(chatSource).toContain('Gemini may route to it and explain it');
    expect(chatSource).toContain('must never recalculate a score or metric');
  });

  it('preserves every response type and existing frontend flow', () => {
    for (const type of ['properties', 'services', 'investment_profile', 'property_details', 'property_comparison', 'deal_copilot_overview']) {
      expect(typesSource).toContain(`'${type}'`);
      expect(serviceSource).toContain(`'${type}'`);
    }
    expect(assistantSource).toContain("message.type === 'deal_copilot_overview'");
    expect(assistantSource).toContain("message.type === 'property_details'");
    expect(assistantSource).toContain("message.type === 'provider_message_draft'");
    expect(assistantSource).toContain("message.type === 'provider_conversation_analysis'");
  });

  it('uses bounded progressive loading with no provider N+1 query', async () => {
    expect(contextSource.match(/\.from\('chat_messages'\)/g)).toHaveLength(1);
    expect(contextSource.match(/\.from\('services'\)/g)).toHaveLength(1);
    expect(contextSource).not.toContain('findServicesForPropertyNeeds');
    const loadDetails = vi.fn(async () => details());
    const loadOptionalContext = vi.fn(async () => ({ conversationSummary: null, providers: [], queryCount: 1 }));
    const result = await orchestrateDealCopilotOverview({ propertyId, loadDetails, loadOptionalContext });
    expect(loadDetails).toHaveBeenCalledOnce();
    expect(loadOptionalContext).toHaveBeenCalledOnce();
    expect(result?.queryCount).toBe(5);
  });
});
