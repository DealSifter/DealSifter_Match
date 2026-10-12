import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const output = 'qa/public-parcel-intelligence/parcel-lens';
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const [targeted, serial, retry, runtime, regression, cameraRegression, manifest] = await Promise.all([
  json(`${output}/targeted-tests-final.json`), json(`${output}/full-tests-serial.json`), json(`${output}/full-tests-worker-retry.json`),
  json(`${output}/runtime-validation.json`), json(`${output}/map-regression-tests.json`),
  json(`${output}/native-camera-filter-regression.json`), json('dist/.vite/manifest.json'),
]);
const testFiles = [...serial.testResults, ...retry.testResults];
const full = { passed: serial.numPassedTests + retry.numPassedTests, total: serial.numTotalTests + retry.numTotalTests,
  files: new Set(testFiles.map(row => row.name)).size, mode:'FULL_SCOPE_WITH_ISOLATED_WORKER_STARTUP_RETRY_NOT_SINGLE_CLEAN_RUN',
  evidence:['full-tests-serial.json','full-tests-worker-retry.json'], originalInfrastructureErrorsRetained:true };
if (!targeted.success || serial.numFailedTests || !retry.success || retry.numPassedTests !== 20 || retry.testResults.length !== 1 || !retry.testResults[0].name.endsWith('MaxxisAnalysisGapResolution.interaction.test.jsx')
  || full.passed !== 1780 || full.total !== 1780 || full.files !== 208 || testFiles.some(row => row.status !== 'passed')) throw new Error('UNIT_ACCEPTANCE_NOT_PASSED');
if (runtime.results.length !== 5 || runtime.results.some(row => row.status !== 'PASS' || row.zoomOutExtraRequests !== 0 || row.calls.length !== 2) || runtime.paidProviderCalls !== 0) throw new Error('RUNTIME_ACCEPTANCE_NOT_PASSED');
if (regression.stats.expected !== 7 || regression.stats.unexpected || regression.errors.length || cameraRegression.stats.expected !== 1 || cameraRegression.stats.unexpected || cameraRegression.errors.length) throw new Error('MAP_REGRESSION_NOT_PASSED');
const lensEntry = Object.values(manifest).find(entry => entry.src === 'src/components/map/ParcelLensLayer.jsx');
const mapEntry = Object.values(manifest).find(entry => (entry.src === 'src/pages/MapView.jsx' || entry.name === 'MapView') && !entry.file.includes('-legacy-'));
const lens = await readFile(`dist/${lensEntry.file}`, 'utf8'); const map = await readFile(`dist/${mapEntry.file}`, 'utf8');
if (!lens.includes('className:"ds-parcel-lens-circle",pathOptions:') || !lens.includes('pane:"popupPane"') || !map.includes('setOptions') || !map.includes('point(12,96)') || !map.includes('origin:"leaflet"')) throw new Error('FINAL_NATIVE_POPUP_CORRECTIONS_NOT_IN_BUILD');
const css = (await Promise.all((mapEntry.css || []).map(file => readFile(`dist/${file}`, 'utf8')))).join('\n');
if (!css.includes('.ds-property-leaflet-popup.ds-parcel-popup .leaflet-popup-content')) throw new Error('FINAL_NEIGHBOR_WIDTH_CORRECTION_NOT_IN_BUILD');
const hash = content => createHash('sha256').update(content).digest('hex');
const sourceFiles = ['src/pages/MapView.jsx', 'src/components/map/PropertyPinPopup.jsx', 'src/components/map/ParcelLensLayer.jsx', 'src/components/map/ParcelLens.css', 'src/features/parcel/parcelLensController.js', 'src/features/parcel/parcelLensGeometry.js', 'supabase/functions/_shared/featureFlags.ts'];
const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async path => [path, hash(await readFile(path))])));
const result = {
  observedAt: new Date().toISOString(), implementation: 'PASS',
  targetedTests: { passed: targeted.numPassedTests, total: targeted.numTotalTests, files: targeted.testResults.length },
  fullTests: full,
  mapRegressionTests: { passed: regression.stats.expected, failed: regression.stats.unexpected, finalNativeCameraFilterRetryPassed:cameraRegression.stats.expected },
  runtimeMode: runtime.mode, runtimeCases: runtime.results.length,
  typecheck: 'PASS_CONTRACTS_AND_BOTH_AFFECTED_DENO_ROOTS', lint: 'PASS_FULL_SRC_AND_AFFECTED_FILES', build: 'PASS_FINAL_NATIVE_CORRECTIONS_PRESENT',
  builtChunks: { lens: lensEntry.file, map: mapEntry.file, css:mapEntry.css, lensSha256: hash(lens), mapSha256: hash(map), cssSha256:hash(css) }, sourceHashes,
  featureFlags: { public_parcel_intelligence: 'EXISTING_AUTHENTICATED_INTERNAL_COHORT_ONLY', public_parcel_qa_grid: 'OFF_DEFAULT' },
  publicUserExposure: 'DISABLED', productionAuthenticatedValidation: 'PENDING_NO_USER_SESSION',
  parcelRequestsPerActivation: 2, extraZoomOutRequests: 0, paidProviderCalls: 0,
  sourcesChanged: false, migration: 'NONE', maxxisParcelConsumption: false, canonicalFactsChanged: false, reportsChanged: false,
};
await writeFile(`${output}/full-suite-coverage.json`,JSON.stringify(full,null,2)+'\n');
await writeFile(`${output}/quality-readiness.json`, JSON.stringify(result, null, 2)+'\n');
console.log(JSON.stringify({implementation:result.implementation, fullTests:result.fullTests, runtimeCases:result.runtimeCases, build:result.build}));
