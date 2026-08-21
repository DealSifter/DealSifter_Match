import { describe, expect, it } from 'vitest';
import { areDataSnapshotsEquivalent, preserveEquivalentState } from './stateStability';

describe('stateStability', () => {
  it('treats equivalent records and maps as the same snapshot', () => {
    const previous = new Map([
      ['owner-b', { ownerId: 'owner-b', contact: { name: 'Beta' } }],
      ['owner-a', { contact: { name: 'Alpha' }, ownerId: 'owner-a' }],
    ]);
    const next = new Map([
      ['owner-a', { ownerId: 'owner-a', contact: { name: 'Alpha' } }],
      ['owner-b', { contact: { name: 'Beta' }, ownerId: 'owner-b' }],
    ]);

    expect(areDataSnapshotsEquivalent(previous, next)).toBe(true);
    expect(preserveEquivalentState(previous, next)).toBe(previous);
  });

  it('detects actual entitlement and feed changes', () => {
    const previous = [{ ownerId: 'owner-a', unlocked: false }];
    const next = [{ ownerId: 'owner-a', unlocked: true }];

    expect(areDataSnapshotsEquivalent(previous, next)).toBe(false);
    expect(preserveEquivalentState(previous, next)).toBe(next);
  });
});
