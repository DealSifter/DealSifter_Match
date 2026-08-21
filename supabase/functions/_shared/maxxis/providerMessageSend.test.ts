import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../../migrations/20260811000002_maxxis_provider_message_send.sql', import.meta.url), 'utf8');
const handlerSource = readFileSync(new URL('./providerMessageSend.ts', import.meta.url), 'utf8');
const prepareIndexSource = readFileSync(new URL('../../maxxis-provider-message-prepare/index.ts', import.meta.url), 'utf8');
const confirmIndexSource = readFileSync(new URL('../../maxxis-provider-message-confirm/index.ts', import.meta.url), 'utf8');
const cancelIndexSource = readFileSync(new URL('../../maxxis-provider-message-cancel/index.ts', import.meta.url), 'utf8');
const assistantSource = readFileSync(new URL('../../../../src/components/maxxis/MaxxisAssistant.jsx', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../../../../src/services/maxxisService.js', import.meta.url), 'utf8');
const chatHookSource = readFileSync(new URL('../../../../src/hooks/useChatRealtime.js', import.meta.url), 'utf8');
const chatSource = readFileSync(new URL('../../maxxis-chat/index.ts', import.meta.url), 'utf8');
const configSource = readFileSync(new URL('../../../config.toml', import.meta.url), 'utf8');

describe('Phase 3K Confirmed Provider Message Send', () => {
  it('prepares a pending action for an unlocked provider and valid message without inserting chat', () => {
    expect(migration).toContain("'send_provider_message'");
    expect(migration).toContain('ds_prepare_maxxis_provider_message');
    expect(migration).toContain("status', 'pending'");
    const prepareOnly = migration.split('create or replace function public.ds_confirm_maxxis_provider_message')[0];
    expect(prepareOnly).not.toContain('insert into public.chat_messages');
    expect(prepareIndexSource).toContain("handleProviderMessageSendRequest(req, 'prepare')");
  });

  it('confirms by inserting one real human chat message into chat_messages', () => {
    expect(migration).toContain('insert into public.chat_messages');
    expect(migration).toContain('sender_id');
    expect(migration).toContain('recipient_id');
    expect(migration).toContain("'maxxis_provider_message_send'");
    expect(confirmIndexSource).toContain("handleProviderMessageSendRequest(req, 'confirm')");
  });

  it('cancels without inserting a message', () => {
    const cancelOnly = migration.split('create or replace function public.ds_cancel_maxxis_provider_message')[1];
    expect(cancelOnly).toContain("status = 'cancelled'");
    expect(cancelOnly).not.toContain('insert into public.chat_messages');
    expect(cancelIndexSource).toContain("handleProviderMessageSendRequest(req, 'cancel')");
  });

  it('refuses sending when provider is not unlocked', () => {
    expect(migration).toContain('ds_get_provider_contact_access');
    expect(migration).toContain("provider_contact_locked");
    expect(migration).toMatch(/coalesce\(v_access\.status,[\s\S]*already_unlocked/);
  });

  it('rejects serviceId outside the published service context', () => {
    expect(migration).toContain('from public.services s');
    expect(migration).toContain('s.id = p_service_id');
    expect(migration).toContain('coalesce(s.publish_to_connections, false) = true');
    expect(migration).toContain('provider_unavailable');
  });

  it('does not trust an arbitrary recipient from the frontend or Gemini', () => {
    expect(handlerSource).not.toMatch(/recipientId|recipient_id|body\.recipient/i);
    expect(migration).toContain('v_service.owner_id');
    expect(migration).toContain('v_service.owner_id <> v_provider_id');
    expect(migration).not.toMatch(/p_recipient|recipient_hint/i);
  });

  it('rejects an empty message', () => {
    expect(migration).toContain('message required');
    expect(handlerSource).toContain('MESSAGE_REQUIRED');
    expect(serviceSource).toContain("if (!text) throw new Error('Message is required.')");
  });

  it('rejects a message above the limit', () => {
    expect(migration).toContain('char_length(v_message) > 1800');
    expect(handlerSource).toContain('MESSAGE_TOO_LONG');
    expect(serviceSource).toContain('text.length > 1800');
  });

  it('prevents double click from creating duplicate pending actions with an idempotency key', () => {
    expect(migration).toContain("a.payload->>'idempotencyKey' = v_idempotency_key");
    expect(assistantSource).toContain('sendIdempotencyKey');
    expect(serviceSource).toContain('idempotencyKey');
  });

  it('prevents concurrent confirmations from inserting two messages', () => {
    expect(migration).toContain('for update');
    expect(migration).toContain("if v_action.status = 'executed' then");
    expect(migration).toContain("payload = v_action.payload || jsonb_build_object('messageId', v_message_id)");
  });

  it('always uses the authenticated user as sender', () => {
    expect(migration).toContain('v_user_id uuid := auth.uid()');
    expect(migration).toMatch(/insert into public\.chat_messages[\s\S]*v_user_id,[\s\S]*v_service\.owner_id/);
    expect(migration).not.toMatch(/p_sender|sender_hint|body\.sender/i);
  });

  it('keeps Gemini out of send execution', () => {
    expect(chatSource).toContain('must never send, confirm, modify text after confirmation');
    expect(chatSource).toContain('call send endpoints');
    expect(chatSource).not.toContain('maxxis-provider-message-confirm');
  });

  it('does not consume Nuggets when sending a provider message', () => {
    expect(migration).not.toMatch(/ds_purchase_contact_unlock|ds_create_unlock_intent|nuggets\s*-|consume|deduct/i);
    expect(handlerSource).not.toMatch(/nuggets|unlock_intent/i);
  });

  it('reuses the existing human chat realtime/hydration path', () => {
    expect(chatHookSource).toContain("const CHAT_MESSAGES_TABLE = 'chat_messages'");
    expect(chatHookSource).toContain("filter: `recipient_id=eq.${userId}`");
    expect(chatHookSource).toContain("filter: `sender_id=eq.${userId}`");
    expect(assistantSource).toContain("type: 'provider_message_sent'");
    expect(configSource).toContain('[functions.maxxis-provider-message-confirm]');
  });
});
