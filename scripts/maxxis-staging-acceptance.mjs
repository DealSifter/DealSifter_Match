import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import {
  frontendSourceHash,
  git,
  localFunctionInventory,
  parseFunctionRows,
  readJson,
  root,
} from './release-safety-lib.mjs';
import {
  MAXXIS_STAGING_PROJECT_REF,
  validateAcceptanceEnvironment,
  validateBaselineLock,
} from './maxxis-acceptance-lib.mjs';

const args = new Set(process.argv.slice(2));
const targetArg = process.argv.find((value) => value.startsWith('--target='));
const target = targetArg?.slice('--target='.length) || process.env.TARGET_ENV || '';
const varianceCheck = args.has('--variance-check');
const startedAt = new Date();
const runId = `r2-${startedAt.toISOString().replace(/[^0-9]/g, '').slice(0, 14)}-${process.pid}`;
const artifactDirectory = resolve(root, 'artifacts/heartbeat');
const artifactPath = resolve(artifactDirectory, `heartbeat-${startedAt.toISOString().replace(/[:.]/g, '-')}.json`);
const rawResultPath = resolve(artifactDirectory, `.raw-${runId}.json`);
const lifecyclePath = resolve(artifactDirectory, `.fixture-${runId}.json`);

mkdirSync(artifactDirectory, { recursive: true });

function safeReadJson(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeArtifact(value) {
  writeFileSync(artifactPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  console.log(`[maxxis-acceptance] artifact=${relative(root, artifactPath).replaceAll('\\', '/')}`);
}

function blocked(status, classification, reason, evidence = {}) {
  const artifact = {
    schemaVersion: 1,
    authority: 'REAL_RUNTIME',
    runId,
    target,
    projectRef: process.env.SUPABASE_PROJECT_REF || '',
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    mode: varianceCheck ? 'VARIANCE_CHECK' : 'STANDARD',
    status,
    classification,
    reason,
    realGemini: false,
    stub: false,
    fixture: { setup: 'NOT_STARTED', cleanup: 'NOT_STARTED' },
    evidence,
    results: [],
  };
  writeArtifact(artifact);
  console.error(`[maxxis-acceptance] status=${status} classification=${classification} reason=${reason}`);
  process.exit(2);
}

const environment = validateAcceptanceEnvironment({
  target,
  projectRef: process.env.SUPABASE_PROJECT_REF,
  supabaseUrl: process.env.E2E_SUPABASE_URL,
  anonKey: process.env.E2E_SUPABASE_ANON_KEY,
  serviceRoleKey: process.env.E2E_SUPABASE_SERVICE_ROLE_KEY,
  backendMode: process.env.E2E_BACKEND_MODE,
  llmMode: process.env.E2E_LLM_MODE,
  stubValue: process.env.MAXXIS_E2E_LLM_STUB,
});
if (!environment.ok) blocked(environment.status, environment.classification, environment.reason);

const contract = readJson('config/heartbeat-contract.json');
const baseline = readJson('config/heartbeat-baseline-r1.json');
const baselineLock = validateBaselineLock(contract, baseline);
if (!baselineLock.ok) blocked('BLOCKED_CONTRACT', 'CONTRACT', baselineLock.reason);

const manifest = readJson('config/release-manifest.json');
const receipts = readJson('config/function-deployments.json');
const candidateSha = git('rev-parse', 'HEAD');
const maxxisChat = localFunctionInventory().find((item) => item.name === 'maxxis-chat');
const receipt = receipts.staging?.['maxxis-chat'];
if (!maxxisChat || !receipt || receipt.status !== 'IN_SYNC' || receipt.projectRef !== MAXXIS_STAGING_PROJECT_REF || receipt.combinedHash !== maxxisChat.combinedHash) {
  blocked('BLOCKED_STALE_FUNCTION', 'CONTRACT', 'MAXXIS_CHAT_RECEIPT_NOT_IN_SYNC', {
    candidateSha,
    localHash: maxxisChat?.combinedHash || 'missing',
    receiptHash: receipt?.combinedHash || 'missing',
  });
}
try {
  git('merge-base', '--is-ancestor', receipt.deployedFromSha, candidateSha);
} catch {
  blocked('BLOCKED_STALE_FUNCTION', 'CONTRACT', 'DEPLOYED_SHA_NOT_IN_CANDIDATE_HISTORY');
}

function remoteMaxxisChat() {
  try {
    const output = execFileSync('supabase', ['functions', 'list', '--project-ref', MAXXIS_STAGING_PROJECT_REF], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return parseFunctionRows(output).find((item) => item.name === 'maxxis-chat') || null;
  } catch {
    return null;
  }
}

const remoteBefore = remoteMaxxisChat();
if (!remoteBefore) blocked('BLOCKED_INFRA', 'INFRASTRUCTURE', 'REMOTE_FUNCTION_INVENTORY_UNAVAILABLE');
if (Number(remoteBefore.version) !== Number(receipt.remoteVersion) || remoteBefore.updatedAt !== receipt.remoteUpdatedAt) {
  blocked('BLOCKED_STALE_FUNCTION', 'CONTRACT', 'REMOTE_FUNCTION_RECEIPT_MISMATCH', {
    candidateSha,
    localHash: maxxisChat.combinedHash,
    receiptVersion: receipt.remoteVersion,
    remoteVersion: remoteBefore.version,
  });
}

const playwrightCli = resolve(root, 'node_modules/@playwright/test/cli.js');
if (!existsSync(playwrightCli)) blocked('BLOCKED_INFRA', 'ENVIRONMENT', 'PLAYWRIGHT_NOT_INSTALLED');

const childEnvironment = {
  ...process.env,
  E2E_RUN_ID: runId,
  E2E_BACKEND_MODE: 'real',
  E2E_LLM_MODE: 'real',
  E2E_HEARTBEAT_VARIANCE_CHECK: varianceCheck ? '1' : '0',
  E2E_HEARTBEAT_CASE: '',
  E2E_HEARTBEAT_REPEAT: '',
  E2E_HEARTBEAT_RESULT_FILE: rawResultPath,
  E2E_HEARTBEAT_LIFECYCLE_FILE: lifecyclePath,
};
delete childEnvironment.MAXXIS_E2E_LLM_STUB;

console.log(
  `[maxxis-acceptance] status=RUNNING target=staging projectRef=${MAXXIS_STAGING_PROJECT_REF} ` +
  `candidateSha=${candidateSha} maxxisChatVersion=${remoteBefore.version} variance=${varianceCheck}`,
);
const execution = spawnSync(process.execPath, [
  playwrightCli,
  'test',
  'e2e/tests/real-gemini/maxxis-heartbeat-r0.spec.js',
  '--config=playwright.real-gemini.config.js',
], {
  cwd: root,
  env: childEnvironment,
  stdio: 'inherit',
});

const raw = safeReadJson(rawResultPath, { results: [], summary: { status: 'INCOMPLETE' } });
const lifecycle = safeReadJson(lifecyclePath, { setup: 'UNKNOWN', cleanup: 'UNKNOWN' });
const remoteAfter = remoteMaxxisChat();
const runtimeChanged = !remoteAfter || remoteAfter.version !== remoteBefore.version || remoteAfter.updatedAt !== remoteBefore.updatedAt;
const realGemini = raw.results.length > 0 && raw.results.every((item) => item.provider === 'gemini');
const fixtureComplete = lifecycle.setup === 'PASS' && lifecycle.cleanup === 'PASS';
const heartbeatPass = raw.summary?.status === 'PASS' && raw.summary?.pass === 10 && raw.summary?.fail === 0 && raw.summary?.flaky === 0;
let status = 'PASS';
let classification = '';
let reason = 'OK';
if (runtimeChanged) {
  status = 'INCOMPLETE';
  classification = 'INFRASTRUCTURE';
  reason = 'RUNTIME_CHANGED_DURING_ACCEPTANCE';
} else if (!fixtureComplete) {
  status = 'INCOMPLETE';
  classification = 'FIXTURE';
  reason = 'FIXTURE_CLEANUP_INCOMPLETE';
} else if (!realGemini) {
  status = 'FAIL';
  classification = 'CONTRACT';
  reason = 'REAL_GEMINI_NOT_PROVEN';
} else if (!heartbeatPass || execution.status !== 0) {
  status = raw.summary?.flaky > 0 ? 'FLAKY' : 'FAIL';
  classification = raw.summary?.firstFailure?.classification || (execution.error ? 'INFRASTRUCTURE' : 'PRODUCT');
  reason = raw.summary?.firstFailure?.reason || (execution.error ? 'PLAYWRIGHT_EXECUTION_FAILED' : 'HEARTBEAT_FAILED');
}

const artifact = {
  schemaVersion: 1,
  authority: 'REAL_RUNTIME',
  runId,
  target: 'staging',
  projectRef: MAXXIS_STAGING_PROJECT_REF,
  startedAt: startedAt.toISOString(),
  completedAt: new Date().toISOString(),
  mode: varianceCheck ? 'VARIANCE_CHECK' : 'STANDARD',
  status,
  classification,
  reason,
  realGemini,
  stub: false,
  fixture: lifecycle,
  candidate: {
    beforeSha: baseline.sourceSha || baseline.releaseSha || 'not-recorded',
    afterSha: candidateSha,
    frontendSha: manifest.frontendSha || null,
    frontendSourceHash: frontendSourceHash(),
    frontendStagingSha: null,
    maxxisChatVersion: Number(remoteBefore.version),
    maxxisChatDeployHash: maxxisChat.combinedHash,
    migrationHeadStaging: manifest.migrationParity?.staging === 'PASS' ? manifest.migrationHead : null,
  },
  summary: raw.summary,
  results: raw.results,
};
writeArtifact(artifact);
for (const temporaryPath of [rawResultPath, lifecyclePath]) {
  if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
}
console.log(
  `[maxxis-acceptance] status=${status} realGemini=${realGemini} stub=false ` +
  `fixtureCleanup=${lifecycle.cleanup || 'UNKNOWN'} hbPass=${raw.summary?.pass || 0}`,
);
if (status !== 'PASS') process.exit(1);
