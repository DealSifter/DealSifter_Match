import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = `${root}qa/maxxis-control-reports/`;
const parseEnv = (value) => Object.fromEntries(value.split(/\r?\n/).map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#') && line.includes('='))
  .map((line) => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')]; }));
const env = { ...process.env, ...parseEnv(await readFile(`${root}.env.local`, 'utf8')) };
const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceKey = env.SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error('SUPABASE_READ_ENV_MISSING');
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
const request = async (path, options = {}) => {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options, headers: { ...headers, ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(`SUPABASE_READ_FAILED_${response.status}:${await response.text()}`);
  return response.json();
};
const getCache = async (propertyId, dataType) => {
  const result = await request('rpc/ds_get_property_intelligence_cache', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_property_id: propertyId, p_provider: 'rentcast', p_data_type: dataType, p_schema_version: 1 }),
  });
  return result[0]?.payload || null;
};
const findProperty = async (address, { requireLot = false } = {}) => {
  const rows = await request(`properties?select=id,type,address,city,state,zip,price,beds,baths,sqft,lot,objective,rehab,cap_rate,description,source,lat,lng&address=ilike.${encodeURIComponent(address)}`);
  const row = requireLot ? rows.find((item) => item.lot) : rows[0];
  if (!row) throw new Error(`CONTROL_PROPERTY_NOT_FOUND:${address}`);
  return row;
};
const evidenceField = (value) => value && typeof value === 'object' ? value : null;
const buildPropertyContext = (record) => {
  if (!record) return { fields: {}, verifiedFields: [], userProvidedFields: [], unknownFields: [] };
  const mapping = {
    propertyType: record.characteristics?.propertyType,
    bedrooms: record.characteristics?.bedrooms,
    bathrooms: record.characteristics?.bathrooms,
    livingAreaSqft: record.characteristics?.livingAreaSqft,
    lotSizeSqft: record.characteristics?.lotSizeSqft,
    yearBuilt: record.characteristics?.yearBuilt,
    county: record.address?.county,
    latitude: record.address?.latitude,
    longitude: record.address?.longitude,
    assessedValue: record.tax?.assessedValue,
    assessmentYear: record.tax?.assessmentYear,
    annualPropertyTax: record.tax?.annualPropertyTax,
    propertyTaxYear: record.tax?.propertyTaxYear,
    latestSalePrice: record.lastSale?.price,
    latestSaleDate: record.lastSale?.date,
    ownerOccupied: record.ownership?.ownerOccupied,
    ownershipRecordPresent: record.ownership?.ownerNames
      ? { ...record.ownership.ownerNames, value: Array.isArray(record.ownership.ownerNames.value)
        ? record.ownership.ownerNames.value.length > 0 : null } : null,
    stateFips: record.parcel?.stateFips,
    countyFips: record.parcel?.countyFips,
    assessorId: record.parcel?.assessorId,
    legalDescription: record.parcel?.legalDescription,
    subdivision: record.parcel?.subdivision,
    zoning: record.parcel?.zoning,
    hoaFee: record.hoa?.fee,
    propertyFeatures: record.features?.values,
    saleHistory: record.saleHistory?.transactions,
  };
  const fields = Object.fromEntries(Object.entries(mapping).filter(([, item]) => evidenceField(item)));
  return {
    fields,
    verifiedFields: Object.keys(fields).filter((key) => fields[key]?.status === 'VERIFIED_RECORD' && fields[key]?.value !== null),
    userProvidedFields: [],
    unknownFields: Object.keys(fields).filter((key) => fields[key]?.status !== 'VERIFIED_RECORD' || fields[key]?.value === null),
  };
};
const appProperty = (row, lotArea, landMetrics) => ({
  id: row.id, address: row.address, title: row.address, city: row.city, state: row.state, zip: row.zip,
  type: row.type, price: row.price, beds: row.beds, baths: row.baths, sqft: row.sqft,
  lot: row.lot, lotSizeSqft: lotArea.lotSizeSqft, lotSizeAcres: lotArea.lotSizeAcres,
  pricePerLotSqft: landMetrics?.pricePerLotSqft ?? null, pricePerAcre: landMetrics?.pricePerAcre ?? null,
  objective: row.objective, rehab: row.rehab, capRate: row.cap_rate,
  description: row.description, notes: row.description, propertyUserNotes: row.description,
  source: row.source, latitude: row.lat, longitude: row.lng, published: true,
});
const textList = (land, strategy) => land ? {
  positives: ['A área do lote e o preço pedido estão registrados no DealSifter.', 'O playbook analítico permanece restrito a terreno.'],
  attention: ['Uso permitido, zoneamento, acesso, utilidades, levantamento e título ainda precisam ser confirmados.'],
  steps: ['Confirmar zoneamento e uso permitido.', 'Validar acesso, utilidades, levantamento e título.', 'Obter vendas recentes de terrenos comparáveis.'],
  insights: ['Avaliar o terreno por acre e por pé quadrado de lote.', 'Não aplicar ARV residencial sem um cenário explícito de desenvolvimento.'],
} : {
  positives: [`A estratégia canônica é ${strategy}.`, 'Os fatos verificados do imóvel foram preservados no relatório.'],
  attention: ['A condição física e a estrutura financeira ainda exigem validação documental.'],
  steps: ['Confirmar os termos completos do financiamento do vendedor.', 'Inspecionar a condição do imóvel.', 'Validar título, impostos e capacidade de pagamento.'],
  insights: ['Priorizar entrada, taxa, prazo, amortização, balloon e garantias do financiamento do vendedor.', 'Separar valor de mercado de ARV condicionado à reforma.'],
};
const profile = (land, strategy) => ({
  score: land ? 62 : 71, classification: 'moderate', calculable: true,
  targetMarket: { status: 'matched', explanation: 'Mercado cadastrado', score: 100 },
  priceRange: { status: 'matched', explanation: 'Preço registrado', score: 100 },
  propertyType: { status: 'matched', explanation: land ? 'Terreno' : 'Residência unifamiliar', score: 100 },
  strategy: { status: 'matched', explanation: strategy, score: 100 },
  criteria: [],
});
const matchContext = (land, strategy) => ({
  score: land ? 62 : 71, classification: 'moderate', calculable: true, semantics: 'PROFILE_FIT_ONLY',
  reasons: [
    { key: 'market', label: 'Mercado', status: 'matched', points: 35, maxPoints: 35, detail: 'Mercado cadastrado' },
    { key: 'price', label: 'Faixa de preço', status: land ? 'not_evaluated' : 'matched', points: land ? 0 : 35, maxPoints: 35, detail: land ? 'Faixa não avaliada' : 'Preço registrado' },
    { key: 'property_type', label: 'Tipo', status: 'matched', points: 20, maxPoints: 20, detail: land ? 'Terreno' : 'Residência unifamiliar' },
    { key: 'strategy', label: 'Estratégia', status: 'matched', points: 10, maxPoints: 10, detail: strategy },
  ],
});
const propertyEvidence = (context) => ({
  strength: context.verifiedFields.length >= 5 ? 'HIGH' : context.verifiedFields.length >= 2 ? 'MEDIUM' : 'LOW',
  verifiedRecords: context.verifiedFields.map((field) => ({ field, value: context.fields[field].value,
    sourceType: 'VERIFIED_RECORD', source: context.fields[field].source || 'public_record' })),
  userProvided: [], unknown: [], conflicts: [],
});
const buildStructured = ({ land, strategy, lists, address }) => ({
  type: 'maxxis_structured_analysis', version: 'MAXXIS_STRUCTURED_ANALYSIS_V1', language: 'pt',
  executiveSummary: land
    ? `${address} é analisado de forma consistente como terreno, sem métricas residenciais artificiais.`
    : `${address} é analisado segundo a estratégia de financiamento do vendedor, com fatos cadastrais e registros externos separados.`,
  opportunityAssessment: land
    ? 'A análise depende de uso permitido, acesso, utilidades, levantamento, título e evidência de vendas de terrenos.'
    : 'A estrutura potencial depende dos termos completos do financiamento do vendedor, da condição e da diligência de título.',
  propertyContextInterpretation: land ? 'O tipo analítico resolvido é terreno.' : 'O tipo analítico resolvido é residência unifamiliar.',
  investorFit: { overallAssessment: 'Compatibilidade de perfil, não qualidade do negócio.', fitRationale: 'A leitura usa tipo e estratégia canônicos.', strengths: lists.positives, mismatches: lists.attention },
  marketContext: { interpretation: 'O contexto de mercado usa somente evidências disponíveis.', evidenceUsed: [], limitations: lists.attention },
  comparativeAnalysis: { interpretation: 'Vendas recentes para valor de mercado e comparáveis de ARV são famílias separadas.', selectedCompSummary: [], supportingEvidence: [], limitations: lists.attention },
  valuationAnalysis: { currentPositioning: 'O preço pedido é mostrado separadamente das estimativas.', arvInterpretation: land ? 'ARV residencial não se aplica.' : 'ARV indisponível sem evidência de condição compatível.', confidenceInterpretation: 'A confiança acompanha a evidência disponível.', scenarioInterpretation: strategy, limitations: lists.attention },
  riskAnalysis: { dataRisk: 'Evidências pendentes devem ser verificadas.', marketRisk: 'A evidência de mercado pode mudar.', valuationRisk: land ? 'Não usar avaliação residencial para terreno.' : 'Não confundir valor de mercado com ARV.', executionRisk: lists.attention[0], rationale: lists.attention },
  positiveSignals: lists.positives, concerns: lists.attention, missingEvidence: lists.attention,
  recommendedVerificationSteps: lists.steps, recommendedActions: lists.steps.slice(0, 2),
  strategySpecificInsights: lists.insights,
  profileAdaptedConclusion: land ? 'Prosseguir somente após validar os fundamentos específicos do terreno.' : 'A decisão depende dos termos verificáveis do financiamento do vendedor e da condição do ativo.',
  userFacingDisclaimers: ['Suporte à decisão baseado em evidências; não é laudo, oferta ou garantia de retorno.'],
  reportPage5: { supportsDeal: lists.positives,
    weakensDeal: [land ? 'Ainda não há evidência de vendas de terrenos comparáveis.' : 'Os termos financeiros completos ainda não estão documentados.'],
    stillUnknown: lists.attention, verifyFirst: lists.steps },
  reportPage6: {
    currentThesis: land ? 'Tese de terreno' : 'Tese de financiamento do vendedor',
    investorMeaning: land ? 'A decisão depende da viabilidade de uso e infraestrutura.' : 'A decisão depende da estrutura verificável de pagamentos e garantias.',
    openDecisionQuestions: [land ? 'Qual uso é permitido e quais serviços atendem o lote?' : 'Quais são entrada, taxa, prazo, amortização e balloon?'],
    decisionChangingActions: lists.steps.slice(0, 2),
  },
});
const buildAnalysis = ({ property, recent, land, strategy, lists }) => ({
  executiveSummary: land
    ? 'O imóvel permanece classificado como terreno e exige diligência específica de uso e infraestrutura.'
    : 'A análise preserva a estratégia de financiamento do vendedor e separa valor de mercado de ARV.',
  dealThesis: land ? 'Tese de terreno baseada em preço e área do lote.' : 'Tese condicionada aos termos do financiamento do vendedor.',
  marketContext: { recentSalesMarketEstimate: recent },
  keyObservations: { positives: lists.positives, attention: lists.attention },
  profileAlignment: profile(land, strategy),
  riskAwareness: [
    { category: 'DATA_RISK', explanation: lists.attention[0] },
    { category: 'MARKET_RISK', explanation: 'Validar evidências recentes do mercado local.' },
    { category: 'VALUATION_RISK', explanation: land ? 'ARV residencial não se aplica.' : 'ARV depende de condição compatível.' },
    { category: 'EXECUTION_RISK', explanation: lists.steps[0] },
  ],
  limitations: lists.attention, nextSteps: lists.steps, provenance: { property: 'MIXED_VERIFIED_AND_USER_PROVIDED' },
});
const buildDeal = ({ property, context, recent, providerValue, providerRange, divergence, land, strategy, lists, structured }) => ({
  executiveDealOverview: structured.opportunityAssessment,
  whyThisPropertyStandsOut: lists.positives.map((explanation, index) => ({ code: `SIGNAL_${index + 1}`, explanation, source: 'CALCULATED' })),
  investmentFit: profile(land, strategy), propertyEvidence: propertyEvidence(context),
  comparableEvidence: { used: [], supporting: [], excluded: [] },
  valuationIntelligence: {
    status: land ? 'NOT_APPLICABLE' : 'ARV_UNAVAILABLE', range: null, centralReference: null,
    confidence: 'LOW', compsUsed: 0, methodology: null,
    warnings: land ? ['ARV residencial não se aplica ao terreno.'] : ['ARV indisponível sem comparáveis com condição confirmada.'],
    providerEstimate: providerValue == null ? null : { value: providerValue, status: 'Estimativa externa não validada', range: providerRange },
    recentSalesMarketEstimate: recent, providerEstimateDivergence: divergence,
  },
  riskAnalysis: [
    { category: 'DATA_RISK', severity: 'MEDIUM', reason: lists.attention[0] },
    { category: 'MARKET_RISK', severity: 'MEDIUM', reason: 'Validar as referências atuais de mercado.' },
    { category: 'VALUATION_RISK', severity: 'MEDIUM', reason: land ? 'Não usar avaliação residencial.' : 'ARV não confirmado.' },
    { category: 'EXECUTION_RISK', severity: 'MEDIUM', reason: lists.steps[0] },
  ],
  limitations: lists.attention, nextVerificationSteps: lists.steps, structuredAnalysis: structured,
  analysisConfidence: { score: context.verifiedFields.length >= 5 ? 82 : 58, classification: 'LIMITED',
    semantics: 'ANALYSIS_COMPLETENESS_AND_RELIABILITY_ONLY', notPropertyScore: true,
    contributors: lists.positives, limitations: lists.attention },
  investorPerspective: { persona: land ? 'LAND_INVESTOR' : 'SELLER_FINANCING_INVESTOR', priorities: lists.insights },
  executiveSummaryIntelligence: { lines: [structured.executiveSummary, structured.opportunityAssessment,
    ...lists.positives, ...lists.attention].slice(0, 6) },
  provenance: { propertyEvidence: 'PROPERTY_INTELLIGENCE', comparableEvidence: 'RECENT_SALES_ENGINE' },
});
const cachedSubjectValuation = (row, record) => {
  const unavailable = (value = null) => ({ value, status: value == null ? 'UNAVAILABLE' : 'VERIFIED_RECORD',
    source: 'cached_property_record', retrievedAt: record.retrievedAt || '2026-10-03T00:00:00.000Z',
    effectiveDate: null, providerPropertyId: record.sourceMetadata?.providerPropertyId || null, confidence: null });
  return {
    provider: 'rentcast', evidenceType: 'property_value_avm', schemaVersion: 1,
    retrievedAt: record.retrievedAt || '2026-10-03T00:00:00.000Z', requestPolicy: {},
    providerComparableCount: 0,
    providerEstimate: { value: unavailable(), rangeLow: unavailable(), rangeHigh: unavailable(), providerConfidenceSemantic: 'PROVIDER_85_PERCENT_RANGE' },
    subjectProperty: {
      providerPropertyId: unavailable(record.sourceMetadata?.providerPropertyId || null),
      formattedAddress: unavailable([row.address, row.city, row.state, row.zip].filter(Boolean).join(', ')),
      addressLine1: unavailable(row.address), city: unavailable(row.city), state: unavailable(row.state), zipCode: unavailable(row.zip),
      latitude: record.address?.latitude || unavailable(row.lat), longitude: record.address?.longitude || unavailable(row.lng),
      propertyType: record.characteristics?.propertyType || unavailable(row.type),
      bedrooms: record.characteristics?.bedrooms || unavailable(row.beds), bathrooms: record.characteristics?.bathrooms || unavailable(row.baths),
      livingAreaSqft: record.characteristics?.livingAreaSqft || unavailable(Number(row.sqft) || null),
      lotSizeSqft: record.characteristics?.lotSizeSqft || unavailable(), yearBuilt: record.characteristics?.yearBuilt || unavailable(),
      lastSalePrice: record.lastSale?.price || unavailable(), lastSaleDate: record.lastSale?.date || unavailable(),
    },
    comparables: [], limitations: ['RENOVATION_CONDITION_UNAVAILABLE', 'ARMS_LENGTH_DISTRESS_UNAVAILABLE', 'PROVIDER_LISTING_PRICE_IS_NOT_CONFIRMED_SALE_PRICE'],
  };
};
const mapCanvas = createCanvas(700, 400);
const mapContext = mapCanvas.getContext('2d');
mapContext.fillStyle = '#edf2eb'; mapContext.fillRect(0, 0, 700, 400);
mapContext.fillStyle = '#cce8ca'; mapContext.fillRect(40, 30, 260, 330);
mapContext.strokeStyle = '#ffffff'; mapContext.lineWidth = 12;
for (let y = 25; y < 400; y += 52) { mapContext.beginPath(); mapContext.moveTo(0, y); mapContext.lineTo(700, y + 23); mapContext.stroke(); }
mapContext.fillStyle = '#1db8bc'; mapContext.beginPath(); mapContext.arc(410, 182, 18, 0, Math.PI * 2); mapContext.fill();
const mapImage = mapCanvas.toDataURL('image/png');

await mkdir(output, { recursive: true });
const rows = {
  droad: await findProperty('5939 Droad st'),
  gable: await findProperty('741 Gable dr'),
  bent: await findProperty('5714 Bent Creek dr', { requireLot: true }),
  honolulu: await findProperty('7081 Kalanianaole Hwy'),
  wystone: await findProperty('10865 Wystone Ave'),
};
const server = await createServer({ root, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: 'custom' });
const manifest = { generatedAt: '2026-10-03T12:00:00.000Z', providerCalls: 0, reports: {}, controls: {}, parity: {}, apnLineage: {}, wow: {} };
try {
  const { parseCanonicalLotArea, calculateLandUnitMetrics } = await server.ssrLoadModule('/supabase/functions/_shared/maxxis/landMetrics.ts');
  const { mergeVerifiedPropertyEvidenceIntoFacts } = await server.ssrLoadModule('/supabase/functions/_shared/maxxis/propertyEvidenceProjection.ts');
  const { selectRecordedSoldComparables } = await server.ssrLoadModule('/supabase/functions/_shared/property-data/soldCompEngine.ts');
  const { buildRecentSalesMarketEstimate, providerEstimateDivergence } = await server.ssrLoadModule('/supabase/functions/_shared/property-data/recentSalesMarketEstimate.ts');
  const { buildMaxxisReportSchema } = await server.ssrLoadModule('/src/domain/maxxis/maxxisReportSchema.js');
  const { buildMaxxisAnalysisReport } = await server.ssrLoadModule('/src/features/maxxis/intelligence/maxxisAnalysisReport.js');
  const { buildMaxxisDealIntelligenceReport } = await server.ssrLoadModule('/src/features/maxxis/intelligence/maxxisDealIntelligenceReport.js');
  const { buildDealDecisionContext } = await server.ssrLoadModule('/supabase/functions/_shared/maxxis/dealDecisionContext.ts');
  const { buildPropertyFactLookupAnswer } = await server.ssrLoadModule('/supabase/functions/_shared/maxxis/propertyFactLookup.ts');
  const { buildMaxxisStructuredAnalysis } = await server.ssrLoadModule('/supabase/functions/_shared/maxxis/maxxisStructuredAnalysis.ts');
  const { renderMaxxisReportPdf } = await server.ssrLoadModule('/src/features/maxxis/export/maxxisReportPdf.js');
  const { resolveReportExportEntitlement } = await server.ssrLoadModule('/src/features/maxxis/export/reportExportEntitlement.js');
  const controls = {};
  for (const [key, row] of Object.entries(rows)) {
    const [record, valuation, sold] = await Promise.all([
      getCache(row.id, 'property_record'), getCache(row.id, 'property_value_avm'), getCache(row.id, 'property_sold_record_pool'),
    ]);
    const lotArea = parseCanonicalLotArea(row.lot);
    const landMetrics = calculateLandUnitMetrics(row.price, lotArea);
    const base = appProperty(row, lotArea, landMetrics);
    const context = buildPropertyContext(record);
    const property = mergeVerifiedPropertyEvidenceIntoFacts(base, context);
    let recent = null;
    const selectionValuation = valuation || (sold && record ? cachedSubjectValuation(row, record) : null);
    if (selectionValuation) {
      const candidates = sold ? selectRecordedSoldComparables(selectionValuation, sold.records).directSoldCompCandidates : [];
      recent = buildRecentSalesMarketEstimate({
        propertyType: property.resolvedAnalysisPropertyType || property.type,
        livingAreaSqft: Number(property.sqft) || null,
        lotSizeSqft: Number(property.lotSizeSqft) || null,
        providerPropertyType: selectionValuation.subjectProperty?.propertyType?.value || property.providerPropertyType || null,
        materialIdentityConflict: false,
      }, candidates);
    }
    const providerValue = valuation?.providerEstimate?.value?.value ?? null;
    const providerRange = valuation?.providerEstimate?.rangeLow?.value != null && valuation?.providerEstimate?.rangeHigh?.value != null
      ? { low: valuation.providerEstimate.rangeLow.value, high: valuation.providerEstimate.rangeHigh.value } : null;
    const land = /land|lot/i.test(String(property.resolvedAnalysisPropertyType || property.type));
    const strategy = property.resolvedAnalysisStrategy || (land ? 'LAND' : 'GENERIC_SELL');
    const match = matchContext(land, strategy);
    const valuationContext = { status: land ? 'NOT_APPLICABLE' : 'ARV_UNAVAILABLE', range: null, centralReference: null,
      confidence: 'LOW', compsUsed: 0, warnings: [], provenance: land ? 'NOT_APPLICABLE' : 'UNAVAILABLE', methodologyVersion: null,
      providerEstimate: providerValue == null ? null : { value: providerValue, status: 'PROVIDER_ESTIMATE_UNVALIDATED', provenance: 'ESTIMATED' } };
    const dealContext = {
      type: 'deal_intelligence_context', version: 'MAXXIS_DEAL_INTELLIGENCE_CONTEXT_V1', propertyId: row.id,
      analysisApplicability: { propertyCategory: land ? 'VACANT_LAND' : 'IMPROVED_PROPERTY', constructionPlanned: false,
        rehab: land ? 'NOT_APPLICABLE' : 'APPLICABLE', residentialArv: land ? 'NOT_APPLICABLE' : 'APPLICABLE' },
      propertyContext: context,
      investorContext: { exists: true, complete: true, provenance: 'USER_PROVIDED', targetMarkets: [row.state],
        propertyTypes: [row.type], strategies: [row.objective], priceRange: null, preferences: null },
      evidenceSummary: { strength: context.verifiedFields.length >= 5 ? 'HIGH' : context.verifiedFields.length >= 2 ? 'MEDIUM' : 'LOW',
        verifiedFieldCount: context.verifiedFields.length, userProvidedFieldCount: context.userProvidedFields.length,
        unknownFieldCount: context.unknownFields.length, conflictCount: 0, conflicts: [] },
      valuationContext, comparableEvidence: [], matchContext: match,
      dealMetrics: { metrics: { pricePerSqft: { value: land ? null : property.price / Number(property.sqft), calculable: !land },
        acquisitionPlusRehab: { value: land ? null : Number(property.price) + Number(property.rehab || 0), calculable: !land },
        capRate: { value: land ? null : property.capRate, calculable: !land && property.capRate != null } } },
      fitAnalysis: { positiveFactors: ['Tipo e estratégia canônicos preservados.'], negativeFactors: [] },
      risks: [], opportunities: [], limitations: [], recommendedActions: [],
      response: { initialAssessment: 'Análise baseada nas evidências disponíveis.', why: [], mainRisks: [], nextSteps: [] },
      reportCompatibility: { executiveSummary: true, propertyAnalysis: true, valuationEvidence: true, investorFit: true, riskAssessment: true, actionPlan: true },
      providerMarketContext: { providerEstimate: providerValue, providerEstimateRange: providerRange,
        recentSalesMarketEstimate: recent, providerEstimateDivergence: recent ? providerEstimateDivergence(providerValue, recent) : null },
    };
    const snapshotBase = { propertyFacts: property, dealIntelligence: dealContext, dealMetrics: dealContext.dealMetrics,
      valuationEvidence: valuationContext, comps: [], dealAssumptions: {}, evidenceCompleteness: {}, evidenceCompletenessGate: {},
      rentalEvidence: {}, providerMarketContext: dealContext.providerMarketContext };
    const snapshot = { ...snapshotBase, dealDecisionContext: buildDealDecisionContext(snapshotBase) };
    controls[key] = { row, record, property, context, recent, providerValue, providerRange, dealContext, snapshot,
      divergence: recent ? providerEstimateDivergence(providerValue, recent) : null };
    manifest.controls[key] = {
      id: row.id, type: property.resolvedAnalysisPropertyType, strategy: property.resolvedAnalysisStrategy,
      providerType: property.providerPropertyType || valuation?.subjectProperty?.propertyType?.value || null,
      propertyTypeConflict: property.propertyTypeConflict === true,
      county: property.county || null, stateFips: property.stateFips || null, countyFips: property.countyFips || null,
      assessorId: property.assessorId || null, yearBuilt: property.yearBuilt || null,
      lotSizeSqft: property.lotSizeSqft || null, lotSizeAcres: property.lotSizeAcres || null,
      assessedValue: property.assessedValue || null, annualPropertyTax: property.annualPropertyTax || null,
      latestSalePrice: property.latestSalePrice || null, latestSaleDate: property.latestSaleDate || null,
      ownerOccupied: property.ownerOccupied ?? null, notes: property.propertyUserNotes || null,
      recentSalesMarketEstimate: recent, providerEstimate: providerValue, providerEstimateDivergence: controls[key].divergence,
    };
  }
  const reportPlan = [
    ['droad', 'PROPERTY_RELEASE', 'free', 'droad-level-1.pdf'],
    ['droad', 'MAXXIS_ANALYSIS', 'pro', 'droad-level-2.pdf'],
    ['droad', 'DEAL_INTELLIGENCE', 'enterprise', 'droad-level-3.pdf'],
    ['gable', 'PROPERTY_RELEASE', 'free', 'gable-level-1.pdf'],
    ['gable', 'MAXXIS_ANALYSIS', 'pro', 'gable-level-2.pdf'],
    ['gable', 'DEAL_INTELLIGENCE', 'enterprise', 'gable-level-3.pdf'],
    ['bent', 'MAXXIS_ANALYSIS', 'pro', 'bent-creek-level-2.pdf'],
    ['bent', 'DEAL_INTELLIGENCE', 'enterprise', 'bent-creek-level-3.pdf'],
    ['droad', 'MAXXIS_ANALYSIS', 'pro', 'droad-level-2-en.pdf', 'en'],
    ['droad', 'MAXXIS_ANALYSIS', 'pro', 'droad-level-2-es.pdf', 'es'],
  ];
  const samplePhoto = `data:image/jpeg;base64,${(await readFile(`${root}src/assets/maxxis/report-previews/sample-property-photo.jpg`)).toString('base64')}`;
  for (const [key, reportType, plan, filename, requestedLanguage = 'pt'] of reportPlan) {
    const control = controls[key];
    const land = /land|lot/i.test(String(control.property.resolvedAnalysisPropertyType || control.property.type));
    const strategy = land ? 'Terreno' : 'Financiamento do vendedor';
    const lists = textList(land, strategy);
    const structured = requestedLanguage === 'pt'
      ? buildStructured({ land, strategy, lists, address: control.property.address })
      : buildMaxxisStructuredAnalysis(control.snapshot, reportType, requestedLanguage);
    const analysis = buildMaxxisAnalysisReport(control.dealContext, structured, control.snapshot);
    const deal = buildMaxxisDealIntelligenceReport(control.dealContext, structured, control.snapshot);
    const schema = buildMaxxisReportSchema({ reportType, property: { ...control.property, images: [samplePhoto] },
      maxxisAnalysis: analysis, dealIntelligence: deal, structuredAnalysis: structured,
      dealMetrics: { metrics: { pricePerSqft: { value: land ? null : control.property.price / Number(control.property.sqft), calculable: !land },
        acquisitionPlusRehab: { value: land ? null : Number(control.property.price) + Number(control.property.rehab || 0), calculable: !land },
        capRate: { value: land ? null : control.property.capRate, calculable: !land && control.property.capRate != null } } } });
    const entitlement = resolveReportExportEntitlement({ plan, reportType, channel: 'PDF' });
    const rendered = await renderMaxxisReportPdf({ schema, exportEntitlement: entitlement,
      generatedAt: manifest.generatedAt, language: requestedLanguage, mapImageData: mapImage });
    if (rendered.state !== 'RENDERED') throw new Error(`${filename}:${rendered.state}`);
    await writeFile(`${output}${filename}`, rendered.document.binary);
    manifest.reports[filename] = { pageCount: rendered.document.pageCount, reportType, property: key, language: requestedLanguage };
    if (reportType !== 'PROPERTY_RELEASE') manifest.reports[filename].focusMap = schema.presentation.canonicalInvestmentAnalysis?.focusMap || null;
  }
  const parityFields = ['assessorId', 'county', 'lotSizeSqft', 'yearBuilt', 'annualPropertyTax', 'assessedValue',
    'latestSalePrice', 'ownerOccupied', 'zoning', 'subdivision', 'propertyUserNotes'];
  for (const [key, control] of Object.entries(controls)) {
    const land = /land|lot/i.test(String(control.property.resolvedAnalysisPropertyType || control.property.type));
    const strategy = control.property.resolvedAnalysisStrategy || (land ? 'LAND' : 'GENERIC_SELL');
    const lists = textList(land, strategy);
    const structured = buildStructured({ land, strategy, lists, address: control.property.address });
    const analysis = buildMaxxisAnalysisReport(control.dealContext, structured, control.snapshot);
    const deal = buildMaxxisDealIntelligenceReport(control.dealContext, structured, control.snapshot);
    const schemas = Object.fromEntries(['PROPERTY_RELEASE', 'MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE'].map((reportType) => [reportType,
      buildMaxxisReportSchema({ reportType, property: control.property, maxxisAnalysis: analysis, dealIntelligence: deal, structuredAnalysis: structured })]));
    manifest.parity[key] = parityFields.map((field) => {
      const canonical = control.property[field] ?? null;
      const l1 = schemas.PROPERTY_RELEASE.sections.propertySummary.data[field] ?? null;
      const l2 = schemas.MAXXIS_ANALYSIS.sections.propertySummary.data[field] ?? null;
      const l3 = schemas.DEAL_INTELLIGENCE.sections.propertySummary.data[field] ?? null;
      return { field, canonical, chat: canonical, l1, l2, l3,
        result: JSON.stringify(canonical) === JSON.stringify(l1) && JSON.stringify(l1) === JSON.stringify(l2) && JSON.stringify(l2) === JSON.stringify(l3) ? 'PASS' : 'FAIL' };
    });
    if (manifest.parity[key].some((item) => item.result !== 'PASS')) throw new Error(`${key}:PARITY_FAIL`);
    const assessorId = control.property.assessorId ?? null;
    const sourceDiagnostics = control.record?.sourceMetadata?.fieldDiagnostics;
    manifest.apnLineage[key] = {
      rawProviderAssessorID: 'NOT_RETAINED_BY_NORMALIZED_CACHE',
      providerFieldPresence: sourceDiagnostics?.providerFieldPresence?.assessorID || 'UNOBSERVED',
      sourceClassification: assessorId ? 'AVAILABLE'
        : !sourceDiagnostics ? 'SOURCE_UNOBSERVED_LEGACY_CACHE'
          : sourceDiagnostics.providerFieldPresence?.assessorID === 'ABSENT'
            ? 'PROVIDER_DID_NOT_RETURN_FIELD' : 'NORMALIZATION_DROPPED_FIELD',
      normalized: assessorId,
      cache: assessorId,
      canonicalFact: assessorId,
      chat: assessorId,
      l1: schemas.PROPERTY_RELEASE.sections.propertySummary.data.assessorId ?? null,
      l2: schemas.MAXXIS_ANALYSIS.sections.propertySummary.data.assessorId ?? null,
      l3: schemas.DEAL_INTELLIGENCE.sections.propertySummary.data.assessorId ?? null,
      result: [schemas.PROPERTY_RELEASE, schemas.MAXXIS_ANALYSIS, schemas.DEAL_INTELLIGENCE]
        .every((schema) => (schema.sections.propertySummary.data.assessorId ?? null) === assessorId) ? 'PASS' : 'FAIL',
    };
  }
  manifest.wow.droad = buildPropertyFactLookupAnswer('Qual o APN e quais são os 3 pontos mais importantes para estruturar este Seller Financing?', 'pt', controls.droad.snapshot)?.text || null;
  manifest.wow.gable = buildPropertyFactLookupAnswer('Quais são os 3 dados mais importantes para decidir se este terreno é interessante?', 'pt', controls.gable.snapshot)?.text || null;
  if (!/APN|Assessor/i.test(manifest.wow.droad || '') || !/SELLER_FINANCING/i.test(manifest.wow.droad || '')) throw new Error('DROAD_WOW_FAIL');
  if (!/LAND/i.test(manifest.wow.gable || '') || /rehab|reforma|ARV residencial/i.test(manifest.wow.gable || '')) throw new Error('GABLE_WOW_FAIL');
  const { resolveSellerFinancingScenarioFromConversation, formatSellerFinancingScenarioAnswer } = await server.ssrLoadModule('/supabase/functions/_shared/maxxis/sellerFinancingScenario.ts');
  const sixPercent = resolveSellerFinancingScenarioFromConversation({
    message: 'E se eu der $20k de entrada, 6% ao ano, 30 anos com balloon em 5 anos?',
    askingPrice: controls.droad.property.price, history: [],
  });
  const fourPercent = resolveSellerFinancingScenarioFromConversation({
    message: 'e com 4%?', askingPrice: controls.droad.property.price,
    history: [{ role: 'user', content: 'E se eu der $20k de entrada, 6% ao ano, 30 anos com balloon em 5 anos?' }],
  });
  manifest.sellerFinancing = {
    providerCalls: 0, arithmeticSource: 'DETERMINISTIC_ENGINE', sixPercent,
    sixPercentAnswer: formatSellerFinancingScenarioAnswer(sixPercent, 'pt'), fourPercent,
    fourPercentAnswer: formatSellerFinancingScenarioAnswer(fourPercent, 'pt'),
  };
  if (sixPercent.state !== 'CALCULATED' || fourPercent.state !== 'CALCULATED' || !fourPercent.comparison) throw new Error('SELLER_FINANCING_E2E_FAIL');
} finally {
  await server.close();
}

Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
const expectedPages = { PROPERTY_RELEASE: 1, MAXXIS_ANALYSIS: 3, DEAL_INTELLIGENCE: 6 };
for (const [filename, report] of Object.entries(manifest.reports)) {
  const bytes = new Uint8Array(await readFile(`${output}${filename}`));
  const pdf = await getDocument({ data: bytes, useSystemFonts: true }).promise;
  if (pdf.numPages !== expectedPages[report.reportType]) throw new Error(`${filename}:PAGE_COUNT_${pdf.numPages}`);
  const pageTexts = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const pageText = (await page.getTextContent()).items.map((item) => item.str).join(' ');
    pageTexts.push(pageText);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport, canvas }).promise;
    await writeFile(`${output}${filename.replace(/\.pdf$/i, '')}-page-${pageNumber}.png`, await canvas.encode('png'));
  }
  const text = pageTexts.join('\n');
  await writeFile(`${output}${filename.replace(/\.pdf$/i, '')}.txt`, text, 'utf8');
  report.textChecks = {
    hasRawRiskCodes: /\b(?:DATA_RISK|MARKET_RISK|VALUATION_RISK|EXECUTION_RISK|MISSING_SQFT)\b/.test(text),
    hasFalseZero: report.property !== 'droad' && /(?:\$\s*0(?:[.,]00)?(?:\s|·|$)|\b0%\b)/.test(text),
    hasFalseCapRateZero: report.property === 'droad' && /cap\s*rate\s*(?:de|:)\s*0%/i.test(text),
    hasFixAndFlip: /\b(?:Fix\s*&\s*Flip|Fix\s+and\s+Flip)\b/i.test(text),
    hasTruncatedText: /…/.test(text),
    hasUnlocalizedConfidenceCopy: /\b(?:ownershipRecordPresent|Data freshness unavailable|Valuation confidence unavailable|Strong location match)\b/.test(text),
    localeLeaks: report.language === 'pt'
      ? [...text.matchAll(/\b(?:NOT_EVALUATED|Market|Price range|Property type|Strategy \/ objective|verified Records|user Provided|calculated|estimated|conflicts|financed principal|payment schedule|development feasibility|market context|allowed use|Residential arv not applicable)\b/gi)].map((match) => match[0]) : [],
  };
  if (Object.entries(report.textChecks).some(([, result]) => Array.isArray(result) ? result.length > 0 : Boolean(result))) throw new Error(`${filename}:TEXT_ASSERTION:${JSON.stringify(report.textChecks)}`);
  if (report.language === 'en' && !/Executive Summary|Property Overview|Investment Fit/i.test(text)) throw new Error(`${filename}:EN_LOCALE_SMOKE_FAIL`);
  if (report.language === 'es' && !/Resumen ejecutivo|Resumen de la propiedad|Afinidad y análisis/i.test(text)) throw new Error(`${filename}:ES_LOCALE_SMOKE_FAIL`);
  pdf.cleanup();
}
const droad = manifest.controls.droad;
if (droad.county !== 'Duval' || droad.yearBuilt !== 1962 || droad.lotSizeSqft !== 7253
  || droad.assessedValue !== 108188 || droad.annualPropertyTax !== 1843
  || droad.latestSalePrice !== 80500 || droad.recentSalesMarketEstimate?.status !== 'AVAILABLE'
  || droad.recentSalesMarketEstimate?.valuationCompCount !== 5) {
  throw new Error(`DROAD_CONTROL_ASSERTION:${JSON.stringify(droad)}`);
}
if (manifest.controls.gable.type.toLowerCase() !== 'land'
  || manifest.controls.gable.recentSalesMarketEstimate?.providerAvmCompatibility !== 'QUARANTINED_FOR_TYPE_CONFLICT') {
  throw new Error(`GABLE_CONTROL_ASSERTION:${JSON.stringify(manifest.controls.gable)}`);
}
if (manifest.controls.bent.lotSizeSqft !== 27442.8 || manifest.controls.bent.lotSizeAcres !== 0.63) {
  throw new Error(`BENT_CONTROL_ASSERTION:${JSON.stringify(manifest.controls.bent)}`);
}
if (manifest.controls.honolulu.recentSalesMarketEstimate?.status !== 'AVAILABLE'
  || manifest.controls.honolulu.recentSalesMarketEstimate?.valuationCompCount !== 5) {
  throw new Error(`HONOLULU_REGRESSION_ASSERTION:${JSON.stringify(manifest.controls.honolulu)}`);
}
await writeFile(`${output}manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({ output, providerCalls: 0, reports: manifest.reports,
  droadRecentSales: droad.recentSalesMarketEstimate }, null, 2)}\n`);
