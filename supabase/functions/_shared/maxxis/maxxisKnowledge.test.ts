import { describe, expect, it } from 'vitest';
import {
  buildMaxxisKnowledgeInstruction,
  MAXXIS_KNOWLEDGE_SECTIONS,
  MAXXIS_KNOWLEDGE_VERSION,
  selectMaxxisKnowledge,
} from './maxxisKnowledge.ts';

describe('versioned Maxxis runtime knowledge', () => {
  it('selects compact topic knowledge instead of the whole documentation', () => {
    const selected = selectMaxxisKnowledge('Como funciona o Dashboard?', 'dashboard');
    expect(selected.map((section) => section.topic)).toContain('dashboard');
    expect(selected.length).toBeLessThanOrEqual(2);
    expect(buildMaxxisKnowledgeInstruction(selected)).toContain(MAXXIS_KNOWLEDGE_VERSION);
  });

  it('uses the current surface for free-form screen questions', () => {
    expect(selectMaxxisKnowledge('Voce consegue me explicar esta tela?', 'mapview')[0]?.topic).toBe('mapview');
  });

  it('routes operational subjects to their authoritative section', () => {
    expect(selectMaxxisKnowledge('Como funciona meu saldo de nuggets?', 'dashboard')[0]?.topic).toBe('nuggets');
    expect(selectMaxxisKnowledge('Quem pode me ajudar com esse imovel?', 'property-details')[0]?.topic).toBe('providers');
  });

  it('keeps Maxxis thinking included and undefined intelligence pricing disabled', () => {
    const nuggets = MAXXIS_KNOWLEDGE_SECTIONS.find((section) => section.topic === 'nuggets')?.text || '';
    expect(nuggets).toContain('do not consume Nuggets');
    expect(nuggets).toContain('never pay-per-question or pay-per-field');
    expect(nuggets).toContain('remain undefined and disabled');
    expect(nuggets).toContain('server-authoritative price');
  });

  it('does not compile mutable rollout claims or sensitive data into the artifact', () => {
    const artifact = JSON.stringify(MAXXIS_KNOWLEDGE_SECTIONS);
    expect(artifact).not.toMatch(/production remains off|producao permanece off|api key|password|email|phone|whatsapp/i);
  });
});
