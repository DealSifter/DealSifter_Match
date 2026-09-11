import { formatPropertyLookupAddress, rentCastAddressMatches, validatePropertyLookupInput } from './address.ts';
import { MOCK_PROPERTY_FIXTURES, type MockPropertyFixture } from './fixtures.ts';
import { logPropertyDataEvent, type PropertyDataLogger } from './logger.ts';
import { createRentCastClient, DEFAULT_RENTCAST_TIMEOUT_MS, type RentCastClient, type RentCastFetch } from './rentcast/rentcastClient.ts';
import { mapRentCastProperty } from './rentcast/rentcastMapper.ts';
import {
  asPropertyDataError,
  PropertyDataError,
  type NormalizedPropertyRecord,
  type PropertyDataMode,
  type PropertyDataProvider,
  type PropertyLookupInput,
} from './types.ts';
import {
  DEFAULT_RENTCAST_MONTHLY_HARD_LIMIT,
  normalizeRentCastHardLimit,
  type PropertyDataUsageGuard,
  type UsageReservation,
} from './usageGuard.ts';

const lookupKey = (input: PropertyLookupInput) => formatPropertyLookupAddress(input).toUpperCase();

export class DisabledPropertyDataProvider implements PropertyDataProvider {
  async getPropertyRecord(_input: PropertyLookupInput): Promise<NormalizedPropertyRecord> {
    throw new PropertyDataError('PROVIDER_DISABLED');
  }
}

export class NotConfiguredPropertyDataProvider implements PropertyDataProvider {
  async getPropertyRecord(_input: PropertyLookupInput): Promise<NormalizedPropertyRecord> {
    throw new PropertyDataError('PROVIDER_NOT_CONFIGURED');
  }
}

export class MockPropertyDataProvider implements PropertyDataProvider {
  private readonly fixtures: MockPropertyFixture[];

  constructor(fixtures: MockPropertyFixture[] = MOCK_PROPERTY_FIXTURES) {
    this.fixtures = fixtures;
  }

  async getPropertyRecord(input: PropertyLookupInput) {
    const normalized = validatePropertyLookupInput(input);
    const fixture = this.fixtures.find((item) => lookupKey(item.input) === lookupKey(normalized));
    if (!fixture) throw new PropertyDataError('PROPERTY_NOT_FOUND');
    return structuredClone(fixture.record);
  }
}

export class RentCastPropertyDataProvider implements PropertyDataProvider {
  private readonly client: RentCastClient;
  private readonly usageGuard: PropertyDataUsageGuard;
  private readonly logger: PropertyDataLogger;
  private readonly now: () => Date;

  constructor(options: {
    client: RentCastClient;
    usageGuard: PropertyDataUsageGuard;
    logger?: PropertyDataLogger;
    now?: () => Date;
  }) {
    this.client = options.client;
    this.usageGuard = options.usageGuard;
    this.logger = options.logger || logPropertyDataEvent;
    this.now = options.now || (() => new Date());
  }

  async getPropertyRecord(input: PropertyLookupInput) {
    const startedAt = Date.now();
    const normalizedInput = validatePropertyLookupInput(input);
    let reservation: UsageReservation | null = null;
    let finalizationAttempted = false;
    try {
      reservation = await this.usageGuard.reserve({
        propertyId: normalizedInput.propertyId,
        userId: normalizedInput.userId,
      });
      const result = await this.client.lookupProperty(formatPropertyLookupAddress(normalizedInput));
      finalizationAttempted = true;
      await this.usageGuard.finalize(reservation, { billableSuccess: true, httpStatus: 200, errorCode: null });
      if (!result.record) throw new PropertyDataError('PROPERTY_NOT_FOUND', { httpStatus: 200, billableSuccess: true });
      if (!rentCastAddressMatches(normalizedInput, result.record)) {
        throw new PropertyDataError('ADDRESS_MISMATCH', { httpStatus: 200, billableSuccess: true });
      }
      const normalizedRecord = mapRentCastProperty(result.record, this.now().toISOString());
      this.logger({ success: true, durationMs: Date.now() - startedAt, httpStatus: 200, quotaState: 'completed' });
      return normalizedRecord;
    } catch (value) {
      let error = asPropertyDataError(value);
      if (reservation && !finalizationAttempted) {
        finalizationAttempted = true;
        try {
          await this.usageGuard.finalize(reservation, {
            billableSuccess: error.billableSuccess,
            httpStatus: error.httpStatus,
            errorCode: error.code,
          });
        } catch {
          // The reservation stays active and conservatively consumes capacity.
          error = new PropertyDataError('PROVIDER_UPSTREAM_ERROR');
        }
      }
      this.logger({
        success: false,
        durationMs: Date.now() - startedAt,
        httpStatus: error.httpStatus,
        errorCode: error.code,
        quotaState: error.code === 'MONTHLY_PROVIDER_LIMIT_REACHED' ? 'blocked' : 'completed',
      });
      throw error;
    }
  }
}

export function normalizePropertyDataMode(value: unknown): PropertyDataMode {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'mock' || normalized === 'live' || normalized === 'disabled' ? normalized : 'disabled';
}

export function readPropertyDataConfig(getEnv: (name: string) => string | undefined) {
  return {
    mode: normalizePropertyDataMode(getEnv('PROPERTY_DATA_MODE')),
    apiKey: String(getEnv('RENTCAST_API_KEY') || '').trim(),
    timeoutMs: Math.max(100, Math.min(30_000, Number(getEnv('RENTCAST_TIMEOUT_MS')) || DEFAULT_RENTCAST_TIMEOUT_MS)),
    monthlyHardLimit: normalizeRentCastHardLimit(getEnv('RENTCAST_MONTHLY_HARD_LIMIT')),
  };
}

export function createPropertyDataProvider(options: {
  mode: PropertyDataMode;
  apiKey?: string;
  timeoutMs?: number;
  usageGuard?: PropertyDataUsageGuard;
  fetchImpl?: RentCastFetch;
  fixtures?: MockPropertyFixture[];
  logger?: PropertyDataLogger;
}): PropertyDataProvider {
  if (options.mode === 'disabled') return new DisabledPropertyDataProvider();
  if (options.mode === 'mock') return new MockPropertyDataProvider(options.fixtures);
  if (!String(options.apiKey || '').trim() || !options.usageGuard) return new NotConfiguredPropertyDataProvider();
  return new RentCastPropertyDataProvider({
    client: createRentCastClient({ apiKey: options.apiKey || '', timeoutMs: options.timeoutMs, fetchImpl: options.fetchImpl }),
    usageGuard: options.usageGuard,
    logger: options.logger,
  });
}

export const PROPERTY_DATA_DEFAULTS = {
  mode: 'disabled' as const,
  timeoutMs: DEFAULT_RENTCAST_TIMEOUT_MS,
  monthlyHardLimit: DEFAULT_RENTCAST_MONTHLY_HARD_LIMIT,
};
