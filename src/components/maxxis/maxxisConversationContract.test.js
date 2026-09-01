import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const assistantSource = readFileSync(new URL('./MaxxisAssistant.jsx', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../../services/maxxisService.js', import.meta.url), 'utf8');
const edgeSource = readFileSync(new URL('../../../supabase/functions/maxxis-chat/index.ts', import.meta.url), 'utf8');
const typesSource = readFileSync(new URL('../../../supabase/functions/_shared/maxxis/types.ts', import.meta.url), 'utf8');

describe('Maxxis core conversation contract', () => {
  it('keeps semantic conversation and surface context authority in the backend', () => {
    expect(assistantSource).not.toContain('if (isSurfaceContextQuestion(cleanMessage))');
    expect(assistantSource).toContain('meta.controlledIntent ? buildLocalDealIntelligenceReply');
    expect(edgeSource).toContain("router_path: 'GEMINI_CONVERSATION'");
    expect(edgeSource).toContain("router_path: 'SAFE_LOCAL_SURFACE_CONTEXT'");
  });

  it('only intercepts provider-conversation analysis when trusted provider context exists', () => {
    expect(assistantSource).toContain('validatedLatestProviderContext && isProviderConversationIntent(cleanMessage)');
  });

  it('exposes explicit success, degraded and unavailable states to the frontend', () => {
    expect(typesSource).toContain("'success' | 'degraded' | 'unavailable'");
    expect(serviceSource).toContain("status: 'unavailable'");
    expect(serviceSource).toContain("status: 'degraded'");
    expect(serviceSource).toContain("status: String(data?.status || 'success')");
  });

  it('does not accept an empty provider payload as normal success', () => {
    expect(edgeSource).toContain('inspectGeminiCandidate(result.payload, MAXXIS_TOOL_NAMES)');
    expect(serviceSource).toContain("degradedReason: 'MAXXIS_EMPTY_RESPONSE'");
  });

  it('promotes the current sanitized property context to the canonical edge contract', () => {
    expect(serviceSource).toContain("cleanMaxxisContext?.property?.id");
    expect(serviceSource).toContain("{ propertyId: trustedPropertyId }");
    expect(edgeSource).toContain('bodyContext.propertyId');
  });
});
