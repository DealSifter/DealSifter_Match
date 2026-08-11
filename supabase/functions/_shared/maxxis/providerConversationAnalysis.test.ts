import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeProviderConversation } from './providerConversationAnalyzer.ts';

const analyzerSource = readFileSync(new URL('./providerConversationAnalyzer.ts', import.meta.url), 'utf8');
const handlerSource = readFileSync(new URL('./providerConversationAnalysis.ts', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../../maxxis-provider-conversation-analysis/index.ts', import.meta.url), 'utf8');
const assistantSource = readFileSync(new URL('../../../../src/components/maxxis/MaxxisAssistant.jsx', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../../../../src/services/maxxisService.js', import.meta.url), 'utf8');
const chatSource = readFileSync(new URL('../../maxxis-chat/index.ts', import.meta.url), 'utf8');
const configSource = readFileSync(new URL('../../../config.toml', import.meta.url), 'utf8');

describe('Phase 3L Provider Reply Assistant', () => {
  it('extracts provider amount, availability, facts, and an editable suggested reply', () => {
    const analysis = analyzeProviderConversation([
      { sender: 'user', text: 'Can you inspect this Dallas single family?' },
      { sender: 'provider', text: 'I can do tomorrow afternoon. The initial visit would be $250.' },
    ]);

    expect(analysis.providerReplyFound).toBe(true);
    expect(analysis.quotedAmounts).toContain('$250');
    expect(analysis.availability.join(' ')).toMatch(/tomorrow afternoon/i);
    expect(analysis.facts.join(' ')).toContain('Provider mentioned $250.');
    expect(analysis.suggestedReply).toMatch(/Thanks/i);
  });

  it('extracts provider questions without answering them automatically', () => {
    const analysis = analyzeProviderConversation([
      { sender: 'provider', text: 'Can you send photos of the roof and foundation?' },
    ]);

    expect(analysis.questions).toContain('Can you send photos of the roof and foundation?');
    expect(analysis.openItems).toContain('Can you send photos of the roof and foundation?');
    expect(analysis.suggestedReply).toMatch(/information you requested/i);
  });

  it('extracts provider requests as open items', () => {
    const analysis = analyzeProviderConversation([
      { sender: 'provider', text: 'Please share the inspection docs before we quote the job.' },
    ]);

    expect(analysis.requests).toContain('Please share the inspection docs before we quote the job.');
    expect(analysis.openItems).toContain('Please share the inspection docs before we quote the job.');
  });

  it('handles a conversation with no provider reply safely', () => {
    const analysis = analyzeProviderConversation([
      { sender: 'user', text: 'Hi, are you available?' },
    ]);

    expect(analysis.providerReplyFound).toBe(false);
    expect(analysis.summary).toMatch(/No provider reply/i);
    expect(analysis.suggestedReply).toBe('');
    expect(analysis.openItems.join(' ')).toMatch(/Wait for the provider/i);
  });

  it('reads only the authenticated user to provider pair resolved from the service', () => {
    expect(handlerSource).toContain('const { data: { user }, error } = await client.auth.getUser(token)');
    expect(handlerSource).toContain('userId = auth.user.id');
    expect(handlerSource).toContain("eq('id', serviceId)");
    expect(handlerSource).toContain("eq('publish_to_connections', true)");
    expect(handlerSource).toContain("if (String(data.owner_id) === userId) return null");
    expect(handlerSource).toContain('and(sender_id.eq.${userId},recipient_id.eq.${providerId})');
    expect(handlerSource).toContain('and(sender_id.eq.${providerId},recipient_id.eq.${userId})');
    expect(handlerSource).not.toMatch(/body\.providerId|body\.provider_id|body\.recipient|recipientId/i);
  });

  it('does not treat ambiguous language as provider confirmation', () => {
    const analysis = analyzeProviderConversation([
      { sender: 'provider', text: 'That might work. Let me check my schedule.' },
    ], 'Did the provider confirm the appointment?');

    expect(analysis.summary).toMatch(/does not contain an unequivocal confirmation/i);
    expect(analysis.openItems).toContain('There is no unequivocal confirmation in the recent provider reply.');
  });

  it('treats a quoted amount as a mentioned fact, not accepted price or contract', () => {
    const analysis = analyzeProviderConversation([
      { sender: 'provider', text: 'The walkthrough fee is $250 if you want me to come out.' },
    ]);

    expect(analysis.quotedAmounts).toContain('$250');
    expect(`${analysis.summary} ${analysis.facts.join(' ')} ${analysis.openItems.join(' ')}`).not.toMatch(/accepted price|price accepted|contract|hired/i);
  });

  it('does not update property rehab or other property data from conversation text', () => {
    const analysis = analyzeProviderConversation([
      { sender: 'provider', text: 'This rehab could be around $45,000 based on the photos.' },
    ]);

    expect(analysis.quotedAmounts).toContain('$45,000');
    expect(handlerSource).not.toMatch(/from\('properties'\)[\s\S]{0,240}\.update\(/);
    expect(handlerSource).not.toMatch(/rehab\s*[:=]/i);
  });

  it('does not invent address, access, gate code, or lockbox details in suggested replies', () => {
    const analysis = analyzeProviderConversation([
      { sender: 'provider', text: 'Please send the address and lockbox code.' },
    ]);

    expect(analysis.requests).toContain('Please send the address and lockbox code.');
    expect(analysis.suggestedReply).toMatch(/once we confirm the appropriate next step/i);
    expect(analysis.suggestedReply).not.toMatch(/\b\d{2,6}\s+[A-Za-z]+\s+(St|Street|Ave|Avenue|Rd|Road|Dr|Drive)\b/i);
    expect(analysis.suggestedReply).not.toMatch(/lockbox code is|gate code is/i);
  });

  it('keeps Gemini and Maxxis chat away from automatic provider replies', () => {
    expect(analyzerSource).not.toMatch(/callGemini|gemini|model/i);
    expect(handlerSource).not.toMatch(/callGemini|gemini|model/i);
    expect(chatSource).toContain('Provider Conversation Analysis is a read-only assistant view');
    expect(chatSource).toContain('you must never send the suggestedReply, auto-reply');
    expect(chatSource).not.toContain('maxxis-provider-conversation-analysis');
  });

  it('does not consume Nuggets or alter unlock/payment state', () => {
    expect(handlerSource).not.toMatch(/nuggets|ds_purchase_contact_unlock|ds_create_unlock_intent|consume|deduct|checkout|payment|stripe/i);
    expect(analyzerSource).not.toMatch(/nuggets|consume|deduct|unlock|payment|stripe/i);
  });

  it('limits recent conversation history to 20 messages', () => {
    const messages = Array.from({ length: 25 }, (_, index) => ({
      sender: index % 2 ? 'provider' as const : 'user' as const,
      text: `message ${index}`,
    }));
    const analysis = analyzeProviderConversation(messages);

    expect(analysis.messageCount).toBe(20);
    expect(handlerSource).toContain('const MESSAGE_LIMIT = 20');
    expect(handlerSource).toContain('.limit(MESSAGE_LIMIT)');
    expect(analyzerSource).toContain('.slice(-20)');
  });

  it('exposes a dedicated read-only edge endpoint and keeps analysis separate from confirmed send', () => {
    const analysisCardSource = assistantSource.split('function ProviderConversationAnalysisCard')[1].split('function MessageBubble')[0];

    expect(indexSource).toContain('handleProviderConversationAnalysisRequest(req)');
    expect(configSource).toContain('[functions.maxxis-provider-conversation-analysis]');
    expect(serviceSource).toContain('analyzeMaxxisProviderConversation');
    expect(assistantSource).toContain("type: 'provider_conversation_analysis'");
    expect(assistantSource).toContain('ProviderConversationAnalysisCard');
    expect(assistantSource).toContain('PROVIDER_CONVERSATION_INTENT_RE');
    expect(assistantSource).toContain('findLatestProviderConversationContext');
    expect(assistantSource).toContain('question: cleanMessage');
    expect(analysisCardSource).toContain('suggestedReply');
    expect(analysisCardSource).toContain('navigator.clipboard');
    expect(handlerSource).not.toMatch(/insert\s+into public\.chat_messages|ds_confirm_maxxis_provider_message|ds_prepare_maxxis_provider_message/i);
    expect(analyzerSource).not.toMatch(/insert\s+into|update\s+public|chat_messages/i);
  });
});
