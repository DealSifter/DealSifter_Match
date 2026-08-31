import { describe, expect, it } from 'vitest';
import { classifyMaxxisPropertyIntent, validateMaxxisToolSelection } from './conversationRouting.ts';

const propertyId = '11111111-1111-4111-8111-111111111111';

describe('Maxxis conversation routing contract', () => {
  it.each([
    'Como está este imóvel?',
    'Como está esse imóvel?',
    'O que você vê neste deal?',
    'Faça uma leitura deste imóvel.',
    'O que falta aqui neste deal?',
    'Me dê uma visão geral desta oportunidade.',
    'How does this deal look?',
    'What do you see in this property?',
    'Give me an overview of this deal.',
    '¿Cómo está esta propiedad?',
    '¿Qué ves en esta oportunidad?',
  ])('classifies broad deal reading as Deal Copilot: %s', (message) => {
    expect(classifyMaxxisPropertyIntent(message)).toBe('DEAL_OVERVIEW');
    expect(validateMaxxisToolSelection({
      message,
      propertyId,
      proposedTool: { name: 'getPropertyDetails', args: { propertyId } },
    })).toMatchObject({ tool: { name: 'getDealCopilotOverview' }, policy: 'DEAL_OVERVIEW' });
  });

  it.each([
    'Mostre os detalhes publicados deste imóvel.',
    'Qual é o preço, quartos, banheiros e sqft?',
    'Show the factual published details.',
    'Muestra los datos publicados de esta propiedad.',
  ])('keeps explicit facts in property details: %s', (message) => {
    expect(classifyMaxxisPropertyIntent(message)).toBe('PROPERTY_FACTS');
    expect(validateMaxxisToolSelection({ message, propertyId })).toMatchObject({
      tool: { name: 'getPropertyDetails' },
      policy: 'PROPERTY_FACTS',
    });
  });

  it('preserves search and comparison contracts', () => {
    expect(validateMaxxisToolSelection({ message: 'Mostre propriedades em Dallas.', propertyId: '' })).toMatchObject({ tool: { name: 'searchProperties' } });
    expect(validateMaxxisToolSelection({
      message: 'Compare estes dois imóveis.',
      propertyId,
      comparisonPropertyIds: [propertyId, '22222222-2222-4222-8222-222222222222'],
    })).toMatchObject({ tool: { name: 'compareProperties' } });
  });

  it('does not force a tool for an app guide question', () => {
    expect(validateMaxxisToolSelection({ message: 'Como funciona o Feed?', propertyId: '' })).toEqual({
      tool: null,
      policy: 'GEMINI_AUTHORITY',
      corrected: false,
    });
  });
});
