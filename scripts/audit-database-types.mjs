import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const TYPE_FILE = new URL('../src/types/database.types.ts', import.meta.url);
const SNAPSHOT_FILE = new URL('../config/database-types.snapshot.json', import.meta.url);
const TYPE_SAFETY_FILE = new URL('../config/type-safety-baseline.json', import.meta.url);
const STAGING_REF = 'oqdcnjupquhybwdbeeew';
const PRODUCTION_REF = 'cyeipfskwwisbbayyaca';
const REQUIRED_CONTRACTS = [
  'properties:', 'services:', 'user_profiles:', 'chat_messages:', 'deal_workflow_items:',
  'ds_get_global_feed_inventory:', 'ds_save_professional_profile:',
  'ds_consume_edge_rate_limit:', 'ds_purchase_contact_unlock:',
  'ds_set_manual_deal_workflow_item:', 'ds_data_integrity_audit:', 'track_app_event:',
];

const normalize = (value) => String(value || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trimEnd() + '\n';
const digest = (value) => createHash('sha256').update(normalize(value)).digest('hex');
const committed = normalize(readFileSync(TYPE_FILE, 'utf8'));
const snapshot = JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf8'));
const typeSafety = JSON.parse(readFileSync(TYPE_SAFETY_FILE, 'utf8'));

const missing = REQUIRED_CONTRACTS.filter((contract) => !committed.includes(contract));
if (missing.length) {
  console.error(`[database-types] missing critical contracts: ${missing.join(', ')}`);
  process.exit(1);
}

const currentHash = digest(committed);
if (snapshot.sha256 !== currentHash || snapshot.projectRef !== STAGING_REF || snapshot.schema !== 'public') {
  console.error('[database-types] committed snapshot is stale; regenerate types and update the snapshot.');
  process.exit(1);
}

const dangerousAnyPattern = /\bas any\b|Record<string, any>|:\s*any\b|=>\s*any\b|<any>/g;
const dangerousAnyCount = typeSafety.scope.reduce((count, file) => (
  count + (readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').match(dangerousAnyPattern) || []).length
), 0);
if (dangerousAnyCount > typeSafety.dangerousAnyMaximum) {
  console.error(`[database-types] dangerous any regression=${dangerousAnyCount} limit=${typeSafety.dangerousAnyMaximum}`);
  process.exit(1);
}

if (process.argv.includes('--remote')) {
  const projectRef = String(process.env.SUPABASE_PROJECT_REF || STAGING_REF).trim();
  if (projectRef === PRODUCTION_REF) {
    console.error('[database-types] production type generation is blocked.');
    process.exit(1);
  }
  if (projectRef !== STAGING_REF) {
    console.error(`[database-types] unexpected project ref: ${projectRef}`);
    process.exit(1);
  }
  if (process.env.CI && !String(process.env.SUPABASE_ACCESS_TOKEN || '').trim()) {
    console.error('[database-types] SUPABASE_ACCESS_TOKEN is required for CI remote drift validation.');
    process.exit(1);
  }
  const command = process.platform === 'win32' ? 'supabase.exe' : 'supabase';
  const generated = spawnSync(command, ['gen', 'types', 'typescript', '--project-id', projectRef, '--schema', 'public'], {
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 5 * 1024 * 1024,
  });
  if (generated.status !== 0) {
    console.error(generated.stderr || generated.error?.message || '[database-types] Supabase generation failed.');
    process.exit(generated.status || 1);
  }
  if (normalize(generated.stdout) !== committed) {
    console.error('[database-types] schema/type drift detected against staging.');
    process.exit(1);
  }
  console.log(`[database-types] remote staging drift=0 contracts=${REQUIRED_CONTRACTS.length}`);
} else {
  console.log(`[database-types] snapshot=${currentHash.slice(0, 12)} contracts=${REQUIRED_CONTRACTS.length} dangerous-any=${typeSafety.dangerousAnyBefore}->${dangerousAnyCount} status=ok`);
}
