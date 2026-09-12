import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, parseAllowedOrigins } from '../_shared/maxxis/corsPolicy.ts';
import {
  ARV_VISUAL_COMP_REVIEW_POLICY_VERSION,
  buildArvVisualCompReviewPayload,
  isConditionCompatibility,
  isTargetCondition,
} from '../_shared/property-data/arvVisualCompReview.ts';
import {
  createBackendSoldEvidenceService,
  type PropertyEvidenceBackendClient,
} from '../_shared/property-data/backendFactory.ts';
import { validatePropertyId } from '../_shared/property-data/cache.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const allowedOrigins = parseAllowedOrigins(
  Deno.env.get('PROPERTY_INTELLIGENCE_ALLOWED_ORIGINS') || '',
  [Deno.env.get('APP_URL') || '', Deno.env.get('VITE_APP_URL') || ''],
);

function response(origin: string, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: {
    ...buildCorsHeaders(origin, allowedOrigins), 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
  } });
}

function cleanNotes(value: unknown) {
  const notes = String(value || '').trim();
  if (notes.length > 1000) throw new Error('NOTES_TOO_LONG');
  return notes || null;
}

export async function handleArvVisualCompReviewRequest(req: Request) {
  const origin = req.headers.get('Origin') || '';
  if (req.method === 'OPTIONS') return new Response('ok', { headers: buildCorsHeaders(origin, allowedOrigins) });
  if (req.method !== 'POST') return response(origin, { success: false, error: 'METHOD_NOT_ALLOWED' }, 405);
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || !supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return response(origin, { success: false, error: 'AUTH_REQUIRED' }, 401);
  }
  const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) return response(origin, { success: false, error: 'AUTH_REQUIRED' }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'LOAD').trim().toUpperCase();
    const propertyId = validatePropertyId(String(body?.propertyId || '').trim());
    const { data: entitled, error: entitlementError } = await client.rpc('ds_has_property_intelligence_entitlement', {
      p_property_id: propertyId, p_unlock_type: 'property_record',
    });
    if (entitlementError || entitled !== true) return response(origin, { success: false, state: 'locked', error: 'NOT_ENTITLED' }, 403);

    if (action === 'SET_TARGET') {
      if (!isTargetCondition(body?.targetCondition)) return response(origin, { success: false, error: 'INVALID_TARGET_CONDITION' }, 400);
      const { error } = await client.from('property_arv_review_contexts').upsert({
        subject_property_id: propertyId,
        reviewer_user_id: user.id,
        target_condition: body.targetCondition,
        evidence_status: 'USER_PROVIDED',
        policy_version: ARV_VISUAL_COMP_REVIEW_POLICY_VERSION,
      }, { onConflict: 'subject_property_id,reviewer_user_id' });
      if (error) throw new Error('TARGET_CONDITION_WRITE_FAILED');
    }

    const admin = createClient(supabaseUrl, serviceRoleKey) as unknown as PropertyEvidenceBackendClient;
    const soldService = createBackendSoldEvidenceService({
      supabaseAdmin: admin,
      getEnv: (name) => name === 'PROPERTY_DATA_MODE' ? 'disabled' : Deno.env.get(name),
    });
    const soldEvidence = await soldService.getCachedSoldEvidence({ propertyId, userId: user.id });
    if (!soldEvidence) return response(origin, { success: false, state: 'no_cached_evidence', error: 'CACHED_SOLD_EVIDENCE_REQUIRED' });
    const candidateIds = new Set(soldEvidence.recordedSoldCompSelection.primaryStructuralCandidates
      .map((candidate) => candidate.soldRecord.providerPropertyId).filter(Boolean));

    if (action === 'UPSERT_REVIEW') {
      const compIdentifier = String(body?.compIdentifier || '').trim();
      if (!candidateIds.has(compIdentifier)) return response(origin, { success: false, error: 'INVALID_COMP_CANDIDATE' }, 400);
      if (!isTargetCondition(body?.targetCondition) || !isTargetCondition(body?.observedCondition)
        || !isConditionCompatibility(body?.conditionCompatibility)) {
        return response(origin, { success: false, error: 'INVALID_REVIEW' }, 400);
      }
      const { data: activeTargetRows, error: activeTargetError } = await client
        .from('property_arv_review_contexts').select('target_condition')
        .eq('subject_property_id', propertyId).eq('reviewer_user_id', user.id).limit(1);
      if (activeTargetError || !Array.isArray(activeTargetRows)
        || activeTargetRows[0]?.target_condition !== body.targetCondition) {
        return response(origin, { success: false, error: 'TARGET_CONDITION_CONFIRMATION_REQUIRED' }, 409);
      }
      const { error } = await client.from('property_comp_condition_reviews').upsert({
        subject_property_id: propertyId,
        reviewer_user_id: user.id,
        comp_identifier: compIdentifier,
        target_condition: body.targetCondition,
        observed_condition: body.observedCondition,
        condition_compatibility: body.conditionCompatibility,
        notes: cleanNotes(body?.notes),
        evidence_status: 'USER_PROVIDED',
        reviewed_at: new Date().toISOString(),
        policy_version: ARV_VISUAL_COMP_REVIEW_POLICY_VERSION,
      }, { onConflict: 'subject_property_id,reviewer_user_id,comp_identifier' });
      if (error) throw new Error('COMP_REVIEW_WRITE_FAILED');
    } else if (!['LOAD', 'SET_TARGET'].includes(action)) {
      return response(origin, { success: false, error: 'INVALID_ACTION' }, 400);
    }

    const [{ data: targetRows, error: targetError }, { data: reviewRows, error: reviewError }] = await Promise.all([
      client.from('property_arv_review_contexts').select('target_condition').eq('subject_property_id', propertyId).eq('reviewer_user_id', user.id).limit(1),
      client.from('property_comp_condition_reviews').select('comp_identifier,target_condition,observed_condition,condition_compatibility,notes,evidence_status,reviewed_at,reviewer_user_id,policy_version').eq('subject_property_id', propertyId).eq('reviewer_user_id', user.id),
    ]);
    if (targetError || reviewError) throw new Error('COMP_REVIEW_READ_FAILED');
    const targetCondition = Array.isArray(targetRows) && isTargetCondition(targetRows[0]?.target_condition)
      ? targetRows[0].target_condition : null;
    const payload = buildArvVisualCompReviewPayload({
      propertyId,
      targetCondition,
      candidates: soldEvidence.recordedSoldCompSelection.primaryStructuralCandidates,
      persistedReviews: Array.isArray(reviewRows) ? reviewRows : [],
    });
    return response(origin, { success: true, state: 'ready', data: payload });
  } catch (error) {
    const code = String(error instanceof Error ? error.message : 'ARV_VISUAL_REVIEW_UNAVAILABLE');
    return response(origin, { success: false, error: code }, code === 'INVALID_PROPERTY' ? 400 : 500);
  }
}

Deno.serve(handleArvVisualCompReviewRequest);
