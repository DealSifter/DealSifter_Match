import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createCanvas, Image, DOMMatrix, ImageData, Path2D, loadImage } from '@napi-rs/canvas';
import { reportIntegrityFixtures, reportIntegrityLongNotesFixture, REPORT_FIXTURE_LANGUAGES, REPORT_FIXTURE_TIME } from './report-integrity-fixtures.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = new Map(process.argv.slice(2).map(value => {
  const [key, ...parts] = value.replace(/^--/, '').split('='); return [key, parts.join('=') || true];
}));
const directory = process.env.REPORT_INTEGRITY_QA_DIRECTORY
  || (args.get('long-notes') ? 'qa/report-integrity-final/structured-notes' : 'qa/report-integrity-final');
const selection = args.get('fixtures') ? String(args.get('fixtures')).split(',') : null;
const languages = args.get('languages') ? String(args.get('languages')).split(',') : REPORT_FIXTURE_LANGUAGES;
if (languages.some(language => !REPORT_FIXTURE_LANGUAGES.includes(language))) throw new Error('QA_LANGUAGE_INVALID');
const scale = 1.4;
await mkdir(directory, { recursive: true });
const saveJson = (name, value) => writeFile(`${directory}/${name}`, `${JSON.stringify(value, null, 2)}\n`);
const normalized = value => value.normalize('NFKC').replace(/\s+/g, ' ').trim();
const hash = value => createHash('sha256').update(value).digest('hex');
const sourcePaths = [
  'src/domain/maxxis/maxxisReportSchema.js',
  'src/features/maxxis/export/reportIntegrityTypes.ts',
  'src/features/maxxis/export/reportIntegrityViewModel.ts',
  'src/features/maxxis/export/reportSavedScenarioProjection.ts',
  'src/features/maxxis/export/maxxisReportPdf.js',
  'src/features/maxxis/export/strictReportPdf.ts',
  'src/features/maxxis/export/referenceReportPdf.ts',
  'src/features/maxxis/export/reportMapAssets.js',
  'src/features/maxxis/export/maxxisReportRenderer.js',
  'src/features/maxxis/export/comparableMapGeometry.ts',
  'src/features/maxxis/export/marketRentReport.js',
  'src/features/maxxis/export/reportPreparedAssets.ts',
  'src/features/maxxis/export/reportExportEntitlement.js',
  'src/features/maxxis/presentation/reportNarrativePresentation.js',
  'src/services/chatTranslation.js',
  'src/features/maxxis/export/maxxisReportVisualPolicy.js',
  'src/features/maxxis/qa/maxxisProductionReadiness.js',
  'supabase/functions/_shared/maxxis/financialEvidence.ts',
  'supabase/functions/_shared/maxxis/financialReadiness.ts',
  'scripts/report-integrity-fixtures.mjs',
  'scripts/report-integrity-qa.mjs',
];
const sourceHashes = async () => Object.fromEntries(await Promise.all(sourcePaths.map(async path =>
  [path, hash(await readFile(`${root}${path}`))])));
const failures = [];
const networkAttempts = [];
const imageNetworkAttempts = [];
const originalFetch = globalThis.fetch;
const originalImage = globalThis.Image;
const originalDocument = globalThis.document;

// The renderer is deliberately denied all transports, not supplied fake HTTP
// responses. A request attempt is a QA failure even when caught by the renderer.
globalThis.fetch = async input => {
  networkAttempts.push(String(input?.url || input));
  throw new Error('REPORT_QA_RENDERER_NETWORK_FORBIDDEN');
};
class OfflineImage extends Image {
  set src(value) {
    if (typeof value !== 'string' || !value.startsWith('data:image/')) {
      imageNetworkAttempts.push(typeof value === 'string' ? value : '[non-string image source]');
      throw new Error('REPORT_QA_EXTERNAL_IMAGE_FORBIDDEN');
    }
    super.src = value;
  }
  get src() { return super.src; }
}
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D, Image: OfflineImage,
  document: { createElement(tag) {
    if (tag === 'canvas') return createCanvas(1, 1);
    if (tag === 'img') return new OfflineImage();
    throw new Error(`REPORT_QA_UNSUPPORTED_ELEMENT:${tag}`);
  } },
});

const PROHIBITED = [
  ['RAW_OBJECT', /\[object\s+Object\]/g],
  ['NON_FINITE_OR_ABSENT', /\b(?:undefined|NaN|Infinity)\b/g],
  ['RAW_JSON', /\{\s*["'][^"']+["']\s*:/g],
  ['INTERNAL_FIELD', /\b(?:annualPropertyTax|propertyTaxYear|assessorID|assessorId|effectiveSource|evidenceHash|sourceFamily|sourceType|sourceAuthority|analyticalUsability|providerCorrelation|currentContractRent|providerMarketRentEstimate|livingAreaSqft|lotSizeSqft|lotSizeAcres|fieldProvenance|property_intelligence_cache|cap_rate)\b/g],
  ['INTERNAL_ENUM', /\b(?:MISSING(?:_|\s+)[A-Z_ ]+|PROVIDER_ESTIMATE|MATERIAL_CONFLICT|OUTLIER_DETECTED|READY_MIXED|REVIEW_REQUIRED|ARV_UNAVAILABLE|ACTUAL_SINGLE_SOURCE|ESTIMATED_PROVIDER|VERIFIED_RECORD|USER_PROVIDED|UNAVAILABLE|NOT_APPLICABLE|UNKNOWN)\b/g],
  ['GENERIC_DUMP', /(?:Informa[çc][õo]es preservadas|Preserved information|Informaci[oó]n preservada|preservedCanonicalContent|preservedInformation)/gi],
  ['IMPOSSIBLE_PROVENANCE', /(?:declared input|user[- ]provided|informado pelo usu[aá]rio|declarado pelo usu[aá]rio|aportado por el usuario)\s*[·|—-]\s*(?:RentCast|Public GIS|GIS p[uú]blico)/gi],
];
const LOCALIZATION_BANS = {
  pt: /\b(?:price positioning|marketability review|Estimated Monthly Rent|Retrieved on|Current Rent|Current contract rent|No qualifying closed comparable|Property tax year|Primary decision blocker|Decision blockers)\b/gi,
  es: /\b(?:price positioning|marketability review|Estimated Monthly Rent|Retrieved on|Current contract rent|No qualifying closed comparable|Property tax year|Primary decision blocker|Decision blockers)\b/gi,
  en: /\b(?:Sinais positivos|Resumo executivo|Pr[oó]ximos passos recomendados|Imposto predial|Habitaciones|Se[ñn]ales positivas)\b/gi,
};
function scanText(text, language) {
  const found = [];
  for (const [code, pattern] of [...PROHIBITED, ['UNLOCALIZED_SYSTEM_COPY', LOCALIZATION_BANS[language]]]) {
    for (const match of text.matchAll(pattern)) found.push({ code, token: match[0],
      context: text.slice(Math.max(0, match.index - 65), match.index + match[0].length + 65) });
  }
  return found;
}
function auditZeros(text, vm, fixture) {
  const tokens = [...text.matchAll(/(?:US\$|USD|\$)\s*0(?:[,.]0{1,2})?(?![\d.,])|\b0(?:[,.]0+)?\s*%/g)];
  const explicit = Object.entries(vm.values || {}).filter(([, value]) => value.state === 'EXPLICIT_ZERO');
  const contexts = tokens.map(match => ({ token: match[0],
    context: text.slice(Math.max(0, match.index - 75), match.index + match[0].length + 75) }));
  const monetary = contexts.filter(item => /\$|USD/.test(item.token));
  // A zero in a table/currency field requires typed provenance. Evidence
  // coverage zeros are deterministic counts, not financial return claims.
  const capRateZeros = [...text.matchAll(/cap\s*rate\s*[:·—-]?\s*(?:indispon[ií]vel|unavailable|no disponible)?\s*0(?:[,.]0+)?\s*%/gi)];
  const legalMonetaryZeros = fixture.expected.explicitZeroDomains?.length ? explicit.length : 0;
  const falseMonetaryZeros = fixture.expected.noZero ? monetary.length : Math.max(0, monetary.length - legalMonetaryZeros);
  return { tokens: contexts, explicitZeroEvidence: explicit.map(([id, value]) => ({ id, ...value })),
    falseMonetaryZeros, falseCapRateZeros: capRateZeros.length,
    pass: falseMonetaryZeros === 0 && capRateZeros.length === 0 };
}
function sectionSubstantive(section) {
  return Boolean(section.text?.trim() || section.items?.some(item => item.text?.trim())
    || section.rows?.some(row => row.label?.trim() && row.value?.trim())
    || section.table?.rows?.length || section.hero?.value?.trim());
}
function auditSections(vm, pdfText, level, layoutAudit) {
  const sections = vm.sections || [];
  const empty = sections.filter(section => !sectionSubstantive(section)).map(section => section.id);
  const duplicateTitles = sections.map(section => section.title).filter((title, index, values) => values.indexOf(title) !== index);
  const thesis = vm.executive?.thesis;
  const missingSummary = level !== 'PROPERTY_RELEASE' && (!thesis?.text?.trim() || !thesis.evidenceRefs?.length);
  const collapsedDuplicates = sections.filter(section => section.title && !pdfText.includes(normalized(section.title))
    && section.items?.length && section.items.every(item => pdfText.includes(normalized(item.text))));
  // Reference grids combine property/tax groups under one visual card. Their
  // audited panel mappings plus the independent value audit prove containment.
  const composedFacts = new Set((layoutAudit?.sections || []).filter(section => ['reference-facts', 'reference-panel'].includes(section.kind)).map(section => section.sectionId));
  // A complete evidence detail may share a conclusion card instead of repeating
  // its section heading. Keep its traced section ID; the content audit below
  // independently requires every source value and complete claim to remain.
  if ((layoutAudit?.sections || []).some(section => section.kind === 'reference-panel')) {
    for (const line of layoutAudit.lines || []) composedFacts.add(line.sectionId);
  }
  const missingExpectedSections = sections.filter(section => section.title && !pdfText.includes(normalized(section.title)) && !composedFacts.has(section.id)
    && !collapsedDuplicates.includes(section))
    .map(section => section.id);
  return { emptySections: empty, duplicateTitles, missingExecutiveSummary: missingSummary,
    substantiveSections: sections.length - empty.length, omittedSections: vm.diagnostics || [],
    missingExpectedSections, collapsedDuplicateSections: collapsedDuplicates.map(section => section.id),
    pass: empty.length === 0 && !missingSummary && missingExpectedSections.length === 0 };
}
function auditLayout(audit, pageTexts, pdfBoxes) {
  const lines = audit?.lines || [];
  const body = lines.filter(line => !/^(?:header|footer)/i.test(line.sectionId));
  const clipping = lines.filter(line => (line.overflowX || 0) > 0.1 || (line.overflowY || 0) > 0.1);
  const footerOverlap = body.filter(line => line.bottomY > 798.5);
  const textOutsidePage = pdfBoxes.filter(box => box.x < -0.8 || box.right > box.pageWidth + 0.8
    || box.top < -0.8 || box.bottom > box.pageHeight + 0.8);
  const collisions = [];
  for (let index = 0; index < body.length; index += 1) {
    for (let second = index + 1; second < body.length; second += 1) {
      const a = body[index], b = body[second];
      if (a.page !== b.page || a.sectionId === b.sectionId) continue;
      const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.bottomY, b.bottomY) - Math.max(a.y, b.y);
      if (overlapX > 1 && overlapY > 1) collisions.push({ page: a.page, a: a.sectionId, b: b.sectionId, overlapX, overlapY });
    }
  }
  const mapClipping = (audit?.maps || []).flatMap(map => map.points.filter(point =>
    point.x - point.radius < map.bounds.x - 0.1 || point.x + point.radius > map.bounds.x + map.bounds.width + 0.1
    || point.y - point.radius < map.bounds.y - 0.1 || point.y + point.radius > map.bounds.y + map.bounds.height + 0.1)
    .map(point => ({ sectionId: map.sectionId, page: map.page, point })));
  const pages = pageTexts.map((text, index) => {
    const page = index + 1, own = body.filter(line => line.page === page);
    const ids = new Set(own.map(line => line.sectionId));
    const bounds = [...(audit?.sections || []).filter(section => section.page === page).map(section => section.bounds),
      ...(audit?.maps || []).filter(map => map.page === page).map(map => map.bounds)].filter(Boolean);
    const bottom = Math.max(110, ...bounds.map(bound => bound.y + bound.height), ...own.map(line => line.bottomY));
    const top = Math.min(110, ...bounds.map(bound => bound.y), ...own.map(line => line.y));
    const usedVerticalRatio = Number(((bottom - Math.max(100, top)) / 688).toFixed(3));
    return { page, textCharacters: text.length, auditedLines: own.length,
      substantiveSections: [...ids], contentTop: top, contentBottom: bottom,
      usedVerticalRatio,
      possibleSparsePage: text.length < 180 && ids.size < 2 || page > 1 && usedVerticalRatio < 0.5
        && own.length < 15 && !(audit?.maps || []).some(map => map.page === page) };
  });
  const genericContinuations = (audit?.continuations || []).filter(item => /preserv|remainingContent|overflowItems/i.test(item.sectionId));
  return { auditedLineCount: lines.length, clipping, footerOverlap, textOutsidePage,
    crossSectionCollisions: collisions, maps: audit?.maps || [], mapMarkerClipping: mapClipping,
    pages, continuations: audit?.continuations || [],
    genericContinuations, pass: lines.length > 0 && clipping.length === 0 && footerOverlap.length === 0
      && textOutsidePage.length === 0 && collisions.length === 0 && mapClipping.length === 0 && genericContinuations.length === 0
      && !pages.some(page => page.possibleSparsePage) };
}
function auditEvidence(vm) {
  const claims = [vm.executive?.thesis, vm.executive?.opportunity, vm.executive?.risk, vm.executive?.blocker,
    ...(vm.sections || []).flatMap(section => section.items || [])].filter(Boolean);
  const allowed = new Set((vm.evidencePacket || []).map(item => item.id));
  const missingRefs = claims.filter(claim => !claim.evidenceRefs?.length);
  const unknownRefs = claims.flatMap(claim => (claim.evidenceRefs || [])
    .filter(reference => !allowed.has(reference)).map(reference => ({ text: claim.text, reference })));
  return { claims: claims.length, evidencePacketEntries: allowed.size, missingRefs, unknownRefs,
    pass: missingRefs.length === 0 && unknownRefs.length === 0 };
}
function auditContent(vm, text, logicalBodyText) {
  const normalizedText = normalized(text);
  const rows = [...vm.property.metrics, ...vm.property.facts.flatMap(group => group.rows),
    ...vm.sections.flatMap(section => section.rows || [])];
  const missingRowValues = rows.filter(row => row.value && !normalizedText.includes(normalized(row.value)))
    .map(row => ({ label: row.label, value: row.value }));
  const tableCells = vm.sections.flatMap(section => section.table?.rows?.flat() || []);
  const missingTableCells = tableCells.filter(value => value && !normalizedText.includes(normalized(value)));
  const logical = normalized(logicalBodyText);
  const missingNotes = vm.property.notes.filter(note => !logical.includes(normalized(note)));
  const missingClaimTexts = vm.sections.flatMap(section => section.items || [])
    .filter(item => !logical.includes(normalized(item.text))).map(item => item.text);
  const actions = vm.sections.find(section => section.id === 'next-actions')?.items || [];
  const activeBlockers = new Set(vm.evidencePacket.filter(item => item.id.startsWith('blocker:'))
    .map(item => item.id.slice('blocker:'.length)));
  const actionsWithoutBlockers = actions.filter(item => !(item.evidenceRefs || []).some(reference =>
    reference.startsWith('action:') && activeBlockers.has(reference.slice('action:'.length))));
  const duplicateActions = actions.map(item => item.text).filter((item, index, values) => values.indexOf(item) !== index);
  return { missingRowValues, missingTableCells, missingNotes, missingClaimTexts, actionsWithoutBlockers, duplicateActions,
    prioritizedActions: actions.length,
    pass: !missingRowValues.length && !missingTableCells.length && !missingNotes.length && !missingClaimTexts.length
      && !actionsWithoutBlockers.length && !duplicateActions.length && actions.length <= 3 };
}
function auditMarket(vm, fixture, text, level, viewport) {
  const expected = fixture.expected;
  const rental = (vm.sections || []).find(section => section.table?.rows?.some(row => expected.rentalAddresses?.some(address => row.includes(address))));
  const sold = (vm.sections || []).find(section => section.table?.rows?.some(row => expected.soldAddresses?.some(address => row.includes(address))));
  const control = {};
  const inspect = (section, addresses, expectedCount) => {
    const points = section?.map?.points || [], comparablePoints = points.filter(point => point.marker !== 'S');
    const frame = points.length ? viewport(points) : null;
    return { sectionId: section?.id || null, tableRows: section?.table?.rows?.length || 0,
      expectedRows: addresses.length, missingTableAddresses: addresses.filter(address => !text.includes(address)),
      subjectMarker: points.some(point => point.marker === 'S'), markers: comparablePoints.map(point => point.marker),
      ids: comparablePoints.map(point => point.id), expectedMarkers: expectedCount,
      mapTableOrderMismatch: comparablePoints.filter((point, index) => point.marker !== String(index + 1)).length,
      mapTableIdMismatch: comparablePoints.filter((point, index) => {
        const rowReferences = section?.table?.evidenceRefs?.[index] || [];
        const sourceEntry = vm.evidencePacket.find(entry => entry.id === point.id);
        return !rowReferences.includes(point.id) || !sourceEntry?.text.includes(addresses[index]);
      }).length,
      pointsInsidePaddedBounds: Boolean(frame && frame.world.every(point => point.x - frame.left >= frame.padding - 0.01
        && point.x - frame.left <= frame.width - frame.padding + 0.01
        && point.y - frame.top >= frame.padding - 0.01 && point.y - frame.top <= frame.height - frame.padding + 0.01)) };
  };
  if (expected.rental && level === 'DEAL_INTELLIGENCE') control.rental = inspect(rental, expected.rentalAddresses, expected.rentalMarkers);
  if (expected.arv && level === 'DEAL_INTELLIGENCE') control.sold = inspect(sold, expected.soldAddresses, expected.soldMarkers);
  const rentWords = /(?:Comparable Rentals|Compar[aá]veis de aluguel|Alquileres comparables)/i;
  const forbidsDetailedRent = level !== 'DEAL_INTELLIGENCE' || expected.noRental;
  const irrelevantRent = forbidsDetailedRent && (rentWords.test(text) || Boolean(rental)
    || expected.noRental && vm.sections.some(section => ['market-rent', 'operating-evidence'].includes(section.id)));
  const landResidentialRows = expected.noResidentialFacts
    ? vm.property.metrics.filter(row => /(?:beds|baths|quartos|banheiros|habita[çc][õo]es|habitaciones|ba[ñn]os|living area|[aá]rea [uú]til|rehab|reforma)/i.test(row.label)) : [];
  const noArvViolation = expected.noArvModule && (vm.sections || []).some(section => section.table?.rows?.length && /arv/i.test(section.id));
  const semanticFailures = [];
  if (expected.conflict && !['CONFLICTED'].includes(vm.values.lotSizeSqft?.state)) semanticFailures.push('LOT_CONFLICT_NOT_PRESERVED');
  if (expected.conflict && ['VALUE', 'PROVISIONAL'].includes(vm.values.pricePerAcre?.state)) semanticFailures.push('UNRESOLVED_AREA_USED_FOR_PRICE_PER_ACRE');
  if (expected.zoning && !text.includes(expected.zoning)) semanticFailures.push('PUBLISHER_ZONING_LOST');
  const formattedMoney = value => new Intl.NumberFormat(vm.locale === 'pt' ? 'pt-BR' : vm.locale === 'es' ? 'es-US' : 'en-US',
    { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  if (expected.rental) {
    const normalizedText = normalized(text), main = normalized(formattedMoney(expected.rentalRent));
    if (level !== 'PROPERTY_RELEASE' && !normalizedText.includes(main)) semanticFailures.push('MAIN_MARKET_RENT_MISSING');
    if (level === 'PROPERTY_RELEASE' && normalizedText.includes(main)) semanticFailures.push('L1_MARKET_RENT_EXPOSED');
    for (const value of [expected.rentalLow, expected.rentalHigh]) {
      const hasRangeAmount = normalizedText.includes(normalized(formattedMoney(value)));
      if (level === 'DEAL_INTELLIGENCE' && !hasRangeAmount) semanticFailures.push('L3_RENT_RANGE_MISSING');
      if (level !== 'DEAL_INTELLIGENCE' && hasRangeAmount) semanticFailures.push('LOWER_LEVEL_RENT_RANGE_EXPOSED');
    }
    if (expected.currentRent && !normalizedText.includes(normalized(formattedMoney(expected.currentRent)))) semanticFailures.push('CURRENT_RENT_LOST');
  }
  const pass = Object.values(control).every(item => item.tableRows === item.expectedRows && !item.missingTableAddresses.length
    && item.subjectMarker && item.markers.length === item.expectedMarkers && item.mapTableOrderMismatch === 0
    && item.mapTableIdMismatch === 0 && item.pointsInsidePaddedBounds);
  return { ...control, irrelevantRent: Boolean(irrelevantRent), landResidentialRows, noArvViolation: Boolean(noArvViolation), semanticFailures,
    pass: pass && !irrelevantRent && !landResidentialRows.length && !noArvViolation && !semanticFailures.length };
}
async function contactSheet(images, path) {
  const width = 360, columns = Math.min(3, images.length), padding = 12;
  const height = Math.ceil(width * 841.89 / 595.28), rows = Math.ceil(images.length / columns);
  const canvas = createCanvas(columns * (width + padding) + padding, rows * (height + 32 + padding) + padding);
  const context = canvas.getContext('2d'); context.fillStyle = '#dbe3e8'; context.fillRect(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < images.length; index += 1) {
    const image = await loadImage(images[index]);
    const x = padding + (index % columns) * (width + padding), y = padding + Math.floor(index / columns) * (height + 32 + padding);
    context.fillStyle = '#193448'; context.font = 'bold 15px sans-serif'; context.fillText(`Page ${index + 1}`, x, y + 19);
    context.drawImage(image, x, y + 27, width, height);
  }
  await writeFile(path, await canvas.encode('png'));
}

const server = await createServer({ root, optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, watch: { usePolling: false } }, appType: 'custom' });
const results = [];
try {
  const initialSourceHashes = await sourceHashes();
  const { buildMaxxisReportSchema } = await server.ssrLoadModule('/src/domain/maxxis/maxxisReportSchema.js');
  const { renderMaxxisReportPdf } = await server.ssrLoadModule('/src/features/maxxis/export/maxxisReportPdf.js');
  const { prepareReportMaps } = await server.ssrLoadModule('/src/features/maxxis/export/reportMapAssets.js');
  const { buildStrictReportViewModel, validateReportViewModel, validateRenderedReportText } = await server.ssrLoadModule('/src/features/maxxis/export/reportIntegrityViewModel.ts');
  const { comparableMapViewport } = await server.ssrLoadModule('/src/features/maxxis/export/comparableMapGeometry.ts');
  const { resolveReportExportEntitlement } = await server.ssrLoadModule('/src/features/maxxis/export/reportExportEntitlement.js');
  const { buildFinancialEvidenceStack } = await server.ssrLoadModule('/supabase/functions/_shared/maxxis/financialEvidence.ts');
  const { buildFinancialInputReadiness } = await server.ssrLoadModule('/supabase/functions/_shared/maxxis/financialReadiness.ts');
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const heroImage = `data:image/jpeg;base64,${(await readFile(`${root}src/assets/maxxis/report-previews/sample-property-photo.jpg`)).toString('base64')}`;
  const fixtures = (args.get('long-notes') ? [reportIntegrityLongNotesFixture(languages[0])]
    : reportIntegrityFixtures({ heroImage })).filter(fixture => !selection || selection.includes(fixture.id));
  if (!fixtures.length) throw new Error('QA_FIXTURE_SELECTION_EMPTY');
  for (const fixture of fixtures) {
    if (fixture.financialCandidates) {
      const financialEvidence = buildFinancialEvidenceStack({ propertyId: fixture.input.property.id,
        candidates: fixture.financialCandidates, occupancy: 'OCCUPIED', leaseStatus: 'LEASED' });
      const financialReadiness = buildFinancialInputReadiness(financialEvidence, { propertyType: fixture.input.property.type,
        strategy: fixture.input.property.objective, valueBasis: { kind: 'ASKING_PRICE', value: fixture.input.property.price } });
      Object.assign(fixture.input.dealIntelligence, { financialEvidence, financialReadiness });
      Object.assign(fixture.input.maxxisAnalysis, { financialEvidence, financialReadiness });
    }
    const levels = args.get('recovery') ? (fixture.id === 'RENTAL_MARKET_RICH' ? ['DEAL_INTELLIGENCE', 'MAXXIS_ANALYSIS'] : ['DEAL_INTELLIGENCE']) : args.get('l3-only') || !['LOW_EVIDENCE_SELL', 'RENTAL_MARKET_RICH'].includes(fixture.id)
      ? ['DEAL_INTELLIGENCE'] : ['DEAL_INTELLIGENCE', 'PROPERTY_RELEASE', 'MAXXIS_ANALYSIS'];
    for (const language of languages) for (const level of levels) {
      const levelSuffix = level === 'DEAL_INTELLIGENCE' ? '' : level === 'PROPERTY_RELEASE' ? '-l1' : '-l2';
      const localeSuffix = language === 'pt' ? '' : `-${language}`;
      const basename = `golden-${fixture.slug}${levelSuffix}${localeSuffix}`;
      const started = performance.now(), fetchBefore = networkAttempts.length, imagesBefore = imageNetworkAttempts.length;
      const currentInput = fixture.localizedRegressionNotes ? { ...fixture.input,
        property: { ...fixture.input.property, localizedPropertyUserNotes: {
          translation: fixture.localizedRegressionNotes[language],
        } } } : fixture.input;
      const schema = buildMaxxisReportSchema({ ...currentInput, reportType: level, resolvedUserLocale: language });
      const vm = buildStrictReportViewModel({ schema, language });
      const modelValidation = validateReportViewModel(vm);
      if (args.get('recovery-maps')) {
        class PreparedTile extends Image {
          set src(value) {
            if (!/^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/.test(value)) throw new Error('QA_TILE_NOT_ALLOWED');
            originalFetch(value, { headers: { 'User-Agent': 'DealSifter report visual validation' }, signal: AbortSignal.timeout(3000) })
              .then(r => { if (!r.ok) throw new Error('TILE_UNAVAILABLE'); return r.arrayBuffer(); })
              .then(bytes => { super.src = Buffer.from(bytes); }).catch(() => this.onerror?.());
          }
          get src() { return super.src; }
        }
        globalThis.Image = PreparedTile;
        try { await prepareReportMaps(schema, language); } finally { globalThis.Image = OfflineImage; }
      }
      const result = await renderMaxxisReportPdf({ schema, language, generatedAt: REPORT_FIXTURE_TIME,
        exportEntitlement: resolveReportExportEntitlement({ plan: 'enterprise', reportType: level, channel: 'PDF' }) });
      const record = { fixture: fixture.id, basename, language, level, syntheticFixture: true,
        renderedState: result.state, modelValidation, inputHash: hash(JSON.stringify(currentInput)),
        rendererNetworkAttempts: networkAttempts.length - fetchBefore, rendererImageNetworkAttempts: imageNetworkAttempts.length - imagesBefore };
      if (result.state !== 'RENDERED' || !result.document?.binary) {
        record.validation = result.validation; record.pass = false; results.push(record);
        await saveJson(`${basename}-validation.json`, record);
        failures.push(`${basename}: ${result.state}`); continue;
      }
      const binary = new Uint8Array(result.document.binary);
      await writeFile(`${directory}/${basename}.pdf`, binary);
      const pdf = await getDocument({ data: new Uint8Array(await readFile(`${directory}/${basename}.pdf`)), useSystemFonts: true }).promise;
      const pageTexts = [], logicalBodyChunks = [], boxes = [], images = [];
      for (let number = 1; number <= pdf.numPages; number += 1) {
        const page = await pdf.getPage(number), contents = await page.getTextContent();
        const unscaled = page.getViewport({ scale: 1 });
        pageTexts.push(normalized(contents.items.map(item => item.str || '').join(' ')));
        for (const item of contents.items.filter(item => item.str?.trim())) {
          const x = item.transform[4], baseline = unscaled.height - item.transform[5];
          if (baseline >= 130 && baseline < 800 && !vm.sections.some(section => normalized(section.title) === normalized(item.str))) {
            logicalBodyChunks.push(item.str);
          }
          boxes.push({ page: number, text: item.str, x, top: baseline - item.height * 0.85,
            right: x + item.width, bottom: baseline + item.height * 0.15,
            pageWidth: unscaled.width, pageHeight: unscaled.height });
        }
        const viewport = page.getViewport({ scale }), canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport, canvas }).promise;
        const png = `${directory}/${basename}-page-${number}.png`; images.push(png);
        await writeFile(png, await canvas.encode('png'));
      }
      const text = pageTexts.join('\n\n');
      await writeFile(`${directory}/${basename}-text.txt`, text + '\n');
      await contactSheet(images, `${directory}/${basename}-contact.png`);
      await pdf.cleanup();
      const leaks = scanText(text, language), zeroAudit = auditZeros(text, vm, fixture);
      const sectionAudit = auditSections(vm, text, level, result.document.layoutAudit), layout = auditLayout(result.document.layoutAudit, pageTexts, boxes);
      const evidenceAudit = auditEvidence(vm), marketAudit = auditMarket(vm, fixture, text, level, comparableMapViewport);
      const contentAudit = auditContent(vm, text, logicalBodyChunks.join(' '));
      const renderedTextValidation = validateRenderedReportText(text);
      const identityVisible = text.includes(fixture.expected.address);
      const maxPagesPass = args.get('recovery') ? level !== 'DEAL_INTELLIGENCE' || pageTexts.length >= 5 && pageTexts.length <= 10 : !fixture.expected.maxPages || pageTexts.length <= fixture.expected.maxPages;
      Object.assign(record, { pages: pageTexts.length, durationMs: Math.round(performance.now() - started),
        pdfSha256: hash(binary), reopenedStoredArtifact: true, strictViewModelVersion: vm.version,
        identityVisible, leaks, zeroAudit, sectionAudit, layout, evidenceAudit, marketAudit, contentAudit, renderedTextValidation,
        images: images.map(path => path.replaceAll('\\', '/')), contactSheet: `${directory}/${basename}-contact.png`,
        maxPagesPass, sourceTraceability: vm.evidencePacket,
        pass: modelValidation.valid === true && renderedTextValidation.valid === true && identityVisible
          && !leaks.length && zeroAudit.pass && sectionAudit.pass && layout.pass && evidenceAudit.pass && marketAudit.pass && contentAudit.pass
          && maxPagesPass && networkAttempts.length === fetchBefore && imageNetworkAttempts.length === imagesBefore });
      results.push(record);
      await saveJson(`${basename}-validation.json`, record);
      await saveJson(`${basename}-view-model.json`, vm);
      if (!record.pass) failures.push(basename);
      process.stdout.write(`${basename}: pages=${record.pages} leaks=${leaks.length} layout=${layout.pass} market=${marketAudit.pass} ${record.pass ? 'PASS' : 'FAIL'}\n`);
    }
  }
  const l3 = results.filter(record => record.level === 'DEAL_INTELLIGENCE');
  const dynamic = languages.map(language => {
    const weak = l3.find(record => record.fixture === 'LOW_EVIDENCE_SELL' && record.language === language);
    const rich = l3.find(record => record.fixture === 'RENTAL_MARKET_RICH' && record.language === language);
    return { language, weakPages: weak?.pages, richPages: rich?.pages,
      // Approved page grids can fit a richer evidence set in the same six pages;
      // completeness is checked independently against every displayed row/claim.
      pass: !weak || !rich || rich.pages >= weak.pages };
  });
  const finalSourceHashes = await sourceHashes();
  const changedSourcesDuringRun = sourcePaths.filter(path => initialSourceHashes[path] !== finalSourceHashes[path]);
  const summary = { generatedAt: new Date().toISOString(), syntheticFixturesOnly: true,
    sourceHashes: finalSourceHashes, sourceDigest: hash(JSON.stringify(finalSourceHashes)), changedSourcesDuringRun,
    reportCount: results.length, goldenFixtureCount: fixtures.length, locales: languages,
    actualPdfArtifacts: results.filter(record => record.renderedState === 'RENDERED').length,
    goldenReports: fixtures.map(fixture => ({ id: fixture.id,
      locales: l3.filter(record => record.fixture === fixture.id).map(record => ({ language: record.language, pages: record.pages, pass: record.pass })),
      pass: l3.filter(record => record.fixture === fixture.id).every(record => record.pass) })),
    dynamic, networkAttempts, imageNetworkAttempts, actualRentCastCalls: 0, actualGISCalls: 0,
    reportReopenProviderCalls: 0, authenticatedProductionSmoke: 'BLOCKED',
    manualVisualReview: 'PENDING_MAIN_AGENT_INSPECTION', executiveWowReview: 'PENDING_MAIN_AGENT_INSPECTION',
    failures, pass: results.every(record => record.pass) && dynamic.every(record => record.pass) && changedSourcesDuringRun.length === 0
      && networkAttempts.length === 0 && imageNetworkAttempts.length === 0 };
  await saveJson('golden-report-validation.json', summary);
  await saveJson('prohibited-output-scan.json', { pass: results.every(record => record.leaks?.length === 0),
    reports: results.map(record => ({ report: record.basename, leaks: record.leaks })),
    scannedActualPdfCount: summary.actualPdfArtifacts });
  await saveJson('false-zero-audit.json', { pass: results.every(record => record.zeroAudit?.pass),
    reports: results.map(record => ({ report: record.basename, ...record.zeroAudit })) });
  await saveJson('empty-section-audit.json', { pass: results.every(record => record.sectionAudit?.pass),
    reports: results.map(record => ({ report: record.basename, ...record.sectionAudit })) });
  await saveJson('pdf-text-e2e.json', { reportCount: results.length, actualPdfCount: summary.actualPdfArtifacts,
    pass: results.every(record => record.renderedTextValidation?.valid && record.identityVisible),
    reports: results.map(record => ({ report: record.basename, pages: record.pages,
      identityVisible: record.identityVisible, validation: record.renderedTextValidation })) });
  await writeFile(`${directory}/visual-regression-summary.md`, `# Golden PDF visual validation\n\n${results.length} deterministic PDFs generated; every page rasterized at ${scale}×, with per-document contact sheets.\n\nAutomated layout: ${results.every(record => record.layout?.pass) ? 'PASS' : 'FAIL'}.\n\nManual inspection: PENDING. Algorithmic geometry is not an executive-WOW approval.\n\n${results.map(record => `- ${record.basename}: ${record.pages || 0} pages; ${record.pass ? 'PASS' : 'FAIL'}; contact: ${record.basename}-contact.png`).join('\n')}\n`);
  process.stdout.write(JSON.stringify(summary) + '\n');
  if (!summary.pass) process.exitCode = 1;
} finally {
  await server.close();
  globalThis.fetch = originalFetch; globalThis.Image = originalImage; globalThis.document = originalDocument;
}
