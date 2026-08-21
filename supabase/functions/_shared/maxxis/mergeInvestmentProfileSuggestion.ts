import type { ValidatedProfileSuggestion } from './types.ts';

type JsonObject = Record<string, unknown>;
const isObject = (value: unknown): value is JsonObject => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const objectOrEmpty = (value: unknown): JsonObject => isObject(value) ? value : {};
const listOrEmpty = (value: unknown) => Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : [];

export function mergeInvestmentProfileSuggestion(profilePayload: unknown, suggestion: ValidatedProfileSuggestion) {
  const payload = structuredClone(objectOrEmpty(profilePayload));
  const profiles = objectOrEmpty(payload.profiles);
  const professional = objectOrEmpty(profiles.professional);
  const legacy = objectOrEmpty(payload.legacy);
  const legacyProfessional = objectOrEmpty(legacy.professionalProfile);
  const currentProfile = objectOrEmpty(
    professional.investmentProfile
    || legacyProfessional.investmentProfile
    || payload.investmentProfile,
  );
  const field = suggestion.operation === 'add_market'
    ? 'targetMarkets'
    : suggestion.operation === 'add_property_type'
      ? 'propertyTypes'
      : 'strategies';
  const currentValues = listOrEmpty(currentProfile[field]);
  const exists = currentValues.some((item) => item.toLowerCase() === suggestion.suggestedValue.toLowerCase());
  const investmentProfile = {
    ...currentProfile,
    [field]: exists ? currentValues : [...currentValues, suggestion.suggestedValue],
  };
  return {
    ...payload,
    profiles: {
      ...profiles,
      professional: { ...professional, investmentProfile },
    },
    legacy: {
      ...legacy,
      professionalProfile: { ...legacyProfessional, investmentProfile },
    },
  };
}
