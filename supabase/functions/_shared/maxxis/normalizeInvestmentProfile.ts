import type { MaxxisInvestmentProfile } from './types.ts';

export type NormalizedInvestmentProfileResult = {
  profile: MaxxisInvestmentProfile | null;
  complete: boolean;
  exists: boolean;
};

const cleanText = (value: unknown, max = 240) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
const cleanList = (value: unknown, maxItems = 30) => Array.from(new Set(
  (Array.isArray(value) ? value : []).map((item) => cleanText(item, 120)).filter(Boolean),
)).slice(0, maxItems);
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function extractInvestmentProfile(profilePayload: unknown): unknown {
  if (!isRecord(profilePayload)) return null;
  const profiles = isRecord(profilePayload.profiles) ? profilePayload.profiles : {};
  const professional = isRecord(profiles.professional) ? profiles.professional : {};
  if (isRecord(professional.investmentProfile)) return professional.investmentProfile;

  const legacy = isRecord(profilePayload.legacy) ? profilePayload.legacy : {};
  const legacyProfessional = isRecord(legacy.professionalProfile) ? legacy.professionalProfile : {};
  if (isRecord(legacyProfessional.investmentProfile)) return legacyProfessional.investmentProfile;

  return isRecord(profilePayload.investmentProfile) ? profilePayload.investmentProfile : null;
}

function hasMeaningfulProfile(source: Record<string, unknown>) {
  const meaningfulLists = [
    'investorRoles', 'lookingFor', 'targetMarkets', 'propertyTypes', 'strategies',
    'dealSources', 'taxDealObjectives', 'acceptableConditions',
  ];
  if (meaningfulLists.some((key) => cleanList(source[key]).length > 0)) return true;
  if (['currentFocus', 'taxDealObjectiveOtherText', 'priceRange', 'capitalReady', 'accreditedInvestor']
    .some((key) => cleanText(source[key]).length > 0)) return true;
  if (Number(source.currentlyActiveDeals || 0) > 0 || Number(source.profileStrength || 0) > 0) return true;
  if (cleanText(source.status) === 'complete' || source.completedAt) return true;
  if (!['', '0'].includes(cleanText(source.dealsClosedLifetime))) return true;
  if (!['', '0'].includes(cleanText(source.dealsClosedLast12mo))) return true;
  return false;
}

export function normalizeInvestmentProfile(value: unknown): NormalizedInvestmentProfileResult {
  const source = isRecord(value) ? value : {};
  if (!hasMeaningfulProfile(source)) return { profile: null, complete: false, exists: false };

  const profile: MaxxisInvestmentProfile = {};
  const mutableProfile = profile as unknown as Record<string, unknown>;
  const addText = (key: keyof MaxxisInvestmentProfile, raw: unknown, max = 240) => {
    const normalized = cleanText(raw, max);
    if (normalized) mutableProfile[key] = normalized;
  };
  const addList = (key: keyof MaxxisInvestmentProfile, raw: unknown) => {
    const normalized = cleanList(raw);
    if (normalized.length) mutableProfile[key] = normalized;
  };

  const version = Number(source.version);
  if (Number.isFinite(version)) profile.version = Math.max(1, Math.floor(version));
  const status = cleanText(source.status, 20);
  if (status === 'draft' || status === 'complete') profile.status = status;
  const strength = Number(source.profileStrength);
  if (Number.isFinite(strength)) profile.profileStrength = Math.max(0, Math.min(100, Math.round(strength)));
  if (typeof source.completedAt === 'number' || typeof source.completedAt === 'string') profile.completedAt = source.completedAt;

  addText('currentFocus', source.currentFocus, 500);
  addList('triggerCategories', source.triggerCategories);
  addList('investorRoles', source.investorRoles);
  addList('lookingFor', source.lookingFor);
  addList('targetMarkets', source.targetMarkets);
  addList('propertyTypes', source.propertyTypes);
  addList('strategies', source.strategies);
  addList('dealSources', source.dealSources);
  addList('taxDealObjectives', source.taxDealObjectives);
  addText('taxDealObjectiveOtherText', source.taxDealObjectiveOtherText, 500);
  addText('priceRange', source.priceRange, 40);
  addList('acceptableConditions', source.acceptableConditions);
  if (source.capitalReady === 'yes' || source.capitalReady === 'no') profile.capitalReady = source.capitalReady;
  if (source.accreditedInvestor === 'yes' || source.accreditedInvestor === 'no') profile.accreditedInvestor = source.accreditedInvestor;
  addText('dealsClosedLifetime', source.dealsClosedLifetime, 20);
  addText('dealsClosedLast12mo', source.dealsClosedLast12mo, 20);
  addText('avgDealSize', source.avgDealSize, 40);
  addText('yearsInvesting', source.yearsInvesting, 20);
  const activeDeals = Number(source.currentlyActiveDeals);
  if (Number.isFinite(activeDeals)) profile.currentlyActiveDeals = Math.max(0, Math.min(99, Math.round(activeDeals)));

  return { profile, complete: profile.status === 'complete', exists: true };
}
