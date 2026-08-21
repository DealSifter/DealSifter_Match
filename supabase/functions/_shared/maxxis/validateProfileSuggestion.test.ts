import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mergeInvestmentProfileSuggestion } from './mergeInvestmentProfileSuggestion.ts';
import { validateProfileSuggestion } from './validateProfileSuggestion.ts';

const validMarket = () => {
  const result = validateProfileSuggestion({ dimension: 'market', operation: 'add_market', suggestedValue: 'Alabama' });
  if (!result.valid) throw new Error(result.error);
  return result.suggestion;
};

describe('confirmed Investment Profile updates', () => {
  const migration = readFileSync(new URL('../../../migrations/20260810000001_maxxis_pending_profile_actions.sql', import.meta.url), 'utf8');
  const confirmBody = migration.split('create or replace function public.ds_confirm_maxxis_profile_action')[1]
    .split('create or replace function public.ds_cancel_maxxis_profile_action')[0];
  const cancelBody = migration.split('create or replace function public.ds_cancel_maxxis_profile_action')[1];

  it('1. adds AL to an existing FL market list', () => {
    const payload = { profiles: { professional: { investmentProfile: { targetMarkets: ['FL'] } } } };
    const merged = mergeInvestmentProfileSuggestion(payload, validMarket());
    expect((merged.profiles as any).professional.investmentProfile.targetMarkets).toEqual(['FL', 'AL']);
    expect((merged.legacy as any).professionalProfile.investmentProfile.targetMarkets).toEqual(['FL', 'AL']);
  });

  it('2. does not duplicate an existing value', () => {
    const payload = { profiles: { professional: { investmentProfile: { targetMarkets: ['FL', 'AL'] } } } };
    const merged = mergeInvestmentProfileSuggestion(payload, validMarket());
    expect((merged.profiles as any).professional.investmentProfile.targetMarkets).toEqual(['FL', 'AL']);
  });

  it('3. rejects operations, dimensions, values, and arbitrary paths outside the allowlist', () => {
    expect(validateProfileSuggestion({ dimension: 'market', operation: 'remove_market', suggestedValue: 'FL' })).toEqual({ valid: false, error: 'OPERATION_NOT_ALLOWED' });
    expect(validateProfileSuggestion({ dimension: 'strategy', operation: 'add_market', suggestedValue: 'AL' })).toEqual({ valid: false, error: 'DIMENSION_MISMATCH' });
    expect(validateProfileSuggestion({ dimension: 'property_type', operation: 'add_property_type', suggestedValue: 'Anything' })).toEqual({ valid: false, error: 'VALUE_NOT_ALLOWED' });
    expect(validateProfileSuggestion({ operation: 'profile_payload.foo.bar', suggestedValue: 'AL' }).valid).toBe(false);
  });

  it('4. scopes confirmation to the authenticated action owner', () => {
    expect(confirmBody).toContain('where id = p_action_id and user_id = v_user_id');
    expect(confirmBody).not.toContain('p_user_id');
  });

  it('5. refuses an action whose status is no longer pending', () => {
    expect(confirmBody).toContain("if v_action.status <> 'pending'");
    expect(confirmBody).toContain('for update;');
    expect(confirmBody).toContain("set status = 'executed', confirmed_at = now(), executed_at = now()");
  });

  it('6. refuses an expired action', () => {
    expect(confirmBody).toContain('if v_action.expires_at <= now()');
    expect(confirmBody).toContain("set status = 'expired'");
  });

  it('7. cancels a pending action without mutating the profile', () => {
    expect(cancelBody).toContain("set status = 'cancelled', cancelled_at = now()");
    expect(cancelBody).not.toContain('update public.professional_profiles');
  });

  it('8. preserves every unrelated profile_payload branch and legacy field', () => {
    const payload = {
      version: 9,
      resolved: { personal: { name: 'Keep me' } },
      profiles: { personal: { fullName: 'A' }, professional: { pitchB: 'Keep pitch', investmentProfile: { targetMarkets: ['FL'], capitalReady: 'yes' } } },
      legacy: { personalProfile: { fullName: 'Legacy A' }, professionalProfile: { custom: 'keep', investmentProfile: { targetMarkets: ['FL'], capitalReady: 'yes' } } },
      customRoot: { untouched: true },
    };
    const merged = mergeInvestmentProfileSuggestion(payload, validMarket()) as any;
    expect(merged.version).toBe(9);
    expect(merged.resolved).toEqual(payload.resolved);
    expect(merged.profiles.personal).toEqual(payload.profiles.personal);
    expect(merged.profiles.professional.pitchB).toBe('Keep pitch');
    expect(merged.profiles.professional.investmentProfile.capitalReady).toBe('yes');
    expect(merged.legacy.personalProfile).toEqual(payload.legacy.personalProfile);
    expect(merged.legacy.professionalProfile.custom).toBe('keep');
    expect(merged.customRoot).toEqual({ untouched: true });
  });

  it('9. keeps preparation separate from profile mutation and excludes Gemini from writing', () => {
    const prepareBody = migration.split('create or replace function public.ds_prepare_maxxis_profile_actions')[1]
      .split('create or replace function public.ds_confirm_maxxis_profile_action')[0];
    expect(prepareBody).not.toContain('professional_profiles');
    const handler = readFileSync(new URL('./profileActionHandler.ts', import.meta.url), 'utf8');
    expect(handler.toLowerCase()).not.toContain('gemini');
    expect(handler).toContain("const actionId = String(body?.actionId || '').trim()");
    expect(handler).not.toContain('suggestedValue = body');
    expect(handler).not.toContain('SERVICE_ROLE');
  });

  it('10. creates only the minimum compatible branches when Investment Profile is absent', () => {
    const payload = { profiles: { personal: { fullName: 'Existing' } }, other: { safe: true } };
    const merged = mergeInvestmentProfileSuggestion(payload, validMarket()) as any;
    expect(merged.profiles.personal.fullName).toBe('Existing');
    expect(merged.profiles.professional.investmentProfile.targetMarkets).toEqual(['AL']);
    expect(merged.legacy.professionalProfile.investmentProfile.targetMarkets).toEqual(['AL']);
    expect(merged.other).toEqual({ safe: true });
  });
});
