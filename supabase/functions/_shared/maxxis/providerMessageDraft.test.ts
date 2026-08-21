import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildProviderMessageDraft, type ProviderMessageContext } from './providerMessageDraftBuilder.ts';

const providerDraftSource = readFileSync(new URL('./providerMessageDraft.ts', import.meta.url), 'utf8');
const builderSource = readFileSync(new URL('./providerMessageDraftBuilder.ts', import.meta.url), 'utf8');
const assistantSource = readFileSync(new URL('../../../../src/components/maxxis/MaxxisAssistant.jsx', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../../../../src/services/maxxisService.js', import.meta.url), 'utf8');
const chatSource = readFileSync(new URL('../../maxxis-chat/index.ts', import.meta.url), 'utf8');
const configSource = readFileSync(new URL('../../../config.toml', import.meta.url), 'utf8');
const identifiersSource = readFileSync(new URL('./providerIdentifiers.ts', import.meta.url), 'utf8');

const validContext: ProviderMessageContext = {
  serviceId: '11111111-1111-4111-8111-111111111111',
  providerId: '22222222-2222-4222-8222-222222222222',
  propertyId: '33333333-3333-4333-8333-333333333333',
  serviceTitle: 'Dallas Rehab Team',
  serviceType: 'General Contractor',
  property: {
    city: 'Dallas',
    state: 'TX',
    type: 'Single Family',
    objective: 'Fix & Flip',
    rehab: 25000,
  },
  dealAdvisor: {
    positiveSignals: ['rehab_reported'],
    attentionPoints: [],
  },
};

describe('Phase 3J Provider Message Draft', () => {
  it('shares the strict provider UUID parser with unlock and message send', () => {
    expect(providerDraftSource).toContain("import { cleanProviderUuid } from './providerIdentifiers.ts'");
    expect(identifiersSource).toContain('[89ab][0-9a-f]{3}-[0-9a-f]{12}');
    expect(identifiersSource).not.toContain('[89ab][0-9a-f]{12}');
  });

  it('creates a contextual draft for a valid provider and valid property', () => {
    const draft = buildProviderMessageDraft(validContext, 'en');
    expect(draft).toContain('Single Family');
    expect(draft).toContain('Dallas, TX');
    expect(draft).toContain('General Contractor');
    expect(draft).toContain('Fix & Flip');
    expect(draft).toContain('$25,000');
    expect(providerDraftSource).toContain("type: 'provider_message_draft'");
  });

  it('rejects a provider outside the authorized published service context', () => {
    expect(providerDraftSource).toContain("eq('id', serviceId)");
    expect(providerDraftSource).toContain("eq('publish_to_connections', true)");
    expect(providerDraftSource).toContain('if (!target)');
    expect(providerDraftSource).not.toMatch(/body\.providerId|body\.provider_id|ownerId:\s*body/);
    expect(providerDraftSource).toContain('String(data.owner_id) === userId');
  });

  it('returns a draft only after published-service lookup and unlocked entitlement succeed', () => {
    expect(providerDraftSource).toContain("access.status !== 'already_unlocked'");
    expect(providerDraftSource).toMatch(/success: true,[\s\S]*type: 'provider_message_draft'/);
  });

  it('requires property context before preparing an actionable draft', () => {
    expect(providerDraftSource).toContain("if (!propertyId)");
    expect(providerDraftSource).toContain('PROPERTY_CONTEXT_REQUIRED');
    expect(providerDraftSource).toContain('PROPERTY_CONTEXT_UNAVAILABLE');
  });

  it('does not invent rehab when rehab is missing', () => {
    const draft = buildProviderMessageDraft({
      ...validContext,
      property: { city: 'Dallas', state: 'TX', type: 'Single Family', objective: 'Fix & Flip' },
    }, 'en');
    expect(draft).not.toMatch(/rehab amount|\$25,000|rehab is listed/i);
  });

  it('does not invent objective or strategy when objective is missing', () => {
    const draft = buildProviderMessageDraft({
      ...validContext,
      property: { city: 'Dallas', state: 'TX', type: 'Single Family', rehab: 25000 },
    }, 'en');
    expect(draft).not.toMatch(/objective|Fix & Flip|Buy and Hold|strategy/i);
  });

  it('blocks actionable draft when provider contact is not already unlocked', () => {
    expect(providerDraftSource).toContain("access.status !== 'already_unlocked'");
    expect(providerDraftSource).toContain('PROVIDER_CONTACT_LOCKED');
    expect(providerDraftSource).toContain('contactAccess: access');
  });

  it('does not expose private contact data in selected context or generated draft', () => {
    expect(providerDraftSource).toContain("select('id, title, category, owner_id, primary_profile, publish_to_connections')");
    expect(providerDraftSource).not.toMatch(/select\([^)]*(email|phone|whatsapp|address)/i);
    expect(builderSource).toMatch(/redacted/);
    const draft = buildProviderMessageDraft({
      ...validContext,
      serviceType: 'General Contractor owner@example.com +1 555 555 5555',
    }, 'en');
    expect(draft).not.toContain('owner@example.com');
    expect(draft).not.toContain('555 555 5555');
  });

  it('keeps Gemini from choosing the recipient', () => {
    expect(chatSource).toContain('must never choose the recipient');
    expect(chatSource).toContain('change the serviceId');
    expect(providerDraftSource).toContain('providerId: target.ownerId');
    expect(chatSource).not.toContain('maxxis-provider-message-draft');
  });

  it('does not send a message or create pending message sends', () => {
    expect(providerDraftSource).not.toMatch(/chat_messages|insert\(|ds_send_support_message|pending_message_send/i);
    expect(assistantSource).toContain("type: 'provider_message_draft'");
    expect(providerDraftSource).not.toContain('pending_message_send');
  });

  it('does not consume Nuggets', () => {
    expect(providerDraftSource).toContain('ds_get_provider_contact_access');
    expect(providerDraftSource).not.toMatch(/ds_purchase_contact_unlock|ds_create_unlock_intent|nuggets\s*-|consume|deduct/i);
    expect(serviceSource).toContain('prepareMaxxisProviderMessageDraft');
    expect(configSource).toContain('[functions.maxxis-provider-message-draft]');
  });
});
