import { execFileSync } from 'node:child_process';
import { localMigrationInventory, readJson, requireTarget } from './release-safety-lib.mjs';

const target = requireTarget();
const targets = readJson('config/release-targets.json');
const projectRef = targets[target].supabaseProjectRef;
const envName = target === 'production' ? 'SUPABASE_DB_URL_PRODUCTION' : 'SUPABASE_DB_URL_STAGING';
const dbUrl = String(process.env[envName] || '').trim();
const local = localMigrationInventory();

if (!dbUrl) {
  console.error(`[migration-parity] target=${target} local=${local.count} head=${local.head} status=UNKNOWN reason=${envName}_MISSING`);
  process.exit(2);
}

if (!dbUrl.includes(projectRef)) {
  console.error(`[migration-parity] target=${target} status=FAIL reason=TARGET_REF_MISMATCH`);
  process.exit(1);
}

let output = '';
try {
  output = execFileSync('supabase', ['migration', 'list', '--db-url', dbUrl], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch {
  console.error(`[migration-parity] target=${target} local=${local.count} head=${local.head} status=UNKNOWN reason=REMOTE_QUERY_FAILED`);
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
  `head=${local.head} missingRemote=${missingRemote.length} unexpectedRemote=${unexpectedRemote.length} status=${status}`,
);
if (status !== 'PASS') process.exitCode = 1;
