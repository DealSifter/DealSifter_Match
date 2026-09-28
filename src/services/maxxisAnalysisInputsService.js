import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { isPropertyIntelligenceId } from './propertyIntelligenceService';

async function invoke(body, invokeOverride = null) {
  if (!isPropertyIntelligenceId(body?.propertyId)) throw new Error('INVALID_PROPERTY');
  if (!invokeOverride && (!isSupabaseConfigured || !supabase)) throw new Error('ANALYSIS_INPUTS_UNAVAILABLE');
  const call = invokeOverride || ((payload) => supabase.functions.invoke('maxxis-analysis-inputs', { body: payload }));
  const { data, error } = await call(body);
  if (error || !data?.success) {
    let responseData = data;
    if (!responseData && error?.context?.json) {
      responseData = await error.context.clone().json().catch(() => null);
    }
    const failure = new Error(String(responseData?.error || 'ANALYSIS_INPUTS_UNAVAILABLE'));
    failure.requestId = String(responseData?.requestId || error?.context?.headers?.get?.('x-request-id') || '');
    throw failure;
  }
  return data.data;
}

export function saveMaxxisAnalysisInputs(propertyId, values, invokeOverride = null, context = {}) {
  return invoke({ action: 'UPSERT', propertyId, ...values, ...context }, invokeOverride);
}

export function declineMaxxisAnalysisInputs(propertyId, fields, invokeOverride = null, context = {}) {
  return invoke({ action: 'DECLINE', propertyId, fields, ...context }, invokeOverride);
}
