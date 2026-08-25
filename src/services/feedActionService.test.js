import { describe, expect, it } from 'vitest';
import { findRemovedFeedActionRows, makeFeedActionRows, resolveCanonicalFeedActions } from './feedActionService';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const PROPERTY_ID = '22222222-2222-4222-8222-222222222222';

const personalContact = {
  id: `${OWNER_ID}:personal`,
  ownerId: OWNER_ID,
  name: 'Canonical Personal',
  primaryProfile: 'personal',
};
const fsboContact = {
  id: `${OWNER_ID}:fsbo`,
  ownerId: OWNER_ID,
  name: 'Canonical FSBO',
  primaryProfile: 'fsbo',
};
const canonicalProperty = {
  id: PROPERTY_ID,
  ownerId: OWNER_ID,
  title: 'Canonical Property',
};

const identityIndex = (loaded = true) => ({
  loaded,
  contactsByOwnerId: new Map([[OWNER_ID, personalContact]]),
  contactsByOwnerScope: new Map([
    [`${OWNER_ID}::personal`, personalContact],
    [`${OWNER_ID}::fsbo`, fsboContact],
  ]),
  propertiesById: new Map([[PROPERTY_ID, canonicalProperty]]),
});

describe('feed action canonical identity boundary', () => {
  it('fails closed until the public inventory has been validated', () => {
    const result = resolveCanonicalFeedActions([{
      action: 'matched',
      entity_type: 'person',
      entity_id: OWNER_ID,
      payload: { ownerId: OWNER_ID, name: 'Untrusted fallback' },
    }], identityIndex(false));

    expect(result).toEqual({ ready: false, matched: [], interested: [], canonicalRows: [] });
  });

  it('hydrates only entities present in the canonical public inventory', () => {
    const result = resolveCanonicalFeedActions([
      {
        action: 'matched',
        entity_type: 'person',
        entity_id: OWNER_ID,
        payload: { ownerId: OWNER_ID, primaryProfile: 'fsbo', email: 'must-not-leak@example.com' },
      },
      {
        action: 'interested',
        entity_type: 'property',
        entity_id: PROPERTY_ID,
        payload: { title: 'Untrusted title' },
      },
      {
        action: 'matched',
        entity_type: 'person',
        entity_id: '7',
        payload: { ownerId: '7', name: 'Legacy Mock Person' },
      },
      {
        action: 'interested',
        entity_type: 'property',
        entity_id: '99999999-9999-4999-8999-999999999999',
        payload: { title: 'Stale Property' },
      },
    ], identityIndex());

    expect(result.ready).toBe(true);
    expect(result.matched).toEqual([{ ...fsboContact, source: 'supabase', ownerId: OWNER_ID, unlockOwnerId: OWNER_ID }]);
    expect(result.interested).toEqual([{ ...canonicalProperty, source: 'supabase' }]);
    expect(result.canonicalRows).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
    expect(JSON.stringify(result)).not.toContain('Legacy Mock Person');
    expect(JSON.stringify(result)).not.toContain('Stale Property');
  });

  it('normalizes raw realtime rows and preserves the safe profile scope in new rows', () => {
    const rows = makeFeedActionRows({
      matched: [{ ...fsboContact, unlockOwnerId: OWNER_ID }],
      interested: [canonicalProperty],
    });

    expect(rows[0].payload).toMatchObject({ ownerId: OWNER_ID, primaryProfile: 'fsbo' });
    expect(rows[0].payload).not.toHaveProperty('email');

    const result = resolveCanonicalFeedActions(rows, identityIndex());
    expect(result.matched[0]).toMatchObject({ id: `${OWNER_ID}:fsbo`, primaryProfile: 'fsbo' });
    expect(result.interested[0]).toMatchObject({ id: PROPERTY_ID });
  });

  it('accepts a validated empty inventory without falling back to persisted payloads', () => {
    const result = resolveCanonicalFeedActions([{
      action: 'interested',
      entity_type: 'property',
      entity_id: '1',
      payload: { id: '1', title: 'Legacy mock property' },
    }], {
      loaded: true,
      contactsByOwnerId: new Map(),
      contactsByOwnerScope: new Map(),
      propertiesById: new Map(),
    });

    expect(result).toEqual({ ready: true, matched: [], interested: [], canonicalRows: [] });
  });

  it('detects removals without treating profile-scope changes as another entity', () => {
    const previous = makeFeedActionRows({
      matched: [fsboContact],
      interested: [canonicalProperty],
    });
    const next = makeFeedActionRows({ matched: [fsboContact], interested: [] });

    expect(findRemovedFeedActionRows(previous, next)).toEqual([
      expect.objectContaining({ action: 'interested', entity_type: 'property', entity_id: PROPERTY_ID }),
    ]);
  });
});
