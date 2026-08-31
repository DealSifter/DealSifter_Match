import { parseArg, readJson, requireTarget } from './release-safety-lib.mjs';

const level = parseArg('level') || 'contract';
const contract = readJson('config/heartbeat-contract.json');
const allowedStatuses = new Set(contract.allowedStatuses);

if (level === 'contract') {
  const ids = new Set();
  const failures = [];
  for (const item of contract.heartbeats) {
    if (!/^HB-\d{2}$/.test(item.id)) failures.push(`invalid id ${item.id}`);
    if (ids.has(item.id)) failures.push(`duplicate id ${item.id}`);
    if (!item.prompt || !item.page || !item.capability) failures.push(`incomplete contract ${item.id}`);
    ids.add(item.id);
    console.log(`[heartbeat] level=contract-definition id=${item.id} capability=${item.capability} status=DEFINED`);
  }
  if (ids.size !== 10) failures.push(`expected 10 heartbeats, found ${ids.size}`);
  if (failures.length) {
    failures.forEach((failure) => console.error(`[heartbeat] FAIL ${failure}`));
    process.exitCode = 1;
  } else {
    console.log('[heartbeat] level=contract-definition count=10 status=PASS functionalExecution=NOT_EXECUTED authority=NON_RELEASE');
  }
} else if (level === 'baseline') {
  const baseline = readJson('config/heartbeat-baseline-r0.json');
  const failures = baseline.results.filter((item) => (
    !allowedStatuses.has(item.contract) || !allowedStatuses.has(item.realRuntime)
  ));
  baseline.results.forEach((item) => console.log(
    `[heartbeat] level=baseline id=${item.id} contract=${item.contract} realRuntime=${item.realRuntime}`,
  ));
  console.log(`[heartbeat] baseline=${baseline.name} sourceSha=${baseline.sourceSha} status=${failures.length ? 'FAIL' : 'RECORDED'}`);
  if (failures.length) process.exitCode = 1;
} else if (level === 'staging-baseline') {
  const baseline = readJson('config/heartbeat-baseline-r0b.json');
  const failures = baseline.results.filter((item) => !allowedStatuses.has(item.status));
  baseline.results.forEach((item) => console.log(
    `[heartbeat] level=staging-baseline id=${item.id} status=${item.status} requestId=${item.requestId} ` +
    `http=${item.httpStatus} degraded=${item.degraded} tool=${item.toolCalled}`,
  ));
  console.log(
    `[heartbeat] baseline=${baseline.name} target=${baseline.target} authenticated=${baseline.authenticated} ` +
    `geminiReal=${baseline.geminiReal} stub=${baseline.stub} pass=${baseline.summary.pass} fail=${baseline.summary.fail} ` +
    `status=${failures.length ? 'INVALID' : 'RECORDED'}`,
  );
  if (failures.length) process.exitCode = 1;
} else if (level === 'real') {
  const target = requireTarget();
  if (target !== 'staging') throw new Error('Real heartbeat execution is restricted to staging in this runner.');
  const url = String(process.env.HEARTBEAT_SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(process.env.HEARTBEAT_SUPABASE_ANON_KEY || '');
  const email = String(process.env.HEARTBEAT_USER_EMAIL || '');
  const password = String(process.env.HEARTBEAT_USER_PASSWORD || '');
  const propertyId = String(process.env.HEARTBEAT_PROPERTY_ID || '');
  const comparisonPropertyId = String(process.env.HEARTBEAT_COMPARISON_PROPERTY_ID || '');
  if (![url, key, email, password].every(Boolean)) {
    contract.heartbeats.forEach((item) => console.log(`[heartbeat] level=real id=${item.id} status=NOT_EXECUTED reason=STAGING_CREDENTIALS_MISSING`));
    process.exit(2);
  }
  if (!url.includes('oqdcnjupquhybwdbeeew')) throw new Error('Real heartbeat target does not match the staging project contract.');

  const authResponse = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const auth = await authResponse.json().catch(() => ({}));
  if (!authResponse.ok || !auth.access_token) throw new Error(`Staging heartbeat authentication failed (${authResponse.status}).`);

  let failed = 0;
  for (const item of contract.heartbeats) {
    if ((item.context === 'property' || item.context === 'property-history') && !propertyId) {
      console.log(`[heartbeat] level=real id=${item.id} status=NOT_APPLICABLE reason=PROPERTY_ID_MISSING`);
      continue;
    }
    if (item.context === 'comparison' && (!propertyId || !comparisonPropertyId)) {
      console.log(`[heartbeat] level=real id=${item.id} status=NOT_APPLICABLE reason=COMPARISON_IDS_MISSING`);
      continue;
    }
    const context = item.context === 'comparison'
      ? { propertyIds: [propertyId, comparisonPropertyId] }
      : item.context === 'none' ? {} : { propertyId };
    const history = item.context === 'property-history'
      ? [{ role: 'user', content: 'Explique a situação atual deste imóvel.' }]
      : [];
    const response = await fetch(`${url}/functions/v1/maxxis-chat`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${auth.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: item.prompt, page: item.page, language: 'pt', context, history }),
    });
    const payload = await response.json().catch(() => ({}));
    let status = 'PASS';
    let reason = 'OK';
    if (!response.ok) { status = 'FAIL'; reason = `HTTP_${response.status}`; }
    else if (payload.degraded) { status = 'DEGRADED'; reason = String(payload.reason || 'DEGRADED'); }
    else if (!String(payload.message || payload.answer || '').trim()) { status = 'FAIL'; reason = 'EMPTY_RESPONSE'; }
    else if (item.expectedTool && payload.runtime?.toolName !== item.expectedTool) { status = 'FAIL'; reason = 'WRONG_TOOL'; }
    if (status === 'FAIL') failed += 1;
    console.log(
      `[heartbeat] level=real id=${item.id} status=${status} reason=${reason} ` +
      `requestId=${payload.requestId || response.headers.get('x-request-id') || 'missing'} ` +
      `provider=${payload.runtime?.provider || 'unknown'} tool=${payload.runtime?.toolName || 'none'}`,
    );
  }
  if (failed) process.exitCode = 1;
} else {
  throw new Error('Heartbeat level must be contract, baseline, staging-baseline or real.');
}
