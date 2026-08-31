import { createClient } from 'npm:@supabase/supabase-js@2';
import { searchServicesWithMetrics, validateSearchServicesInput } from './searchServices.ts';
import { getMyInvestmentProfile, getMyInvestmentProfileWithClient } from './getMyInvestmentProfile.ts';
import { getPropertyDetails, getPropertyDetailsForAuthenticatedUser } from './getPropertyDetails.ts';
import { resolvePropertyDetailsInput } from './propertyDetails.ts';
import { searchMatchedProperties } from './searchMatchedProperties.ts';
import { comparePropertiesWithLookup, resolveComparePropertiesInput } from './compareProperties.ts';
import { getDealCopilotOverview, getDealCopilotOverviewForAuthenticatedUser } from './dealCopilotContext.ts';
import { supabaseAnonKey, supabaseUrl } from './config.ts';

export const MAXXIS_TOOLS = [{
  functionDeclarations: [
    {
      name: 'searchProperties',
      description: 'Search real active DealSifter properties when the user asks about available platform inventory. Never use this for general education or app usage questions.',
      parameters: { type: 'OBJECT', properties: { state: { type: 'ARRAY', items: { type: 'STRING' } }, city: { type: 'STRING' }, zipCode: { type: 'STRING' }, propertyType: { type: 'STRING' }, minPrice: { type: 'NUMBER' }, maxPrice: { type: 'NUMBER' }, bedrooms: { type: 'NUMBER' }, bathrooms: { type: 'NUMBER' }, objective: { type: 'STRING' }, limit: { type: 'NUMBER' }, personalized: { type: 'BOOLEAN', description: 'Set true only when the user explicitly asks for properties matched to their own Investment Profile.' } } },
    },
    {
      name: 'searchServices',
      description: 'Search real published DealSifter service providers when the user asks to find a contractor, attorney, title company, inspector, photographer, closing professional, or another provider on the platform. Use only for a request to locate a real provider, never for a conceptual or educational question. State can be a US code or full name; city searches the provider market coverage.',
      parameters: { type: 'OBJECT', properties: { serviceType: { type: 'STRING' }, category: { type: 'STRING' }, state: { type: 'STRING' }, city: { type: 'STRING' }, keyword: { type: 'STRING' }, minPrice: { type: 'NUMBER' }, maxPrice: { type: 'NUMBER' }, limit: { type: 'NUMBER' } } },
    },
    {
      name: 'getMyInvestmentProfile',
      description: 'Read the authenticated user\'s own saved Investment Profile only when the requested output is the profile or its preferences. Never use when the user asks which opportunity, property, deal, listing, provider, or service fits the profile; those requests must use searchProperties with personalized=true or searchServices. Never use for conceptual or educational questions.',
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'getPropertyDetails',
      description: 'Read canonical factual published fields for one property, such as price, bedrooms, bathrooms, sqft, type, location, rehab, cap rate, description, images, or a specifically requested stored metric. Use only when the user explicitly asks for published/factual details or named fields. Do NOT use for a broad reading, overview, analysis, current situation, gaps, what is missing, how the deal looks, or what you see in the opportunity; those require getDealCopilotOverview. Copy the trusted context propertyId exactly. Set includeOperationalContext true only for an explicit Next Best Action, what-to-do-next, checklist, or progress request. Set includeServiceMatches true only for an explicit request to find professionals for this property; the backend alone derives the categories from serviceNeeds. Never invent or infer a propertyId, category, or provider.',
      parameters: {
        type: 'OBJECT',
        properties: {
          propertyId: { type: 'STRING', description: 'Exact UUID from the trusted structured property context.' },
          includeOperationalContext: { type: 'BOOLEAN', description: 'True only for an explicit Next Best Action, what-to-do-next, checklist, or deal progress request. Omit for a focused property or metric question.' },
          includeServiceMatches: { type: 'BOOLEAN', description: 'True only for an explicit request to find published professionals for this property. Omit otherwise.' },
        },
        required: ['propertyId'],
      },
    },
    {
      name: 'getDealCopilotOverview',
      description: 'Load the consolidated read-only Deal Copilot view for any broad or interpretive reading of a specific deal: how the property/deal looks, what is visible, an overview or analysis, current situation/status, gaps or missing information, what happened, or what remains. Natural equivalents in Portuguese, English, and Spanish belong here even when the user says property, imóvel, or propiedad instead of deal. Do NOT use for an explicit list of published facts or a named field/metric; those require getPropertyDetails. Requires the exact trusted propertyId. This tool aggregates existing backend results and never executes actions.',
      parameters: {
        type: 'OBJECT',
        properties: {
          propertyId: { type: 'STRING', description: 'Exact UUID from the trusted structured property context.' },
        },
        required: ['propertyId'],
      },
    },
    {
      name: 'compareProperties',
      description: 'Compare two or three real properties using only IDs from the trusted structured comparison context. Use for objective differences only. Never invent IDs, calculate values, select a winner, or recommend a property. If fewer than two identifiable properties are available, ask the user to select or search for properties.',
      parameters: {
        type: 'OBJECT',
        properties: {
          propertyIds: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Two or three exact UUIDs copied from the trusted structured comparison context.',
          },
        },
        required: ['propertyIds'],
      },
    },
  ],
}];

export const MAXXIS_TOOL_NAMES = new Set(
  MAXXIS_TOOLS[0].functionDeclarations.map((declaration) => declaration.name),
);

export async function executeMaxxisTool(name: string, args: unknown, authHeader: string, context: { propertyId?: string; propertyIds?: string[]; userId?: string } = {}) {
  const authenticatedContext = () => {
    const userId = String(context.userId || '').trim();
    if (!userId) return null;
    return {
      userId,
      client: createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } }),
    };
  };
  if (name === 'searchProperties') {
    const result = await searchMatchedProperties(args, authHeader, authenticatedContext() || undefined);
    return { type: 'properties' as const, filters: result.filters, items: result.properties, ...result };
  }
  if (name === 'searchServices') {
    const filters = validateSearchServicesInput(args);
    const result = await searchServicesWithMetrics(filters, authHeader);
    return { type: 'services' as const, filters, items: result.items, performance: result.metrics };
  }
  if (name === 'getMyInvestmentProfile') {
    const authenticated = authenticatedContext();
    const result = authenticated
      ? await getMyInvestmentProfileWithClient(authenticated.userId, authenticated.client)
      : await getMyInvestmentProfile(authHeader);
    return { type: 'investment_profile' as const, ...result };
  }
  if (name === 'getPropertyDetails') {
    const input = resolvePropertyDetailsInput(args, context.propertyId);
    const authenticated = authenticatedContext();
    const result = authenticated
      ? await getPropertyDetailsForAuthenticatedUser(input, authHeader, authenticated.client, authenticated.userId)
      : await getPropertyDetails(input, authHeader);
    return { type: 'property_details' as const, ...result };
  }
  if (name === 'getDealCopilotOverview') {
    const input = resolvePropertyDetailsInput({ propertyId: (args as Record<string, unknown>)?.propertyId }, context.propertyId);
    const authenticated = authenticatedContext();
    const overview = authenticated
      ? await getDealCopilotOverviewForAuthenticatedUser(input.propertyId, authHeader, authenticated.client, authenticated.userId)
      : await getDealCopilotOverview(input.propertyId, authHeader);
    return { type: 'deal_copilot_overview' as const, found: Boolean(overview), overview };
  }
  if (name === 'compareProperties') {
    const input = resolveComparePropertiesInput(args, context.propertyIds);
    const authenticated = authenticatedContext();
    if (!authenticated) throw new Error('UNAUTHORIZED');
    const result = await comparePropertiesWithLookup(
      input,
      (propertyId) => getPropertyDetailsForAuthenticatedUser({ propertyId }, authHeader, authenticated.client, authenticated.userId),
    );
    return { type: 'property_comparison' as const, ...result };
  }
  throw new Error('MAXXIS_TOOL_NOT_ALLOWED');
}
