import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(readFileSync(resolve(root, 'supabase/functions-manifest.json'), 'utf8'));
const required = new Set((manifest.requiredSecrets || []).map(String));
const allowed = new Set([
  ...required,
  ...(manifest.optionalSecrets || []).map(String),
  ...(manifest.platformSecrets || []).map(String),
]);

const fail = (message) => {
  console.error(`[edge-secrets] ${message}`);
  process.exitCode = 1;
};

const parseSecretNames = (output) => String(output || '')
  .split(/\r?\n/)
  .filter((line) => /^\s*[^|]+\s*\|\s*[0-9a-f]{64}\s*$/i.test(line))
  .map((line) => line.split('|')[0].trim())
  .filter((name) => name && name !== 'NAME');

try {
  const output = execFileSync('supabase', ['secrets', 'list'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const remoteNames = parseSecretNames(output);
  const missing = [...required].filter((name) => !remoteNames.includes(name)).sort();
  const unexpected = remoteNames.filter((name) => !allowed.has(name)).sort();

  if (missing.length) fail(`missing required names: ${missing.join(', ')}`);
  if (unexpected.length) fail(`untracked names: ${unexpected.join(', ')}`);

  console.log(`[edge-secrets] remote=${remoteNames.length} required=${required.size}`);
  if (!process.exitCode) console.log('[edge-secrets] names-only preflight passed.');
} catch (error) {
  fail(`remote preflight failed: ${String(error?.stderr || error?.message || error).trim()}`);
}
