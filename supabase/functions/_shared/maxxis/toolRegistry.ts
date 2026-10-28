import { createClient } from 'npm:@supabase/supabase-js@2';
import { searchServicesWithMetrics, validateSearchServicesInput } from './searchServices.ts';
import { getMyInvestmentProfile, getMyInvestmentProfileWithClient } from './getMyInvestmentProfile.ts';
import { getPropertyDetails, getPropertyDetailsForAuthenticatedUser } from './getPropertyDetails.ts';
import { resolvePropertyDetailsInput } from './propertyDetails.ts';
import { searchMatchedProperties } from './searchMatchedProperties.ts';
import { comparePropertiesWithLookup, resolveComparePropertiesInput } from './compareProperties.ts';
import { getDealCopilotOverview, getDealCopilotOverviewForAuthenticatedUser } from './dealCopilotContext.ts';
import { getPropertyEvidenceForAuthenticatedUser } from './getPropertyEvidence.ts';
import { getDealInsightContextForAuthenticatedUser } from './getDealInsightContext.ts';
import { supabaseAnonKey, supabaseUrl } from './config.ts';
import { supabaseServiceRoleKey } from './config.ts';
import { getCanonicalPropertyEvidenceWithDependencies } from './canonicalEvidenceTool.ts';
import { resolveFeatureFlags } from '../featureFlags.ts';
import { publicAnalyticalDecisionProofs } from './analyticalPropertyContext.ts';
import { publicFinancialTaxProof } from './financialEvidenceContext.ts';
import { buildFinancialInputReadiness } from './financialReadiness.ts';
import { createBackendMarketRentService, type PropertyEvidenceBackendClient } from '../property-data/backendFactory.ts';
import type {RentAvmSubject} from '../property-data/rentAvmSubject.ts';
import { shouldAcquireReportMarketRent, reportMarketRentSubject } from './reportMarketRentPolicy.ts';

export const MAXXIS_TOOLS = [{
  functionDeclarations: [
    {
      name:'getCanonicalPropertyEvidence',
      description:'Read authorized current-property evidence consensus from already available publisher/provider cache/public parcel evidence. Read-only, no provider acquisition, no financial/report changes. Copy the trusted propertyId exactly; qualify single-source/stale/provisional evidence and preserve conflicts. Public GIS is not a survey.',
      parameters:{type:'OBJECT',properties:{propertyId:{type:'STRING'}},required:['propertyId']},
    },
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
      description: 'Read factual published details for the specific property in the trusted structured screen context. Copy that context propertyId exactly. Set includeOperationalContext true only when the user explicitly asks for Next Best Action, what to do next, checklist, or deal progress. Set includeServiceMatches true only when the user explicitly asks to find professionals or published services for this property; the backend alone derives the categories from serviceNeeds. Never invent or infer a propertyId, category, or provider.',
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
      name: 'getPropertyEvidence',
      description: 'Read already-loaded public-record evidence for the property in trusted structured screen context. Use for questions about public records, factual consistency, tax records, recorded sale, evidence conflicts, missing evidence, or what should be verified. This tool is cache-only and never loads provider data. Copy the context propertyId exactly; never infer an ID or address.',
      parameters: {
        type: 'OBJECT',
        properties: {
          propertyId: { type: 'STRING', description: 'Exact UUID from the trusted structured property context.' },
        },
        required: ['propertyId'],
      },
    },
    {
      name: 'getDealInsightContext',
      description: 'Compose the current property, authenticated Investment Profile, existing profile-fit Match Score, Property Evidence, deterministic Deal Metrics, and allowed valuation evidence into the canonical report context. MAXXIS_ANALYSIS is cache-only and independent from valuation. DEAL_INTELLIGENCE uses cache first and may load provider evidence server-side when legitimately required. Copy the trusted context propertyId exactly. This tool never invents or recalculates ARV, MAO, ROI, cash flow, or a new deal score.',
      parameters: {
        type: 'OBJECT',
        properties: {
          propertyId: { type: 'STRING', description: 'Exact UUID from the trusted structured property context.' },
          reportType: { type: 'STRING', enum: ['MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE'], description: 'Authorized report capability selected in the trusted property analysis flow.' },
        },
        required: ['propertyId'],
      },
    },
    {
      name: 'getDealCopilotOverview',
      description: 'Load the consolidated read-only Deal Copilot overview only when the user explicitly asks for the current deal status, a deal summary, what has already happened, what remains, or the overall situation. Requires the exact propertyId from trusted structured screen context. Do not use for a single metric, property search, service search, comparison, or general question. This tool aggregates existing results and never executes actions.',
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

export async function executeMaxxisTool(name: string, args: unknown, authHeader: string, context: { propertyId?: string; propertyIds?: string[]; userId?: string; plan?: string; language?: string; cacheOnly?: boolean; analyticalArea?:boolean; financialEvidence?:boolean; rentAvmSubject?:boolean;marketRentAcquisition?:boolean;providerBudgetBucket?:'chat'|'report';parcelEvidenceReceipt?:unknown } = {}) {
  const authenticatedContext = () => {
    const userId = String(context.userId || '').trim();
    if (!userId) return null;
    return {
      userId,
      client: createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } }),
    };
  };
  if(name==='getCanonicalPropertyEvidence'){
    const authenticated=authenticatedContext();if(!authenticated)throw new Error('UNAUTHORIZED');
    let remoteConfig={};try{remoteConfig=JSON.parse(Deno.env.get('FEATURE_FLAGS_JSON')||'{}');}catch{/* OFF by default */}
    const flags=resolveFeatureFlags({userId:authenticated.userId,environment:supabaseUrl.includes('cyeipfskwwisbbayyaca')?'production':supabaseUrl.includes('oqdcnjupquhybwdbeeew')?'staging':'development',remoteConfig});
    return getCanonicalPropertyEvidenceWithDependencies({input:args,propertyId:context.propertyId||'',userId:authenticated.userId,
      receipt:context.parcelEvidenceReceipt,secret:supabaseServiceRoleKey,parcelEnabled:flags.public_parcel_intelligence,financialEvidence:context.financialEvidence===true,rentAvmSubject:context.rentAvmSubject===true,
      loadRentAvmState:async propertyId=>{
        const internal=createClient(supabaseUrl,supabaseServiceRoleKey);
        const property=await internal.from('properties').select('id,type,address,city,state,zip,beds,baths,sqft,lot,owner_id,lat,lng,geocode_status').eq('id',propertyId).maybeSingle();
        if(property.error)throw new Error('RENT_SUBJECT_PROPERTY_READ_FAILED');
        if(!property.data)throw new Error('RENT_SUBJECT_PROPERTY_NOT_FOUND');
        // Only current publisher decisions can become shared AVM overrides.
        const review=await internal.from('property_fact_reviews').select('state').eq('property_id',propertyId).eq('owner_id',property.data.owner_id).maybeSingle();
        if(review.error)throw new Error('RENT_SUBJECT_REVIEW_READ_FAILED');
        return {property:property.data,snapshot:review.data?.state??null};
      },
      loadMarketRent:async(propertyId,initialSubject)=>{
        const admin=createClient(supabaseUrl,supabaseServiceRoleKey) as unknown as PropertyEvidenceBackendClient;
        let first=true;
        const service=createBackendMarketRentService({supabaseAdmin:admin,getEnv:name=>Deno.env.get(name),
          providerBudgetContext:{userId:authenticated.userId,propertyId,plan:context.plan==='ENTERPRISE'?'ENTERPRISE':context.plan==='PRO'?'PRO':'FREE',bucket:context.providerBudgetBucket || 'chat'},
          hasEntitlement:async()=>{
            if(context.plan==='PRO'||context.plan==='ENTERPRISE')return true;
            const check=await authenticated.client.rpc('ds_has_property_intelligence_entitlement',{p_property_id:propertyId,p_unlock_type:'property_record'});
            return !check.error&&check.data===true;
          },
          resolveSubject:async():Promise<RentAvmSubject>=>{
            const normalize=(subject:RentAvmSubject)=>context.providerBudgetBucket==='report'?reportMarketRentSubject(subject):subject;
            if(first){first=false;return normalize(initialSubject);}
            const result=await executeMaxxisTool('getCanonicalPropertyEvidence',{propertyId},authHeader,{...context,financialEvidence:false,marketRentAcquisition:false,rentAvmSubject:true});
            return normalize((result.type==='canonical_property_evidence'&&result.state==='available'?result.rentAvmSubject:null)??{propertyId,state:'SUBJECT_UNAVAILABLE'} as RentAvmSubject);
          }});
        return service.get({propertyId,userId:authenticated.userId,acquire:context.marketRentAcquisition===true});
      },
      loadPublicProperty:async propertyId=>{
        const reader=authenticated.client as unknown as {rpc(name:string,args:{p_property_id:string}):{maybeSingle():Promise<{data:unknown;error:unknown}>}};
        const {data,error}=await reader.rpc('ds_get_public_property_details',{p_property_id:propertyId}).maybeSingle();
        if(error)throw new Error('PROPERTY_DETAILS_FAILED');return data&&typeof data==='object'&&!Array.isArray(data)?data as Record<string,unknown>:null;
      },
      loadUserFacts:async(propertyId,userId)=>{
        const reader=authenticated.client as unknown as {from(name:string):any};
        const {data,error}=await reader.from('property_arv_review_contexts').select('deal_assumptions').eq('subject_property_id',propertyId).eq('reviewer_user_id',userId).maybeSingle();
        if(error||!data?.deal_assumptions)return null;
        const inputs=data.deal_assumptions;if(context.financialEvidence)return inputs;
        return {...(inputs.activeScenario?.propertyId===propertyId?inputs.activeScenario.assumptions||{}:{}),...inputs};
      },
      loadReconciledFacts:async(propertyId,userId)=>{
        const reader=authenticated.client as unknown as {from:(name:string)=>any;rpc:(name:string,args:Record<string,unknown>)=>Promise<{data:any;error:unknown}>};
        const own=await reader.from('property_fact_reviews').select('state').eq('property_id',propertyId).eq('owner_id',userId).maybeSingle();
        if(!own.error&&own.data?.state?.rows)return {facts:Object.fromEntries(Object.entries(own.data.state.rows).map(([field,row])=>[field,(row as {effective:unknown}).effective])),owner:true,reviewSnapshot:own.data.state};
        const publicResult=await reader.rpc('ds_public_effective_property_facts',{p_property_ids:[propertyId]});
        if(publicResult.error)return {facts:{},owner:false,analyticalUnavailable:true};
        if(!publicResult.data?.length)return {facts:{},owner:false};
        if(publicResult.data[0]?.property_id!==propertyId||!publicResult.data[0].facts)return {facts:{},owner:false,analyticalUnavailable:true};
        const facts=publicResult.data[0].facts;
        if(context.financialEvidence){
          // Current publisher only, after the authenticated public RPC gate. No private assumptions/history/actor.
          const internal=createClient(supabaseUrl,supabaseServiceRoleKey);
          const proof=await internal.from('property_fact_reviews').select('owner_id,taxEffective:state->rows->propertyTax->effective,taxDecision:state->rows->propertyTax->decision,taxHash:state->rows->propertyTax->>evidenceHash,taxUsability:state->rows->propertyTax->projection->>analyticalUsability,properties!inner(owner_id)').eq('property_id',propertyId).limit(16).abortSignal(AbortSignal.timeout(1500));
          const current=(!proof.error&&Array.isArray(proof.data)?proof.data:[]).find((row:any)=>row.owner_id===row.properties?.owner_id) as any;
          const snapshot=current?{propertyId,rows:{propertyTax:{effective:current.taxEffective,decision:current.taxDecision,evidenceHash:current.taxHash,projection:{analyticalUsability:current.taxUsability}}}}:null;
          return {facts,owner:false,financialSnapshot:snapshot?publicFinancialTaxProof(snapshot,facts):null,financialUnavailable:!!proof.error||!current};
        }
        // Existing APN/zoning/direct-fact reads incur no new metadata query.
        if(!context.analyticalArea)return {facts,owner:false};
        // After the authenticated public gate, read only current-publisher decision proof.
        // Alternatives/history/actor identity never enter the public analytical context.
        const internal=createClient(supabaseUrl,supabaseServiceRoleKey);
        const proof=await internal.from('property_fact_reviews').select('owner_id,lotEffective:state->rows->lotArea->effective,lotDecision:state->rows->lotArea->decision,lotHash:state->rows->lotArea->>evidenceHash,lotConsensus:state->rows->lotArea->projection->>consensusState,lotUsability:state->rows->lotArea->projection->>analyticalUsability,livingEffective:state->rows->buildingArea->effective,livingDecision:state->rows->buildingArea->decision,livingHash:state->rows->buildingArea->>evidenceHash,livingConsensus:state->rows->buildingArea->projection->>consensusState,livingUsability:state->rows->buildingArea->projection->>analyticalUsability,properties!inner(owner_id)').eq('property_id',propertyId).limit(16).abortSignal(AbortSignal.timeout(1500));
        const rows=(!proof.error&&Array.isArray(proof.data)?proof.data:[]) as unknown as Array<{owner_id:string;properties:{owner_id:string}|null;lotEffective:unknown;lotDecision:unknown;lotHash:string;lotConsensus:string;lotUsability:string;livingEffective:unknown;livingDecision:unknown;livingHash:string;livingConsensus:string;livingUsability:string}>;
        const current=rows.find(row=>row.owner_id===row.properties?.owner_id);
        const selected=current?{rows:{lotArea:{effective:current.lotEffective,decision:current.lotDecision,evidenceHash:current.lotHash,projection:{consensusState:current.lotConsensus,analyticalUsability:current.lotUsability}},buildingArea:{effective:current.livingEffective,decision:current.livingDecision,evidenceHash:current.livingHash,projection:{consensusState:current.livingConsensus,analyticalUsability:current.livingUsability}}}}:null;
        return {facts,owner:false,decisionProofs:selected?publicAnalyticalDecisionProofs(selected,facts):{},analyticalUnavailable:!current};
      },
      loadCachedProvider:propertyId=>getPropertyEvidenceForAuthenticatedUser({propertyId},authHeader,authenticated.userId,context.propertyId,false,
        {plan:context.plan==='ENTERPRISE'?'ENTERPRISE':context.plan==='PRO'?'PRO':'FREE',bucket:'chat'})});
  }
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
      ? await getMyInvestmentProfileWithClient(authenticated.userId, authenticated.client as unknown as Parameters<typeof getMyInvestmentProfileWithClient>[1])
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
  if (name === 'getPropertyEvidence') {
    const authenticated = authenticatedContext();
    if (!authenticated) throw new Error('UNAUTHORIZED');
    return getPropertyEvidenceForAuthenticatedUser(args, authHeader, authenticated.userId, context.propertyId);
  }
  if (name === 'getDealInsightContext') {
    const authenticated = authenticatedContext();
    if (!authenticated) throw new Error('UNAUTHORIZED');
    const providerPlan = context.plan === 'ENTERPRISE' ? 'ENTERPRISE' : context.plan === 'PRO' ? 'PRO' : 'FREE';
    const report = await getDealInsightContextForAuthenticatedUser(
      args, authHeader, authenticated.client as unknown as Parameters<typeof getDealInsightContextForAuthenticatedUser>[2], authenticated.userId, context.propertyId, providerPlan, context.language,
      Boolean(context.cacheOnly),
    );
    if ((args as Record<string, unknown>)?.reportType && report.state === 'available' && report.intelligenceSnapshot) {
      // Explicit report generation is cache-first, not cache-only. The service
      // coalesces fresh/cache/in-flight results and enforces subject, entitlement and usage gates.
      const evidence: Awaited<ReturnType<typeof getCanonicalPropertyEvidenceWithDependencies>> | null = await executeMaxxisTool('getCanonicalPropertyEvidence', { propertyId: report.intelligenceSnapshot.propertyId }, authHeader,
        { ...context, financialEvidence: true, providerBudgetBucket: 'report',
          marketRentAcquisition: shouldAcquireReportMarketRent((args as Record<string, unknown>)?.reportType, context.cacheOnly),
        }).catch(() => null) as Awaited<ReturnType<typeof getCanonicalPropertyEvidenceWithDependencies>> | null;
      if (evidence?.type === 'canonical_property_evidence' && evidence.state === 'available' && evidence.financialEvidence) {
        return { ...report, intelligenceSnapshot: { ...report.intelligenceSnapshot,
          financialEvidence: evidence.financialEvidence,
          marketRent: evidence.marketRent || null,
          ...(evidence.marketRent?.state === 'AVAILABLE' && evidence.marketRent.evidence ? {
            rentalEvidence: { ...report.intelligenceSnapshot.rentalEvidence, rentEstimate: evidence.marketRent.evidence },
            providerMarketContext: { ...report.intelligenceSnapshot.providerMarketContext, rentEstimate: evidence.marketRent.evidence },
          } : {}),
          financialReadiness: buildFinancialInputReadiness(evidence.financialEvidence, { strategy: evidence.financialStrategy, propertyType: evidence.financialPropertyType }),
        } };
      }
    }
    return report;
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
