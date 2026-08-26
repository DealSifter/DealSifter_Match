import { describe, expect, it } from 'vitest';
import {
  MAXXIS_CONTEXT_MAX_BYTES,
  MAXXIS_CONTEXT_VERSION,
  buildMaxxisContextSnapshot,
  describeMaxxisContext,
  getMaxxisContextSize,
  isSurfaceContextQuestion,
  resolveMaxxisNaturalReference,
  sanitizeMaxxisContextSnapshot,
  selectMaxxisContextForMessage,
  shouldResetMaxxisContextSession,
} from './maxxisContextSnapshot';

const PROPERTY_A = '11111111-1111-4111-8111-111111111111';
const PROPERTY_B = '22222222-2222-4222-8222-222222222222';
const SERVICE_A = '33333333-3333-4333-8333-333333333333';
const SERVICE_B = '44444444-4444-4444-8444-444444444444';

function assistantMessage(patch = {}) {
  return {
    id: 'assistant-1',
    role: 'assistant',
    type: 'property_details',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    data: {
      property: { id: PROPERTY_A },
      serviceNeeds: [{ type: 'General Contractor' }],
      serviceMatches: [{ services: [{ id: SERVICE_A, contactAccess: { status: 'locked' } }, { id: SERVICE_B }] }],
      workflow: { items: [{ code: 'property_reviewed', status: 'completed' }] },
      advisor: { attentionPoints: [] },
      ...patch,
    },
  };
}

describe('Maxxis Deal AI context snapshot', () => {
  it('normalizes page and surface context without relying only on URL', () => {
    const snapshot = buildMaxxisContextSnapshot({
      page: 'matches',
      surface: { page: 'matches', route: '/matches', subview: 'property_details' },
      propertyId: PROPERTY_A,
    });

    expect(snapshot.contextVersion).toBe(MAXXIS_CONTEXT_VERSION);
    expect(snapshot.surface).toEqual({ name: 'matches', route: '/matches', subview: 'property_details' });
    expect(snapshot.entity).toEqual({ type: 'PROPERTY', id: PROPERTY_A });
  });

  it('supports dashboard, feed, chat, settings, onboarding and mobile navigation surfaces', () => {
    expect(buildMaxxisContextSnapshot({ page: 'dashboard' }).surface).toMatchObject({ name: 'dashboard', subview: 'feed_deck' });
    expect(buildMaxxisContextSnapshot({ surface: { name: 'chat', page: 'matches', subview: 'human_chat' } }).surface.name).toBe('chat');
    expect(buildMaxxisContextSnapshot({ page: 'settings', surface: { page: 'settings', subview: 'profile' } }).surface.name).toBe('settings');
    expect(buildMaxxisContextSnapshot({ page: 'onboarding', surface: { page: 'onboarding', subview: 'professional' } }).surface.subview).toBe('professional');
    expect(buildMaxxisContextSnapshot({ page: 'mapview', surface: { page: 'mapview', route: '/map', subview: 'mobile_nav' } }).surface.name).toBe('map');
  });

  it('derives operational context from existing Maxxis Deal AI response data without recalculating engines', () => {
    const snapshot = buildMaxxisContextSnapshot({
      propertyId: PROPERTY_A,
      messages: [assistantMessage()],
      pendingProviderUnlock: { serviceId: SERVICE_A },
    });

    expect(snapshot.operational.capabilities).toMatchObject({
      propertyDetails: true,
      serviceNeeds: true,
      providerMatches: true,
      dealAdvisor: true,
      workflow: true,
    });
    expect(snapshot.operational.state).toMatchObject({
      contactAccessState: 'locked',
      pendingActionExists: true,
    });
  });

  it('marks stale and unavailable context explicitly', () => {
    const snapshot = buildMaxxisContextSnapshot({
      propertyId: PROPERTY_A,
      messages: [assistantMessage()],
      now: Number(new Date('2026-01-01T00:10:01.000Z')),
    });

    expect(snapshot.freshness.operational).toBe('stale');
    expect(buildMaxxisContextSnapshot({ page: 'dashboard' }).freshness.operational).toBe('unknown');
  });

  it('keeps short-lived session memory with only safe identifiers', () => {
    const snapshot = buildMaxxisContextSnapshot({
      propertyId: PROPERTY_A,
      messages: [assistantMessage({ properties: [{ id: PROPERTY_A }, { id: PROPERTY_B }] })],
    });

    expect(snapshot.sessionMemory.lastPropertyIds).toContain(PROPERTY_A);
    expect(snapshot.sessionMemory.lastComparedPropertyIds).toEqual([PROPERTY_A, PROPERTY_B]);
    expect(snapshot.sessionMemory.lastServiceIds).toEqual([SERVICE_A, SERVICE_B]);
    expect(JSON.stringify(snapshot)).not.toMatch(/email|phone|whatsapp|chat body|message body/i);
  });

  it('resolves natural references and asks for clarification on ambiguous providers', () => {
    const snapshot = buildMaxxisContextSnapshot({
      propertyId: PROPERTY_A,
      messages: [assistantMessage()],
    });

    expect(resolveMaxxisNaturalReference('tell me about this property', snapshot)).toEqual({
      status: 'resolved',
      entity: { type: 'PROPERTY', id: PROPERTY_A },
    });
    expect(resolveMaxxisNaturalReference('what about the second provider?', snapshot)).toEqual({
      status: 'resolved',
      entity: { type: 'SERVICE', id: SERVICE_B },
    });
    expect(resolveMaxxisNaturalReference('which provider has better fit?', snapshot)).toMatchObject({
      status: 'ambiguous',
      entityType: 'SERVICE',
      count: 2,
    });
  });

  it('answers current surface questions from structured context', () => {
    const snapshot = buildMaxxisContextSnapshot({
      surface: { page: 'matches', route: '/matches', subview: 'property_details' },
      propertyId: PROPERTY_A,
      messages: [assistantMessage()],
    });

    expect(isSurfaceContextQuestion('O que estou vendo?')).toBe(true);
    expect(describeMaxxisContext(snapshot, 'pt')).toContain('matches');
    expect(describeMaxxisContext(snapshot, 'en')).toContain('current focus is property');
  });

  it('attaches context only for contextual questions', () => {
    const snapshot = buildMaxxisContextSnapshot({ propertyId: PROPERTY_A, messages: [assistantMessage()] });

    expect(selectMaxxisContextForMessage(snapshot, 'What is a tax deed?')).toBeNull();
    expect(selectMaxxisContextForMessage(snapshot, 'Give me details about this deal')).toMatchObject({
      contextVersion: MAXXIS_CONTEXT_VERSION,
      property: { id: PROPERTY_A },
    });
  });

  it('sanitizes unknown fields and enforces context budget', () => {
    const snapshot = sanitizeMaxxisContextSnapshot({
      contextVersion: 999,
      surface: { page: 'matches', route: '/matches', subview: 'property_details', secret: 'x' },
      property: { id: PROPERTY_A, address: 'private street' },
      sessionMemory: {
        lastPropertyIds: Array.from({ length: 50 }, () => PROPERTY_A),
        email: 'private@example.test',
      },
    });

    expect(snapshot.contextVersion).toBe(MAXXIS_CONTEXT_VERSION);
    expect(snapshot.property).toEqual({ id: PROPERTY_A });
    expect(snapshot.surface.secret).toBeUndefined();
    expect(getMaxxisContextSize(snapshot)).toBeLessThanOrEqual(MAXXIS_CONTEXT_MAX_BYTES);
  });

  it('clears context on logout or account switch boundaries', () => {
    expect(shouldResetMaxxisContextSession('user-a', 'user-a')).toBe(false);
    expect(shouldResetMaxxisContextSession('user-a', '')).toBe(true);
    expect(shouldResetMaxxisContextSession('user-a', 'user-b')).toBe(true);
  });
});
