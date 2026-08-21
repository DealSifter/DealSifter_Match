/* global process */

const PRODUCTION_REFS = new Set(['cyeipfskwwisbbayyaca']);
const args = new Set(process.argv.slice(2));
const allowFindings = args.has('--allow-findings');
const requiredCodeArg = [...args].find((arg) => arg.startsWith('--require-code='));
const requiredCode = requiredCodeArg?.slice('--require-code='.length) || '';

const supabaseUrl = String(
  process.env.DATA_INTEGRITY_SUPABASE_URL
  || process.env.E2E_SUPABASE_URL
  || '',
).trim().replace(/\/$/, '');
const serviceRoleKey = String(
  process.env.DATA_INTEGRITY_SERVICE_ROLE_KEY
  || process.env.E2E_SUPABASE_SERVICE_ROLE_KEY
  || '',
).trim();

function projectRefFromUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    const parts = hostname.split('.');
    return parts.length >= 3 && parts[1] === 'supabase' ? parts[0] : '';
  } catch {
    return '';
  }
}

function fail(message) {
  console.error(`[data-integrity] ${message}`);
  process.exit(1);
}

if (!supabaseUrl || !serviceRoleKey) {
  fail('DATA_INTEGRITY_SUPABASE_URL and DATA_INTEGRITY_SERVICE_ROLE_KEY are required.');
}

const projectRef = projectRefFromUrl(supabaseUrl);
if (!projectRef) fail('Invalid Supabase project URL.');
if (PRODUCTION_REFS.has(projectRef) && process.env.DATA_INTEGRITY_ALLOW_PRODUCTION !== 'I_UNDERSTAND_READ_ONLY') {
  fail(`Production project ${projectRef} is blocked. Explicit read-only approval is required.`);
}

const response = await fetch(`${supabaseUrl}/rest/v1/rpc/ds_data_integrity_audit`, {
  method: 'POST',
  headers: {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  },
  body: '{}',
  signal: AbortSignal.timeout(30_000),
});

if (!response.ok) {
  const requestId = response.headers.get('x-request-id') || 'unavailable';
  fail(`RPC failed with HTTP ${response.status}; requestId=${requestId}.`);
}

const rows = await response.json();
if (!Array.isArray(rows)) fail('Unexpected RPC response.');

const findings = rows
  .map((row) => ({
    code: String(row.check_code || 'unknown'),
    severity: String(row.severity || 'WARNING').toUpperCase(),
    count: Number(row.issue_count || 0),
  }))
  .filter((row) => row.count > 0)
  .sort((a, b) => a.severity.localeCompare(b.severity) || a.code.localeCompare(b.code));

const summary = {
  projectRef,
  readOnly: true,
  checks: rows.length,
  findings: findings.length,
  counts: findings.reduce((acc, row) => {
    acc[row.severity] = (acc[row.severity] || 0) + row.count;
    return acc;
  }, {}),
  details: findings,
};

console.log(JSON.stringify(summary, null, 2));

if (requiredCode && !findings.some((row) => row.code === requiredCode)) {
  fail(`Required controlled finding was not detected: ${requiredCode}.`);
}

if (!allowFindings && findings.some((row) => row.severity === 'HIGH' || row.severity === 'CRITICAL')) {
  fail('HIGH or CRITICAL findings detected.');
}
