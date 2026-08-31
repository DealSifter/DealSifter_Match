import { frontendSourceHash, localFunctionInventory, localMigrationInventory, parseArg, git } from './release-safety-lib.mjs';

const releaseSha = parseArg('release-sha') || git('rev-parse', 'origin/main');
const frontendSha = parseArg('frontend-sha');
const generatedAt = parseArg('generated-at') || new Date().toISOString();

if (!/^[0-9a-f]{40}$/i.test(releaseSha)) throw new Error('A full release SHA is required.');
if (!/^[0-9a-f]{40}$/i.test(frontendSha)) throw new Error('A proven full frontend SHA is required.');

const functions = localFunctionInventory();
const migrations = localMigrationInventory();
const manifest = {
  schemaVersion: 1,
  kind: 'r0-source-baseline',
  releaseSha,
  frontendSha,
  frontendSourceHash: frontendSourceHash(),
  expectedFunctions: functions.map((item) => item.name),
  functionSourceHashes: Object.fromEntries(functions.map((item) => [item.name, {
    entrypoint: item.entrypoint,
    sourceHash: item.sourceHash,
    usesShared: item.usesShared,
    sharedHash: item.sharedHash,
    sharedFiles: item.sharedFiles,
    combinedHash: item.combinedHash,
  }])),
  migrationHead: migrations.head,
  migrationCount: migrations.count,
  remoteFunctionParity: {
    staging: 'POSSIBLY_STALE',
    production: 'POSSIBLY_STALE',
  },
  migrationParity: {
    staging: 'PASS',
    production: 'UNKNOWN',
  },
  generatedAt,
};

process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
