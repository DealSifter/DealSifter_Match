import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

// Isolated fictional fixture: never imported by the app, stored, or sent to a provider.
const property = Object.freeze({
  id: 'PREVIEW-ONLY', address: '1200 Sample Avenue', city: 'Example City', state: 'FL', zip: '00000',
  type: 'SFR', objective: 'Buy and Hold', price: 425000, beds: 4, baths: 2, sqft: 1780,
  lot: '0.22 acres', rehab: 48000, capRate: 5.1, published: true, source: 'Sample fixture',
  latitude: 27.0000, longitude: -80.0000,
  notes: 'Fictional sample property for report layout demonstration only. Verify all facts in a real report.',
  owner: { name: 'Sample Owner', type: 'Individual', status: 'Not verified', allowedContacts: [] },
});
const analysis = Object.freeze({
  executiveSummary: 'The sample property has a four-bedroom SFR layout and a stored buy-and-hold objective. The illustrated profile fit is 74%; condition, operating costs and ownership still need independent verification.',
  keyObservations: {
    positives: [
      'Four bedrooms and 1,780 sqft are recorded in the sample property.',
      'The illustrated strategy is buy and hold.',
      'The sample property type aligns with the illustrated profile.',
      'A stored asking price is available for contextual comparison.',
    ],
    attention: [
      'Property condition has not been inspected.',
      'Operating expenses and rental history are not documented.',
      'Ownership and title have not been independently confirmed.',
    ],
  },
  profileAlignment: { score: 74, targetMarket: { explanation: 'Illustrative market alignment' }, propertyType: { explanation: 'SFR preferred' }, strategy: { explanation: 'Buy and Hold' } },
  riskAwareness: [
    { category: 'DATA', explanation: 'Condition is not verified.' },
    { category: 'MARKET', explanation: 'Local rent and demand assumptions require verification.' },
    { category: 'EXECUTION', explanation: 'The sample rehab budget is not a contractor quote.' },
  ],
  limitations: [
    'The sample property has no inspection report.',
    'Operating expenses and rental history are not documented.',
    'Profile fit is not a deal score or investment recommendation.',
    'The sample does not establish title or legal status.',
  ],
  nextSteps: [
    'Confirm title and ownership.', 'Inspect the property.', 'Verify operating expenses.',
    'Request comparable rent evidence.', 'Obtain a written renovation estimate.',
  ],
  provenance: { property: 'USER_PROVIDED' },
});
const deal = Object.freeze({
  executiveDealOverview: 'This fictional example combines stored property facts with illustrative sold comparables. It is not a live valuation.',
  whyThisPropertyStandsOut: [
    'The sample layout illustrates a four-bedroom SFR.',
    'The sample profile favors long-term holding.',
    'Two fictional recorded-sale examples meet the illustrated selection criteria.',
    'The illustrative ARV is limited because condition evidence is incomplete.',
  ],
  investmentFit: analysis.profileAlignment,
  propertyEvidence: { verifiedRecords: [], userProvided: [{ field: 'price' }], unknown: [{ field: 'condition' }], conflicts: [] },
  comparableEvidence: {
    used: [
      { compIdentifier: 'sample-a', address: 'Sample Comp A', salePrice: 495000, saleDate: '2026-03-15', beds: 4, baths: 2, sqft: 1820, distanceMiles: 0.5, latitude: 27.002, longitude: -80.004, role: 'PRIMARY', inclusionReason: 'Illustrative structural match.' },
      { compIdentifier: 'sample-b', address: 'Sample Comp B', salePrice: 510000, saleDate: '2026-02-10', beds: 4, baths: 2, sqft: 1750, distanceMiles: 0.8, latitude: 27.006, longitude: -79.998, role: 'PRIMARY', inclusionReason: 'Illustrative proximity match.' },
    ],
    supporting: [{ address: 'Sample Comp C', salePrice: 475000, saleDate: '2025-12-02', beds: 3, baths: 2, sqft: 1600, distanceMiles: 1.2, latitude: 26.995, longitude: -80.006, role: 'SUPPORTING', inclusionReason: 'Different bedroom count.' }],
    excluded: [
      { address: 'Sample Comp D', salePrice: 650000, saleDate: '2025-08-05', beds: 5, baths: 3, sqft: 2300, distanceMiles: 3.1, latitude: 27.008, longitude: -79.993, role: 'EXCLUDED', exclusionReason: 'Different size and location.' },
      { address: 'Sample Comp E', salePrice: 390000, saleDate: '2025-07-12', beds: 2, baths: 1, sqft: 1100, distanceMiles: 2.8, latitude: 26.998, longitude: -80.009, role: 'EXCLUDED', exclusionReason: 'Different layout and smaller living area.' },
    ],
  },
  valuationIntelligence: { status: 'ARV_LIMITED', range: { low: 470000, high: 530000 }, centralReference: 500000, confidence: 'LOW', compsUsed: 2, methodology: 'Illustrative deterministic sample only.', warnings: ['Sample condition evidence is incomplete.', 'The rehab amount is not a verified contractor bid.', 'Market changes can alter comparable relevance.'] },
  riskAnalysis: [
    { category: 'DATA', explanation: 'Sample condition evidence is incomplete.' },
    { category: 'MARKET', explanation: 'Illustrative comparable prices may not represent current demand.' },
    { category: 'VALUATION', explanation: 'The ARV range is limited pending condition review.' },
    { category: 'EXECUTION', explanation: 'Renovation scope and timeline are not confirmed.' },
  ],
  limitations: [
    'No inspection, title report, or expense statement is included in this sample.',
    'Comparable selection remains illustrative and must be reviewed.',
    'The ARV range is not an appraisal or return forecast.',
  ],
  nextVerificationSteps: [
    'Inspect property condition.', 'Verify title and taxes.', 'Obtain contractor bids.',
    'Validate rental assumptions.', 'Review the selected comparable records.',
  ],
  provenance: { propertyEvidence: 'SAMPLE_ONLY' },
});
const sampleMetrics = Object.freeze({ metrics: {
  pricePerSqft: { calculable: true, value: 238.76, source: 'FICTIONAL_SAMPLE' },
  acquisitionPlusRehab: { calculable: true, value: 473000, source: 'FICTIONAL_SAMPLE' },
  capRate: { calculable: true, value: 5.1, source: 'FICTIONAL_SAMPLE' },
} });

const root = fileURLToPath(new URL('../', import.meta.url));
const out = fileURLToPath(new URL('../qa/report-template/', import.meta.url));
await mkdir(out, { recursive: true });
const samplePhoto = `data:image/jpeg;base64,${(await readFile(`${root}src/assets/maxxis/report-previews/sample-property-photo.jpg`)).toString('base64')}`;
const server = await createServer({ root, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: 'custom' });
try {
  const { buildMaxxisReportSchema } = await server.ssrLoadModule('/src/domain/maxxis/maxxisReportSchema.js');
  const { renderMaxxisReportPdf } = await server.ssrLoadModule('/src/features/maxxis/export/maxxisReportPdf.js');
  const { resolveReportExportEntitlement } = await server.ssrLoadModule('/src/features/maxxis/export/reportExportEntitlement.js');
  for (const [reportType, plan, file] of [
    ['PROPERTY_RELEASE', 'free', 'property-release.pdf'],
    ['MAXXIS_ANALYSIS', 'pro', 'maxxis-analysis.pdf'],
    ['DEAL_INTELLIGENCE', 'enterprise', 'deal-intelligence.pdf'],
  ]) {
    const schema = buildMaxxisReportSchema({ reportType, property: { ...property, images: [samplePhoto] }, maxxisAnalysis: analysis, dealIntelligence: deal, dealMetrics: sampleMetrics });
    const exportEntitlement = resolveReportExportEntitlement({ plan, reportType, channel: 'PDF' });
    const result = await renderMaxxisReportPdf({ schema, exportEntitlement, generatedAt: '2026-09-21T22:45:00.000Z', language: 'en' });
    if (result.state !== 'RENDERED') throw new Error(`${reportType}: ${result.state} ${JSON.stringify(result.validation || {})}`);
    await writeFile(`${out}${file}`, result.document.binary);
    process.stdout.write(`${file}: ${result.document.pageCount} A4 pages\n`);
  }
} finally { await server.close(); }
