import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, parseAllowedOrigins } from '../_shared/maxxis/corsPolicy.ts';
import { validatePropertyId } from '../_shared/property-data/cache.ts';
import { estimateRehabBenchmark2026 } from '../_shared/maxxis/rehabCostBenchmarks2026.ts';
import { normalizeTargetCondition } from '../_shared/maxxis/analysisApplicability.ts';
import { createRequestId, logOperationalEvent } from '../_shared/observability.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const allowedOrigins = parseAllowedOrigins(
  Deno.env.get('PROPERTY_INTELLIGENCE_ALLOWED_ORIGINS') || '',
  [Deno.env.get('APP_URL') || '', Deno.env.get('VITE_APP_URL') || ''],
);
const ALLOWED_FIELDS = new Set(['rehab_budget', 'target_condition', 'renovation_scope']);
const NUMERIC_DEAL_ASSUMPTIONS = new Set([
  'sellingCosts', 'sellingCostPercent', 'holdingCosts', 'holdingPeriodMonths', 'interestRate', 'loanAmount',
  'monthlyPayment', 'operatingExpenses', 'noi', 'vacancyRate', 'insurance', 'management', 'maintenance', 'hoa',
  'dispositionPrice', 'assignmentFee', 'closingCosts', 'downPayment', 'termMonths', 'amortizationMonths',
  'balloonMonths', 'existingLoanBalance', 'monthlyPiPayment', 'arrears', 'cashToSeller', 'reinstatement',
]);
const TEXT_DEAL_ASSUMPTIONS = new Set([
  'allowedUse', 'roadAccess', 'utilities', 'survey', 'topography', 'developmentAssumptions',
]);
const BOOLEAN_DEAL_ASSUMPTIONS = new Set(['assignability']);

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

function rehabSource(value: unknown) {
  const parsed = String(value || 'USER_PROVIDED').trim().toUpperCase();
  if (!['USER_PROVIDED', 'USER_CURATED_REHAB_BENCHMARK_2026'].includes(parsed)) throw new Error('INVALID_REHAB_SOURCE');
  return parsed;
}

function dealAssumptions(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_DEAL_ASSUMPTIONS');
  const sanitized: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (NUMERIC_DEAL_ASSUMPTIONS.has(key)) {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000_000) throw new Error('INVALID_DEAL_ASSUMPTIONS');
      sanitized[key] = Math.round(parsed * 100) / 100;
    } else if (TEXT_DEAL_ASSUMPTIONS.has(key)) {
      const parsed = String(raw || '').trim();
      if (!parsed || parsed.length > 1000) throw new Error('INVALID_DEAL_ASSUMPTIONS');
      sanitized[key] = parsed;
    } else if (BOOLEAN_DEAL_ASSUMPTIONS.has(key) && typeof raw === 'boolean') {
      sanitized[key] = raw;
    } else if (key === 'activeScenario' && raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const scenario = raw as Record<string, unknown>; const strategy = String(scenario.strategy || '').toUpperCase();
      if (!['SELLER_FINANCING', 'BUY_AND_HOLD', 'FLIP', 'SUB_TO', 'WHOLESALE', 'LAND'].includes(strategy)
        || scenario.status !== 'COMPLETE' || scenario.confirmed !== true) throw new Error('INVALID_DEAL_ASSUMPTIONS');
      const serialized = JSON.stringify(scenario);
      if (serialized.length > 16_000 || /__proto__|constructor|prototype/.test(serialized)) throw new Error('INVALID_DEAL_ASSUMPTIONS');
      const parsed = JSON.parse(serialized) as Record<string, unknown>;
      if (!parsed.assumptions || typeof parsed.assumptions !== 'object' || !parsed.calculatedOutputs || typeof parsed.calculatedOutputs !== 'object') {
        throw new Error('INVALID_DEAL_ASSUMPTIONS');
      }
      sanitized[key] = parsed;
    } else {
      throw new Error('INVALID_DEAL_ASSUMPTIONS');
    }
  }
  if (!Object.keys(sanitized).length) throw new Error('INVALID_DEAL_ASSUMPTIONS');
  return sanitized;
}

function capability(value: unknown) {
  const parsed = String(value || '').trim().toUpperCase();
  if (!parsed) return null;
  if (!['MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE'].includes(parsed)) throw new Error('INVALID_CAPABILITY');
  return parsed;
}

function publicErrorCode(code: string) {
  if (/^INVALID_|BENCHMARK_NOT_AVAILABLE|STORED_REHAB_TAKES_PRIORITY/.test(code)) {
    return 'GAP_RESOLUTION_VALIDATION_ERROR';
  }
  if (code === 'NOT_ENTITLED') return 'GAP_RESOLUTION_ACCESS_DENIED';
  if (/READ_FAILED|WRITE_FAILED/.test(code)) return 'GAP_RESOLUTION_PERSISTENCE_ERROR';
  return 'GAP_RECOMPUTE_ERROR';
}

export async function handleMaxxisAnalysisInputsRequest(req: Request) {
  const startedAt = Date.now();
  const requestId = createRequestId(req);
  let userId = '';
  let propertyId = '';
  let action = '';
  let requestedCapability: string | null = null;
  let propertyType = '';
  const origin = req.headers.get('Origin') || '';
  if (req.method === 'OPTIONS') return new Response('ok', { headers: buildCorsHeaders(origin, allowedOrigins) });
  if (req.method !== 'POST') return response(origin, { success: false, error: 'METHOD_NOT_ALLOWED' }, 405);
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || !supabaseUrl || !supabaseAnonKey) return response(origin, { success: false, error: 'AUTH_REQUIRED' }, 401);
  const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) return response(origin, { success: false, error: 'AUTH_REQUIRED' }, 401);
  userId = user.id;
  try {
    const body = await req.json().catch(() => ({}));
    propertyId = validatePropertyId(String(body?.propertyId || '').trim());
    action = String(body?.action || '').trim().toUpperCase();
    requestedCapability = capability(body?.capability);
    if (!['UPSERT', 'DECLINE'].includes(action)) throw new Error('INVALID_ACTION');
    const { data: entitled, error: entitlementError } = await client.rpc('ds_has_maxxis_analysis_context_access', {
      p_property_id: propertyId,
    });
    if (entitlementError || entitled !== true) throw new Error('NOT_ENTITLED');
    const { data: property } = await client.from('properties').select('type').eq('id', propertyId).maybeSingle();
    propertyType = String(property?.type || '');
    const { data: existing, error: readError } = await client.from('property_arv_review_contexts')
      .select('target_condition,rehab_budget,renovation_scope,rehab_source,declined_inputs,deal_assumptions')
      .eq('subject_property_id', propertyId).eq('reviewer_user_id', user.id).maybeSingle();
    if (readError) throw new Error('ANALYSIS_INPUT_READ_FAILED');
    const declined = new Set(Array.isArray(existing?.declined_inputs) ? existing.declined_inputs : []);
    const row: Record<string, unknown> = {
      subject_property_id: propertyId,
      reviewer_user_id: user.id,
      target_condition: existing?.target_condition || null,
      rehab_budget: existing?.rehab_budget ?? null,
      renovation_scope: existing?.renovation_scope || null,
      rehab_source: existing?.rehab_source || null,
      deal_assumptions: existing?.deal_assumptions && typeof existing.deal_assumptions === 'object'
        ? existing.deal_assumptions : {},
      evidence_status: 'USER_PROVIDED',
      policy_version: 'MAXXIS_ANALYSIS_INPUTS_V1',
    };
    if (action === 'UPSERT') {
      if (body.targetCondition !== undefined) {
        const canonicalCondition = normalizeTargetCondition(body.targetCondition);
        if (!canonicalCondition) throw new Error('INVALID_TARGET_CONDITION');
        row.target_condition = canonicalCondition;
        declined.delete('target_condition');
      }
      if (body.rehabBudget !== undefined) {
        const source = rehabSource(body.rehabSource);
        row.rehab_source = source;
        if (source === 'USER_CURATED_REHAB_BENCHMARK_2026') {
          if (existing?.rehab_budget !== null && existing?.rehab_budget !== undefined
            && existing?.rehab_source !== 'USER_CURATED_REHAB_BENCHMARK_2026') {
            throw new Error('STORED_REHAB_TAKES_PRIORITY');
          }
          const condition = body.targetCondition || row.target_condition;
          const { data: property, error: propertyError } = await client.from('properties')
            .select('state,sqft,rehab').eq('id', propertyId).maybeSingle();
          if (propertyError) throw new Error('BENCHMARK_PROPERTY_READ_FAILED');
          if (Number.isFinite(Number(property?.rehab)) && Number(property?.rehab) > 0) {
            throw new Error('STORED_REHAB_TAKES_PRIORITY');
          }
          const estimate = estimateRehabBenchmark2026({ state: property?.state, livingAreaSqft: property?.sqft, condition });
          if (!estimate) throw new Error('BENCHMARK_NOT_AVAILABLE');
          row.rehab_budget = estimate.mid;
        } else {
          row.rehab_budget = budget(body.rehabBudget);
          if (row.rehab_budget === null) throw new Error('INVALID_REHAB_BUDGET');
        }
        declined.delete('rehab_budget');
      }
      if (body.renovationScope !== undefined) {
        row.renovation_scope = scope(body.renovationScope);
        if (row.renovation_scope) declined.delete('renovation_scope');
      }
      if (body.dealAssumptions !== undefined) {
        row.deal_assumptions = { ...(row.deal_assumptions as Record<string, unknown>),
          ...dealAssumptions(body.dealAssumptions) };
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
    logOperationalEvent({
      functionName: 'maxxis-analysis-inputs', operation: 'persist_gap_resolution', requestId, userId,
      durationMs: Date.now() - startedAt, success: true, status: 200, provider: 'supabase',
      metrics: {
        action, capability: requestedCapability || 'UNSPECIFIED', property_type: propertyType || 'UNKNOWN',
        pending_gap_count: Array.isArray(body.pendingGaps) ? body.pendingGaps.length : 0,
        target_condition: String(row.target_condition || 'UNAVAILABLE'),
        rehab_present: row.rehab_budget !== null, scope_present: Boolean(row.renovation_scope),
        snapshot_revision: String(body.snapshotRevision || 'UNSPECIFIED').slice(0, 80),
      },
    });
    return response(origin, { success: true, data: {
      targetCondition: row.target_condition,
      rehabBudget: row.rehab_budget,
      renovationScope: row.renovation_scope,
      dealAssumptions: row.deal_assumptions,
      rehabSource: row.rehab_source,
      declinedInputs: row.declined_inputs,
      provenance: row.rehab_source === 'USER_CURATED_REHAB_BENCHMARK_2026' ? 'ESTIMATED' : 'USER_PROVIDED',
    } });
  } catch (error) {
    const code = String(error instanceof Error ? error.message : 'ANALYSIS_INPUTS_UNAVAILABLE');
    const status = /^INVALID_|BENCHMARK_NOT_AVAILABLE/.test(code) ? 400
      : code === 'STORED_REHAB_TAKES_PRIORITY' ? 409 : code === 'NOT_ENTITLED' ? 403 : 500;
    const stableCode = publicErrorCode(code);
    logOperationalEvent({
      functionName: 'maxxis-analysis-inputs', operation: 'persist_gap_resolution', requestId, userId,
      durationMs: Date.now() - startedAt, success: false, errorCode: stableCode, status, provider: 'supabase',
      metrics: {
        internal_code: code, action: action || 'UNKNOWN', capability: requestedCapability || 'UNSPECIFIED',
        property_type: propertyType || 'UNKNOWN', property_id_present: Boolean(propertyId),
      },
    });
    return response(origin, { success: false, error: stableCode, requestId }, status);
  }
}

Deno.serve(handleMaxxisAnalysisInputsRequest);
