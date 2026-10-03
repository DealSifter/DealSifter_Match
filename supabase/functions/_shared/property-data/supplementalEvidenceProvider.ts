import { formatPropertyLookupAddress, validatePropertyLookupInput } from './address.ts';
import { createRentCastClient, type RentCastClient, type RentCastFetch } from './rentcast/rentcastClient.ts';
import { mapListings, mapMarketData, mapRentEstimate } from './supplementalEvidenceMapper.ts';
import type { SupplementalEvidenceProvider } from './supplementalEvidenceTypes.ts';
import { asPropertyDataError, PropertyDataError, type PropertyDataMode } from './types.ts';
import type { PropertyDataUsageGuard, PropertyDataUsageOperation, UsageReservation } from './usageGuard.ts';

export class RentCastSupplementalEvidenceProvider implements SupplementalEvidenceProvider {
  constructor(private readonly options: { client: Pick<RentCastClient, 'searchSaleListings' | 'estimateRent' | 'searchRentalListings' | 'getMarketData'>;
    usageGuard: PropertyDataUsageGuard; now?: () => Date }) {}

  private async guarded<T>(operation: PropertyDataUsageOperation, propertyId: string | null, userId: string | null, load: () => Promise<T>) {
    let reservation: UsageReservation | null = null;
    let finalized = false;
    try {
      reservation = await this.options.usageGuard.reserve({ operation, propertyId, userId });
      const result = await load();
      finalized = true;
      await this.options.usageGuard.finalize(reservation, { billableSuccess: true, httpStatus: 200, errorCode: null });
      return result;
    } catch (value) {
      const error = asPropertyDataError(value);
      if (reservation && !finalized) await this.options.usageGuard.finalize(reservation, {
        billableSuccess: error.billableSuccess, httpStatus: error.httpStatus, errorCode: error.code,
      }).catch(() => undefined);
      throw error;
    }
  }
  private now() { return (this.options.now || (() => new Date()))().toISOString(); }

  async getSaleListings(input: Parameters<SupplementalEvidenceProvider['getSaleListings']>[0]) {
    const lookup = validatePropertyLookupInput(input);
    return this.guarded('sale_listings', lookup.propertyId, lookup.userId, async () => {
      const response = await this.options.client.searchSaleListings({ address: formatPropertyLookupAddress(lookup), radius: 5,
        status: 'Active', propertyType: input.propertyType || undefined, limit: 50 });
      return mapListings(response.records, 'sale_listings', input.queryFingerprint, this.now());
    });
  }
  async getRentEstimate(input: Parameters<SupplementalEvidenceProvider['getRentEstimate']>[0]) {
    const lookup = validatePropertyLookupInput(input);
    return this.guarded('rent_estimate', lookup.propertyId, lookup.userId, async () => {
      const response = await this.options.client.estimateRent({ address: formatPropertyLookupAddress(lookup), maxRadius: 5,
        daysOld: 180, compCount: 20, lookupSubjectAttributes: true });
      return mapRentEstimate(response.data, input.queryFingerprint, this.now());
    });
  }
  async getRentalListings(input: Parameters<SupplementalEvidenceProvider['getRentalListings']>[0]) {
    const lookup = validatePropertyLookupInput(input);
    return this.guarded('rental_listings', lookup.propertyId, lookup.userId, async () => {
      const response = await this.options.client.searchRentalListings({ address: formatPropertyLookupAddress(lookup), radius: 5,
        status: 'Active', propertyType: input.propertyType || undefined, limit: 50 });
      return mapListings(response.records, 'rental_listings', input.queryFingerprint, this.now());
    });
  }
  async getMarketData(input: Parameters<SupplementalEvidenceProvider['getMarketData']>[0]) {
    const lookup = validatePropertyLookupInput(input);
    return this.guarded('market_data', lookup.propertyId, lookup.userId, async () => {
      const response = await this.options.client.getMarketData(lookup.zipCode);
      return mapMarketData(response.data, lookup.zipCode, input.queryFingerprint, this.now());
    });
  }
}

export function createSupplementalEvidenceProvider(options: { mode: PropertyDataMode; apiKey?: string; timeoutMs?: number;
  usageGuard?: PropertyDataUsageGuard; fetchImpl?: RentCastFetch }): SupplementalEvidenceProvider {
  if (options.mode !== 'live' || !String(options.apiKey || '').trim() || !options.usageGuard) {
    const disabled = async () => { throw new PropertyDataError(options.mode === 'live' ? 'PROVIDER_NOT_CONFIGURED' : 'PROVIDER_DISABLED'); };
    return { getSaleListings: disabled, getRentEstimate: disabled, getRentalListings: disabled, getMarketData: disabled };
  }
  return new RentCastSupplementalEvidenceProvider({
    client: createRentCastClient({ apiKey: options.apiKey!, timeoutMs: options.timeoutMs, fetchImpl: options.fetchImpl }),
    usageGuard: options.usageGuard,
  });
}
