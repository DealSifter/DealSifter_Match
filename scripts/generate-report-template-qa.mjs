import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createCanvas } from '@napi-rs/canvas';

// Isolated fictional fixture: never imported by the app, stored, or sent to a provider.
const property = Object.freeze({
  id: 'PREVIEW-ONLY', address: '1200 Sample Avenue', city: 'Example City', state: 'FL', zip: '00000',
  type: 'SFR', objective: 'Buy and Hold', price: 425000, beds: 4, baths: 2, sqft: 1780,
  lot: '9,583 sqft / 0.22 acres', rehab: 48000, capRate: 5.1, published: true, source: 'Sample fixture',
  latitude: 27.0000, longitude: -80.0000,
  description: 'Four-bedroom single-family sample with a long-term hold objective.',
  improvement: 'Single-family residence', dealTag: 'Portfolio', portfolio: true,
  labels: ['Buy and Hold', 'Portfolio', 'Sample'], markets: ['Example City, FL'],
  yearBuilt: 2004, county: 'Example County', assessedValue: 398500, annualPropertyTax: 5120,
  ownerOccupied: false, ownershipRecordPresent: true, latestSalePrice: 315000, latestSaleDate: '2021-06-18',
  notes: 'Fictional sample property for report layout demonstration only. Verify all facts in a real report.',
  owner: { name: 'Sample Owner', type: 'Individual', status: 'Published', allowedContacts: [
    { type: 'phone', label: 'Phone', value: '(555) 010-0120' },
    { type: 'email', label: 'Email', value: 'sample@example.invalid' },
  ] },
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
const structuredAnalysis = Object.freeze({
  type: 'maxxis_structured_analysis', version: 'MAXXIS_STRUCTURED_ANALYSIS_V1',
  executiveSummary: 'The four-bedroom SFR structure aligns with the illustrated buy-and-hold profile. The 74% profile fit reflects that structural alignment, while condition, operating expenses and ownership evidence still require verification.',
  opportunityAssessment: 'The recorded layout and stored strategy support continued review. The unresolved condition, operating-cost and ownership evidence should be verified before relying on the analysis for an investment decision.',
  propertyContextInterpretation: 'The subject is recorded as a four-bedroom, two-bathroom SFR with 1,780 sqft in Example City, Florida.',
  investorFit: { overallAssessment: 'The property has 74% Investment Profile alignment.', fitRationale: 'Property type and strategy align; evidence completeness limits the conclusion.', strengths: analysis.keyObservations.positives, mismatches: analysis.keyObservations.attention },
  marketContext: { interpretation: 'The example location is inside the illustrated target market.', evidenceUsed: ['Configured target market: Example City, FL.'], limitations: ['Market alignment is profile context, not independent proof of demand.'] },
  comparativeAnalysis: { interpretation: 'Two recorded sales meet the illustrated structural selection gates.', selectedCompSummary: deal.comparableEvidence.used, supportingEvidence: ['One additional sale supports context.'], limitations: ['Condition evidence remains illustrative.'] },
  valuationAnalysis: { currentPositioning: 'The asking price equates to $238.76 per square foot.', arvInterpretation: 'The illustrated deterministic ARV range is $470,000 to $530,000.', confidenceInterpretation: 'Confidence is limited by sample condition evidence.', scenarioInterpretation: 'Scenarios use the stored price and rehabilitation amount.', limitations: deal.valuationIntelligence.warnings },
  riskAnalysis: { dataRisk: 'Condition evidence is incomplete.', marketRisk: 'Comparable evidence must be refreshed before reliance.', valuationRisk: 'ARV confidence is limited.', executionRisk: 'Renovation scope and timing are not confirmed.', rationale: deal.riskAnalysis.map((item) => item.explanation) },
  positiveSignals: analysis.keyObservations.positives,
  concerns: analysis.keyObservations.attention,
  missingEvidence: analysis.limitations,
  recommendedVerificationSteps: analysis.nextSteps,
  recommendedActions: deal.nextVerificationSteps,
  strategySpecificInsights: ['For Buy and Hold, verify achievable rent, occupancy and operating expenses.', 'Confirm the renovation scope before relying on cost-basis scenarios.'],
  profileAdaptedConclusion: 'The property is structurally aligned with the illustrated long-term hold profile, but condition and operating evidence remain the priority verification items.',
  userFacingDisclaimers: ['Evidence-based decision support only; not an appraisal or return guarantee.'],
});

const root = fileURLToPath(new URL('../', import.meta.url));
const out = fileURLToPath(new URL('../qa/report-template/', import.meta.url));
await mkdir(out, { recursive: true });
const samplePhoto = `data:image/jpeg;base64,${(await readFile(`${root}src/assets/maxxis/report-previews/sample-property-photo.jpg`)).toString('base64')}`;
const mapCanvas = createCanvas(700, 400);
const mapContext = mapCanvas.getContext('2d');
mapContext.fillStyle = '#edf2eb'; mapContext.fillRect(0, 0, 700, 400);
mapContext.fillStyle = '#cce8ca'; mapContext.fillRect(55, 35, 235, 310);
mapContext.strokeStyle = '#ffffff'; mapContext.lineWidth = 12;
for (let y = 30; y < 400; y += 46) { mapContext.beginPath(); mapContext.moveTo(0, y); mapContext.lineTo(700, y + 18); mapContext.stroke(); }
for (let x = 20; x < 700; x += 72) { mapContext.beginPath(); mapContext.moveTo(x, 0); mapContext.lineTo(x + 35, 400); mapContext.stroke(); }
mapContext.strokeStyle = '#a9c8dc'; mapContext.lineWidth = 18; mapContext.beginPath(); mapContext.moveTo(0, 345); mapContext.lineTo(700, 300); mapContext.stroke();
mapContext.fillStyle = '#148a67'; mapContext.font = 'bold 24px sans-serif'; mapContext.fillText('Sample Community Park', 70, 205);
mapContext.fillStyle = '#1db8bc'; mapContext.beginPath(); mapContext.arc(410, 182, 18, 0, Math.PI * 2); mapContext.fill();
mapContext.fillStyle = '#ffffff'; mapContext.beginPath(); mapContext.arc(410, 182, 6, 0, Math.PI * 2); mapContext.fill();
mapContext.fillStyle = '#20344b'; mapContext.font = 'bold 20px sans-serif'; mapContext.fillText('1200 Sample Avenue', 430, 190);
const sampleMap = mapCanvas.toDataURL('image/png');
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
    const schema = buildMaxxisReportSchema({ reportType, property: { ...property, images: [samplePhoto, samplePhoto, samplePhoto, samplePhoto, samplePhoto] }, maxxisAnalysis: analysis, dealIntelligence: deal, dealMetrics: sampleMetrics, structuredAnalysis });
    const exportEntitlement = resolveReportExportEntitlement({ plan, reportType, channel: 'PDF' });
    const result = await renderMaxxisReportPdf({ schema, exportEntitlement, generatedAt: '2026-09-21T22:45:00.000Z', language: 'en', mapImageData: sampleMap });
    if (result.state !== 'RENDERED') throw new Error(`${reportType}: ${result.state} ${JSON.stringify(result.validation || {})}`);
    await writeFile(`${out}${file}`, result.document.binary);
    process.stdout.write(`${file}: ${result.document.pageCount} A4 pages\n`);
  }
} finally { await server.close(); }
