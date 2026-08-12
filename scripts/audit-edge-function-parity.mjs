import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const manifestPath = resolve(root, 'supabase/functions-manifest.json');
const functionsDir = resolve(root, 'supabase/functions');
const configPath = resolve(root, 'supabase/config.toml');
const checkRemote = process.argv.includes('--remote');

const fail = (message) => {
  console.error(`[edge-functions] ${message}`);
  process.exitCode = 1;
};

const parseRemoteRows = (output) => {
  try {
    const parsed = JSON.parse(output);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Supabase CLI 2.30 advertises JSON output but still renders the table.
  }
  return String(output || '')
    .split(/\r?\n/)
    .filter((line) => /^\s*[0-9a-f-]{36}\s*\|/i.test(line))
    .map((line) => {
      const columns = line.split('|').map((value) => value.trim());
      return { id: columns[0], name: columns[1], slug: columns[2] };
    });
};

if (!existsSync(manifestPath) || !existsSync(functionsDir) || !existsSync(configPath)) {
  throw new Error('Edge Function manifest, directory or Supabase config is missing.');
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const expectedRows = Array.isArray(manifest.functions) ? manifest.functions : [];
const expected = new Map(expectedRows.map((row) => [String(row.name || '').trim(), row]));
const localNames = readdirSync(functionsDir)
  .filter((name) => name !== '_shared')
  .filter((name) => statSync(resolve(functionsDir, name)).isDirectory())
  .sort();

const expectedNames = [...expected.keys()].filter(Boolean).sort();
const missingLocally = expectedNames.filter((name) => !localNames.includes(name));
const untrackedLocally = localNames.filter((name) => !expected.has(name));
if (missingLocally.length) fail(`missing local directories: ${missingLocally.join(', ')}`);
if (untrackedLocally.length) fail(`untracked local directories: ${untrackedLocally.join(', ')}`);

const config = readFileSync(configPath, 'utf8');
for (const [name, row] of expected) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const section = config.match(new RegExp(`\\[functions\\.${escaped}\\]([\\s\\S]*?)(?=\\n\\[|$)`));
  if (!section) {
    fail(`missing config.toml section for ${name}`);
    continue;
  }
  const jwtValue = section[1].match(/verify_jwt\s*=\s*(true|false)/i)?.[1]?.toLowerCase();
  if (jwtValue !== String(Boolean(row.verifyJwt))) {
    fail(`${name} verify_jwt mismatch: manifest=${Boolean(row.verifyJwt)} config=${jwtValue || 'missing'}`);
  }
}

if (checkRemote) {
  try {
    const output = execFileSync('supabase', ['functions', 'list', '--output', 'json'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const remoteRows = parseRemoteRows(output);
    const remoteNames = (Array.isArray(remoteRows) ? remoteRows : [])
      .map((row) => String(row.slug || row.name || '').trim())
      .filter(Boolean)
      .sort();
    const missingRemotely = expectedNames.filter((name) => !remoteNames.includes(name));
    const untrackedRemotely = remoteNames.filter((name) => !expected.has(name));
    if (missingRemotely.length) fail(`missing remote functions: ${missingRemotely.join(', ')}`);
    if (untrackedRemotely.length) fail(`untracked remote functions: ${untrackedRemotely.join(', ')}`);
    console.log(`[edge-functions] remote=${remoteNames.length} expected=${expectedNames.length}`);
  } catch (error) {
    fail(`remote audit failed: ${String(error?.stderr || error?.message || error).trim()}`);
  }
}

console.log(`[edge-functions] local=${localNames.length} expected=${expectedNames.length} config=explicit`);
if (!process.exitCode) console.log('[edge-functions] parity check passed.');
