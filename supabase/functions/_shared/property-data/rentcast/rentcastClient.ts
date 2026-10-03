import { PropertyDataError } from '../types.ts';
import type {
  RentCastLookupResult,
  RentCastPropertyRecordRaw,
  RentCastSoldSearchResult,
  RentCastValueEstimateRaw,
  RentCastValueEstimateResult,
  RentCastObjectResult,
  RentCastArrayResult,
} from './rentcastTypes.ts';

export const RENTCAST_BASE_URL = 'https://api.rentcast.io/v1';
export const DEFAULT_RENTCAST_TIMEOUT_MS = 8_000;

export type RentCastFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type RentCastClient = {
  lookupProperty(address: string): Promise<RentCastLookupResult>;
  estimateValue(input: RentCastValueEstimateInput): Promise<RentCastValueEstimateResult>;
  searchSoldProperties(input: RentCastSoldSearchInput): Promise<RentCastSoldSearchResult>;
  searchSaleListings(input: RentCastListingSearchInput): Promise<RentCastArrayResult>;
  estimateRent(input: RentCastValueEstimateInput): Promise<RentCastObjectResult>;
  searchRentalListings(input: RentCastListingSearchInput): Promise<RentCastArrayResult>;
  getMarketData(zipCode: string): Promise<RentCastObjectResult>;
};

export type RentCastListingSearchInput = {
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  radius: number;
  status?: string;
  propertyType?: string;
  daysOld?: number;
  limit: number;
};

export type RentCastValueEstimateInput = {
  address: string;
  maxRadius: number;
  daysOld: number;
  compCount: number;
  lookupSubjectAttributes: boolean;
};

export type RentCastSoldSearchInput = {
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  radius: number;
  saleDateRange: number;
  propertyType: string;
  limit: number;
};

function statusError(status: number) {
  if (status === 400) return new PropertyDataError('INVALID_PROPERTY_LOOKUP', { httpStatus: status });
  if (status === 401) return new PropertyDataError('PROVIDER_AUTH_ERROR', { httpStatus: status });
  if (status === 403) return new PropertyDataError('PROVIDER_SUBSCRIPTION_ERROR', { httpStatus: status });
  if (status === 404) return new PropertyDataError('PROPERTY_NOT_FOUND', { httpStatus: status });
  if (status === 429) return new PropertyDataError('PROVIDER_RATE_LIMIT', { httpStatus: status });
  if (status >= 500) return new PropertyDataError('PROVIDER_UPSTREAM_ERROR', { httpStatus: status });
  return new PropertyDataError('PROVIDER_UPSTREAM_ERROR', { httpStatus: status });
}

export function createRentCastClient(options: {
  apiKey: string;
  timeoutMs?: number;
  fetchImpl?: RentCastFetch;
  baseUrl?: string;
}): RentCastClient {
  const apiKey = String(options.apiKey || '').trim();
  if (!apiKey) throw new PropertyDataError('PROVIDER_NOT_CONFIGURED');
  const timeoutMs = Math.max(100, Math.min(30_000, Number(options.timeoutMs) || DEFAULT_RENTCAST_TIMEOUT_MS));
  const fetchImpl = options.fetchImpl || fetch;
  const baseUrl = String(options.baseUrl || RENTCAST_BASE_URL).replace(/\/+$/, '');

  const requestJson = async (url: URL) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: { Accept: 'application/json', 'X-Api-Key': apiKey },
        signal: controller.signal,
      });
      if (!response.ok) throw statusError(response.status);
      try {
        return await response.json() as unknown;
      } catch {
        throw new PropertyDataError('INVALID_PROVIDER_RESPONSE', { httpStatus: 200, billableSuccess: true });
      }
    } catch (error) {
      if (error instanceof PropertyDataError) throw error;
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
        throw new PropertyDataError('PROVIDER_TIMEOUT');
      }
      throw new PropertyDataError('PROVIDER_NETWORK_ERROR');
    } finally {
      clearTimeout(timeout);
    }
  };

  const objectResult = async (url: URL): Promise<RentCastObjectResult> => {
    const body = await requestJson(url);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new PropertyDataError('INVALID_PROVIDER_RESPONSE', { httpStatus: 200, billableSuccess: true });
    }
    return { data: body as Record<string, unknown>, httpStatus: 200, billableSuccess: true };
  };
  const arrayResult = async (url: URL): Promise<RentCastArrayResult> => {
    const body = await requestJson(url);
    if (!Array.isArray(body) || body.some((record) => !record || typeof record !== 'object' || Array.isArray(record))) {
      throw new PropertyDataError('INVALID_PROVIDER_RESPONSE', { httpStatus: 200, billableSuccess: true });
    }
    return { records: body as Record<string, unknown>[], httpStatus: 200, billableSuccess: true };
  };
  const listingUrl = (path: string, input: RentCastListingSearchInput) => {
    const address = String(input?.address || '').trim();
    const latitude = Number(input?.latitude);
    const longitude = Number(input?.longitude);
    const hasCoordinates = input?.latitude != null && input?.longitude != null
      && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
      && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
    if (!address && !hasCoordinates) throw new PropertyDataError('INVALID_PROPERTY_LOOKUP');
    const url = new URL(`${baseUrl}${path}`);
    if (hasCoordinates) {
      url.searchParams.set('latitude', String(latitude));
      url.searchParams.set('longitude', String(longitude));
    } else url.searchParams.set('address', address);
    url.searchParams.set('radius', String(input.radius));
    if (String(input.status || '').trim()) url.searchParams.set('status', String(input.status).trim());
    if (String(input.propertyType || '').trim()) url.searchParams.set('propertyType', String(input.propertyType).trim());
    if (Number.isFinite(Number(input.daysOld)) && Number(input.daysOld) > 0) {
      url.searchParams.set('daysOld', String(Math.trunc(Number(input.daysOld))));
    }
    url.searchParams.set('limit', String(input.limit));
    return url;
  };

  return {
    async lookupProperty(address: string) {
      const normalizedAddress = String(address || '').trim();
      if (!normalizedAddress) throw new PropertyDataError('INVALID_PROPERTY_LOOKUP');

      const url = new URL(`${baseUrl}/properties`);
      url.searchParams.set('address', normalizedAddress);
      const body = await requestJson(url);
      try {
        if (!Array.isArray(body)) {
          throw new PropertyDataError('INVALID_PROVIDER_RESPONSE', {
            httpStatus: 200,
            billableSuccess: true,
          });
        }
        const record = body[0] ?? null;
        if (record !== null && (typeof record !== 'object' || Array.isArray(record))) {
          throw new PropertyDataError('INVALID_PROVIDER_RESPONSE', {
            httpStatus: 200,
            billableSuccess: true,
          });
        }
        return { record: record as RentCastPropertyRecordRaw | null, httpStatus: 200, billableSuccess: true };
      } catch (error) {
        if (error instanceof PropertyDataError) throw error;
        throw new PropertyDataError('INVALID_PROVIDER_RESPONSE', { httpStatus: 200, billableSuccess: true });
      }
    },
    async estimateValue(input: RentCastValueEstimateInput) {
      const address = String(input?.address || '').trim();
      if (!address) throw new PropertyDataError('INVALID_PROPERTY_LOOKUP');
      const url = new URL(`${baseUrl}/avm/value`);
      url.searchParams.set('address', address);
      url.searchParams.set('maxRadius', String(input.maxRadius));
      url.searchParams.set('daysOld', String(input.daysOld));
      url.searchParams.set('compCount', String(input.compCount));
      url.searchParams.set('lookupSubjectAttributes', String(input.lookupSubjectAttributes));
      const body = await requestJson(url);
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new PropertyDataError('INVALID_PROVIDER_RESPONSE', { httpStatus: 200, billableSuccess: true });
      }
      return { valuation: body as RentCastValueEstimateRaw, httpStatus: 200, billableSuccess: true };
    },
    async searchSoldProperties(input: RentCastSoldSearchInput) {
      const address = String(input?.address || '').trim();
      const latitude = Number(input?.latitude);
      const longitude = Number(input?.longitude);
      const hasCoordinates = input?.latitude !== null && input?.latitude !== undefined
        && input?.longitude !== null && input?.longitude !== undefined
        && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
        && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
      const propertyType = String(input?.propertyType || '').trim();
      if ((!address && !hasCoordinates) || !propertyType) throw new PropertyDataError('INVALID_PROPERTY_LOOKUP');
      const url = new URL(`${baseUrl}/properties`);
      if (hasCoordinates) {
        url.searchParams.set('latitude', String(latitude));
        url.searchParams.set('longitude', String(longitude));
      } else {
        url.searchParams.set('address', address);
      }
      url.searchParams.set('radius', String(input.radius));
      url.searchParams.set('saleDateRange', String(input.saleDateRange));
      url.searchParams.set('propertyType', propertyType);
      url.searchParams.set('limit', String(input.limit));
      const body = await requestJson(url);
      if (!Array.isArray(body) || body.some((record) => !record || typeof record !== 'object' || Array.isArray(record))) {
        throw new PropertyDataError('INVALID_PROVIDER_RESPONSE', { httpStatus: 200, billableSuccess: true });
      }
      return { records: body as RentCastPropertyRecordRaw[], httpStatus: 200, billableSuccess: true };
    },
    async searchSaleListings(input: RentCastListingSearchInput) {
      return arrayResult(listingUrl('/listings/sale', input));
    },
    async estimateRent(input: RentCastValueEstimateInput) {
      const address = String(input?.address || '').trim();
      if (!address) throw new PropertyDataError('INVALID_PROPERTY_LOOKUP');
      const url = new URL(`${baseUrl}/avm/rent/long-term`);
      url.searchParams.set('address', address);
      url.searchParams.set('maxRadius', String(input.maxRadius));
      url.searchParams.set('daysOld', String(input.daysOld));
      url.searchParams.set('compCount', String(input.compCount));
      url.searchParams.set('lookupSubjectAttributes', String(input.lookupSubjectAttributes));
      return objectResult(url);
    },
    async searchRentalListings(input: RentCastListingSearchInput) {
      return arrayResult(listingUrl('/listings/rental/long-term', input));
    },
    async getMarketData(zipCode: string) {
      const zip = String(zipCode || '').trim();
      if (!/^\d{5}$/.test(zip)) throw new PropertyDataError('INVALID_PROPERTY_LOOKUP');
      const url = new URL(`${baseUrl}/markets`);
      url.searchParams.set('zipCode', zip);
      return objectResult(url);
    },
  };
}
