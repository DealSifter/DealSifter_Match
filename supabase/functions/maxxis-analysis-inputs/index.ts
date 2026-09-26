import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, parseAllowedOrigins } from '../_shared/maxxis/corsPolicy.ts';
import { isTargetCondition } from '../_shared/property-data/arvVisualCompReview.ts';
import { validatePropertyId } from '../_shared/property-data/cache.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const allowedOrigins = parseAllowedOrigins(
  Deno.env.get('PROPERTY_INTELLIGENCE_ALLOWED_ORIGINS') || '',
  [Deno.env.get('APP_URL') || '', Deno.env.get('VITE_APP_URL') || ''],
);
const ALLOWED_FIELDS = new Set(['rehab_budget', 'target_condition', 'renovation_scope']);

function response(origin: string, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: {
    ...buildCorsHeaders(origin, allowedOrigins), 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
  } });
}

function budget(value: unknown) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000_000) throw new Error('INVALID_REHAB_BUDGET');
  return Math.round(parsed * 100) / 100;
}

function scope(value: unknown) {
  const parsed = String(value || '').trim();
  if (parsed.length > 1000) throw new Error('INVALID_RENOVATION_SCOPE');
  return parsed || null;
}

export async function handleMaxxisAnalysisInputsRequest(req: Request) {
  const origin = req.headers.get('Origin') || '';
  if (req.method === 'OPTIONS') return new Response('ok', { headers: buildCorsHeaders(origin, allowedOrigins) });
  if (req.method !== 'POST') return response(origin, { success: false, error: 'METHOD_NOT_ALLOWED' }, 405);
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || !supabaseUrl || !supabaseAnonKey) return response(origin, { success: false, error: 'AUTH_REQUIRED' }, 401);
  const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) return response(origin, { success: false, error: 'AUTH_REQUIRED' }, 401);
  try {
    const body = await req.json().catch(() => ({}));
    const propertyId = validatePropertyId(String(body?.propertyId || '').trim());
    const action = String(body?.action || '').trim().toUpperCase();
    if (!['UPSERT', 'DECLINE'].includes(action)) return response(origin, { success: false, error: 'INVALID_ACTION' }, 400);
    const { data: entitled, error: entitlementError } = await client.rpc('ds_has_property_intelligence_entitlement', {
      p_property_id: propertyId, p_unlock_type: 'property_record',
    });
    if (entitlementError || entitled !== true) return response(origin, { success: false, error: 'NOT_ENTITLED' }, 403);
    const { data: existing, error: readError } = await client.from('property_arv_review_contexts')
      .select('target_condition,rehab_budget,renovation_scope,declined_inputs')
      .eq('subject_property_id', propertyId).eq('reviewer_user_id', user.id).maybeSingle();
    if (readError) throw new Error('ANALYSIS_INPUT_READ_FAILED');
    const declined = new Set(Array.isArray(existing?.declined_inputs) ? existing.declined_inputs : []);
    const row: Record<string, unknown> = {
      subject_property_id: propertyId,
      reviewer_user_id: user.id,
      target_condition: existing?.target_condition || null,
      rehab_budget: existing?.rehab_budget ?? null,
      renovation_scope: existing?.renovation_scope || null,
      evidence_status: 'USER_PROVIDED',
      policy_version: 'MAXXIS_ANALYSIS_INPUTS_V1',
    };
    if (action === 'UPSERT') {
      if (body.targetCondition !== undefined) {
        if (!isTargetCondition(body.targetCondition) || body.targetCondition === 'UNKNOWN') throw new Error('INVALID_TARGET_CONDITION');
        row.target_condition = body.targetCondition;
        declined.delete('target_condition');
      }
      if (body.rehabBudget !== undefined) {
        row.rehab_budget = budget(body.rehabBudget);
        if (row.rehab_budget === null) throw new Error('INVALID_REHAB_BUDGET');
        declined.delete('rehab_budget');
      }
      if (body.renovationScope !== undefined) {
        row.renovation_scope = scope(body.renovationScope);
        if (row.renovation_scope) declined.delete('renovation_scope');
      }
    } else {
      const fields = Array.isArray(body.fields) ? body.fields.map((field: unknown) => String(field || '')) : [];
      if (!fields.length || fields.some((field: string) => !ALLOWED_FIELDS.has(field))) throw new Error('INVALID_DECLINED_INPUTS');
      fields.forEach((field: string) => declined.add(field));
    }
    row.declined_inputs = [...declined];
    const { error: writeError } = await client.from('property_arv_review_contexts').upsert(row, {
      onConflict: 'subject_property_id,reviewer_user_id',
    });
    if (writeError) throw new Error('ANALYSIS_INPUT_WRITE_FAILED');
    return response(origin, { success: true, data: {
      targetCondition: row.target_condition,
      rehabBudget: row.rehab_budget,
      renovationScope: row.renovation_scope,
      declinedInputs: row.declined_inputs,
      provenance: 'USER_PROVIDED',
    } });
  } catch (error) {
    const code = String(error instanceof Error ? error.message : 'ANALYSIS_INPUTS_UNAVAILABLE');
    return response(origin, { success: false, error: code }, /^INVALID_/.test(code) ? 400 : 500);
  }
}

Deno.serve(handleMaxxisAnalysisInputsRequest);
