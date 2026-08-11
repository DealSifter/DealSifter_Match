import { searchServices } from './searchServices.ts';
import { calculateServiceFit, rankServicesByFit } from './calculateServiceFit.ts';
import type { SearchServicesInput } from './searchServices.ts';
import type {
  MaxxisPropertyDetails,
  MaxxisServiceResult,
  PropertyServiceMatch,
  PropertyServiceNeed,
} from './types.ts';

const MAX_SERVICE_NEEDS = 3;
const MAX_SERVICES_PER_NEED = 3;

export type ServiceSearch = (
  input: SearchServicesInput,
  authHeader: string,
) => Promise<MaxxisServiceResult[]>;

export type FindServicesForPropertyNeedsInput = {
  property: Pick<MaxxisPropertyDetails, 'city' | 'state'>;
  serviceNeeds: PropertyServiceNeed[];
  authHeader: string;
};

export type PropertyServiceMatchingSummary = {
  serviceNeedsProcessed: number;
  searchesPerformed: number;
  resultsReturned: number;
  durationMs: number;
  cityToStateFallbackUsed: boolean;
};

export type PropertyServiceMatchingResult = {
  serviceMatches: PropertyServiceMatch[];
  summary: PropertyServiceMatchingSummary;
};

function safeService(service: MaxxisServiceResult): MaxxisServiceResult {
  return {
    id: service.id,
    title: service.title,
    serviceType: service.serviceType,
    description: service.description,
    price: service.price,
    markets: service.markets,
    image: service.image,
    contactAccess: service.contactAccess,
  };
}

function prioritizeServiceNeeds(serviceNeeds: PropertyServiceNeed[]) {
  const prioritized = serviceNeeds
    .map((need, index) => ({ need, index }))
    .sort((left, right) => {
      const confidenceDifference = Number(right.need.confidence === 'high') - Number(left.need.confidence === 'high');
      return confidenceDifference || left.index - right.index;
    });
  const seen = new Set<string>();
  const unique: PropertyServiceNeed[] = [];
  prioritized.forEach(({ need }) => {
    const key = need.serviceType.trim().toLowerCase();
    if (!key || seen.has(key) || unique.length >= MAX_SERVICE_NEEDS) return;
    seen.add(key);
    unique.push(need);
  });
  return unique;
}

export async function findServicesForPropertyNeeds(
  input: FindServicesForPropertyNeedsInput,
  serviceSearch: ServiceSearch = searchServices,
): Promise<PropertyServiceMatchingResult> {
  const startedAt = Date.now();
  const selectedNeeds = prioritizeServiceNeeds(Array.isArray(input.serviceNeeds) ? input.serviceNeeds : []);
  const city = String(input.property.city || '').trim().slice(0, 100);
  const rawState = String(input.property.state || '').trim().toUpperCase();
  const state = /^[A-Z]{2}$/.test(rawState) ? rawState : '';
  const serviceMatches: PropertyServiceMatch[] = [];
  let searchesPerformed = 0;
  let cityToStateFallbackUsed = false;

  for (const need of selectedNeeds) {
    const primaryFilters: SearchServicesInput = {
      category: need.serviceType,
      ...(state ? { state } : {}),
      ...(city ? { city } : {}),
      limit: MAX_SERVICES_PER_NEED,
    };
    searchesPerformed += 1;
    let services = await serviceSearch(primaryFilters, input.authHeader);

    if (!services.length && city && state) {
      cityToStateFallbackUsed = true;
      searchesPerformed += 1;
      services = await serviceSearch({
        category: need.serviceType,
        state,
        limit: MAX_SERVICES_PER_NEED,
      }, input.authHeader);
    }

    const rankedServices = rankServicesByFit(
      services.map(safeService).map((service) => ({
        ...service,
        fit: calculateServiceFit({
          serviceNeed: need,
          propertyContext: input.property,
          service,
        }),
      })),
    );

    serviceMatches.push({
      serviceType: need.serviceType,
      confidence: need.confidence,
      services: rankedServices.slice(0, MAX_SERVICES_PER_NEED),
    });
  }

  return {
    serviceMatches,
    summary: {
      serviceNeedsProcessed: selectedNeeds.length,
      searchesPerformed,
      resultsReturned: serviceMatches.reduce((total, match) => total + match.services.length, 0),
      durationMs: Date.now() - startedAt,
      cityToStateFallbackUsed,
    },
  };
}
