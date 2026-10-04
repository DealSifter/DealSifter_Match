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
const addressFilter = process.argv.slice(2).join(' ').trim().toLowerCase();
const rows = (await request(`properties?select=id,type,address,city,state,zip,price,beds,baths,sqft,lot,objective,rehab,cap_rate,description,source,lat,lng&or=(${[
  '5939 Droad St', '741 Gable Dr', '5714 Bent Creek Dr', '7081 Kalanianaole Hwy', '10865 Wystone Ave',
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
  for (const dataType of ['property_record', 'property_value_avm', 'property_sold_record_pool']) {
    const result = await request('rpc/ds_get_property_intelligence_cache', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_property_id: property.id, p_provider: 'rentcast', p_data_type: dataType, p_schema_version: 1 }),
    });
    const row = result[0];
    cache[dataType] = !row ? null : {
      retrievedAt: row.retrieved_at, expiresAt: row.expires_at,
      summary: dataType === 'property_record' ? propertyRecordSummary(row.payload)
        : dataType === 'property_value_avm' ? valuationSummary(row.payload) : soldSummary(row.payload),
    };
  }
  output.push({ property, cache });
}
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
