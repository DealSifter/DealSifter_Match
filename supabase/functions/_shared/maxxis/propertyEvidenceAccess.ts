import type { ProviderBudgetPlan } from '../property-data/providerBudget.ts';

export function resolvePropertyEvidenceAccess({ plan, maxxisAnalysisOnly, cacheOnly }: {
  plan: ProviderBudgetPlan;
  maxxisAnalysisOnly: boolean;
  cacheOnly: boolean;
}) {
  const cacheAuthorized = plan !== 'FREE';
  return Object.freeze({
    cacheAuthorized,
    allowProviderFallback: cacheAuthorized && !maxxisAnalysisOnly && !cacheOnly,
  });
}
