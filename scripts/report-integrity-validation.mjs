import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

const root = process.cwd();
const qa = 'qa/report-integrity-final';
const baseline = '04950e1';
const argv = process.argv.slice(2);
const option = name => {
  const inline = argv.find(value => value.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[index + 1] : null;
};
const normalized = value => value.replace(/\r\n/g, '\n');
const sha = value => createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', ['--no-optional-locks', '-c', 'core.safecrlf=false', ...args], {
  encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, windowsHide: true,
});
const gitPaths = (...paths) => git('ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...paths).split('\0').filter(Boolean);
const save = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};
const read = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const safePath = path => {
  const target = resolve(root, path), within = relative(root, target);
  if (!within || within.startsWith('..') || isAbsolute(within)) throw new Error(`OUT_OF_WORKSPACE_PATH:${path}`);
  return target;
};
function sourceBinding() {
  const paths = [...new Set(gitPaths('src', 'supabase/functions', 'scripts', 'tsconfig.contracts.json', 'tsconfig.report-integrity.json', 'vite.config.js'))]
    .filter(path => /\.(?:[cm]?[jt]sx?|json)$/.test(path) && existsSync(path)).sort();
  const sourceHashes = Object.fromEntries(paths.map(path => [path, sha(normalized(readFileSync(path, 'utf8')))]));
  return { sourceDigest: sha(JSON.stringify(sourceHashes)), sourceHashes };
}
function runNode(name, args, logFile) {
  const startedAt = new Date().toISOString();
  let exitCode = 0, output = '';
  try { output = execFileSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 48 * 1024 * 1024, windowsHide: true }); }
  catch (error) { exitCode = typeof error.status === 'number' ? error.status : 1; output = `${error.stdout || ''}${error.stderr || ''}${error.message || ''}`; }
  if (logFile) { mkdirSync(dirname(logFile), { recursive: true }); writeFileSync(logFile, output); }
  return { name, args, startedAt, finishedAt: new Date().toISOString(), exitCode, logFile, pass: exitCode === 0 };
}
function finish(path, result) {
  save(path, result);
  console.log(JSON.stringify({ receipt: path, pass: result.pass, ...('tests' in result ? { tests: result.tests, failed: result.failed } : {}), ...('missingReceipts' in result ? { missingReceipts: result.missingReceipts } : {}) }));
  if (!result.pass) process.exitCode = 1;
}

if (argv.includes('--help')) {
  console.log('Usage: node scripts/report-integrity-validation.mjs --source | --binding | --static | --isolation | --tests=targeted | --tests=full | --tests=path1.test.js,path2.test.jsx | --consolidate');
  console.log('Full suite runs only for the explicit --tests=full argument. Default mode consolidates existing receipts; it never executes tests/build/providers.');
  process.exit(0);
}
mkdirSync(qa, { recursive: true });

if (argv.includes('--source')) {
  const result = { generatedAt: new Date().toISOString(), ...sourceBinding() };
  save(`${qa}/source-before-build.json`, result);
  console.log(JSON.stringify({ receipt: `${qa}/source-before-build.json`, sourceDigest: result.sourceDigest }));
} else if (argv.includes('--binding')) {
  const current = sourceBinding();
  const beforePath = `${qa}/source-before-build.json`, buildPath = `${qa}/build.json`, denoPath = `${qa}/deno-baseline-comparison.json`, closurePath = `${qa}/backend-dependency-closure.json`;
  const before = existsSync(beforePath) ? read(beforePath) : null;
  const build = existsSync(buildPath) ? read(buildPath) : null;
  const deno = existsSync(denoPath) ? read(denoPath) : null;
  const closure = existsSync(closurePath) ? read(closurePath) : null;
  const stage = safePath(option('--stage') || process.env.REPORT_INTEGRITY_BUILD_STAGE || '.cache/smart-property-release');
  const browserSources = Object.keys(current.sourceHashes).filter(path => path.startsWith('src/') || path.startsWith('supabase/functions/_shared/'));
  const buildSourceMismatch = browserSources.filter(path => !existsSync(resolve(stage, path)) || sha(normalized(readFileSync(resolve(stage, path), 'utf8'))) !== current.sourceHashes[path]);
  const backendModules = [...(closure?.changedSharedModules || []), ...(closure?.changedFunctionModules || [])];
  const denoSourceMismatch = backendModules.filter(path => !existsSync(path) || deno?.sourceHashes?.[path] !== sha(normalized(readFileSync(path, 'utf8'))));
  const bundlePath = resolve(stage, 'dist/index.html');
  const result = { stage: relative(root, stage).replaceAll('\\', '/'), buildPass: build?.pass === true,
    preBuildSourceMatches: before?.sourceDigest === current.sourceDigest, buildSourceMismatch, denoSourceMismatch,
    denoPass: deno?.pass === true && deno?.newErrors === 0, stagedBuildExists: existsSync(bundlePath),
    stagedIndexSha256: existsSync(bundlePath) ? sha(readFileSync(bundlePath)) : null, ...current,
    pass: build?.pass === true && before?.sourceDigest === current.sourceDigest && !buildSourceMismatch.length
      && backendModules.length > 0 && deno?.pass === true && deno?.newErrors === 0 && !denoSourceMismatch.length && existsSync(bundlePath) };
  finish(`${qa}/source-binding.json`, result);
  if (result.pass) save(buildPath, { ...build, sourceDigest: current.sourceDigest, sourceBindingReceipt: `${qa}/source-binding.json` });
} else if (argv.includes('--static')) {
  const before = sourceBinding();
  const checks = [
    runNode('lint', ['node_modules/eslint/bin/eslint.js', 'src/', '--max-warnings=0'], `${qa}/static-lint.log`),
    runNode('typecheck-contracts', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.contracts.json'], `${qa}/static-contracts.log`),
    runNode('typecheck-reports', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.report-integrity.json'], `${qa}/static-reports.log`),
  ];
  const after = sourceBinding();
  finish(`${qa}/static-checks.json`, { baseline, checks, ...after, sourcesUnchangedDuringRun: before.sourceDigest === after.sourceDigest,
    pass: checks.every(row => row.pass) && before.sourceDigest === after.sourceDigest });
} else if (argv.includes('--isolation')) {
  const baselineFrontend = '.cache/report-integrity-baseline-frontend.json';
  if (existsSync(baselineFrontend)) copyFileSync(baselineFrontend, `${qa}/frontend-production-before.json`);
  const enginePaths = [
    ...['dealMetrics', 'scenarioEngine', 'dealDecisionContext', 'landMetrics', 'landDevelopmentScenario', 'analyticalPropertyFacts', 'analyticalPropertyContext', 'areaMetrics', 'areaAnalyticalAnswer', 'marketReferenceAnswer', 'cachedArvEvaluation', 'rehabCostBenchmarks2026', 'sellerFinancingScenario'].map(name => `supabase/functions/_shared/maxxis/${name}.ts`),
    ...['arvEngine', 'arvVisualCompReview', 'recentSalesMarketEstimate', 'recordedSoldManualValidation', 'soldCache', 'soldCompEngine', 'soldEvidenceService', 'soldManualValidation', 'soldMapper', 'soldProvider', 'soldSchema', 'soldTypes'].map(name => `supabase/functions/_shared/property-data/${name}.ts`),
  ];
  const mapPaths = [...new Set(gitPaths('src/pages/MapView.jsx', 'src/components/map', 'src/features/parcel'))].filter(path => /\.(?:[jt]sx?)$/.test(path) && !/\.(?:test|spec)\./.test(path));
  const compare = path => {
    try {
      const oldSource = normalized(git('show', `${baseline}:${path}`));
      const current = normalized(readFileSync(path, 'utf8'));
      return { path, unchanged: oldSource === current, baselineSha256: sha(oldSource), currentSha256: sha(current) };
    } catch (error) { return { path, unchanged: false, error: String(error.message).slice(0, 240) }; }
  };
  const engines = enginePaths.map(compare), mapFiles = mapPaths.map(compare);
  const migrationChanges = git('diff', '--name-status', baseline, '--', 'supabase/migrations').trim().split('\n').filter(Boolean);
  const untrackedMigrations = git('ls-files', '-z', '--others', '--exclude-standard', '--', 'supabase/migrations').split('\0').filter(Boolean);
  const pass = engines.length === 25 && engines.every(row => row.unchanged) && mapFiles.length > 0 && mapFiles.every(row => row.unchanged) && !migrationChanges.length && !untrackedMigrations.length;
  finish(`${qa}/financial-engine-isolation.json`, { baseline, engines, mapFiles, engineCount: engines.length, migration: migrationChanges.length || untrackedMigrations.length ? 'CHANGED' : 'NONE', migrationChanges, untrackedMigrations,
    financialEnginesSourceUnchanged: engines.every(row => row.unchanged),
    ...sourceBinding(), pass });
} else if (argv.includes('--tests') || argv.some(value => value.startsWith('--tests='))) {
  const selection = option('--tests') || 'targeted';
  const full = selection === 'full';
  const targeted = [
    'src/features/maxxis/export/reportIntegrityViewModel.test.js',
    'src/features/maxxis/export/reportSavedScenarioProjection.test.js',
    'src/features/maxxis/intelligence/MaxxisDealIntelligenceReportPreview.test.jsx',
    'src/features/maxxis/intelligence/MaxxisStrictReportPreview.dom.test.jsx',
    'src/features/maxxis/export/maxxisReportTemplate.test.js',
    'src/features/maxxis/export/maxxisReportPerformance.test.js',
    'src/features/maxxis/export/maxxisReportTextContainment.test.js',
    'src/features/maxxis/export/maxxisReportExportDelivery.test.jsx',
    'src/features/maxxis/export/marketRentReport.test.js',
    'src/features/maxxis/export/landDevelopmentReport.test.js',
    'src/domain/maxxis/maxxisReportSchema.test.js',
    'src/services/presentationTranslation.test.jsx',
    'supabase/functions/_shared/presentationTranslationContract.vitest.test.ts',
    'supabase/functions/_shared/maxxis/dealThesisReportIntegrity.vitest.test.ts',
    'supabase/functions/_shared/maxxis/dealDecisionContext.vitest.test.ts',
    'supabase/functions/_shared/maxxis/maxxisStructuredAnalysis.vitest.test.ts',
    'supabase/functions/_shared/maxxis/financialEvidence.vitest.test.ts',
    'supabase/functions/_shared/property-data/marketRent.vitest.test.ts',
  ];
  const selected = full ? [] : selection === 'targeted' ? targeted : selection.split(',').filter(Boolean);
  for (const path of selected) if (!existsSync(safePath(path)) || !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path)) throw new Error(`INVALID_TEST_PATH:${path}`);
  const mode = full ? 'full' : 'targeted';
  const stamp = `${Date.now()}-${process.pid}`;
  const snapshotDirectory = `.cache/report-integrity-qa-snapshots/${stamp}`;
  const historical = git('ls-files', '-z', '--', 'qa').split('\0').filter(path => path && !path.startsWith('qa/report-integrity'));
  const snapshot = historical.map(path => {
    safePath(path);
    if (!existsSync(path)) return { path, existed: false, sha256: null };
    const destination = `${snapshotDirectory}/${path}`;
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(path, destination);
    return { path, existed: true, sha256: sha(readFileSync(path)), snapshot: destination };
  });
  const before = sourceBinding();
  const rawFile = `${qa}/${mode}/vitest-raw.json`, logFile = `${qa}/${mode}/vitest.log`;
  mkdirSync(dirname(rawFile), { recursive: true });
  // Eliminate only this task-owned stale output, never user QA or arbitrary files.
  if (existsSync(rawFile)) unlinkSync(safePath(rawFile));
  let execution;
  const restored = [], restoreErrors = [];
  try { execution = runNode('vitest', ['node_modules/vitest/vitest.mjs', 'run', ...selected, '--reporter=json', `--outputFile=${rawFile}`], logFile); }
  finally {
    for (const item of snapshot) {
      try {
        if (item.existed) {
          if (!existsSync(item.path) || sha(readFileSync(item.path)) !== item.sha256) { mkdirSync(dirname(item.path), { recursive: true }); copyFileSync(item.snapshot, item.path); restored.push(item.path); }
          if (sha(readFileSync(item.path)) !== item.sha256) throw new Error('RESTORED_BYTES_MISMATCH');
        } else if (existsSync(item.path)) { unlinkSync(safePath(item.path)); restored.push(item.path); }
      } catch (error) { restoreErrors.push({ path: item.path, error: String(error.message) }); }
    }
    save(`${qa}/${mode}/historical-qa-preservation.json`, { snapshotDirectory, trackedFiles: historical.length, preservedPreexistingDirtyBytes: true, excludedPrefix: 'qa/report-integrity', restored, errors: restoreErrors, pass: restoreErrors.length === 0 });
  }
  let raw = null;
  try { raw = read(rawFile); } catch { /* Startup failure is FAIL, not a stale/empty PASS. */ }
  const after = sourceBinding();
  const tests = raw?.numTotalTests || 0, passed = raw?.numPassedTests || 0, failed = raw?.numFailedTests || 0;
  const result = { baseline, selection: full ? 'FULL_EXPLICIT_REQUEST' : selected, execution, rawFile, rawSha256: raw ? sha(readFileSync(rawFile)) : null,
    files: raw?.testResults?.length || 0, suites: raw?.numTotalTestSuites || 0, tests, passed, failed, skipped: raw?.numPendingTests || 0,
    failures: (raw?.testResults || []).filter(row => row.status !== 'passed').map(row => ({ name: row.name, status: row.status, message: row.message })),
    historicalQaRestored: restoreErrors.length === 0, sourcesUnchangedDuringRun: before.sourceDigest === after.sourceDigest, ...after,
    pass: execution?.pass === true && raw?.success === true && tests > 0 && failed === 0 && passed > 0 && restoreErrors.length === 0 && before.sourceDigest === after.sourceDigest };
  finish(`${qa}/${mode}/tests.json`, result);
} else {
  const current = sourceBinding(), missingReceipts = [], gate = (id, pass, detail = '') => ({ id, pass: pass === true, detail });
  const required = name => {
    const path = `${qa}/${name}.json`;
    if (!existsSync(path)) { missingReceipts.push(path); return null; }
    try { return read(path); } catch { missingReceipts.push(`${path}:INVALID_JSON`); return null; }
  };
  const staticChecks = required('static-checks'), isolation = required('financial-engine-isolation'), targeted = required('targeted/tests'), full = required('full/tests');
  const golden = required('golden-report-validation'), visual = required('manual-visual-review'), build = required('build'), deno = required('deno-baseline-comparison'), browser = required('browser-validation'), binding = required('source-binding');
  const bindingMatches = receipt => receipt?.sourceDigest === current.sourceDigest;
  const pdfRecords = readdirSync(qa).filter(name => /^golden-.+-validation\.json$/.test(name) && name !== 'golden-report-validation.json').map(name => {
    try { return read(`${qa}/${name}`); } catch { return null; }
  }).filter(record => record?.renderedState);
  const pdfFiles = pdfRecords.map(record => {
    const path = `${qa}/${record.basename}.pdf`, text = `${qa}/${record.basename}-text.txt`;
    const imagePaths = Array.from({ length: record.pages || 0 }, (_, index) => `${qa}/${record.basename}-page-${index + 1}.png`);
    return { basename: record.basename, fixture: record.fixture, language: record.language, level: record.level,
      pdfSha256: existsSync(path) ? sha(readFileSync(path)) : null,
      pass: record.pass === true && existsSync(path) && existsSync(text) && imagePaths.every(existsSync)
        && sha(readFileSync(path)) === record.pdfSha256 && record.rendererNetworkAttempts === 0 && record.rendererImageNetworkAttempts === 0 };
  });
  const fixtures = ['LOW_EVIDENCE_SELL', 'RENTAL_MARKET_RICH', 'LAND_CONFLICT', 'ARV_RICH', 'BUY_HOLD', 'MINIMAL'];
  const completeMatrix = fixtures.every(fixture => ['pt', 'en', 'es'].every(language => pdfFiles.some(row => row.fixture === fixture && row.language === language && row.level === 'DEAL_INTELLIGENCE' && row.pass)))
    && ['PROPERTY_RELEASE', 'MAXXIS_ANALYSIS'].every(level => ['LOW_EVIDENCE_SELL', 'RENTAL_MARKET_RICH'].every(fixture => ['pt', 'en', 'es'].every(language => pdfFiles.some(row => row.fixture === fixture && row.language === language && row.level === level && row.pass))));
  const goldenSourceMatch = golden?.sourceHashes && Object.keys(golden.sourceHashes).length > 0 && Object.entries(golden.sourceHashes).every(([path, hash]) => existsSync(path) && sha(readFileSync(path)) === hash);
  const reviewed = Array.isArray(visual?.reviewedReports) ? visual.reviewedReports : [];
  const visualBound = reviewed.length >= 6 && fixtures.every(fixture => reviewed.some(row => row.fixture === fixture && row.pass === true
    && pdfFiles.some(pdf => pdf.basename === row.basename && pdf.fixture === fixture && pdf.level === 'DEAL_INTELLIGENCE' && pdf.pdfSha256 === row.pdfSha256 && pdf.pass)));
  const denoBound = deno?.sourceHashes && Object.keys(deno.sourceHashes).length > 0 && Object.entries(deno.sourceHashes).every(([path, hash]) => existsSync(path) && [sha(readFileSync(path)), sha(normalized(readFileSync(path, 'utf8')))].includes(hash));
  const gates = [
    gate('TARGETED_TESTS', targeted?.pass && bindingMatches(targeted)), gate('FULL_TESTS', full?.pass && bindingMatches(full)),
    gate('STATIC', staticChecks?.pass && bindingMatches(staticChecks)), gate('ISOLATION', isolation?.pass && isolation.engineCount === 25 && bindingMatches(isolation)),
    gate('THIRTY_ACTUAL_PDFS', golden?.pass && golden.reportCount === 30 && golden.actualPdfArtifacts === 30 && golden.goldenFixtureCount === 6 && pdfFiles.length === 30 && pdfFiles.every(row => row.pass) && completeMatrix && goldenSourceMatch),
    gate('MANUAL_VISUAL_REVIEW', visual?.pass && visual.executiveWowPass && visualBound),
    gate('OFFLINE_RENDERER', golden?.actualRentCastCalls === 0 && golden?.actualGISCalls === 0 && golden?.reportReopenProviderCalls === 0 && golden?.networkAttempts?.length === 0 && golden?.imageNetworkAttempts?.length === 0),
    gate('BUILD', build?.pass && bindingMatches(build)), gate('DENO', deno?.pass && deno.newErrors === 0 && denoBound),
    gate('SOURCE_BINDING', binding?.pass && bindingMatches(binding)),
    gate('BROWSER', browser?.pass && bindingMatches(browser) && browser.realBackendWrites === 0 && browser.reviewCases >= 6 && browser.mapTransitions >= 10 && browser.photoHandoffs >= 2 && browser.errors === 0),
  ];
  finish(`${qa}/quality-gates.json`, { baseline, generatedAt: new Date().toISOString(), gates, missingReceipts, actualPdfChecks: pdfFiles,
    authenticatedProductionSmoke: 'BLOCKED', authenticatedProductionSmokeReason: 'NO_LEGITIMATE_REAL_USER_SESSION_AVAILABLE',
    ...current, pass: !missingReceipts.length && gates.every(row => row.pass) });
}
