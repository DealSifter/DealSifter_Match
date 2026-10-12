import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';

// Operator-only configuration, not runtime infrastructure. Never log identities,
// credentials or flag values. Existing configuration must be merged privately by
// the operator; this first-cohort helper refuses to overwrite any existing blob.
const project = process.env.PARCEL_PREVIEW_PROJECT_REF;
const email = process.env.PARCEL_PREVIEW_APPROVED_EMAIL?.trim().toLowerCase();
if (!/^[a-z]{20}$/.test(project || '') || !email?.includes('@') || !process.argv.includes('--apply')) throw new Error('EXPLICIT_APPROVED_PROJECT_ACCOUNT_AND_APPLY_REQUIRED');
const cli = args => {
  try { return execFileSync('supabase', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }); }
  catch { throw new Error('SUPABASE_OPERATOR_COMMAND_FAILED_NO_SECRET_OUTPUT'); }
};
const inventory = () => {
  const rows = new Map(); let header = false;
  for (const line of cli(['secrets', 'list', '--project-ref', project]).split(/\r?\n/)) {
    const text = line.trim();
    if (/^NAME\s*\|/.test(text)) { header = true; continue; }
    if (!text || /^[\s|+\-]+$/.test(text)) continue;
    const match = text.match(/^([A-Z][A-Z0-9_]*)\s*\|\s*([a-f0-9]{64})\s*$/);
    if (!match || rows.has(match[1])) throw new Error('SECRET_INVENTORY_UNKNOWN_OR_DUPLICATE_ROW');
    rows.set(match[1], match[2]);
  }
  if (!header || rows.size === 0) throw new Error('SECRET_INVENTORY_UNVERIFIED');
  return rows;
};
const before = inventory();
if (before.has('FEATURE_FLAGS_JSON')) throw new Error('EXISTING_CONFIGURATION_REQUIRES_SAFE_PRIVATE_MERGE_NO_OVERWRITE');
const keys = JSON.parse(cli(['projects', 'api-keys', '--project-ref', project, '--output', 'json']));
const serviceKey = keys.find(key => key.name === 'service_role')?.api_key;
if (!serviceKey) throw new Error('ADMIN_LOOKUP_CREDENTIAL_UNAVAILABLE');
const response = await fetch(`https://${project}.supabase.co/auth/v1/admin/users?filter=${encodeURIComponent(email)}&per_page=100`, {
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, signal: AbortSignal.timeout(15000),
});
if (!response.ok) throw new Error('ADMIN_ACCOUNT_LOOKUP_FAILED');
const { users } = await response.json(); const matches = users.filter(user => user.email?.toLowerCase() === email);
if (matches.length !== 1 || !matches[0].email_confirmed_at || !/^[a-f0-9-]{36}$/i.test(matches[0].id)) throw new Error('EXACT_CONFIRMED_APPROVED_ACCOUNT_REQUIRED');
const config = { public_parcel_intelligence: { enabled: true, environments: ['production'], percentage: 100, internalUserIds: [matches[0].id] } };
const directory = await mkdtemp(join(tmpdir(), 'ds-parcel-preview-'));
const envFile = join(directory, 'preview.env');
try {
  const recheck = inventory();
  if (recheck.size !== before.size || [...before].some(([name, digest]) => recheck.get(name) !== digest)) throw new Error('SECRET_INVENTORY_CHANGED_ABORT_NO_WRITE');
  const configText = JSON.stringify(config);
  await writeFile(envFile, `FEATURE_FLAGS_JSON='${configText}'\n`, { mode: 0o600 });
  cli(['secrets', 'set', '--env-file', envFile, '--project-ref', project]);
  const updated = inventory();
  if (updated.size !== before.size + 1 || [...before].some(([name, digest]) => updated.get(name) !== digest)) throw new Error('OTHER_SECRET_INTEGRITY_NOT_CONFIRMED');
  if (updated.get('FEATURE_FLAGS_JSON') !== createHash('sha256').update(configText).digest('hex')) throw new Error('EXACT_FLAG_SECRET_WRITE_NOT_CONFIRMED');
  console.log(JSON.stringify({ status: 'CONFIGURED_EXISTING_FLAG', approvedAccountCount: 1, generalPublicExposure: 'DISABLED',
    envChanged: ['FEATURE_FLAGS_JSON'], existingConfigOverwritten: false, unchangedPriorSecretCount: before.size,
    functionRedeployRequired: false, authenticatedProductionValidation: 'BLOCKED_NO_USER_SESSION' }));
} finally {
  // Delete exactly our own ephemeral UUID-only config; never recurse or touch
  // a workspace/home directory. No service credential was written to disk.
  if (resolve(dirname(envFile)) !== resolve(directory) || !resolve(directory).startsWith(resolve(tmpdir()) + '\\') && process.platform === 'win32') throw new Error('TEMP_TARGET_OUTSIDE_EXPECTED_DIRECTORY');
  await unlink(envFile).catch(error => { if (error.code !== 'ENOENT') throw error; });
  await rmdir(directory);
}
