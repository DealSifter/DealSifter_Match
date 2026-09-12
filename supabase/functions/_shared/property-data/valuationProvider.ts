import { formatPropertyLookupAddress, validatePropertyLookupInput } from './address.ts';
import { logPropertyDataEvent, type PropertyDataLogger } from './logger.ts';
import { createRentCastClient, type RentCastClient, type RentCastFetch } from './rentcast/rentcastClient.ts';
import { mapRentCastValueEstimate } from './valuationMapper.ts';
import { asPropertyDataError, PropertyDataError, type PropertyDataMode, type PropertyLookupInput } from './types.ts';
import type { PropertyDataUsageGuard, UsageReservation } from './usageGuard.ts';
import type { ValuationDataProvider, ValuationRequestPolicy } from './valuationTypes.ts';

export const DEFAULT_VALUATION_REQUEST_POLICY: Readonly<ValuationRequestPolicy> = Object.freeze({
  maxRadius: 5,
  daysOld: 270,
  compCount: 20,
  lookupSubjectAttributes: true,
});

export function normalizeValuationRequestPolicy(input: Partial<ValuationRequestPolicy> = {}): ValuationRequestPolicy {
  const maxRadius = Number(input.maxRadius);
  const daysOld = Number(input.daysOld);
  const compCount = Number(input.compCount);
  return {
    maxRadius: Number.isFinite(maxRadius) && maxRadius > 0 ? maxRadius : DEFAULT_VALUATION_REQUEST_POLICY.maxRadius,
    daysOld: Number.isFinite(daysOld) && daysOld >= 1 ? Math.trunc(daysOld) : DEFAULT_VALUATION_REQUEST_POLICY.daysOld,
    compCount: Number.isFinite(compCount) && compCount >= 5 && compCount <= 25 ? Math.trunc(compCount) : DEFAULT_VALUATION_REQUEST_POLICY.compCount,
    lookupSubjectAttributes: input.lookupSubjectAttributes !== false,
  };
}

export class DisabledValuationDataProvider implements ValuationDataProvider {
  async getValuationEvidence(_input: PropertyLookupInput): Promise<never> { throw new PropertyDataError('PROVIDER_DISABLED'); }
}

export class NotConfiguredValuationDataProvider implements ValuationDataProvider {
  async getValuationEvidence(_input: PropertyLookupInput): Promise<never> { throw new PropertyDataError('PROVIDER_NOT_CONFIGURED'); }
}

export class RentCastValuationDataProvider implements ValuationDataProvider {
  private readonly client: Pick<RentCastClient, 'estimateValue'>;
  private readonly usageGuard: PropertyDataUsageGuard;
  private readonly logger: PropertyDataLogger;
  private readonly policy: ValuationRequestPolicy;
  private readonly now: () => Date;

  constructor(options: {
    client: Pick<RentCastClient, 'estimateValue'>;
    usageGuard: PropertyDataUsageGuard;
    policy?: Partial<ValuationRequestPolicy>;
    logger?: PropertyDataLogger;
    now?: () => Date;
  }) {
    this.client = options.client;
    this.usageGuard = options.usageGuard;
    this.logger = options.logger || logPropertyDataEvent;
    this.policy = normalizeValuationRequestPolicy(options.policy);
    this.now = options.now || (() => new Date());
  }

  async getValuationEvidence(input: PropertyLookupInput) {
    const startedAt = Date.now();
    const normalizedInput = validatePropertyLookupInput(input);
    let reservation: UsageReservation | null = null;
    let finalizationAttempted = false;
    try {
      reservation = await this.usageGuard.reserve({
        propertyId: normalizedInput.propertyId,
        userId: normalizedInput.userId,
        operation: 'property_value_avm',
      });
      const response = await this.client.estimateValue({
        address: formatPropertyLookupAddress(normalizedInput),
        ...this.policy,
      });
      finalizationAttempted = true;
      await this.usageGuard.finalize(reservation, { billableSuccess: true, httpStatus: 200, errorCode: null });
      const valuation = mapRentCastValueEstimate({
        raw: response.valuation, lookup: normalizedInput, requestPolicy: this.policy,
        retrievedAt: this.now().toISOString(),
      });
      this.logger({ operation: 'property_value_avm', success: true, durationMs: Date.now() - startedAt, httpStatus: 200, quotaState: 'completed' });
      return valuation;
    } catch (value) {
      let error = asPropertyDataError(value);
      if (reservation && !finalizationAttempted) {
        finalizationAttempted = true;
        try {
          await this.usageGuard.finalize(reservation, {
            billableSuccess: error.billableSuccess, httpStatus: error.httpStatus, errorCode: error.code,
          });
        } catch {
          error = new PropertyDataError('PROVIDER_UPSTREAM_ERROR');
        }
      }
      this.logger({
        operation: 'property_value_avm', success: false, durationMs: Date.now() - startedAt,
        httpStatus: error.httpStatus, errorCode: error.code,
        quotaState: error.code === 'MONTHLY_PROVIDER_LIMIT_REACHED' ? 'blocked' : 'completed',
      });
      throw error;
    }
  }
}

export function createValuationDataProvider(options: {
  mode: PropertyDataMode;
  apiKey?: string;
  timeoutMs?: number;
  usageGuard?: PropertyDataUsageGuard;
  fetchImpl?: RentCastFetch;
  policy?: Partial<ValuationRequestPolicy>;
  logger?: PropertyDataLogger;
}): ValuationDataProvider {
  if (options.mode === 'disabled' || options.mode === 'mock') return new DisabledValuationDataProvider();
  if (!String(options.apiKey || '').trim() || !options.usageGuard) return new NotConfiguredValuationDataProvider();
  return new RentCastValuationDataProvider({
    client: createRentCastClient({ apiKey: options.apiKey || '', timeoutMs: options.timeoutMs, fetchImpl: options.fetchImpl }),
    usageGuard: options.usageGuard, policy: options.policy, logger: options.logger,
  });
}
