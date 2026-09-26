import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { isPropertyIntelligenceId } from './propertyIntelligenceService';

async function invoke(body, invokeOverride = null) {
  if (!isPropertyIntelligenceId(body?.propertyId)) throw new Error('INVALID_PROPERTY');
  if (!invokeOverride && (!isSupabaseConfigured || !supabase)) throw new Error('ANALYSIS_INPUTS_UNAVAILABLE');
  const call = invokeOverride || ((payload) => supabase.functions.invoke('maxxis-analysis-inputs', { body: payload }));
  const { data, error } = await call(body);
  if (error || !data?.success) throw new Error(String(data?.error || 'ANALYSIS_INPUTS_UNAVAILABLE'));
  return data.data;
}

export function saveMaxxisAnalysisInputs(propertyId, values, invokeOverride = null) {
  return invoke({ action: 'UPSERT', propertyId, ...values }, invokeOverride);
}

export function declineMaxxisAnalysisInputs(propertyId, fields, invokeOverride = null) {
  return invoke({ action: 'DECLINE', propertyId, fields }, invokeOverride);
}
