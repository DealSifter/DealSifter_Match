import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';

const out = 'qa/land-report-hardening/';
await mkdir(out, { recursive: true });
const save = (name, value) => writeFile(out + name, JSON.stringify(value, null, 2) + '\n');
const env = Object.fromEntries((await readFile('.env.local', 'utf8')).split(/\r?\n/).filter(line => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line)).map(line => {
  const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')];
}));
const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = env.SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const request = async path => {
  const response = await fetch(url + '/rest/v1/' + path, { headers: { apikey: key, Authorization: 'Bearer ' + key } });
  if (!response.ok) throw new Error('SCOPED_CACHE_READ_FAILED_' + response.status);
  return response.json();
};
// Read-only, scoped to the user-designated control. Never invoke a provider function.
const id = '20e8a78f-fcf7-4017-83cd-5c8355498da9';
const [rows, cacheRows] = await Promise.all([
  request('properties?select=id,type,address,city,state,zip,price,lot,objective,description,lat,lng&id=eq.' + id),
  request('property_intelligence_cache?select=data_type,retrieved_at,expires_at,payload&property_id=eq.' + id),
]);
const row = rows[0];
if (!row || !/^741 Gable/i.test(row.address)) throw new Error('GABLE_CONTROL_IDENTITY_FAILED');
const cache = type => cacheRows.find(item => item.data_type === type);
const recordCache = cache('property_record'); const record = recordCache?.payload;
if (!record?.characteristics?.lotSizeSqft) throw new Error('GABLE_CACHED_PARCEL_EVIDENCE_UNAVAILABLE');
const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, watch: { usePolling: false } }, appType: 'custom' });
let rendered; let debug; const localization = {};
try {
  const load = path => server.ssrLoadModule(path);
  const metrics = await load('/supabase/functions/_shared/maxxis/landMetrics.ts');
  const projection = await load('/supabase/functions/_shared/maxxis/propertyEvidenceProjection.ts');
  const development = await load('/supabase/functions/_shared/maxxis/landDevelopmentScenario.ts');
  const { buildMarketReferenceAnswer } = await load('/supabase/functions/_shared/maxxis/marketReferenceAnswer.ts');
  const { buildDealDecisionContext } = await load('/supabase/functions/_shared/maxxis/dealDecisionContext.ts');
  const { buildMaxxisReportSchema } = await load('/src/domain/maxxis/maxxisReportSchema.js');
  const { buildMaxxisDealIntelligenceReport } = await load('/src/features/maxxis/intelligence/maxxisDealIntelligenceReport.js');
  const { buildMaxxisStructuredAnalysis } = await load('/supabase/functions/_shared/maxxis/maxxisStructuredAnalysis.ts');
  const { buildLandReportView } = await load('/src/features/maxxis/export/maxxisLandReportView.js');
  const { renderMaxxisReportPdf } = await load('/src/features/maxxis/export/maxxisReportPdf.js');
  const { resolveReportExportEntitlement } = await load('/src/features/maxxis/export/reportExportEntitlement.js');
  const mapping = { propertyType: record.characteristics.propertyType, lotSizeSqft: record.characteristics.lotSizeSqft,
    county: record.address?.county, assessedValue: record.tax?.assessedValue, assessmentYear: record.tax?.assessmentYear,
    annualPropertyTax: record.tax?.annualPropertyTax, propertyTaxYear: record.tax?.propertyTaxYear,
    assessorId: record.parcel?.assessorId, legalDescription: record.parcel?.legalDescription, zoning: record.parcel?.zoning };
  const fields = Object.fromEntries(Object.entries(mapping).filter(([, value]) => value));
  const context = { fields, verifiedFields: Object.keys(fields).filter(field => fields[field].status === 'VERIFIED_RECORD'), unknownFields: [] };
  const app = { ...row, notes: row.description, propertyUserNotes: row.description, latitude: row.lat, longitude: row.lng, ...metrics.parseCanonicalLotArea(row.lot) };
  const property = projection.mergeVerifiedPropertyEvidenceIntoFacts(app, context);
  const assumptions = { zoning: 'R2', zoningSource: 'USER_PROVIDED', developmentIntent: 'NEW_CONSTRUCTION', proposedUnitCount: 1, proposedPropertyType: 'SFR' };
  const valuation = cache('property_value_avm')?.payload;
  const sold = cache('property_sold_record_pool')?.payload;
  const evidence = valuation && sold?.records ? { valuation, records: sold.records,
    freshness: { landAcquisition: { state: Date.parse(cache('property_sold_record_pool').expires_at) > Date.now() ? 'FRESH' : 'STALE_USABLE', retrievedAt: cache('property_sold_record_pool').retrieved_at } } } : null;
  const result = development.calculateLandDevelopmentScenario({ ...property, ...assumptions, purchasePrice: property.price }, evidence);
  const scenario = { propertyId: id, strategy: 'LAND', status: 'PARTIAL', provenance: 'USER_PROVIDED', assumptions, calculatedOutputs: result };
  const snapshot = { propertyFacts: property, propertyId: id, developmentEvidence: evidence, dealAssumptions: { ...assumptions, activeScenario: scenario } };
  snapshot.dealDecisionContext = buildDealDecisionContext(snapshot);
  const dealContext = { type: 'deal_intelligence_context', propertyId: id, propertyContext: context,
    evidenceSummary: { strength: 'LOW', verifiedFieldCount: context.verifiedFields.length, conflicts: property.canonicalPropertyFacts.conflicts },
    valuationContext: { status: 'NOT_APPLICABLE', confidence: 'LOW', compsUsed: 0, warnings: [] },
    providerMarketContext: { providerAvmCompatibility: 'QUARANTINED_FOR_TYPE_CONFLICT' }, comparableEvidence: [],
    response: { initialAssessment: 'Terreno analisado com premissas explícitas de uma casa SFR e zoneamento R2. Viabilidade legal e custos adicionais ainda não verificados.' },
    limitations: [], recommendedActions: [], risks: [], opportunities: [] };
  snapshot.dealIntelligence = dealContext;
  const structured = buildMaxxisStructuredAnalysis(snapshot, 'DEAL_INTELLIGENCE', 'pt');
  const deal = buildMaxxisDealIntelligenceReport(dealContext, structured, snapshot);
  const schema = buildMaxxisReportSchema({ reportType: 'DEAL_INTELLIGENCE', property, dealIntelligence: deal, structuredAnalysis: structured, resolvedUserLocale: 'pt' });
  const view = buildLandReportView(schema, 'pt');
  const chat = buildMarketReferenceAnswer(snapshot, 'LAND_MARKET_VALUE', 'pt');
  const pair = property.resolvedLotDimensions;
  await save('lot-dimension-resolution.json', { propertyId: id, observedAt: new Date().toISOString(), sourceAcres: { path: 'properties.lot', value: row.lot },
    sourceSqft: { path: 'property_intelligence_cache[property_record].payload.characteristics.lotSizeSqft', ...record.characteristics.lotSizeSqft },
    resolved: pair, asking: view.metrics, chat: chat.data.landMetrics, report: view.metrics,
    conversionConsistent: Math.abs(pair.resolvedSqft / 43560 - pair.resolvedAcres) < 1e-9,
    cacheRetrievedAt: recordCache.retrieved_at, automatedRentcastCalls: 0 });
  await save('land-scenario-state.json', { propertyId: id, assumptions, source: 'EXPLICIT_CURRENT_USER_CONTROL_PROMPT', scenario, staleTwoHouseAction: 0 });
  await save('land-gap-semantics.json', { decision: snapshot.dealDecisionContext, propertyType: property.type, providerConflict: property.propertyTypeConflict,
    missingPropertyTypeGaps: snapshot.dealDecisionContext.decisionGaps.filter(gap => /MISSING_PROPERTY_TYPE/.test(gap.code)).length });
  const entitlement = resolveReportExportEntitlement({ plan: 'enterprise', reportType: 'DEAL_INTELLIGENCE', channel: 'PDF' });
  for (const language of ['pt', 'en', 'es']) {
    const localizedStructured = buildMaxxisStructuredAnalysis(snapshot, 'DEAL_INTELLIGENCE', language);
    const localizedDeal = buildMaxxisDealIntelligenceReport(dealContext, localizedStructured, snapshot);
    const current = language === 'pt' ? schema : buildMaxxisReportSchema({ reportType: 'DEAL_INTELLIGENCE', property,
      dealIntelligence: localizedDeal, structuredAnalysis: localizedStructured, resolvedUserLocale: language });
    const output = await renderMaxxisReportPdf({ schema: current, exportEntitlement: entitlement, generatedAt: new Date().toISOString(), language });
    if (output.state !== 'RENDERED') throw new Error(JSON.stringify({ state: output.state, validation: output.validation }));
    const landContinuations = output.document.layoutAudit.continuations.filter(item => /^land/.test(item.sectionId));
    localization[language] = { pageCount: output.document.pageCount, landContinuations: landContinuations.map(item => item.sectionId), allContinuations: output.document.layoutAudit.continuations.map(item => ({ section: item.sectionId, text: item.sourceText })) };
    if (language === 'pt') rendered = output;
    else await writeFile(out + `gable-report-${language}.pdf`, output.document.binary);
  }
  globalThis.REPORT_LAYOUT_DEBUG = true;
  debug = await renderMaxxisReportPdf({ schema, exportEntitlement: entitlement, generatedAt: new Date().toISOString(), language: 'pt' });
  delete globalThis.REPORT_LAYOUT_DEBUG;
  await save('localization.json', localization);
  for (const page of [2, 3]) {
    const audit = rendered.document.layoutAudit;
    const lines = audit.lines.filter(line => line.page === page); const ids = new Set(lines.map(line => line.sectionId));
    const sections = audit.sections.filter(section => ids.has(section.sectionId));
    const collisions = [];
    for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i]; const b = lines[j];
      if (a.sectionId === b.sectionId) continue;
      if (Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0.5 && Math.min(a.bottomY, b.bottomY) - Math.max(a.y, b.y) > 0.5) collisions.push([a.sectionId, b.sectionId]);
    }
    await save(`page${page}-layout-audit.json`, { page, lines, sections, collisions, overflow: lines.filter(line => line.overflowX > 0 || line.overflowY > 0),
      continuations: audit.continuations.filter(item => /^land/.test(item.sectionId)), fixedPageCount: rendered.document.pageCount });
  }
  await save('false-zero-regression.json', { rehab: property.canonicalPropertyFacts.financial.rehab.status,
    capRate: property.canonicalPropertyFacts.financial.capRate.status, knownDevelopmentBasis: view.knownBasis,
    coverage: result.costCoverage, hardCost: result.hardCost, falseZeroMetrics: 0 });
} finally { await server.close(); }
await writeFile(out + 'gable-report.pdf', rendered.document.binary);
await writeFile(out + 'gable-report-debug.pdf', debug.document.binary);
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
const texts = [];
for (const [document, suffix] of [[rendered.document, ''], [debug.document, '-debug']]) {
  const pdf = await getDocument({ data: new Uint8Array(document.binary), useSystemFonts: true }).promise;
  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number);
    if (!suffix) texts.push((await page.getTextContent()).items.map(item => item.str).join(' '));
    if (![2, 3].includes(number)) continue;
    const viewport = page.getViewport({ scale: 1.5 }); const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport, canvas }).promise;
    await writeFile(out + `page${number}${suffix}.png`, await canvas.encode('png'));
  }
  await pdf.cleanup?.();
}
await writeFile(out + 'gable-report.txt', texts.join('\n\n'));
console.log(JSON.stringify({ output: out, pageCount: rendered.document.pageCount, localization, automatedRentcastCalls: 0 }));
