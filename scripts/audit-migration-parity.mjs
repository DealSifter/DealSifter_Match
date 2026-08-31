import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { localMigrationInventory, parseArg, readJson, requireTarget, root } from './release-safety-lib.mjs';

function readEnvFile(path) {
  if (!path) return {};
  const values = {};
  for (const line of readFileSync(resolve(root, path), 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

const target = requireTarget();
const targets = readJson('config/release-targets.json');
const targetConfig = targets[target];
const projectRef = targetConfig.supabaseProjectRef;
const suffix = target.toUpperCase();
const urlName = `SUPABASE_DB_URL_${suffix}`;
const passwordName = `POSTGRES_PASSWORD_${suffix}`;
const fileValues = readEnvFile(parseArg('env-file'));
const dbUrl = String(process.env[urlName] || fileValues[urlName] || '').trim();
const password = String(process.env[passwordName] || fileValues[passwordName] || '').trim();
const local = localMigrationInventory();

if (!dbUrl && !password) {
  console.error(`[migration-parity] target=${target} local=${local.count} head=${local.head} status=UNKNOWN reason=MISSING_CREDENTIAL credential=${urlName}|${passwordName}`);
  process.exit(2);
}
if (!dbUrl && !targetConfig.db) {
  console.error(`[migration-parity] target=${target} local=${local.count} head=${local.head} status=UNKNOWN reason=MISSING_TARGET_CONNECTION_CONFIG required=${urlName}`);
  process.exit(2);
}

if (dbUrl && !dbUrl.includes(projectRef)) {
  console.error(`[migration-parity] target=${target} status=FAIL reason=TARGET_REF_MISMATCH`);
  process.exit(1);
}

let output = '';
try {
  const args = dbUrl
    ? ['migration', 'list', '--db-url', dbUrl]
    : ['migration', 'list', '--db-url', `postgresql://${targetConfig.db.user}:${encodeURIComponent(password)}@${targetConfig.db.host}:${targetConfig.db.port}/postgres`];
  output = execFileSync('supabase', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch {
  console.error(`[migration-parity] target=${target} local=${local.count} head=${local.head} status=UNKNOWN reason=REMOTE_QUERY_FAILED credentialSource=${dbUrl ? urlName : passwordName}`);
  process.exit(2);
}

const rows = output.split(/\r?\n/)
  .map((line) => line.match(/^\s*(\d+)\s*\|\s*(\d+)\s*\|/)?.slice(1, 3))
  .filter(Boolean);
const remote = rows.map(([, version]) => version).filter(Boolean);
const missingRemote = local.versions.filter((version) => !remote.includes(version));
const unexpectedRemote = remote.filter((version) => !local.versions.includes(version));
const status = missingRemote.length || unexpectedRemote.length ? 'FAIL' : 'PASS';
console.log(
  `[migration-parity] target=${target} local=${local.versions.length} remote=${remote.length} ` +
  `head=${local.head} missingRemote=${missingRemote.length} unexpectedRemote=${unexpectedRemote.length} ` +
  `credentialSource=${dbUrl ? urlName : passwordName} status=${status}`,
);
if (status !== 'PASS') process.exitCode = 1;
