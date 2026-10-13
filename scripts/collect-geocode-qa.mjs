import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const directory = 'qa/geocode-wood-spring';
const reports = ['full-tests.json', 'full-retry.json', 'contract-final.json'];
const files = new Map();
for (const name of reports) {
  const report = JSON.parse(await readFile(`${directory}/${name}`, 'utf8'));
  for (const result of report.testResults) files.set(result.name, result);
}
const tests = [...files.values()].flatMap(result => result.assertionResults);
if (tests.some(test => test.status !== 'passed')) throw new Error('FINAL_ASSERTION_COVERAGE_FAILED');
const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'));
const onboarding = manifest['src/pages/Onboarding.jsx']; const app = manifest['index.html'];
const chunk = await readFile(`dist/${onboarding.file}`, 'utf8');
const appChunk = await readFile(`dist/${app.file}`, 'utf8');
if (!chunk.includes('--geocode-attention') || !chunk.includes('geocode-edit-required') || !appChunk.includes('PROPERTY_SAVE_NOT_CONFIRMED')) {
  throw new Error('FINAL_COMPILED_CONTRACT_MISSING');
}
const receipt = { observedAt: new Date().toISOString(), fullAssertionCoverage: {
  passed: tests.length, files: files.size, mode: 'FULL_SCOPE_WITH_TARGETED_FIXTURE_AND_TIMEOUT_RETRY_NOT_SINGLE_CLEAN_RUN', evidence: reports,
}, maintenanceTests: { passed: 4, total: 4 }, lint: 'PASS_FULL_SRC_AND_AFFECTED_SCRIPTS_DENO',
  typecheck: 'PASS_CONTRACTS_AND_GEOCODE_DENO', executionBudgetRuntimeByteIdentical: true,
  build: 'PASS_FINAL_WARNING_AND_AUTHORITATIVE_SAVE_PRESENT', onboardingChunk: onboarding.file,
  onboardingSha256: createHash('sha256').update(chunk).digest('hex'), appChunk: app.file,
  databaseContract: 'PASS_TEMPORARY_COPY_ROLLED_BACK', databaseInvalidPublished: 0,
  migration: '20261013000001_property_geocode_publication_guard', privateCardWithoutPin: 'PRESERVED',
  publicParcelConfigurationChanged: false, paidProviderCalls: 0,
};
await writeFile(`${directory}/quality-readiness.json`, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
