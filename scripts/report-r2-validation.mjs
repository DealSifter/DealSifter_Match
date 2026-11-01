// Opt-in validation tooling only. No application module imports this runner.
export const R2_DATA_TYPES = Object.freeze(['property_record', 'property_value_avm', 'property_sold_record_pool', 'rent_estimate_evidence']);
export function validationDataTypes(value = R2_DATA_TYPES) {
  if (!Array.isArray(value) || value.length === 0 || value.some(type => !R2_DATA_TYPES.includes(type)) || new Set(value).size !== value.length) throw Error('R2_INVALID_DATA_TYPES');
  return new Set(value);
}
export function rentcastDataType(url) {
  if (/\/avm\/value$/.test(url.pathname)) return 'property_value_avm';
  if (/\/avm\/rent\/long-term$/.test(url.pathname)) return 'rent_estimate_evidence';
  if (/\/properties$/.test(url.pathname)) return url.searchParams.has('saleDateRange') || url.searchParams.has('radius') ? 'property_sold_record_pool' : 'property_record';
  return null;
}
export function createValidationTransport({fetchImpl, dataTypes, supabaseOrigin, arcgisOrigins = [], maxRentcastCalls = 4, maxArcgisRequests = 6, reportId, requestId,onAttempt}) {
  const allowed = validationDataTypes(dataTypes), attempts = [];
  let rentcastCalls = 0, arcgisCalls = 0, stopped = null;
  if (!Number.isInteger(maxRentcastCalls) || maxRentcastCalls < 0 || maxRentcastCalls > 4 || !Number.isInteger(maxArcgisRequests) || maxArcgisRequests < 0 || maxArcgisRequests > 6) throw Error('R2_INVALID_REQUEST_LIMIT');
  const assertContinue = () => { if (stopped) throw Error('R2_PROVIDER_STOPPED'); };
  const stop = reason => { stopped ||= reason; };
  async function fetcher(input, init) {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (url.protocol !== 'https:' || url.username || url.password) throw Error('R2_NETWORK_DESTINATION_FORBIDDEN');
    const rentcast = url.origin === 'https://api.rentcast.io';
    const arcgis = arcgisOrigins.includes(url.origin);
    const tile = /^https:\/\/(?:[abc]\.)?tile\.openstreetmap\.org$/.test(url.origin);
    if (!rentcast && !arcgis && !tile && url.origin !== supabaseOrigin) throw Error('R2_NETWORK_DESTINATION_FORBIDDEN');
    if (url.origin === supabaseOrigin) return fetchImpl(input, init);
    let type = null;
    if (rentcast) {
      type = rentcastDataType(url); assertContinue();
      if (!type || !allowed.has(type)) throw Error('R2_DATA_TYPE_FORBIDDEN');
      if (rentcastCalls >= maxRentcastCalls) throw Error('R2_RENTCAST_LIMIT');
      rentcastCalls++;
    } else if (arcgis) {
      if (arcgisCalls >= maxArcgisRequests) throw Error('R2_ARCGIS_LIMIT');
      arcgisCalls++;
    }
    const attempt = {provider: rentcast ? 'rentcast' : arcgis ? 'arcgis' : 'openstreetmap',dataType:type,...(arcgis?{service:url.origin+url.pathname}:{}),reportId,requestId,origin:'validation',http:null,latencyMs:null};
    attempts.push(attempt);const start = Date.now();
    await onAttempt?.(attempts);
    try {
      const response = await fetchImpl(input, {...init,redirect:'error'});attempt.http=response.status;
      if (rentcast) {
        if (!response.ok) stop('HTTP_ERROR');
        else {
          const body = await response.clone().json().catch(() => null);
          const empty = body == null || Array.isArray(body) && !body.length || type === 'rent_estimate_evidence' && !(Number(body.rent)>0) || type === 'property_value_avm' && !(Number(body.price)>0) && !body.comparables?.length;
          if (empty) stop('EMPTY');
        }
      }
      return response;
    } catch { if (rentcast) stop('TRANSPORT_ERROR'); throw Error('R2_TRANSPORT_FAILED'); }
    finally { attempt.latencyMs = Date.now()-start; await onAttempt?.(attempts); }
  }
  return {fetch:fetcher,assertContinue,stop,attempts,get stopped(){return stopped;},get rentcastCalls(){return rentcastCalls;},get arcgisCalls(){return arcgisCalls;}};
}
/** Dependency boundary is the real domain orchestrator, never the Gemini/chat API.
 * The optional dataTypes parameter affects this tooling call only. A suppressed
 * family is not invoked, so it cannot reserve quota before the transport gate.
 */
export async function runValidationAcquisition({dataTypes,orchestrate,propertyId,userId,services,loadPropertyDetails,loadInvestmentProfile,calculateMatch,loadArvEvaluation,transport,parcelCovered=false,analysisAssumptions}) {
  const allowed=validationDataTypes(dataTypes),results={},errors=[];
  async function family(type,work) {
    if (!allowed.has(type) || type==='property_record'&&parcelCovered) return null;
    transport.assertContinue();
    try {
      const result=await work();results[type]=result;
      if (!result || result.state==='NO_RESULT' || result.state==='PROVIDER_ERROR') transport.stop('EMPTY_OR_PROVIDER_ERROR');
      return result;
    } catch(error) {
      const code=error?.code||error?.message||'R2_ACQUISITION_FAILED';
      const safe=/^[A-Z][A-Z0-9_]{1,90}$/.test(code)?code:'R2_ACQUISITION_FAILED';
      errors.push({dataType:type,reason:safe});transport.stop(/ADDRESS|IDENTITY/.test(safe)?'IDENTITY_REJECTED':safe);throw Error(safe);
    }
  }
  const context=await orchestrate({propertyId,loadPropertyDetails,loadInvestmentProfile,calculateMatch,analysisAssumptions,
    loadPropertyEvidence:async()=>{
      const result=await family('property_record',()=>services.property.getPropertyEvidence({propertyId,userId}));
      return services.presentProperty(result);
    },
    loadArvEvaluation:async()=>{
      await family('property_value_avm',()=>services.valuation.getValuationEvidence({propertyId,userId}));
      await family('property_sold_record_pool',()=>services.sold.getSoldEvidence({propertyId,userId}));
      if(transport.stopped)return null;
      return loadArvEvaluation();
    }});
  if(!transport.stopped)await family('rent_estimate_evidence',()=>services.rent.get({propertyId,userId,acquire:true})).catch(()=>null);
  return {context,results,errors,stopped:transport.stopped};
}
