import { mkdir, writeFile } from 'node:fs/promises';

if (!process.argv.includes('--live') || process.env.NODE_ENV === 'production') throw new Error('LOCAL_REVIEW_ONLY');
const output = 'qa/public-parcel-intelligence'; await mkdir(output, { recursive: true });
const observations = [];
const urls = [
  'https://www.arcgis.com/sharing/rest/content/items/e60514c3b78542ef9902e3d7f7a671c1/data?f=json',
  'https://www.arcgis.com/sharing/rest/content/items/efa909d6b1c841d298b0a649e7f71cf2?f=json',
  'https://www.arcgis.com/sharing/rest/content/items/6f900727e16d4ce1a83f2a1ec1d82e60?f=json',
  'https://jccgis.jccal.org/server/rest/services/Basemap/Parcels/MapServer/0?f=json',
  'https://jccgis.jccal.org/server/rest/info?f=json',
  'https://www.arcgis.com/sharing/rest/content/items/222c0369492646b48ccd25bbe8b2553e/data?f=json',
  'https://www.arcgis.com/sharing/rest/content/items/b5118cb926c64ebeac59c8d0b01f6e45/data?f=json',
  'https://eringcapture.jccal.org/',
  'https://www.revenue.alabama.gov/property-tax/county-offices-appraisal-assessment-records/',
  'https://gis.alabama.gov/',
];
for (const url of urls) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json,text/html' } });
    const text = (await response.text()).slice(0, 500000); let data; try { data = JSON.parse(text); } catch { /* HTML is not an ArcGIS token error */ }
    const plain = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    observations.push({ url, observedAt: new Date().toISOString(), status: response.status, redirectedTo: response.url !== url ? response.url : null,
      contentType: response.headers.get('content-type'), edgeGateway: /incapsula|imperva/i.test(text) ? 'IMPERva_INCAPSULA' : null,
      arcgisError: data?.error || null, licenseSummary: data?.licenseInfo?.replace(/<[^>]*>/g, ' ').slice(0, 1000) || null,
      publicReferences: [...new Set(text.match(/https?:[^\s"<>\\]+/g) || [])].filter(link => /jccal|jeffco|arcgis|alabama/i.test(link)).slice(0, 35),
      termsObservations: url.includes('e605') ? plain.match(/.{0,60}(unrestricted|release agreements|free and|sale of).{0,200}/gi)?.slice(0, 6) : null,
      accessControlBypass: false });
  } catch (error) { observations.push({ url, error: error.message, accessControlBypass: false }); }
  console.log(JSON.stringify({ url, status: observations.at(-1).status, error: observations.at(-1).error }));
}
await writeFile(`${output}/phase1b-official-review.json`, JSON.stringify({ observations, paidCalls: 0, canonicalWrites: 0, noCredentialsOrSpoofing: true }, null, 2) + '\n');
