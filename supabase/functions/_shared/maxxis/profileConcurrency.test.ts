import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mergeInvestmentProfileSuggestion } from './mergeInvestmentProfileSuggestion.ts';

type JsonObject = Record<string, any>;
type VersionedRecord = { version: number; payload: JsonObject };

const objectOrEmpty = (value: unknown): JsonObject => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
);

function mergeFormPayload(currentValue: unknown, incomingValue: unknown) {
  const current = structuredClone(objectOrEmpty(currentValue));
  const incoming = objectOrEmpty(incomingValue);
  const result = { ...current };
  if (typeof incoming.version === 'number') result.version = incoming.version;
  if (typeof incoming.accountType === 'string') result.accountType = incoming.accountType;

  for (const namespace of ['profiles', 'resolved'] as const) {
    const currentNamespace = objectOrEmpty(current[namespace]);
    const incomingNamespace = objectOrEmpty(incoming[namespace]);
    const mergedNamespace = { ...currentNamespace };
    for (const branch of ['personal', 'professional', 'fsbo']) {
      if (Object.keys(objectOrEmpty(incomingNamespace[branch])).length) {
        mergedNamespace[branch] = {
          ...objectOrEmpty(currentNamespace[branch]),
          ...objectOrEmpty(incomingNamespace[branch]),
        };
      }
    }
    result[namespace] = mergedNamespace;
  }

  const currentLegacy = objectOrEmpty(current.legacy);
  const incomingLegacy = objectOrEmpty(incoming.legacy);
  result.legacy = { ...currentLegacy };
  for (const branch of ['personalProfile', 'professionalProfile']) {
    if (Object.keys(objectOrEmpty(incomingLegacy[branch])).length) {
      result.legacy[branch] = {
        ...objectOrEmpty(currentLegacy[branch]),
        ...objectOrEmpty(incomingLegacy[branch]),
      };
    }
  }

  const incomingInvestmentProfile = incoming?.profiles?.professional?.investmentProfile
    || incoming?.legacy?.professionalProfile?.investmentProfile;
  if (incomingInvestmentProfile && typeof incomingInvestmentProfile === 'object') {
    const existingInvestmentProfile = current?.profiles?.professional?.investmentProfile
      || current?.legacy?.professionalProfile?.investmentProfile
      || {};
    const investmentProfile = {
      ...objectOrEmpty(existingInvestmentProfile),
      ...objectOrEmpty(incomingInvestmentProfile),
    };
    result.profiles = objectOrEmpty(result.profiles);
    result.profiles.professional = {
      ...objectOrEmpty(result.profiles.professional),
      investmentProfile: structuredClone(investmentProfile),
    };
    result.legacy = objectOrEmpty(result.legacy);
    result.legacy.professionalProfile = {
      ...objectOrEmpty(result.legacy.professionalProfile),
      investmentProfile: structuredClone(investmentProfile),
    };
  }
  return result;
}

function saveWithExpectedVersion(record: VersionedRecord, expectedVersion: number, incoming: JsonObject) {
  if (record.version !== expectedVersion) {
    return {
      success: false as const,
      code: 'PROFILE_CONFLICT',
      record: structuredClone(record),
    };
  }
  return {
    success: true as const,
    record: {
      version: record.version + 1,
      payload: mergeFormPayload(record.payload, incoming),
    },
  };
}

const migration = readFileSync(new URL('../../../migrations/20260810000002_profile_concurrency_protection.sql', import.meta.url), 'utf8');
const maxxisMigration = readFileSync(new URL('../../../migrations/20260810000001_maxxis_pending_profile_actions.sql', import.meta.url), 'utf8');
const frontendService = readFileSync(new URL('../../../../src/services/profileConcurrencyService.js', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../../../../src/App.jsx', import.meta.url), 'utf8');

describe('Profile Concurrency Protection', () => {
  it('1. saves version 1 successfully while the database remains at version 1', () => {
    const result = saveWithExpectedVersion({ version: 1, payload: { safe: true } }, 1, { accountType: 'professional' });
    expect(result.success).toBe(true);
    expect(result.record.version).toBe(2);
  });

  it('2. returns PROFILE_CONFLICT after Maxxis advances version 1 to version 2 without losing its change', () => {
    const base: VersionedRecord = {
      version: 1,
      payload: { profiles: { professional: { investmentProfile: { targetMarkets: ['FL'] } } } },
    };
    const afterMaxxis: VersionedRecord = {
      version: 2,
      payload: mergeInvestmentProfileSuggestion(base.payload, { operation: 'add_market', dimension: 'market', suggestedValue: 'AL' }),
    };
    const staleSave = saveWithExpectedVersion(afterMaxxis, 1, {
      profiles: { professional: { investmentProfile: { targetMarkets: ['FL'] } } },
    });
    expect(staleSave).toMatchObject({ success: false, code: 'PROFILE_CONFLICT' });
    expect(staleSave.record.payload.profiles.professional.investmentProfile.targetMarkets).toEqual(['FL', 'AL']);
    expect(migration).toContain('before update on public.professional_profiles');
    expect(maxxisMigration).toContain('update public.professional_profiles set profile_payload = v_payload');
  });

  it('3. allows only one of two tabs saving the same version to win', () => {
    const base = { version: 1, payload: { profiles: { professional: { pitchB: 'old' } } } };
    const first = saveWithExpectedVersion(base, 1, { profiles: { professional: { pitchB: 'tab-a' } } });
    expect(first.success).toBe(true);
    const second = saveWithExpectedVersion(first.record, 1, { profiles: { professional: { pitchB: 'tab-b' } } });
    expect(second).toMatchObject({ success: false, code: 'PROFILE_CONFLICT' });
    expect(second.record.payload.profiles.professional.pitchB).toBe('tab-a');
  });

  it('4. preserves edited professional fields when Maxxis adds a market', () => {
    const payload = {
      profiles: { professional: { pitchB: 'edited pitch', customPreference: 'keep', investmentProfile: { targetMarkets: ['FL'] } } },
      legacy: { professionalProfile: { pitchB: 'edited pitch', investmentProfile: { targetMarkets: ['FL'] } } },
    };
    const merged = mergeInvestmentProfileSuggestion(payload, { operation: 'add_market', dimension: 'market', suggestedValue: 'AL' }) as any;
    expect(merged.profiles.professional.pitchB).toBe('edited pitch');
    expect(merged.profiles.professional.customPreference).toBe('keep');
    expect(merged.profiles.professional.investmentProfile.targetMarkets).toEqual(['FL', 'AL']);
  });

  it('5. preserves unrelated profile_payload namespaces during onboarding save', () => {
    const current = {
      billing: { plan: 'pro' },
      customRoot: { untouched: true },
      profiles: { professional: { serverOnly: 'keep', pitchB: 'old' }, futureScope: { enabled: true } },
    };
    const merged = mergeFormPayload(current, { profiles: { professional: { pitchB: 'new' } } });
    expect(merged.billing).toEqual({ plan: 'pro' });
    expect(merged.customRoot).toEqual({ untouched: true });
    expect(merged.profiles.futureScope).toEqual({ enabled: true });
    expect(merged.profiles.professional).toMatchObject({ serverOnly: 'keep', pitchB: 'new' });
    const investmentMerge = mergeFormPayload(
      { profiles: { professional: { investmentProfile: { serverOnlyCriterion: 'keep', targetMarkets: ['FL'] } } } },
      { profiles: { professional: { investmentProfile: { targetMarkets: ['FL', 'AL'] } } } },
    );
    expect(investmentMerge.profiles.professional.investmentProfile).toEqual({ serverOnlyCriterion: 'keep', targetMarkets: ['FL', 'AL'] });
  });

  it('6. keeps current and legacy Investment Profile structures synchronized', () => {
    const investmentProfile = { targetMarkets: ['TX'], propertyTypes: ['Single Family'] };
    const merged = mergeFormPayload({}, { profiles: { professional: { investmentProfile } } });
    expect(merged.profiles.professional.investmentProfile).toEqual(investmentProfile);
    expect(merged.legacy.professionalProfile.investmentProfile).toEqual(investmentProfile);
  });

  it('7. binds writes to auth.uid and does not accept another user id', () => {
    expect(migration).toContain('v_user_id uuid := auth.uid()');
    expect(migration).toContain('where user_id = v_user_id');
    expect(migration).not.toContain('p_user_id');
    expect(migration).toContain('revoke insert, update on table public.professional_profiles from public, anon, authenticated');
    expect(frontendService).not.toContain('p_user_id');
    expect(frontendService).toContain("supabase.rpc('ds_save_professional_profile'");
  });

  it('8. leaves the database record unchanged when a conflict occurs', () => {
    const record = { version: 2, payload: { profiles: { professional: { pitchB: 'winner' } } } };
    const before = structuredClone(record);
    const result = saveWithExpectedVersion(record, 1, { profiles: { professional: { pitchB: 'stale' } } });
    expect(result.success).toBe(false);
    expect(result.record).toEqual(before);
    expect(migration).toContain('if v_current.profile_version <> p_expected_version then');
    expect(migration).toContain('where user_id = v_user_id and profile_version = p_expected_version');
    expect(appSource).toContain('if (isProfileConflictError(error))');
    expect(appSource).toContain('refreshProfileHydration();');
  });

  it('9. succeeds when retrying after reloading the current version', () => {
    const current = { version: 2, payload: { profiles: { professional: { pitchB: 'winner' } } } };
    expect(saveWithExpectedVersion(current, 1, {}).success).toBe(false);
    const retry = saveWithExpectedVersion(current, 2, { profiles: { professional: { pitchB: 'reviewed retry' } } });
    expect(retry.success).toBe(true);
    expect(retry.record).toMatchObject({ version: 3, payload: { profiles: { professional: { pitchB: 'reviewed retry' } } } });
  });
});
