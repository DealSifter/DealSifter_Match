import {
  SupabasePropertyIntelligenceCache,
  type PropertyIntelligenceRpcClient,
} from './cache.ts';
import { type PropertyDataLogger } from './logger.ts';
import { createPropertyDataProvider, readPropertyDataConfig } from './providers.ts';
import { PropertyEvidenceService } from './propertyEvidenceService.ts';
import { SupabasePropertyEvidenceRepository, type PropertyEvidenceTableClient } from './propertyRepository.ts';
import type { RentCastFetch } from './rentcast/rentcastClient.ts';
import { SupabasePropertyDataUsageGuard, type PropertyDataUsageRpcClient } from './usageGuard.ts';
import { SupabasePropertySingleFlight } from './singleFlight.ts';

export type PropertyEvidenceBackendClient = PropertyIntelligenceRpcClient
  & PropertyDataUsageRpcClient
  & PropertyEvidenceTableClient;

export function createBackendPropertyEvidenceService(options: {
  supabaseAdmin: PropertyEvidenceBackendClient;
  getEnv: (name: string) => string | undefined;
  fetchImpl?: RentCastFetch;
  logger?: PropertyDataLogger;
}) {
  const config = readPropertyDataConfig(options.getEnv);
  // Backend callers outside HTTP must also restrict mock to isolated tests.
  if (config.mode === 'mock' && options.getEnv('NODE_ENV') !== 'test') config.mode = 'disabled';
  const usageGuard = new SupabasePropertyDataUsageGuard(options.supabaseAdmin, config.monthlyHardLimit);
  const provider = createPropertyDataProvider({
    mode: config.mode,
    apiKey: config.apiKey,
    timeoutMs: config.timeoutMs,
    usageGuard,
    fetchImpl: options.fetchImpl,
    logger: options.logger,
  });
  return new PropertyEvidenceService({
    repository: new SupabasePropertyEvidenceRepository(options.supabaseAdmin),
    cache: new SupabasePropertyIntelligenceCache(
      options.supabaseAdmin,
      options.getEnv('PROPERTY_RECORD_CACHE_TTL_HOURS'),
    ),
    provider,
    enabled: config.mode !== 'disabled',
    singleFlight: new SupabasePropertySingleFlight(options.supabaseAdmin),
    logger: options.logger,
  });
}
