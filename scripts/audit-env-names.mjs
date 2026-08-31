import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { listFiles, parseArg, root } from './release-safety-lib.mjs';

const sourceDir = resolve(parseArg('source-dir') || process.env.ENV_AUDIT_SOURCE_DIR || root);
const baseline = process.argv.includes('--baseline');
const projectRefs = {
  staging: 'oqdcnjupquhybwdbeeew',
  production: 'cyeipfskwwisbbayyaca',
};
const sentryNames = new Set(['VITE_SENTRY_DSN', 'SENTRY_ORG', 'SENTRY_PROJECT', 'SENTRY_AUTH_TOKEN']);
const allowedPublic = new Set(['VITE_SENTRY_DSN']);
const searchableExtensions = /\.(?:cjs|js|jsx|json|md|mjs|ps1|ts|tsx|toml|ya?ml)$/i;
const searchableRoots = ['src', 'supabase', 'scripts', 'config', '.github']
  .map((name) => resolve(root, name))
  .filter(existsSync);
const searchableFiles = [
  ...searchableRoots.flatMap((path) => listFiles(path)),
  ...['vite.config.js', 'vercel.json', 'package.json']
    .map((name) => resolve(root, name))
    .filter(existsSync),
].filter((path) => searchableExtensions.test(path));
const searchableText = searchableFiles.map((path) => readFileSync(path, 'utf8')).join('\n');

if (!existsSync(sourceDir)) throw new Error(`Environment source directory does not exist: ${sourceDir}`);

const files = readdirSync(sourceDir)
  .filter((name) => name === '.env' || name === '.env.local' || name.startsWith('.env.'))
  .filter((name) => statSync(resolve(sourceDir, name)).isFile())
  .sort((a, b) => a === '.env' ? -1 : b === '.env' ? 1 : a.localeCompare(b));

const rows = [];
for (const filename of files) {
  const path = resolve(sourceDir, filename);
  const raw = readFileSync(path, 'utf8');
  const newline = raw.includes('\r\n') ? 'CRLF' : raw.includes('\n') ? 'LF' : 'NONE';
  let targetHint = 'shared';
  const loadGroup = filename === '.env.example'
    ? 'template'
    : filename === '.env' || filename === '.env.local'
      ? 'default-runtime'
      : `isolated:${filename}`;
  raw.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) targetHint = 'shared';
    const commentRef = Object.entries(projectRefs).find(([, ref]) => line.trim().startsWith('#') && line.includes(ref));
    if (commentRef) targetHint = commentRef[0];
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) return;
    const [, name, value] = match;
    let expectedTarget = targetHint;
    const valueTarget = Object.entries(projectRefs).find(([, ref]) => value.includes(ref));
    if (valueTarget) expectedTarget = valueTarget[0];
    rows.push({ filename, line: index + 1, name, value, expectedTarget, newline, loadGroup });
  });
}

let failures = 0;
for (const row of rows) {
  const sameFile = rows.filter((item) => item.filename === row.filename && item.name === row.name);
  const later = rows.filter((item) => item.name === row.name && item.loadGroup === row.loadGroup && (
    item.filename > row.filename || (item.filename === row.filename && item.line > row.line)
  ));
  const duplicate = sameFile.length > 1;
  const shadowed = later.length > 0;
  const empty = !row.value.trim();
  const exposedSecret = row.name.startsWith('VITE_') &&
    /(SECRET|SERVICE_ROLE|GEMINI_API_KEY|WEBHOOK|POSTGRES_PASSWORD)/i.test(row.name) &&
    !allowedPublic.has(row.name);
  const optional = sentryNames.has(row.name);
  const used = new RegExp(`\\b${row.name}\\b`).test(searchableText);
  const statuses = [];
  if (duplicate) statuses.push('DUPLICATE');
  if (shadowed) statuses.push('SHADOWED');
  if (empty) statuses.push(optional ? 'OPTIONAL_EMPTY' : 'EMPTY');
  if (exposedSecret) statuses.push('CLIENT_SECRET_NAME');
  if (optional) statuses.push('OPTIONAL_NON_BLOCKING');
  if (row.loadGroup === 'template') statuses.push('TEMPLATE_ONLY');
  if (!used && row.loadGroup !== 'template') statuses.push('UNUSED_CANDIDATE');
  if (!statuses.length) statuses.push('OK');
  if (duplicate || empty && !optional || exposedSecret) failures += 1;
  console.log(
    `[env] name=${row.name} source=${basename(sourceDir)}/${row.filename}:${row.line} ` +
    `loadGroup=${row.loadGroup} expectedTarget=${row.expectedTarget} duplicate=${duplicate} shadowed=${shadowed} ` +
    `newline=${row.newline} status=${statuses.join(',')}`,
  );
}

console.log(`[env] files=${files.length} entries=${rows.length} failures=${failures} sentry=OPTIONAL_NON_BLOCKING`);
if (failures && !baseline) process.exitCode = 1;
