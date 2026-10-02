import { describe, expect, it } from 'vitest';
import {
  resolveMaxxisOpportunityIntent,
  resolveMaxxisPropertyContext,
} from './maxxisPropertyContext';

const ids = {
  explicit: '11111111-1111-4111-8111-111111111111',
  selected: '22222222-2222-4222-8222-222222222222',
  screen: '33333333-3333-4333-8333-333333333333',
  active: '44444444-4444-4444-8444-444444444444',
  recent: '55555555-5555-4555-8555-555555555555',
};

describe('canonical Maxxis property context', () => {
  it.each(['portfolio', 'matches', 'feed'])('resolves the currently visible %s property', (surface) => {
    expect(resolveMaxxisPropertyContext({ screenProperty: { id: ids.screen, surface } })).toMatchObject({
      status: 'RESOLVED', propertyId: ids.screen, source: 'APP_SCREEN',
    });
  });

  it('lets an explicit address in user text override every weaker context', () => {
    const explicit = { id: ids.explicit, address: '5939 Droad St' };
    expect(resolveMaxxisPropertyContext({
      userMessage: 'analise 5939 Droad St',
      propertyCandidates: [explicit],
      chatSelectedProperty: ids.selected,
      screenProperty: ids.screen,
      activeConversationProperty: ids.active,
    })).toMatchObject({ propertyId: ids.explicit, source: 'USER_MESSAGE' });
  });

  it('keeps a chat-selected property ahead of stale screen, conversation, and recent contexts', () => {
    expect(resolveMaxxisPropertyContext({
      chatSelectedProperty: ids.selected,
      screenProperty: ids.screen,
      activeConversationProperty: ids.active,
      recentProperties: [ids.recent],
    })).toMatchObject({ propertyId: ids.selected, source: 'MAXXIS_SELECTION' });
  });

  it('falls back through active conversation and recent context before requesting selection', () => {
    expect(resolveMaxxisPropertyContext({ activeConversationProperty: ids.active, recentProperties: [ids.recent] }))
      .toMatchObject({ propertyId: ids.active, source: 'ACTIVE_CONVERSATION' });
    expect(resolveMaxxisPropertyContext({ recentProperties: [ids.recent] }))
      .toMatchObject({ propertyId: ids.recent, source: 'RECENT_CONTEXT' });
    expect(resolveMaxxisPropertyContext({})).toEqual({
      status: 'SELECTION_REQUIRED', propertyId: '', property: null, source: 'NONE',
    });
  });

  it('is viewport-independent and survives a generic follow-up', () => {
    const desktop = resolveMaxxisPropertyContext({ chatSelectedProperty: ids.selected, viewport: 'desktop' });
    const mobile = resolveMaxxisPropertyContext({ chatSelectedProperty: ids.selected, viewport: 'mobile' });
    const followUp = resolveMaxxisPropertyContext({ userMessage: 'por que?', activeConversationProperty: desktop.propertyId });
    expect(mobile).toEqual(desktop);
    expect(followUp.propertyId).toBe(ids.selected);
  });

  it('analyzes a contextual opportunity but preserves explicit multi-property search', () => {
    expect(resolveMaxxisOpportunityIntent('há alguma oportunidade para mim?', true)).toBe('CURRENT_PROPERTY_ANALYSIS');
    expect(resolveMaxxisOpportunityIntent('mostre outras oportunidades', true)).toBe('GENERAL_OPPORTUNITY_SEARCH');
    expect(resolveMaxxisOpportunityIntent('quais imóveis combinam comigo?', true)).toBe('GENERAL_OPPORTUNITY_SEARCH');
    expect(resolveMaxxisOpportunityIntent('há alguma oportunidade para mim?', false)).toBe('GENERAL_OPPORTUNITY_SEARCH');
  });
});
