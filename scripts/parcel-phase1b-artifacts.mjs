import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const output = 'qa/public-parcel-intelligence';
const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, watch: { usePolling: false } }, appType: 'custom' });
const save = (name, value) => writeFile(`${output}/${name}`, JSON.stringify(value, null, 2) + '\n');
try {
  const { PARCEL_SOURCES, productionSourceAllowed, activationBlockers, licenseCleared } = await server.ssrLoadModule('/supabase/functions/_shared/public-parcel/registry.ts');
  const records = JSON.parse(await readFile(`${output}/phase1b-source-inspection.json`, 'utf8'));
  const active = PARCEL_SOURCES.filter(productionSourceAllowed);
  const sourceRecords = records.filter(record => active.some(source => source.sourceId === record.sourceId));
  const activeCounties = [...new Set(active.flatMap(source => [source.countyFips, ...(source.coverageCountyFips || [])]))];
  const counties = [...new Set(records.map(record => record.countyFips))].map(countyFips => {
    const observed = records.filter(record => record.countyFips === countyFips);
    const enabled = active.filter(source => source.countyFips === countyFips || source.coverageCountyFips?.includes(countyFips));
    const attributes = enabled.some(source => source.fieldMapping.ownerName || source.fieldMapping.assessedValue || source.fieldMapping.propertyTax || source.fieldMapping.zoning);
    const blocked = observed.every(record => record.error);
    return { state: observed[0].state, county: observed[0].county, countyFips, sourceIds: observed.map(record => record.sourceId), activeSourceIds: enabled.map(source => source.sourceId),
      classification: enabled.length ? attributes ? 'FULL' : 'PARCEL_ONLY' : blocked ? 'TECHNICALLY_BLOCKED' : observed.some(record => record.licenseStatus === 'LICENSE_REVIEW_REQUIRED') ? 'LICENSE_BLOCKED' : 'NO_ACTIVE_SOURCE',
      meaning: 'Tested samples and declared source coverage only; FULL does not mean every field or every parcel is populated.' };
  });
  await save('source-registry-expanded.json', PARCEL_SOURCES);
  await save('coverage-report-expanded.json', { observedAt: new Date().toISOString(), baseline: '970c5d6dd47c5ecc0b8594922e097be50f31fa97',
    statesInspected: [...new Set(records.map(record => record.state))], countiesInspected: counties.length, candidateRegistrySources: PARCEL_SOURCES.length,
    schemaValidSources: PARCEL_SOURCES.filter(source => records.some(record => record.sourceId === source.sourceId && record.schema)).length,
    licenseClearedSources: PARCEL_SOURCES.filter(licenseCleared).length, licenseReviewSources: PARCEL_SOURCES.filter(source => !licenseCleared(source)).length,
    activeSources: active.length, activeStates: [...new Set(active.map(source => source.state))], activeCounties,
    technicallyInaccessibleSources: PARCEL_SOURCES.filter(source => records.filter(record => record.sourceId === source.sourceId).every(record => record.error)).map(source => source.sourceId),
    noSourceCounties: 0, noSourceMeaning: 'All inspected counties have candidates; uninspected/unsupported counties are not counted as discovery successes or failures.',
    counties, nationalCoverageExtrapolation: false, generalPublicExposure: 'DISABLED', productionInternalCohort: 'NOT_CONFIGURED_NO_USER_ID_PROVIDED',
    maxxisConsumption: 0, reportConsumption: 0, paidApiCostUSD: 0, arbitraryUrlProxy: 0 });
  await save('active-source-runtime-validation.json', { observedAt: new Date().toISOString(), mode: 'LIVE_PUBLIC_GOVERNMENT_NORMAL_RESOLVER',
    sources: active.map(source => ({ sourceId: source.sourceId, blockers: activationBlockers(source), status: source.status, licenseStatus: source.licenseStatus,
      counties: sourceRecords.filter(record => record.sourceId === source.sourceId).map(record => ({ countyFips: record.countyFips, point: record.point?.status, apnParity: record.apnParity, viewport: record.viewport?.status,
        address: record.address?.status || 'NOT_RUN', addressGeocoder: record.addressGeocode?.provider || null, areaComparisons: record.areaComparisons })) })),
    productionAuthenticatedE2E: 'NOT_RUN_NO_USER_SESSION', addressUsesExistingPublicProviderOrder: true, canonicalWrites: 0 });
  await save('cache-runtime-validation.json', { mode: 'REAL_SOURCE_RECORDS_WITH_ISOLATED_VIRTUAL_CLOCK_AND_SIMULATED_OUTAGE',
    rows: sourceRecords.map(record => ({ sourceId: record.sourceId, countyFips: record.countyFips, ...record.cacheProof, outageFreshness: record.outage?.freshness })) });
  await save('source-health.json', sourceRecords.map(record => ({ sourceId: record.sourceId, countyFips: record.countyFips, simulation: 'OUTAGE_AFTER_REAL_QUERY',
    health: Object.entries(record.health || {}).map(([sourceId, health]) => ({ sourceId, lastSuccessfulQuery: health.lastSuccessfulQuery, lastFailure: health.lastFailure, consecutiveFailures: health.consecutiveFailures, healthState: health.status })) })));
  const columns = ['SOURCE', 'STATUS', 'ROLE', 'GEOMETRY', 'APN', 'AREA', 'OWNER', 'ASSESSMENT', 'PROPERTY_TAX', 'ZONING', 'LEGAL_DESCRIPTION', 'SUBDIVISION'];
  const rows = PARCEL_SOURCES.map(source => {
    const schema = records.find(record => record.sourceId === source.sourceId && record.schema)?.schema;
    const available = field => !!source.fieldMapping[field] && !!schema?.fields.some(candidate => candidate.name === source.fieldMapping[field]);
    return [source.sourceId, source.status, source.role || 'PARCEL_PRIMARY', schema ? 'YES' : 'UNVERIFIED', available('apn'),
      available('assessorAcres') || available('gisAcres') || available('lotSqft') || !!source.areaMapping || !!schema,
      available('ownerName'), available('assessedValue'), available('propertyTax'), available('zoning'), available('legalDescription'), available('subdivision')];
  });
  await writeFile(`${output}/field-availability-matrix.csv`, [columns, ...rows].map(row => row.join(',')).join('\n') + '\n');
  const gable = JSON.parse(await readFile(`${output}/gable-public-parcel.json`, 'utf8'));
  await save('gable-source-comparison.json', { property: '741 Gable Dr, Center Point, AL 35215', countyFips: '01073', point: { lat: gable.appControl.lat, lng: gable.appControl.lng },
    publisherAcres: 1.14, publisherRaw: gable.appControl.lot, cachedRentCastSqft: gable.existingFactsComparison.cachedProviderSqft,
    cachedRentCastAcres: gable.existingFactsComparison.cachedProviderSqft / 43560, publicParcel: null, apn: null, assessedValue: null, propertyTax: null, zoning: null,
    agreementCluster: 'UNAVAILABLE_WITHOUT_PUBLIC_GIS', materialPublisherProviderConflict: true, canonicalFactsModified: false, newPaidCalls: 0 });
  console.log(JSON.stringify({ activeSources: active.length, activeStates: new Set(active.map(source => source.state)).size, activeCounties: activeCounties.length, states: new Set(records.map(record => record.state)).size, counties: counties.length }));
} finally { await server.close(); }
