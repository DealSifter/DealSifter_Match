import { existsSync } from 'node:fs';
import {
  git,
  frontendSourceHash,
  localFunctionInventory,
  localMigrationInventory,
  parseArg,
  readJson,
  root,
} from './release-safety-lib.mjs';

const manifest = readJson('config/release-manifest.json');
const branch = git('branch', '--show-current');
const head = git('rev-parse', 'HEAD');
const originMain = git('rev-parse', 'origin/main');
const functions = localFunctionInventory();
const migrations = localMigrationInventory();
const currentFrontendSourceHash = frontendSourceHash();
const failures = [];

try {
  git('merge-base', '--is-ancestor', manifest.releaseSha, head);
} catch {
  failures.push('manifest releaseSha is not an ancestor of HEAD');
}
if (branch !== 'repair/maxxis-runtime' && !process.env.CI) {
  failures.push(`repairs must run from repair/maxxis-runtime, current=${branch || 'detached'}`);
}
if (manifest.releaseSha !== manifest.frontendSha) failures.push('frontendSha differs from releaseSha');
if (manifest.frontendSourceHash !== currentFrontendSourceHash) failures.push('frontend source hash differs from manifest');
if (manifest.migrationHead !== migrations.head || manifest.migrationCount !== migrations.count) {
  failures.push('local migration inventory differs from the versioned manifest');
}

const expected = [...manifest.expectedFunctions].sort();
const actual = functions.map((item) => item.name).sort();
if (JSON.stringify(expected) !== JSON.stringify(actual)) failures.push('local Edge Function inventory differs from manifest');
for (const item of functions) {
  const recorded = manifest.functionSourceHashes[item.name];
  if (!recorded || recorded.combinedHash !== item.combinedHash) {
    failures.push(`source hash drift: ${item.name}`);
  }
}

const affectedFunction = parseArg('affected-function');
if (affectedFunction) {
  if (!expected.includes(affectedFunction)) failures.push(`unknown affected function: ${affectedFunction}`);
  for (const target of ['staging', 'production']) {
    if (manifest.remoteFunctionParity?.[target] !== 'IN_SYNC') {
      failures.push(`${target} parity for affected function ${affectedFunction} is not IN_SYNC`);
    }
  }
}

const worktreeGitFile = existsSync(`${root}/.git`);
console.log(`[release-audit] branch=${branch} head=${head} originMain=${originMain}`);
console.log(`[release-audit] baseSha=${manifest.releaseSha} frontendSha=${manifest.frontendSha} frontendParity=${manifest.releaseSha === manifest.frontendSha ? 'PASS' : 'FAIL'}`);
console.log(`[release-audit] frontendSourceHash=${currentFrontendSourceHash} sourceContent=${manifest.frontendSourceHash === currentFrontendSourceHash ? 'VERIFIED' : 'DRIFT'}`);
console.log(`[release-audit] worktree=${worktreeGitFile ? 'linked' : 'primary'} expectedBranch=repair/maxxis-runtime`);
console.log(`[release-audit] functions=${actual.length} localHashes=VERIFIED staging=${manifest.remoteFunctionParity.staging} production=${manifest.remoteFunctionParity.production}`);
console.log(`[release-audit] migrations=${migrations.count} head=${migrations.head} staging=${manifest.migrationParity.staging} production=${manifest.migrationParity.production}`);
console.log('[release-audit] sentry=OPTIONAL_NON_BLOCKING');
if (failures.length) {
  failures.forEach((failure) => console.error(`[release-audit] FAIL ${failure}`));
  process.exitCode = 1;
} else {
  console.log('[release-audit] local source contract=PASS remote promotion authority=NOT_GRANTED');
}
