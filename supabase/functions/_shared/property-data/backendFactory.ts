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
import { SupabaseValuationEvidenceCache } from './valuationCache.ts';
import { ValuationEvidenceService } from './valuationEvidenceService.ts';
import { createValuationDataProvider } from './valuationProvider.ts';
import { SupabaseSoldRecordPoolCache } from './soldCache.ts';
import { SoldEvidenceService } from './soldEvidenceService.ts';
import { createSoldRecordDataProvider } from './soldProvider.ts';

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

export function createBackendValuationEvidenceService(options: {
  supabaseAdmin: PropertyEvidenceBackendClient;
  getEnv: (name: string) => string | undefined;
  fetchImpl?: RentCastFetch;
  logger?: PropertyDataLogger;
}) {
  const config = readPropertyDataConfig(options.getEnv);
  if (config.mode === 'mock' && options.getEnv('NODE_ENV') !== 'test') config.mode = 'disabled';
  const usageGuard = new SupabasePropertyDataUsageGuard(options.supabaseAdmin, config.monthlyHardLimit);
  return new ValuationEvidenceService({
    repository: new SupabasePropertyEvidenceRepository(options.supabaseAdmin),
    cache: new SupabaseValuationEvidenceCache(options.supabaseAdmin, options.getEnv('VALUATION_CACHE_TTL_HOURS')),
    provider: createValuationDataProvider({
      mode: config.mode, apiKey: config.apiKey, timeoutMs: config.timeoutMs, usageGuard,
      fetchImpl: options.fetchImpl, logger: options.logger,
    }),
    enabled: config.mode === 'live',
    singleFlight: new SupabasePropertySingleFlight(options.supabaseAdmin),
  });
}

export function createBackendSoldEvidenceService(options: {
  supabaseAdmin: PropertyEvidenceBackendClient;
  getEnv: (name: string) => string | undefined;
  fetchImpl?: RentCastFetch;
  logger?: PropertyDataLogger;
}) {
  const config = readPropertyDataConfig(options.getEnv);
  if (config.mode === 'mock' && options.getEnv('NODE_ENV') !== 'test') config.mode = 'disabled';
  const usageGuard = new SupabasePropertyDataUsageGuard(options.supabaseAdmin, config.monthlyHardLimit);
  return new SoldEvidenceService({
    repository: new SupabasePropertyEvidenceRepository(options.supabaseAdmin),
    valuationCache: new SupabaseValuationEvidenceCache(options.supabaseAdmin, options.getEnv('VALUATION_CACHE_TTL_HOURS')),
    soldCache: new SupabaseSoldRecordPoolCache(options.supabaseAdmin, options.getEnv('SOLD_RECORD_POOL_CACHE_TTL_HOURS')),
    provider: createSoldRecordDataProvider({ mode: config.mode, apiKey: config.apiKey,
      timeoutMs: config.timeoutMs, usageGuard, fetchImpl: options.fetchImpl, logger: options.logger }),
    enabled: config.mode === 'live',
    singleFlight: new SupabasePropertySingleFlight(options.supabaseAdmin),
  });
}
