import { readFile } from 'node:fs/promises';

const parseEnv = (value) => Object.fromEntries(value.split(/\r?\n/).map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#') && line.includes('='))
  .map((line) => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')]; }));
const env = { ...process.env, ...parseEnv(await readFile(new URL('../.env.local', import.meta.url), 'utf8')) };
const base = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = env.SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) throw new Error('SUPABASE_READ_ENV_MISSING');
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const request = async (path, options = {}) => {
  const response = await fetch(`${base}/rest/v1/${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`SUPABASE_READ_FAILED_${response.status}:${await response.text()}`);
  return response.json();
};
const validate = process.argv.includes('--validate');
const addressFilter = process.argv.slice(2).filter(arg => arg !== '--validate').join(' ').trim().toLowerCase();
// Deno's TS loader runs the actual cache identity/schema contracts during QA.
const contracts = validate ? {
  ...await import('../supabase/functions/_shared/property-data/cacheIdentity.ts'),
  ...await import('../supabase/functions/_shared/property-data/address.ts'),
  ...await import('../supabase/functions/_shared/property-data/normalizedRecordSchema.ts'),
  ...await import('../supabase/functions/_shared/property-data/valuationSchema.ts'),
  ...await import('../supabase/functions/_shared/property-data/soldSchema.ts'),
  ...await import('../supabase/functions/_shared/property-data/soldCache.ts'),
  ...await import('../supabase/functions/_shared/property-data/cacheFreshness.ts'),
} : null;
const rows = (await request(`properties?select=id,type,address,city,state,zip,price,beds,baths,sqft,lot,objective,rehab,cap_rate,description,source,lat,lng&or=(${[
  '5939 Droad St', '741 Gable Dr', '5714 Bent Creek Dr', '7081 Kalanianaole Hwy', '10865 Wystone Ave', '9537 Dalegrove Dr',
].map((address) => `address.ilike.${encodeURIComponent(address)}`).join(',')})`))
  .filter((property) => !addressFilter || String(property.address || '').toLowerCase().includes(addressFilter));
const field = (entry) => entry && typeof entry === 'object' ? entry.value ?? null : null;
const propertyRecordSummary = (payload = {}) => ({
  providerPropertyId: payload.sourceMetadata?.providerPropertyId || null,
  propertyType: field(payload.characteristics?.propertyType), county: field(payload.address?.county),
  countyFips: field(payload.parcel?.countyFips), stateFips: field(payload.parcel?.stateFips),
  latitude: field(payload.address?.latitude), longitude: field(payload.address?.longitude),
  bedrooms: field(payload.characteristics?.bedrooms), bathrooms: field(payload.characteristics?.bathrooms),
  livingAreaSqft: field(payload.characteristics?.livingAreaSqft), lotSizeSqft: field(payload.characteristics?.lotSizeSqft),
  yearBuilt: field(payload.characteristics?.yearBuilt), assessorId: field(payload.parcel?.assessorId),
  legalDescription: field(payload.parcel?.legalDescription), subdivision: field(payload.parcel?.subdivision),
  zoning: field(payload.parcel?.zoning), ownerOccupied: field(payload.ownership?.ownerOccupied),
  ownershipRecordPresent: Array.isArray(field(payload.ownership?.ownerNames))
    ? field(payload.ownership?.ownerNames).length > 0 : null,
  latestSalePrice: field(payload.lastSale?.price), latestSaleDate: field(payload.lastSale?.date),
  assessedValue: field(payload.tax?.assessedValue), assessmentYear: field(payload.tax?.assessmentYear),
  annualPropertyTax: field(payload.tax?.annualPropertyTax), propertyTaxYear: field(payload.tax?.propertyTaxYear),
  hoaFee: field(payload.hoa?.fee), propertyFeaturesCount: field(payload.features?.values)
    ? Object.keys(field(payload.features?.values)).length : 0,
  apnDiagnostics: payload.sourceMetadata?.fieldDiagnostics
    ? {
        providerFieldPresence: payload.sourceMetadata.fieldDiagnostics.providerFieldPresence?.assessorID || 'UNOBSERVED',
        normalizationResult: payload.sourceMetadata.fieldDiagnostics.normalizationResult?.assessorId ?? null,
        classification: field(payload.parcel?.assessorId) ? 'AVAILABLE'
          : payload.sourceMetadata.fieldDiagnostics.providerFieldPresence?.assessorID === 'ABSENT'
            ? 'PROVIDER_DID_NOT_RETURN_FIELD' : 'NORMALIZATION_DROPPED_FIELD',
      }
    : {
        providerFieldPresence: 'UNOBSERVED', normalizationResult: field(payload.parcel?.assessorId),
        classification: field(payload.parcel?.assessorId) ? 'AVAILABLE' : 'SOURCE_UNOBSERVED_LEGACY_CACHE',
      },
});
const valuationSummary = (payload = {}) => ({
  providerType: field(payload.subjectProperty?.propertyType), providerEstimate: field(payload.providerEstimate?.value),
  rangeLow: field(payload.providerEstimate?.rangeLow), rangeHigh: field(payload.providerEstimate?.rangeHigh),
  providerComparableCount: payload.providerComparableCount || 0,
});
const soldSummary = (payload = {}) => ({
  records: Array.isArray(payload.records) ? payload.records.length : 0,
  queryFingerprint: payload.queryFingerprint || null,
});
const output = [];
for (const property of rows) {
  const cache = {};
  // Backend-only, read-only inspection includes expired rows; never contacts RentCast.
  const retained = await request(`property_intelligence_cache?property_id=eq.${property.id}&select=data_type,address_fingerprint,provider_property_id,payload,retrieved_at,expires_at,schema_version`);
  const fingerprint = contracts ? await contracts.propertyAddressFingerprint({ street: property.address, city: property.city, state: property.state, zipCode: property.zip }) : null;
  const valuationRow = retained.find(row => row.data_type === 'property_value_avm');
  const validValuation = contracts && contracts.isNormalizedValuationEvidence(valuationRow?.payload)
    && await contracts.matchesCachedSubject(property, valuationRow.payload.subjectProperty);
  for (const dataType of ['property_record', 'property_value_avm', 'property_sold_record_pool', 'sale_listing_evidence', 'rent_estimate_evidence', 'rental_listing_evidence', 'market_evidence']) {
    const row = retained.find(entry => entry.data_type === dataType);
    let diagnostic = {};
    if (contracts && row) {
      let structurallyValid = row.schema_version === 1, identityMatch = false, queryMatch = true;
      if (dataType === 'property_record') {
        structurallyValid &&= contracts.isNormalizedPropertyRecord(row.payload);
        identityMatch = structurallyValid && await contracts.matchesCachedSubject(property, row.payload.address);
      } else if (dataType === 'property_value_avm') {
        structurallyValid &&= contracts.isNormalizedValuationEvidence(row.payload);
        identityMatch = Boolean(validValuation);
      } else if (dataType === 'property_sold_record_pool') {
        structurallyValid &&= contracts.isNormalizedSoldRecordPool(row.payload);
        identityMatch = Boolean(validValuation) && [fingerprint, valuationRow.address_fingerprint].includes(row.address_fingerprint);
        if (structurallyValid && validValuation) {
          const subject = valuationRow.payload.subjectProperty;
          const center = { latitude: subject.latitude.value, longitude: subject.longitude.value };
          const expected = await contracts.soldSearchQueryFingerprint(fingerprint, row.payload.requestPolicy, center);
          const legacy = await contracts.legacySoldSearchQueryFingerprint(valuationRow.address_fingerprint || fingerprint, row.payload.requestPolicy);
          queryMatch = [expected, legacy].includes(row.payload.queryFingerprint);
          diagnostic.queryAlias = row.payload.queryFingerprint === legacy ? 'LEGACY_V1_VALIDATED' : queryMatch ? 'CURRENT_V2' : 'UNRESOLVED';
        }
      } else identityMatch = row.address_fingerprint === fingerprint;
      const freshness = contracts.cacheFreshness({ retrievedAt: row.retrieved_at, expiresAt: row.expires_at, addressFingerprint: row.address_fingerprint },
        { structurallyValid, identityMatches: identityMatch, invalidated: !queryMatch });
      diagnostic = { ...diagnostic, freshness: freshness.state, identityMatch, usable: ['FRESH', 'STALE_USABLE'].includes(freshness.state),
        why: !structurallyValid ? 'SCHEMA_INVALID' : !identityMatch ? 'IDENTITY_UNRESOLVED_OR_MISMATCH' : !queryMatch ? 'QUERY_UNRESOLVED' : 'VALIDATED_RETAINED_REFERENCE' };
    }
    cache[dataType] = !row ? { found: false, freshness: 'ABSENT' } : {
      found: true, freshness: Date.parse(row.expires_at) > Date.now() ? 'FRESH' : 'STALE_REQUIRES_IDENTITY_VALIDATION',
      addressFingerprint: row.address_fingerprint, providerPropertyId: row.provider_property_id, schemaVersion: row.schema_version,
      retrievedAt: row.retrieved_at, expiresAt: row.expires_at,
      ...diagnostic,
      summary: dataType === 'property_record' ? propertyRecordSummary(row.payload)
        : dataType === 'property_value_avm' ? valuationSummary(row.payload) : soldSummary(row.payload),
    };
  }
  const reports = await request(`maxxis_reports?property_id=eq.${property.id}&select=id,capability,created_at,report_payload&order=created_at.desc&limit=10`);
  const savedReports = reports.map(({ report_payload, ...report }) => ({ ...report,
    hasPayload: Boolean(report_payload), payloadKeys: Object.keys(report_payload || {}),
    hasRecentSales: /recentSales|recent.sales/i.test(JSON.stringify(report_payload || {})),
    hasEvidence: /propertyEvidence|soldPool|externalData/.test(JSON.stringify(report_payload || {})),
  }));
  const providerIds = [...new Set(retained.map(row => row.provider_property_id).filter(Boolean))];
  const aliases = [];
  for (const id of providerIds) {
    const related = await request(`property_intelligence_cache?provider_property_id=eq.${encodeURIComponent(id)}&select=property_id,data_type,address_fingerprint,retrieved_at,expires_at`);
    aliases.push(...related.filter(row => row.property_id !== property.id));
  }
  output.push({ property, cache, savedReports, historicalAliases: aliases });
}
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
