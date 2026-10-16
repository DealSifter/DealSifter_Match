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
import { readProviderBudgetConfig, SupabaseProviderBudgetManager, type ProviderBudgetBucket, type ProviderBudgetPlan } from './providerBudget.ts';
import { SupabasePropertySingleFlight } from './singleFlight.ts';
import { SupabaseValuationEvidenceCache } from './valuationCache.ts';
import { ValuationEvidenceService } from './valuationEvidenceService.ts';
import { createValuationDataProvider } from './valuationProvider.ts';
import { SupabaseSoldRecordPoolCache } from './soldCache.ts';
import { SoldEvidenceService } from './soldEvidenceService.ts';
import { createSoldRecordDataProvider } from './soldProvider.ts';
import { SupabaseSupplementalEvidenceCache } from './supplementalEvidenceCache.ts';
import { SupplementalEvidenceService } from './supplementalEvidenceService.ts';
import { createSupplementalEvidenceProvider } from './supplementalEvidenceProvider.ts';
import {MarketRentService} from './marketRentService.ts';
import type {RentAvmSubject} from './rentAvmSubject.ts';
import {resolveCachedRentAvmSubject} from './marketRentSubjectContext.ts';

export function createBackendMarketRentService(options:{supabaseAdmin:PropertyEvidenceBackendClient;getEnv:(name:string)=>string|undefined;
  providerBudgetContext:ProviderBudgetContext;resolveSubject:()=>Promise<RentAvmSubject>;hasEntitlement:()=>Promise<boolean>;fetchImpl?:RentCastFetch}){
  const config=readPropertyDataConfig(options.getEnv),flight=new SupabasePropertySingleFlight(options.supabaseAdmin);
  return new MarketRentService({cache:new SupabaseSupplementalEvidenceCache(options.supabaseAdmin),singleFlight:flight,
    resolveSubject:options.resolveSubject,hasEntitlement:options.hasEntitlement,enabled:config.mode==='live',
    providerGate:work=>flight.run('rentcast:market-rent-rate-gate',async()=>{
      const start=Date.now();try{return await work();}finally{const wait=250-(Date.now()-start);if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));}
    }),
    provider:createSupplementalEvidenceProvider({mode:config.mode,apiKey:config.apiKey,timeoutMs:config.timeoutMs,
      usageGuard:usageGuard({supabaseAdmin:options.supabaseAdmin,getEnv:options.getEnv,context:options.providerBudgetContext}),fetchImpl:options.fetchImpl})});
}

export type PropertyEvidenceBackendClient = PropertyIntelligenceRpcClient
  & PropertyDataUsageRpcClient
  & PropertyEvidenceTableClient;

type ProviderBudgetContext = { userId: string; propertyId: string; plan: ProviderBudgetPlan; bucket: ProviderBudgetBucket };

function usageGuard(options: { supabaseAdmin: PropertyEvidenceBackendClient; getEnv: (name: string) => string | undefined; context?: ProviderBudgetContext }) {
  const config = readPropertyDataConfig(options.getEnv);
  const budget = options.context ? new SupabaseProviderBudgetManager(options.supabaseAdmin, {
    ...options.context,
    config: readProviderBudgetConfig(options.context.plan, options.getEnv),
  }) : null;
  return new SupabasePropertyDataUsageGuard(options.supabaseAdmin, config.monthlyHardLimit, budget);
}

export function createBackendPropertyEvidenceService(options: {
  supabaseAdmin: PropertyEvidenceBackendClient;
  getEnv: (name: string) => string | undefined;
  fetchImpl?: RentCastFetch;
  logger?: PropertyDataLogger;
  providerBudgetContext?: ProviderBudgetContext;
}) {
  const config = readPropertyDataConfig(options.getEnv);
  // Backend callers outside HTTP must also restrict mock to isolated tests.
  if (config.mode === 'mock' && options.getEnv('NODE_ENV') !== 'test') config.mode = 'disabled';
  const guardedUsage = usageGuard({ supabaseAdmin: options.supabaseAdmin, getEnv: options.getEnv, context: options.providerBudgetContext });
  const provider = createPropertyDataProvider({
    mode: config.mode,
    apiKey: config.apiKey,
    timeoutMs: config.timeoutMs,
    usageGuard: guardedUsage,
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
  providerBudgetContext?: ProviderBudgetContext;
}) {
  const config = readPropertyDataConfig(options.getEnv);
  if (config.mode === 'mock' && options.getEnv('NODE_ENV') !== 'test') config.mode = 'disabled';
  const guardedUsage = usageGuard({ supabaseAdmin: options.supabaseAdmin, getEnv: options.getEnv, context: options.providerBudgetContext });
  return new ValuationEvidenceService({
    repository: new SupabasePropertyEvidenceRepository(options.supabaseAdmin),
    cache: new SupabaseValuationEvidenceCache(options.supabaseAdmin, options.getEnv('VALUATION_CACHE_TTL_HOURS')),
    provider: createValuationDataProvider({
      mode: config.mode, apiKey: config.apiKey, timeoutMs: config.timeoutMs, usageGuard: guardedUsage,
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
  providerBudgetContext?: ProviderBudgetContext;
  developmentPropertyType?: string;
}) {
  const config = readPropertyDataConfig(options.getEnv);
  if (config.mode === 'mock' && options.getEnv('NODE_ENV') !== 'test') config.mode = 'disabled';
  const guardedUsage = usageGuard({ supabaseAdmin: options.supabaseAdmin, getEnv: options.getEnv, context: options.providerBudgetContext });
  return new SoldEvidenceService({
    repository: new SupabasePropertyEvidenceRepository(options.supabaseAdmin),
    valuationCache: new SupabaseValuationEvidenceCache(options.supabaseAdmin, options.getEnv('VALUATION_CACHE_TTL_HOURS')),
    soldCache: new SupabaseSoldRecordPoolCache(options.supabaseAdmin, options.getEnv('SOLD_RECORD_POOL_CACHE_TTL_HOURS'),
      options.developmentPropertyType ? `property_sold_record_pool_exit_${options.developmentPropertyType.toLowerCase().replace(/\s+/g, '_')}` : 'property_sold_record_pool'),
    provider: createSoldRecordDataProvider({ mode: config.mode, apiKey: config.apiKey,
      timeoutMs: config.timeoutMs, usageGuard: guardedUsage, fetchImpl: options.fetchImpl, logger: options.logger }),
    enabled: config.mode === 'live',
    singleFlight: new SupabasePropertySingleFlight(options.supabaseAdmin),
    developmentPropertyType: options.developmentPropertyType,
    policy: options.developmentPropertyType ? { saleDateRangeDays: 365 } : undefined,
  });
}

export function createBackendSupplementalEvidenceService(options: {
  supabaseAdmin: PropertyEvidenceBackendClient;
  getEnv: (name: string) => string | undefined;
  fetchImpl?: RentCastFetch;
  logger?: PropertyDataLogger;
  providerBudgetContext?: ProviderBudgetContext;
}) {
  const config = readPropertyDataConfig(options.getEnv);
  if (config.mode === 'mock' && options.getEnv('NODE_ENV') !== 'test') config.mode = 'disabled';
  const guardedUsage = usageGuard({ supabaseAdmin: options.supabaseAdmin, getEnv: options.getEnv, context: options.providerBudgetContext });
  return new SupplementalEvidenceService({
    repository: new SupabasePropertyEvidenceRepository(options.supabaseAdmin),
    cache: new SupabaseSupplementalEvidenceCache(options.supabaseAdmin),
    provider: createSupplementalEvidenceProvider({ mode: config.mode, apiKey: config.apiKey,
      timeoutMs: config.timeoutMs, usageGuard: guardedUsage, fetchImpl: options.fetchImpl }),
    enabled: config.mode === 'live',
    singleFlight: new SupabasePropertySingleFlight(options.supabaseAdmin),
    marketRent:options.providerBudgetContext?createBackendMarketRentService({...options,providerBudgetContext:options.providerBudgetContext,
      resolveSubject:()=>resolveCachedRentAvmSubject(options.supabaseAdmin,options.providerBudgetContext!.propertyId),
      // Upstream report family capability policy remains authoritative.
      hasEntitlement:async()=>true}):undefined,
  });
}
