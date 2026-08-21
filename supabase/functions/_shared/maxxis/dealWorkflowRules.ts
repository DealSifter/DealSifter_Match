import type { MaxxisPropertyDetails, PropertyServiceMatch, PropertyServiceNeed } from './types.ts';

export type DealWorkflowCode = 'property_reviewed' | 'provider_found' | 'provider_unlocked' | 'provider_contacted' | 'provider_replied' | 'inspection_completed' | 'survey_completed' | 'rehab_quote_received';
export type DealWorkflowStatus = 'pending' | 'completed' | 'not_applicable';
export type DealWorkflowSource = 'system' | 'user';
export type DealWorkflowItem = {
  id?: string;
  propertyId: string;
  code: DealWorkflowCode;
  status: DealWorkflowStatus;
  source: DealWorkflowSource;
  metadata: Record<string, unknown>;
  createdAt?: string | null;
  updatedAt?: string | null;
  completedAt?: string | null;
};
export type DealWorkflowView = { items: DealWorkflowItem[]; completed: number; pending: number; total: number; progressLabel: string };
export type DealWorkflowDefinitionInput = {
  property: Pick<MaxxisPropertyDetails, 'id'>;
  propertyReviewed?: boolean;
  serviceNeeds?: PropertyServiceNeed[] | null;
  serviceMatches?: PropertyServiceMatch[] | null;
  providerContacted?: boolean;
  providerReplied?: boolean;
};

const SYSTEM_CODES: DealWorkflowCode[] = ['property_reviewed', 'provider_found', 'provider_unlocked', 'provider_contacted', 'provider_replied'];
export const MANUAL_WORKFLOW_CODES: DealWorkflowCode[] = ['inspection_completed', 'survey_completed', 'rehab_quote_received'];
export const DEAL_WORKFLOW_ORDER: DealWorkflowCode[] = [...SYSTEM_CODES, ...MANUAL_WORKFLOW_CODES];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function cleanWorkflowUuid(value: unknown) {
  const id = String(value || '').trim();
  return UUID_PATTERN.test(id) ? id : '';
}

function item(propertyId: string, code: DealWorkflowCode, status: DealWorkflowStatus, source: DealWorkflowSource, evidence: string): DealWorkflowItem {
  return { propertyId, code, status, source, metadata: evidence ? { evidence } : {} };
}

export function getWorkflowProviders(serviceMatches: PropertyServiceMatch[] | null | undefined) {
  const providers: Array<{ serviceId: string; accessStatus: string }> = [];
  for (const match of Array.isArray(serviceMatches) ? serviceMatches : []) {
    for (const service of Array.isArray(match?.services) ? match.services : []) {
      const serviceId = cleanWorkflowUuid(service?.id);
      if (!serviceId || providers.some((provider) => provider.serviceId === serviceId)) continue;
      providers.push({ serviceId, accessStatus: String(service?.contactAccess?.status || '') });
    }
  }
  return providers.slice(0, 9);
}

export function buildDealWorkflowDefinition(input: DealWorkflowDefinitionInput): DealWorkflowItem[] {
  const propertyId = cleanWorkflowUuid(input.property?.id);
  if (!propertyId) return [];
  const needs = Array.isArray(input.serviceNeeds) ? input.serviceNeeds : [];
  const matches = Array.isArray(input.serviceMatches) ? input.serviceMatches : null;
  const providers = getWorkflowProviders(matches);
  const providerFound = providers.length > 0;
  const providerUnlocked = providers.some((provider) => provider.accessStatus === 'already_unlocked');
  const providerContacted = input.providerContacted === true;
  const providerReplied = input.providerReplied === true;
  const definition: DealWorkflowItem[] = [item(propertyId, 'property_reviewed', input.propertyReviewed === false ? 'pending' : 'completed', 'system', 'property_details_loaded')];
  if (matches !== null || providerFound) definition.push(item(propertyId, 'provider_found', providerFound ? 'completed' : 'pending', 'system', providerFound ? 'service_match_found' : 'service_search_completed'));
  if (providerFound || providerUnlocked) definition.push(item(propertyId, 'provider_unlocked', providerUnlocked ? 'completed' : 'pending', 'system', providerUnlocked ? 'contact_entitlement_confirmed' : 'provider_found'));
  if (providerUnlocked || providerContacted) definition.push(item(propertyId, 'provider_contacted', providerContacted ? 'completed' : 'pending', 'system', providerContacted ? 'property_linked_user_message' : 'provider_unlocked'));
  if (providerContacted || providerReplied) definition.push(item(propertyId, 'provider_replied', providerReplied ? 'completed' : 'pending', 'system', providerReplied ? 'property_linked_provider_message' : 'provider_contacted'));
  const needTypes = new Set(needs.map((need) => String(need?.serviceType || '')));
  if (needTypes.has('Inspections')) definition.push(item(propertyId, 'inspection_completed', 'pending', 'user', 'service_need_inspections'));
  if (needTypes.has('Survey')) definition.push(item(propertyId, 'survey_completed', 'pending', 'user', 'service_need_survey'));
  if (needTypes.has('General Contractor') || needTypes.has('Rehab Staff')) definition.push(item(propertyId, 'rehab_quote_received', 'pending', 'user', 'service_need_rehab'));
  return definition;
}

export function reconcileDealWorkflowItems(definition: DealWorkflowItem[], persisted: DealWorkflowItem[]): DealWorkflowItem[] {
  const byCode = new Map((Array.isArray(persisted) ? persisted : []).map((entry) => [entry.code, { ...entry }]));
  for (const desired of definition) {
    const existing = byCode.get(desired.code);
    if (!existing) {
      byCode.set(desired.code, { ...desired });
      continue;
    }
    if (existing.source === 'user') continue;
    byCode.set(desired.code, {
      ...existing,
      status: existing.status === 'completed' ? 'completed' : desired.status,
      metadata: desired.metadata,
      completedAt: existing.status === 'completed' ? existing.completedAt : desired.completedAt,
    });
  }
  return Array.from(byCode.values()).sort((left, right) => DEAL_WORKFLOW_ORDER.indexOf(left.code) - DEAL_WORKFLOW_ORDER.indexOf(right.code));
}

export function summarizeDealWorkflow(items: DealWorkflowItem[]): DealWorkflowView {
  const visible = (Array.isArray(items) ? items : []).filter((entry) => entry.status !== 'not_applicable');
  const completed = visible.filter((entry) => entry.status === 'completed').length;
  const pending = visible.filter((entry) => entry.status === 'pending').length;
  return { items: visible, completed, pending, total: visible.length, progressLabel: `${completed} of ${visible.length} completed` };
}
