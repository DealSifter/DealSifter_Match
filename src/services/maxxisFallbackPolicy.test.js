import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const clientSource = readFileSync(new URL('./maxxisService.js', import.meta.url), 'utf8');
const edgeSource = readFileSync(
  new URL('../../supabase/functions/maxxis-chat/index.ts', import.meta.url),
  'utf8',
);

describe('Maxxis fallback policy contract', () => {
  it('keeps Gemini as the primary brain and removes the duplicate client keyword catalog', () => {
    expect(clientSource).not.toContain('LOCAL_ANSWER_CATALOG');
    expect(clientSource).not.toContain('buildLocalMaxxisAnswer');
    expect(edgeSource).toContain("fallbackSource: 'edge_knowledge_catalog'");
  });

  it('labels every degraded fallback level explicitly', () => {
    expect(edgeSource).toContain("fallbackSource: 'structured_tool_result'");
    expect(edgeSource).toContain("fallbackSource: 'edge_knowledge_catalog'");
    expect(edgeSource).toContain("fallbackSource: 'edge_generic_guard'");
    expect(clientSource).toContain("fallbackSource: 'client_network_guard'");
    expect(clientSource).toContain("fallbackSource: 'client_http_guard'");
  });

  it('does not present an unsupported local intent as a normal guide answer', () => {
    expect(edgeSource).toContain("let key: keyof typeof catalog | '' = '';");
    expect(edgeSource).toContain("return key ? catalog[key][language] || catalog[key].en : '';");
    expect(edgeSource).not.toContain('I am in local guide mode right now');
    expect(edgeSource).not.toContain('Estou em modo guia local neste momento');
  });
});
