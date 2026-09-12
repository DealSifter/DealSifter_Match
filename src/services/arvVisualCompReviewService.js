import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { isPropertyIntelligenceId } from './propertyIntelligenceService';

async function invoke(body, invokeOverride = null) {
  if (!isPropertyIntelligenceId(body?.propertyId)) throw new Error('INVALID_PROPERTY');
  if (!invokeOverride && (!isSupabaseConfigured || !supabase)) throw new Error('ARV_VISUAL_REVIEW_UNAVAILABLE');
  const invokeFunction = invokeOverride || ((payload) => supabase.functions.invoke('arv-visual-comp-review', { body: payload }));
  const { data, error } = await invokeFunction(body);
  if (error || !data?.success || data?.state !== 'ready' || !data?.data) {
    throw new Error(String(data?.error || 'ARV_VISUAL_REVIEW_UNAVAILABLE'));
  }
  return data.data;
}

export function fetchArvVisualCompReview(propertyId, invokeOverride = null) {
  return invoke({ action: 'LOAD', propertyId }, invokeOverride);
}

export function persistArvTargetCondition(propertyId, targetCondition, invokeOverride = null) {
  return invoke({ action: 'SET_TARGET', propertyId, targetCondition }, invokeOverride);
}

export function persistArvCompConditionReview(propertyId, review, invokeOverride = null) {
  return invoke({
    action: 'UPSERT_REVIEW', propertyId,
    compIdentifier: review.compIdentifier,
    targetCondition: review.targetCondition,
    observedCondition: review.observedCondition,
    conditionCompatibility: review.conditionCompatibility,
    notes: review.notes || '',
  }, invokeOverride);
}
