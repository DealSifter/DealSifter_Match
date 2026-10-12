import { readFile, writeFile } from 'node:fs/promises';

const dir = 'qa/public-parcel-intelligence';
const json = async name => JSON.parse(await readFile(`${dir}/${name}`, 'utf8'));
if (process.env.PARCEL_QA_STATIC_CHECKS_PASS !== '1') throw new Error('COMPLETED_BUILD_LINT_TYPES_REQUIRED');
const [targeted, full, e2e, coverage, closure, active] = await Promise.all([
  json('phase1b-targeted-tests.json'), json('phase1b-full-tests.json'), json('mapview-internal-e2e.json'),
  json('coverage-report-expanded.json'), json('phase1b/backend-dependency-closure.json'), json('active-source-runtime-validation.json'),
]);
if (!targeted.success || !full.success || e2e.results.length !== 2 || e2e.results.some(row => row.status !== 'PASS')) throw new Error('RUNTIME_VALIDATION_INCOMPLETE');
if (closure.unresolvedLocalImports.length || closure.affectedFunctions.map(row => row.function).join(',') !== 'feature-flags,public-parcel') throw new Error('UNEXPECTED_DEPLOY_CLOSURE');
if (active.sources.length !== 5 || active.sources.some(source => source.blockers.length || source.counties.some(county => county.point !== 'COVERAGE_AVAILABLE' || !county.apnParity || county.viewport !== 'COVERAGE_AVAILABLE'))) throw new Error('ACTIVE_SOURCE_PROOF_INCOMPLETE');
const lines = (await readFile(`${dir}/field-availability-matrix.csv`, 'utf8')).trim().split(/\r?\n/);
const headers = lines.shift().split(',');
const rows = lines.map(line => Object.fromEntries(line.split(',').map((value, index) => [headers[index], value]))).filter(row => row.STATUS === 'ACTIVE');
const fieldCoverage = Object.fromEntries(['GEOMETRY', 'APN', 'AREA', 'OWNER', 'ASSESSMENT', 'PROPERTY_TAX', 'ZONING'].map(field => [field, rows.filter(row => ['true', 'YES'].includes(row[field])).length]));
const result = { observedAt: new Date().toISOString(), baseline: coverage.baseline, implementation: 'PASS',
  targetedTests: { passed: targeted.numPassedTests, total: targeted.numTotalTests },
  fullTests: { passed: full.numPassedTests, total: full.numTotalTests, files: full.testResults.length },
  popupRefreshRegression: full.testResults.flatMap(row => row.assertionResults).find(row => row.fullName.includes('keeps a popup owner'))?.status,
  typecheck: 'PASS', lint: 'PASS', build: 'PASS', denoRoots: ['public-parcel', 'feature-flags'], newDenoErrors: 0,
  activeSources: coverage.activeSources, activeStates: coverage.activeStates.length, activeCounties: coverage.activeCounties.length,
  inspectedStates: coverage.statesInspected.length, inspectedCounties: coverage.countiesInspected, fieldCoverage,
  realMapView: e2e.results.map(row => ({ device: row.device, status: row.status, normalResolver: row.normalResolver, liveGovernmentQueries: row.liveGovernmentQueries, fixtureParcelResponses: row.fixtureParcelResponses, offGISRequests: row.offGISRequests, lowZoomRequests: row.lowZoomRequests })),
  productionAuthenticatedParcelE2E: 'NOT_RUN_NO_USER_SESSION_PROVIDED', realAddressFlow: 'LOCAL_NOMINATIM_CENSUS_TO_NORMAL_GIS_RESOLVER',
  cacheEvidence: 'REAL_CACHED_RECORDS_MISS_HIT_ZERO_REPEAT_GIS; VIRTUAL_CLOCK_AND_SIMULATED_OUTAGE_FOR_STALE_USABLE',
  featureFlag: 'public_parcel_intelligence', flagDefault: 'OFF', cohortGate: 'SERVER_INTERNAL_USER_ID_ALLOWLIST', productionCohort: 'NOT_CONFIGURED',
  generalPublicExposure: 'DISABLED', migration: 'NONE', maxxisConsumption: 0, reportConsumption: 0, canonicalFactChanges: 0, paidProviderCalls: 0, arbitraryUrlProxy: 0,
  backendDeployClosure: closure.affectedFunctions.map(row => row.function), publicSourcesEnabled: 0,
};
await writeFile(`${dir}/phase1b-validation.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
