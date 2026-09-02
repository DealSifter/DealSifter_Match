export const MAXXIS_STAGING_PROJECT_REF = 'oqdcnjupquhybwdbeeew';

export const FAILURE_CLASSES = new Set([
  'PRODUCT',
  'CONTRACT',
  'DATA',
  'SECURITY',
  'FIXTURE',
  'ENVIRONMENT',
  'INFRASTRUCTURE',
  'PROVIDER_EXTERNAL',
]);

const CRITICAL_VARIANCE_IDS = new Set(['HB-05', 'HB-06', 'HB-07']);

export function projectRefFromUrl(value) {
  try {
    return new URL(String(value || '')).hostname.split('.')[0].toLowerCase();
  } catch {
    return '';
  }
}

export function validateAcceptanceEnvironment({
  target,
  projectRef,
  supabaseUrl,
  anonKey,
  serviceRoleKey,
  backendMode,
  llmMode,
  stubValue,
}) {
  const urlProjectRef = projectRefFromUrl(supabaseUrl);
  if (target !== 'staging' || projectRef !== MAXXIS_STAGING_PROJECT_REF || urlProjectRef !== MAXXIS_STAGING_PROJECT_REF) {
    return { ok: false, status: 'BLOCKED_BY_GUARD', classification: 'SECURITY', reason: 'STAGING_TARGET_MISMATCH' };
  }
  if (!String(anonKey || '').trim() || !String(serviceRoleKey || '').trim()) {
    return { ok: false, status: 'BLOCKED_AUTH', classification: 'ENVIRONMENT', reason: 'STAGING_CREDENTIALS_MISSING' };
  }
  if (backendMode !== 'real' || llmMode !== 'real') {
    return { ok: false, status: 'BLOCKED_BY_GUARD', classification: 'CONTRACT', reason: 'REAL_RUNTIME_MODE_REQUIRED' };
  }
  if (String(stubValue || '').trim() && String(stubValue || '').trim() !== '0') {
    return { ok: false, status: 'BLOCKED_BY_GUARD', classification: 'SECURITY', reason: 'LLM_STUB_FORBIDDEN' };
  }
  return { ok: true, status: 'READY', classification: '', reason: '' };
}

export function attemptsForHeartbeat(id, varianceCheck) {
  return varianceCheck && CRITICAL_VARIANCE_IDS.has(id) ? 3 : 1;
}

export function rateLimitWaitMs({ lastStartedAt = 0, now = Date.now(), minimumIntervalMs = 20_000 } = {}) {
  if (!lastStartedAt) return 0;
  return Math.max(0, minimumIntervalMs - (now - lastStartedAt));
}

function failure(status, classification, reason, semanticClass = 'INVALID') {
  return { status, classification, reason, semanticClass };
}

export function classifyHeartbeatAttempt({ heartbeat, result }) {
  const payload = result?.payload || {};
  const tool = String(payload.runtime?.toolName || 'none');
  const responseType = String(payload.type || 'text');
  const answer = String(payload.message || payload.answer || '').trim();

  if (!result?.ok) {
    const classification = result?.status >= 500 ? 'PROVIDER_EXTERNAL' : result?.status === 401 || result?.status === 403 ? 'SECURITY' : 'INFRASTRUCTURE';
    return failure('FAIL', classification, `HTTP_${result?.status || 0}`);
  }
  if (payload.degraded || payload.status === 'degraded') {
    return failure('DEGRADED', 'PROVIDER_EXTERNAL', String(payload.degradedReason || payload.error || 'PROVIDER_DEGRADED').slice(0, 64));
  }
  if (payload.status === 'unavailable') return failure('FAIL', 'PROVIDER_EXTERNAL', 'PROVIDER_UNAVAILABLE');
  if (!answer) return failure('FAIL', 'CONTRACT', 'EMPTY_RESPONSE');
  if (payload.runtime?.provider !== 'gemini') return failure('FAIL', 'CONTRACT', 'REAL_GEMINI_NOT_USED');
  if (payload.providerStatus !== 'ok') return failure('FAIL', 'CONTRACT', 'PROVIDER_STATUS_NOT_OK');
  if (heartbeat.expectedTool && tool !== heartbeat.expectedTool) return failure('FAIL', 'CONTRACT', 'WRONG_TOOL');

  switch (heartbeat.id) {
    case 'HB-01':
    case 'HB-02':
      if (tool !== 'none' || responseType !== 'text') return failure('FAIL', 'CONTRACT', 'APP_GUIDE_WRONG_CLASS');
      return { status: 'PASS', classification: '', reason: 'OK', semanticClass: 'APP_GUIDE' };
    case 'HB-03':
    case 'HB-04':
      if (tool !== 'none' || responseType !== 'text' || !payload.runtime?.knowledgeVersion) {
        return failure('FAIL', 'CONTRACT', 'REAL_ESTATE_KNOWLEDGE_WRONG_CLASS');
      }
      return { status: 'PASS', classification: '', reason: 'OK', semanticClass: 'REAL_ESTATE_KNOWLEDGE' };
    case 'HB-05':
      if (responseType !== 'properties' || !Array.isArray(payload.data?.properties)) return failure('FAIL', 'DATA', 'PROPERTY_SEARCH_RESULT_INVALID');
      return { status: 'PASS', classification: '', reason: 'OK', semanticClass: 'PROPERTY_SEARCH' };
    case 'HB-06':
      if (responseType !== 'deal_copilot_overview' || !payload.data) return failure('FAIL', 'DATA', 'COPILOT_RESULT_INVALID');
      return { status: 'PASS', classification: '', reason: 'OK', semanticClass: 'DEAL_COPILOT' };
    case 'HB-07':
      if (responseType !== 'property_comparison' || !Array.isArray(payload.data?.properties) || payload.data.properties.length < 2) {
        return failure('FAIL', 'DATA', 'COMPARISON_RESULT_INVALID');
      }
      return { status: 'PASS', classification: '', reason: 'OK', semanticClass: 'PROPERTY_COMPARISON' };
    case 'HB-08':
      if (responseType !== 'property_details' || !Array.isArray(payload.data?.serviceNeeds)) return failure('FAIL', 'DATA', 'PROVIDER_CONTEXT_INVALID');
      return { status: 'PASS', classification: '', reason: 'OK', semanticClass: 'PROPERTY_PROVIDER_CONTEXT' };
    case 'HB-09':
      if (!['getDealCopilotOverview', 'getPropertyDetails'].includes(tool) || !['deal_copilot_overview', 'property_details'].includes(responseType)) {
        return failure('FAIL', 'CONTRACT', 'SURFACE_CONTEXT_NOT_RESOLVED');
      }
      return { status: 'PASS', classification: '', reason: 'OK', semanticClass: 'TRUSTED_SURFACE_CONTEXT' };
    case 'HB-10':
      if (tool !== 'getPropertyDetails' || responseType !== 'property_details' || !payload.data?.nextBestAction) {
        return failure('FAIL', 'CONTRACT', 'CONTINUITY_NOT_RESOLVED');
      }
      return { status: 'PASS', classification: '', reason: 'OK', semanticClass: 'CONTEXT_CONTINUITY' };
    default:
      return failure('FAIL', 'CONTRACT', 'UNKNOWN_HEARTBEAT');
  }
}

export function aggregateAttemptResults(id, attempts) {
  const statuses = attempts.map((item) => item.status);
  const passCount = statuses.filter((status) => status === 'PASS').length;
  const unique = new Set(statuses);
  const firstFailure = attempts.find((item) => item.status !== 'PASS') || null;
  let status = 'FAIL';
  if (passCount === attempts.length) status = 'PASS';
  else if (passCount > 0 || unique.size > 1) status = 'FLAKY';
  else if (statuses.every((value) => value === 'DEGRADED')) status = 'DEGRADED';
  return {
    id,
    status,
    attempts: attempts.length,
    passCount,
    firstFailure: firstFailure ? { status: firstFailure.status, classification: firstFailure.classification, reason: firstFailure.reason } : null,
    finalResult: attempts.at(-1)?.status || 'FAIL',
  };
}

export function validateBaselineLock(contract, baseline) {
  const contractIds = contract.heartbeats.map((item) => item.id);
  const baselineIds = baseline.results.map((item) => item.id);
  if (JSON.stringify(contractIds) !== JSON.stringify(baselineIds)) return { ok: false, reason: 'HEARTBEAT_SET_DRIFT' };
  if (baseline.results.some((item) => item.status !== 'PASS')) return { ok: false, reason: 'R1_BASELINE_NOT_ALL_PASS' };
  return { ok: true, reason: 'R1_BASELINE_LOCKED' };
}
