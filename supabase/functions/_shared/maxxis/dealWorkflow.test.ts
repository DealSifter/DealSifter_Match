import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildDealWorkflowDefinition,
  reconcileDealWorkflowItems,
  summarizeDealWorkflow,
  type DealWorkflowItem,
} from './dealWorkflowRules.ts';
import { determineNextBestAction } from './nextBestAction.ts';

const migration = readFileSync(new URL('../../../migrations/20260811000003_deal_workflow.sql', import.meta.url), 'utf8');
const workflowSource = readFileSync(new URL('./dealWorkflow.ts', import.meta.url), 'utf8');
const assistantSource = readFileSync(new URL('../../../../src/components/maxxis/MaxxisAssistant.jsx', import.meta.url), 'utf8');

const property = { id: '11111111-1111-4111-8111-111111111111' };
const provider = {
  id: '22222222-2222-4222-8222-222222222222',
  title: 'Dallas Rehab',
  serviceType: 'General Contractor',
  description: '',
  price: null,
  markets: ['Dallas, TX'],
  image: '',
  contactAccess: { status: 'locked' as const, cost: 1, currency: 'nuggets' as const },
  fit: {
    score: 80,
    classification: 'good_fit' as const,
    calculable: true,
    reasons: [],
    evaluatedCriteria: 2,
    possibleCriteria: 2,
    earnedPoints: 80,
    evaluatedWeight: 100,
  },
};
const serviceMatches = [{ serviceType: 'General Contractor' as const, confidence: 'high' as const, services: [provider] }];
const serviceNeeds = [{
  serviceType: 'General Contractor' as const,
  reasonCode: 'rehab_reported' as const,
  confidence: 'high' as const,
  sourceSignals: ['property.rehab' as const],
}];

function byCode(items: DealWorkflowItem[], code: string) {
  return items.find((entry) => entry.code === code);
}

describe('Phase 4B Deal Workflow / Checklist', () => {
  it('completes property_reviewed when property details were analyzed', () => {
    const items = buildDealWorkflowDefinition({ property, propertyReviewed: true });
    expect(byCode(items, 'property_reviewed')?.status).toBe('completed');
    expect(byCode(items, 'property_reviewed')?.source).toBe('system');
  });

  it('completes provider_found only from a real service match', () => {
    const items = buildDealWorkflowDefinition({ property, serviceNeeds, serviceMatches });
    expect(byCode(items, 'provider_found')?.status).toBe('completed');
  });

  it('completes provider_unlocked from already_unlocked entitlement', () => {
    const unlockedMatches = [{ ...serviceMatches[0], services: [{ ...provider, contactAccess: { status: 'already_unlocked' as const, cost: 0, currency: 'nuggets' as const } }] }];
    const items = buildDealWorkflowDefinition({ property, serviceNeeds, serviceMatches: unlockedMatches });
    expect(byCode(items, 'provider_unlocked')?.status).toBe('completed');
  });

  it('completes provider_contacted only from structured message evidence', () => {
    const items = buildDealWorkflowDefinition({ property, serviceNeeds, serviceMatches, providerContacted: true });
    expect(byCode(items, 'provider_contacted')?.status).toBe('completed');
    expect(workflowSource).toContain('propertyIdFromMetadata(message.metadata) !== propertyId');
  });

  it('completes provider_replied only from structured reply evidence', () => {
    const items = buildDealWorkflowDefinition({ property, serviceNeeds, serviceMatches, providerContacted: true, providerReplied: true });
    expect(byCode(items, 'provider_replied')?.status).toBe('completed');
    expect(workflowSource).toContain('contactedProviders.has(senderId)');
  });

  it('does not auto-complete inspection without structured evidence', () => {
    const inspectionNeed = [{ serviceType: 'Inspections' as const, reasonCode: 'physical_details_incomplete' as const, confidence: 'medium' as const, sourceSignals: ['analysis.attentionPoints.sqft_missing_or_invalid' as const] }];
    const items = buildDealWorkflowDefinition({ property, serviceNeeds: inspectionNeed });
    expect(byCode(items, 'inspection_completed')).toMatchObject({ status: 'pending', source: 'user' });
  });

  it('persists a manually completed item', () => {
    const desired = buildDealWorkflowDefinition({ property, serviceNeeds });
    const manual: DealWorkflowItem = { ...desired.find((entry) => entry.code === 'rehab_quote_received')!, status: 'completed', completedAt: '2026-08-11T00:00:00.000Z' };
    const reconciled = reconcileDealWorkflowItems(desired, [manual]);
    expect(byCode(reconciled, 'rehab_quote_received')?.status).toBe('completed');
  });

  it('preserves a manual completion when recalculating workflow', () => {
    const definition = buildDealWorkflowDefinition({ property, serviceNeeds });
    const persisted = definition.map((entry) => entry.code === 'rehab_quote_received' ? { ...entry, status: 'completed' as const } : entry);
    const recalculated = reconcileDealWorkflowItems(buildDealWorkflowDefinition({ property, serviceNeeds }), persisted);
    expect(byCode(recalculated, 'rehab_quote_received')?.status).toBe('completed');
  });

  it('is idempotent and creates no duplicate codes when run twice', () => {
    const definition = buildDealWorkflowDefinition({ property, serviceNeeds, serviceMatches });
    const first = reconcileDealWorkflowItems(definition, []);
    const second = reconcileDealWorkflowItems(definition, first);
    expect(new Set(second.map((entry) => entry.code)).size).toBe(second.length);
    expect(summarizeDealWorkflow(second).total).toBe(second.length);
  });

  it('rejects frontend attempts to alter system items without evidence', () => {
    expect(migration).toContain("v_code not in ('inspection_completed', 'survey_completed', 'rehab_quote_received')");
    expect(migration).toContain('deal_workflow_items_no_direct_update');
    expect(migration).toMatch(/for update[\s\S]*using \(false\)[\s\S]*with check \(false\)/i);
    expect(assistantSource).not.toMatch(/onToggleWorkflowManualItem[^\n]+provider_(found|unlocked|contacted|replied)/i);
  });

  it('enforces authenticated ownership through RLS', () => {
    expect(migration).toContain('alter table public.deal_workflow_items enable row level security');
    expect(migration).toContain('using (user_id = auth.uid())');
    expect(migration).toContain("v_user_id uuid := auth.uid()");
    expect(migration).toContain('where dwi.user_id = v_user_id');
  });

  it('lets Next Best Action use workflow memory without executing anything', () => {
    const workflowItems = buildDealWorkflowDefinition({ property, serviceNeeds });
    const result = determineNextBestAction({
      property: { ...property, published: true, dealClosed: false },
      missingFields: [],
      serviceNeeds: [],
      serviceMatches: [],
      workflowItems,
    });
    expect(result.nextBestAction?.code).toBe('review_deal_progress');
    expect(result.nextBestAction?.requiresConfirmation).toBe(false);
    expect(workflowSource).toContain('workflowProviderReplied');
    expect(workflowSource).not.toMatch(/ds_purchase_contact_unlock|insert\s+into\s+public\.chat_messages|consume|deduct/i);
  });
});
