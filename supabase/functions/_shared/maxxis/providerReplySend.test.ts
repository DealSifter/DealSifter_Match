import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../../migrations/20260811000002_maxxis_provider_message_send.sql', import.meta.url), 'utf8');
const handlerSource = readFileSync(new URL('./providerMessageSend.ts', import.meta.url), 'utf8');
const analyzerSource = readFileSync(new URL('./providerConversationAnalyzer.ts', import.meta.url), 'utf8');
const analysisHandlerSource = readFileSync(new URL('./providerConversationAnalysis.ts', import.meta.url), 'utf8');
const cancelIndexSource = readFileSync(new URL('../../maxxis-provider-message-cancel/index.ts', import.meta.url), 'utf8');
const assistantSource = readFileSync(new URL('../../../../src/components/maxxis/MaxxisAssistant.jsx', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../../../../src/services/maxxisService.js', import.meta.url), 'utf8');
const chatHookSource = readFileSync(new URL('../../../../src/hooks/useChatRealtime.js', import.meta.url), 'utf8');
const chatSource = readFileSync(new URL('../../maxxis-chat/index.ts', import.meta.url), 'utf8');

function providerAnalysisCardSource() {
  return assistantSource.split('function ProviderConversationAnalysisCard')[1].split('function profileSuggestionText')[0];
}

describe('Phase 3M Confirmed Provider Reply Send', () => {
  it('lets a valid suggestedReply prepare Send Reply from the analysis card', () => {
    const card = providerAnalysisCardSource();

    expect(card).toContain('suggestedReply');
    expect(card).toContain('copy.sendReply');
    expect(card).toContain('onPrepareProviderMessageSend?.(message)');
    expect(card).toContain('canSendReply');
    expect(card).toContain('UUID_PATTERN.test(String(data.serviceId');
    expect(card).toContain('UUID_PATTERN.test(String(data.propertyId');
  });

  it('sends the final edited suggestedReply, not the original analysis draft', () => {
    expect(assistantSource).toContain("message?.data?.draft || message?.data?.suggestedReply");
    expect(assistantSource).toContain('message: messageText');
    expect(assistantSource).toContain("suggestedReply: String(suggestedReply || '').slice(0, 1800), sendError: null, sendIdempotencyKey: null");
    expect(assistantSource).toContain('setPendingProviderMessageSend((current) => (current?.messageId === messageId ? null : current))');
    expect(assistantSource).not.toMatch(/suggestedReplyOriginal|originalSuggestedReply|similarity/i);
  });

  it('cancel keeps the reply as a draft and creates no chat message', () => {
    expect(providerAnalysisCardSource()).toContain('onCancelProviderMessageSend?.(pending)');
    expect(cancelIndexSource).toContain("handleProviderMessageSendRequest(req, 'cancel')");
    const cancelOnly = migration.split('create or replace function public.ds_cancel_maxxis_provider_message')[1];
    expect(cancelOnly).toContain("status = 'cancelled'");
    expect(cancelOnly).not.toContain('insert into public.chat_messages');
    expect(assistantSource).not.toMatch(/property\s*:\s*{[\s\S]{0,120}sentStatus|negotiation_status|appointment_confirmed/i);
  });

  it('confirm inserts exactly one normal human chat message', () => {
    expect(migration).toMatch(/insert into public\.chat_messages[\s\S]*sender_id[\s\S]*recipient_id[\s\S]*body[\s\S]*message_type/);
    expect(migration).toContain("'text'");
    expect(migration).toContain('returning id into v_message_id');
    expect(handlerSource).toContain("type: 'provider_message_sent'");
    expect(assistantSource).toContain("type: 'provider_message_sent'");
  });

  it('refuses when provider contact is no longer unlocked', () => {
    expect(migration).toContain('ds_get_provider_contact_access');
    expect(migration).toMatch(/coalesce\(v_access\.status,[\s\S]*already_unlocked/);
    expect(migration).toContain('provider_contact_locked');
  });

  it('does not accept arbitrary recipientId or providerId from the frontend', () => {
    expect(handlerSource).not.toMatch(/recipientId|recipient_id|body\.providerId|body\.provider_id/i);
    expect(migration).toContain('v_provider_id := (v_action.payload->>\'providerId\')::uuid');
    expect(migration).toContain('v_service.owner_id <> v_provider_id');
    expect(migration).toContain('v_service.owner_id');
  });

  it('rejects empty and oversized reply text with the same 3K validation', () => {
    expect(handlerSource).toContain('MESSAGE_REQUIRED');
    expect(handlerSource).toContain('MESSAGE_TOO_LONG');
    expect(migration).toContain('message required');
    expect(migration).toContain('message too long');
    expect(migration).toContain('char_length(v_message) > 1800');
    expect(serviceSource).toContain('text.length > 1800');
  });

  it('uses idempotency so double click and network retry prepare one pending send', () => {
    expect(migration).toContain("a.payload->>'idempotencyKey' = v_idempotency_key");
    expect(assistantSource).toContain('sendIdempotencyKey');
    expect(assistantSource).toContain('maxxis-send:${messageId}:${Date.now()}');
    expect(assistantSource).toContain('disabled={active || !canSendReply || !suggestedReply.trim() || suggestedReply.length > 1800}');
  });

  it('uses row locking so simultaneous confirmations produce one chat message', () => {
    expect(migration).toContain('for update');
    expect(migration).toContain("if v_action.status = 'executed' then");
    expect(migration).toContain("payload = v_action.payload || jsonb_build_object('messageId', v_message_id)");
  });

  it('does not consume Nuggets or create a new unlock/payment flow', () => {
    expect(migration).not.toMatch(/ds_purchase_contact_unlock|ds_create_unlock_intent|nuggets\s*-|consume|deduct|stripe|checkout/i);
    expect(handlerSource).not.toMatch(/nuggets|unlock_intent|stripe|checkout/i);
    expect(assistantSource).not.toMatch(/consumeNuggets|checkout|paymentIntent/i);
  });

  it('keeps Gemini out of reply execution', () => {
    expect(assistantSource).toContain('prepareMaxxisProviderMessageSend');
    expect(assistantSource).toContain('confirmMaxxisProviderMessageSend');
    expect(handlerSource).not.toMatch(/callGemini|gemini|model/i);
    expect(chatSource).toContain('you must never send the suggestedReply, auto-reply');
  });

  it('appears in the normal human chat realtime path', () => {
    expect(chatHookSource).toContain("const CHAT_MESSAGES_TABLE = 'chat_messages'");
    expect(chatHookSource).toContain("filter: `recipient_id=eq.${userId}`");
    expect(chatHookSource).toContain("filter: `sender_id=eq.${userId}`");
    expect(migration).toContain("'source', 'maxxis_provider_message_send'");
  });

  it('does not invent exclusive property ownership for a same-provider multi-property chat', () => {
    expect(migration).toContain("'propertyId', v_property_id");
    expect(migration).toContain("'refData', jsonb_build_object");
    expect(migration).not.toMatch(/alter table public\.chat_messages[\s\S]*property_id|add column property_id/i);
    expect(analysisHandlerSource).toContain('propertyId: property?.id || propertyId || null');
  });

  it('does not update property, negotiation status, appointment, contracts, or analyzer state', () => {
    expect(migration).not.toMatch(/from public\.properties[\s\S]{0,300}update|appointment_confirmed|deal_status|contract_status|negotiation_status/i);
    expect(analyzerSource).not.toMatch(/insert\s+into|update\s+public|appointment_confirmed|deal_status|contract_status|negotiation_status/i);
    expect(analysisHandlerSource).not.toMatch(/insert\s+into public\.chat_messages|update\s+public\.properties|appointment_confirmed|deal_status|contract_status|negotiation_status/i);
  });
});
