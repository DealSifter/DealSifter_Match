export type FeatureEnvironment = 'development' | 'staging' | 'production';

export type FeatureFlagDefinition = {
  enabled: boolean;
  environments: FeatureEnvironment[];
  percentage: number;
};

export const FEATURE_FLAG_DEFINITIONS = {
  platform_readiness_probe: { enabled: true, environments: ['development', 'staging'], percentage: 100 },
  maxxis_next_generation: { enabled: false, environments: [], percentage: 0 },
  maxxis_proactive_insights: { enabled: false, environments: [], percentage: 0 },
  maxxis_deal_memory: { enabled: true, environments: ['development', 'staging'], percentage: 100 },
  new_feed_experience: { enabled: false, environments: [], percentage: 0 },
  advanced_deal_analysis: { enabled: false, environments: [], percentage: 0 },
  experimental_provider_flow: { enabled: false, environments: [], percentage: 0 },
} as const satisfies Record<string, FeatureFlagDefinition>;

export type FeatureFlagName = keyof typeof FEATURE_FLAG_DEFINITIONS;

const clampPercentage = (value: unknown) => Math.max(0, Math.min(100, Math.floor(Number(value) || 0)));

export function deterministicCohort(userId: string, flagName: string) {
  const input = `${String(userId || '').trim()}:${String(flagName || '').trim()}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

function normalizeDefinition(value: unknown, fallback: FeatureFlagDefinition): FeatureFlagDefinition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const candidate = value as Partial<FeatureFlagDefinition>;
  const environments = Array.isArray(candidate.environments)
    ? candidate.environments.filter((item): item is FeatureEnvironment => ['development', 'staging', 'production'].includes(String(item)))
    : fallback.environments;
  return {
    enabled: candidate.enabled === true,
    environments,
    percentage: clampPercentage(candidate.percentage),
  };
}

export function resolveFeatureFlags({
  userId,
  environment,
  remoteConfig = {},
  overrides = {},
  allowOverride = false,
}: {
  userId: string;
  environment: FeatureEnvironment;
  remoteConfig?: Record<string, unknown>;
  overrides?: Record<string, unknown>;
  allowOverride?: boolean;
}) {
  const result = {} as Record<FeatureFlagName, boolean>;
  for (const flagName of Object.keys(FEATURE_FLAG_DEFINITIONS) as FeatureFlagName[]) {
    const fallback = FEATURE_FLAG_DEFINITIONS[flagName] as FeatureFlagDefinition;
    const definition = normalizeDefinition(remoteConfig[flagName], fallback);
    const environmentEnabled = definition.environments.includes(environment);
    const cohortEnabled = deterministicCohort(userId, flagName) < definition.percentage;
    let enabled = definition.enabled && environmentEnabled && cohortEnabled;
    if (allowOverride && typeof overrides[flagName] === 'boolean') enabled = overrides[flagName] === true;
    result[flagName] = enabled;
  }
  return result;
}
