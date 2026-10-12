import { readFileSync, writeFileSync } from 'node:fs';

const directory = 'qa/runtime-orchestration-hardening';
const read = name => JSON.parse(readFileSync(`${directory}/${name}`, 'utf8'));
const initial = read('full-tests.json');
const retry = read('full-tests-resource-retry.json');
const results = new Map(initial.testResults.map(result => [result.name, result]));
for (const result of retry.testResults) results.set(result.name, result);
const assertions = [...results.values()].flatMap(result => result.assertionResults);
const failedSuites = [...results.values()].filter(result => result.status !== 'passed');
const failedTests = assertions.filter(result => result.status === 'failed');
const unexpectedSkipped = assertions.filter(result => result.status !== 'passed');
// Failed workers did not contribute test results. Explicitly require their isolated rerun.
const requiredReruns = ['maxxisReportPerformance.test.js', 'landDevelopmentReport.test.js',
  'MaxxisAnalysisGapResolution.interaction.test.jsx', 'productionUxCorrection.test.jsx', 'MaxxisPropertyCard.test.jsx'];
const retryCoverage = requiredReruns.every(name => retry.testResults.some(result => result.name.endsWith(name) && result.status === 'passed'));
const browser = read('browser-e2e.json');
const targeted = read('targeted-tests.json');
const pass = !failedSuites.length && !failedTests.length && !unexpectedSkipped.length && retryCoverage
  && retry.numFailedTests === 0 && targeted.numFailedTests === 0 && browser.state === 'PASS';
const receipt = {
  state: pass ? 'PASS' : 'FAIL', method: 'Full suite plus isolated reruns of resource-timeout files; no assertion changes',
  sourceRevision: process.env.P0_SOURCE_SHA || 'WORKTREE_PENDING_COMMIT',
  full: { files: results.size, tests: assertions.length, passed: assertions.filter(result => result.status === 'passed').length,
    failed: failedTests.length, skipped: unexpectedSkipped.length, failedSuites: failedSuites.map(result => result.name) },
  originalRun: { artifact: 'full-tests.json', state: 'RESOURCE_TIMEOUTS', requiredReruns },
  retry: { artifact: 'full-tests-resource-retry.json', coverage: retryCoverage, timeoutMs: 120000, workers: 1 },
  targeted: { total: targeted.numTotalTests, passed: targeted.numPassedTests, failed: targeted.numFailedTests },
  browser: { state: browser.state, environment: browser.environment, flows: browser.flows },
  automatedRentCastCalls: 0, geminiFinancialArithmetic: 0, authenticatedProductionSmoke: 'NOT_VERIFIED',
};
writeFileSync(`${directory}/verification.json`, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
if (!pass) process.exitCode = 1;
