import { formatPropertyLookupAddress, validatePropertyLookupInput } from './address.ts';
import { logPropertyDataEvent, type PropertyDataLogger } from './logger.ts';
import { createRentCastClient, type RentCastClient, type RentCastFetch } from './rentcast/rentcastClient.ts';
import { mapRentCastSoldRecordPool } from './soldMapper.ts';
import type { SoldRecordDataProvider, SoldSearchPolicy } from './soldTypes.ts';
import { asPropertyDataError, PropertyDataError, type PropertyDataMode } from './types.ts';
import type { PropertyDataUsageGuard, UsageReservation } from './usageGuard.ts';

export const DEFAULT_SOLD_SEARCH_POLICY: Readonly<SoldSearchPolicy> = Object.freeze({
  radiusMiles: 5, saleDateRangeDays: 270, propertyType: 'Single Family', limit: 100,
});

export function normalizeSoldSearchPolicy(input: Partial<SoldSearchPolicy> = {}): SoldSearchPolicy {
  const radius = Number(input.radiusMiles);
  const days = Number(input.saleDateRangeDays);
  const limit = Number(input.limit);
  return {
    radiusMiles: Number.isFinite(radius) && radius > 0 && radius <= 100 ? radius : DEFAULT_SOLD_SEARCH_POLICY.radiusMiles,
    saleDateRangeDays: Number.isFinite(days) && days >= 1 ? Math.trunc(days) : DEFAULT_SOLD_SEARCH_POLICY.saleDateRangeDays,
    propertyType: String(input.propertyType || DEFAULT_SOLD_SEARCH_POLICY.propertyType).trim(),
    limit: Number.isFinite(limit) && limit >= 1 && limit <= 500 ? Math.trunc(limit) : DEFAULT_SOLD_SEARCH_POLICY.limit,
  };
}

export class RentCastSoldRecordDataProvider implements SoldRecordDataProvider {
  constructor(private readonly options: {
    client: Pick<RentCastClient, 'searchSoldProperties'>;
    usageGuard: PropertyDataUsageGuard;
    logger?: PropertyDataLogger;
    now?: () => Date;
  }) {}

  async getSoldRecordPool(input: Parameters<SoldRecordDataProvider['getSoldRecordPool']>[0]) {
    const startedAt = Date.now();
    const lookup = validatePropertyLookupInput(input);
    const policy = normalizeSoldSearchPolicy(input.policy);
    let reservation: UsageReservation | null = null;
    let finalized = false;
    try {
      reservation = await this.options.usageGuard.reserve({
        propertyId: lookup.propertyId, userId: lookup.userId, operation: 'property_sold_search',
      });
      const response = await this.options.client.searchSoldProperties({
        address: formatPropertyLookupAddress(lookup), radius: policy.radiusMiles,
        saleDateRange: policy.saleDateRangeDays, propertyType: policy.propertyType, limit: policy.limit,
      });
      finalized = true;
      await this.options.usageGuard.finalize(reservation, { billableSuccess: true, httpStatus: 200, errorCode: null });
      const pool = mapRentCastSoldRecordPool({ records: response.records, policy,
        queryFingerprint: input.queryFingerprint, retrievedAt: (this.options.now || (() => new Date()))().toISOString() });
      (this.options.logger || logPropertyDataEvent)({ operation: 'property_sold_search', success: true,
        durationMs: Date.now() - startedAt, httpStatus: 200, quotaState: 'completed' });
      return pool;
    } catch (value) {
      let error = asPropertyDataError(value);
      if (reservation && !finalized) {
        finalized = true;
        try {
          await this.options.usageGuard.finalize(reservation, { billableSuccess: error.billableSuccess,
            httpStatus: error.httpStatus, errorCode: error.code });
        } catch { error = new PropertyDataError('PROVIDER_UPSTREAM_ERROR'); }
      }
      (this.options.logger || logPropertyDataEvent)({ operation: 'property_sold_search', success: false,
        durationMs: Date.now() - startedAt, httpStatus: error.httpStatus, errorCode: error.code,
        quotaState: error.code === 'MONTHLY_PROVIDER_LIMIT_REACHED' ? 'blocked' : 'completed' });
      throw error;
    }
  }
}

export function createSoldRecordDataProvider(options: {
  mode: PropertyDataMode;
  apiKey?: string;
  timeoutMs?: number;
  usageGuard?: PropertyDataUsageGuard;
  fetchImpl?: RentCastFetch;
  logger?: PropertyDataLogger;
}): SoldRecordDataProvider {
  if (options.mode !== 'live') return { getSoldRecordPool: async () => { throw new PropertyDataError('PROVIDER_DISABLED'); } };
  if (!String(options.apiKey || '').trim() || !options.usageGuard) {
    return { getSoldRecordPool: async () => { throw new PropertyDataError('PROVIDER_NOT_CONFIGURED'); } };
  }
  return new RentCastSoldRecordDataProvider({
    client: createRentCastClient({ apiKey: options.apiKey || '', timeoutMs: options.timeoutMs, fetchImpl: options.fetchImpl }),
    usageGuard: options.usageGuard, logger: options.logger,
  });
}
