import React from 'react';
import {
  AlertTriangle, BarChart3, Bath, BedDouble, Brain, Camera, CheckCircle,
  DollarSign, FileText, Home, ListChecks, Map, MapPin, Maximize, Target,
  TrendingUp, User, Wrench,
} from 'lucide-react';
import officialDealSifterLogo from '../../../assets/maxxis/report-official-logo.png';
import { MaxxisReportExportActions } from '../export/MaxxisReportExportActions';
import { explainMaxxisEvidenceState } from './maxxisUserFacingEvidence';

const COPY = {
  en: { open: 'Open investor report experience', release: 'Investor-ready property release', property: 'Property Overview', owner: 'Ownership & Public Record', characteristics: 'Property Characteristics', land: 'Land & Tax Information', photos: 'Property Photos', location: 'Location Map', notes: 'Notes', cma: 'Comparative Market Analysis', relative: 'Relative distance view — not geographic coordinates', valuation: 'Valuation Intelligence', providerEstimate: 'Provider estimate (not DealSifter ARV)', spread: 'Potential Spread', roi: 'Projected ROI Range', rental: 'Rental Intelligence', price: 'Price Analysis', distribution: 'Value Distribution', fitRisk: 'Investment Fit & Risk Analysis', profile: 'Investor Profile', compatibility: 'Profile Compatibility', evidence: 'Evidence Summary', insights: 'Key Insights & Verification', positive: 'Positive Signals', missing: 'Missing Information', considerations: 'Considerations', steps: 'Recommended Verification Steps', powered: 'Powered by MAXXIS AI', conclusion: 'Segmented Conclusion', topics: 'Main Topics', questions: 'Questions', actions: 'Recommended Actions', confidence: 'Maxxis Analysis Confidence', contributors: 'Positive contributors', limitations: 'Limitations', perspective: 'Investor Perspective', unknown: 'UNKNOWN', unavailable: 'Unavailable', scenario: 'Scenario-based', noExternal: 'Property records only — no external comparable images.', disclaimer: 'This report provides evidence-based investment analysis only and does not constitute appraisal, financial advice, or recommendation to buy or sell.' },
  pt: { open: 'Abrir experiência do relatório do investidor', release: 'Relatório de imóvel pronto para investidores', property: 'Visão Geral do Imóvel', owner: 'Ownership e Registro Público', characteristics: 'Características do Imóvel', land: 'Terreno e Dados Fiscais', photos: 'Fotos do Imóvel', location: 'Mapa de Localização', notes: 'Notas', cma: 'Análise Comparativa de Mercado', relative: 'Visão de distância relativa — não representa coordenadas geográficas', valuation: 'Inteligência de Avaliação', providerEstimate: 'Estimativa do provedor (não é o ARV DealSifter)', spread: 'Spread Potencial', roi: 'Faixa de ROI Projetado', rental: 'Inteligência de Locação', price: 'Análise de Preço', distribution: 'Distribuição de Valor', fitRisk: 'Aderência e Análise de Risco', profile: 'Perfil do Investidor', compatibility: 'Compatibilidade com o Perfil', evidence: 'Resumo das Evidências', insights: 'Insights e Verificação', positive: 'Sinais Positivos', missing: 'Informações Ausentes', considerations: 'Considerações', steps: 'Etapas Recomendadas de Verificação', powered: 'Powered by MAXXIS AI', conclusion: 'Conclusão Segmentada', topics: 'Tópicos Principais', questions: 'Perguntas', actions: 'Ações Recomendadas', confidence: 'Confiança da Análise Maxxis', contributors: 'Contribuições positivas', limitations: 'Limitações', perspective: 'Perspectiva do Investidor', unknown: 'DESCONHECIDO', unavailable: 'Indisponível', scenario: 'Baseado em cenários', noExternal: 'Somente registros dos imóveis — sem imagens externas de comparáveis.', disclaimer: 'Este relatório fornece apenas análise de investimento baseada em evidências e não constitui avaliação oficial, aconselhamento financeiro ou recomendação de compra ou venda.' },
  es: { open: 'Abrir experiencia del informe del inversor', release: 'Informe de propiedad listo para inversores', property: 'Resumen de la Propiedad', owner: 'Titularidad y Registro Público', characteristics: 'Características de la Propiedad', land: 'Terreno y Datos Fiscales', photos: 'Fotos de la Propiedad', location: 'Mapa de Ubicación', notes: 'Notas', cma: 'Análisis Comparativo de Mercado', relative: 'Vista de distancia relativa — no representa coordenadas geográficas', valuation: 'Inteligencia de Valoración', providerEstimate: 'Estimación del proveedor (no es ARV DealSifter)', spread: 'Margen Potencial', roi: 'Rango de ROI Proyectado', rental: 'Inteligencia de Alquiler', price: 'Análisis de Precio', distribution: 'Distribución de Valor', fitRisk: 'Alineación y Análisis de Riesgo', profile: 'Perfil del Inversor', compatibility: 'Compatibilidad con el Perfil', evidence: 'Resumen de Evidencias', insights: 'Insights y Verificación', positive: 'Señales Positivos', missing: 'Información Faltante', considerations: 'Consideraciones', steps: 'Pasos Recomendados de Verificación', powered: 'Powered by MAXXIS AI', conclusion: 'Conclusión Segmentada', topics: 'Temas Principales', questions: 'Preguntas', actions: 'Acciones Recomendadas', confidence: 'Confianza del Análisis Maxxis', contributors: 'Contribuciones positivas', limitations: 'Limitaciones', perspective: 'Perspectiva del Inversor', unknown: 'DESCONOCIDO', unavailable: 'No disponible', scenario: 'Basado en escenarios', noExternal: 'Solo registros de propiedades — sin imágenes externas de comparables.', disclaimer: 'Este informe ofrece únicamente análisis de inversión basado en evidencia y no constituye tasación, asesoramiento financiero ni recomendación de compra o venta.' },
};

const OPEN_HINT = Object.freeze({ en: 'CLICK TO VIEW', pt: 'CLIQUE PARA VER', es: 'CLIC PARA VER' });

const list = (value) => Array.isArray(value) ? value : [];
const available = (section) => section?.available ? section.data : null;
const text = (value, unknown) => value === null || value === undefined || value === '' ? unknown : String(value);
const money = (value, unknown) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return unknown;
  return number < 0 ? `-$${Math.abs(number).toLocaleString('en-US')}` : `$${number.toLocaleString('en-US')}`;
};
const percent = (value, unknown) => Number.isFinite(Number(value)) ? `${Number(value).toLocaleString('en-US')}%` : unknown;
const evidenceText = (value, fallback) => explainMaxxisEvidenceState(value || fallback).replace(/[.]$/, '');
const DISPLAY_LABELS = Object.freeze({
  HIGH: 'High', MODERATE: 'Moderate', LOW: 'Low',
  PUBLISHED: 'Published', CLOSED: 'Closed', DRAFT: 'Draft',
  USED: 'Used', SUPPORT: 'Supporting', EXCLUDED: 'Excluded',
  MATCHED: 'Matched', PARTIAL: 'Partially matched', NOT_MATCHED: 'Not matched',
  VERIFIED_RECORD: 'Verified record', USER_PROVIDED: 'User provided',
  DATA_RISK: 'Data risk', MARKET_RISK: 'Market risk',
  VALUATION_RISK: 'Valuation risk', EXECUTION_RISK: 'Execution risk',
  MAP_AVAILABLE: 'Map available', MAP_UNAVAILABLE: 'Map unavailable',
});
const displayLabel = (value, fallback = '') => {
  if (value === null || value === undefined || value === '') return fallback;
  const key = String(value).trim();
  if (DISPLAY_LABELS[key]) return DISPLAY_LABELS[key];
  if (/^[A-Z][A-Z0-9_:-]+$/.test(key)) {
    return evidenceText(key, fallback || key).replaceAll('_', ' ');
  }
  return key;
};
const arvStatusText = (status, copy) => {
  if (status === 'ARV_AVAILABLE') return copy.unavailable === 'Indisponível' ? 'ARV disponível' : copy.unavailable === 'No disponible' ? 'ARV disponible' : 'ARV available';
  if (status === 'ARV_LIMITED') return copy.unavailable === 'Indisponível' ? 'ARV limitado pelas evidências' : copy.unavailable === 'No disponible' ? 'ARV limitado por la evidencia' : 'ARV limited by evidence';
  return copy.unavailable;
};

function ReportHeader({ page, level, subtitle }) {
  const product = level === 3 ? 'Maxxis Deal Intelligence Report' : level === 2 ? 'Maxxis Analysis Report' : 'Property Release';
  return <header className="maxxis-v2-header">
    <img src={officialDealSifterLogo} alt="DealSifter Match" />
    <div><strong>{product}</strong><small>{subtitle}</small></div>
    <span>LEVEL {level} · {String(page).padStart(2, '0')}</span>
  </header>;
}

function Badge({ children, tone = 'teal' }) {
  return <span className={`maxxis-v2-badge is-${tone}`}>{children}</span>;
}

function SectionTitle({ icon = FileText, children }) {
  return <strong className="maxxis-v2-section-title"><span>{React.createElement(icon, { 'aria-hidden': true, size: 16 })}</span>{children}</strong>;
}

function InfoCard({ title, rows, icon }) {
  return <section className="maxxis-v2-info-card"><SectionTitle icon={icon}>{title}</SectionTitle><dl>{rows.length ? rows.map(([label, value, source]) => <div key={`${label}-${value}`}><dt>{label}</dt><dd>{displayLabel(value)}{source ? <small>{displayLabel(source)}</small> : null}</dd></div>) : <div><dt>Status</dt><dd>Not available</dd></div>}</dl></section>;
}

function ConfidenceCard({ confidence, copy }) {
  if (!confidence) return null;
  return <section className="maxxis-v2-confidence"><div><small>{copy.confidence}</small><strong>{percent(confidence.score, copy.unknown)}</strong><Badge tone={confidence.classification === 'HIGH' ? 'teal' : confidence.classification === 'MODERATE' ? 'gold' : 'muted'}>{displayLabel(confidence.classification, copy.unavailable)}</Badge><em>Analysis completeness and reliability — not property quality.</em></div><div><strong>{copy.contributors}</strong>{list(confidence.contributors).map((item) => <span key={item}>✓ {displayLabel(item)}</span>)}</div><div><strong>{copy.limitations}</strong>{list(confidence.limitations).map((item) => <span key={item}>⚠ {displayLabel(item)}</span>)}</div></section>;
}

function PropertyOverview({ schema, copy, level }) {
  const property = available(schema.sections.propertySummary) || {};
  const owner = property.owner || {};
  const images = list(property.images);
  const status = property.dealClosed ? 'CLOSED' : property.published ? 'PUBLISHED' : 'DRAFT';
  const location = [property.address, property.city, property.state, property.zip].filter(Boolean).join(', ');
  const contacts = list(owner.allowedContacts).map((item) => item.label || item.type || item.value).filter(Boolean).join(', ');
  const propertyEvidence = available(schema.sections.propertyEvidence) || {};
  const evidenceFacts = Object.fromEntries([
    ...list(propertyEvidence.verifiedRecords),
    ...list(propertyEvidence.userProvided),
  ].filter((item) => item?.field).map((item) => [item.field, item]));
  const fact = (field, fallback = null) => evidenceFacts[field]?.value ?? fallback;
  const factSource = (field) => evidenceFacts[field]?.sourceType || evidenceFacts[field]?.source || null;
  const executiveLines = list(schema.presentation.executiveSummaryIntelligence?.lines);
  return <article className="maxxis-v2-page" data-report-page="1" data-report-section="PROPERTY_OVERVIEW"><ReportHeader page={1} level={level} subtitle={level === 2 ? 'Executive Summary / Property Context' : copy.release} /><div className="maxxis-v2-page-body">
    <section className="maxxis-v2-property-hero">{images[0] ? <img src={images[0]} alt="" /> : <div className="maxxis-v2-image-empty" aria-label={copy.unavailable}>⌂</div>}<div><div className="maxxis-v2-badges"><Badge>{text(property.type, copy.unknown)}</Badge><Badge tone="navy">{status}</Badge></div><h3>{text(property.title || property.address, copy.unknown)}</h3><span>{text([property.city, property.state].filter(Boolean).join(', '), copy.unknown)}</span><strong className="maxxis-v2-price">{money(property.price, copy.unknown)}</strong></div></section>
    <section className="maxxis-v2-metric-strip"><span><BedDouble aria-hidden="true" /><small>Beds</small><b>{text(property.beds, copy.unknown)}</b></span><span><Bath aria-hidden="true" /><small>Baths</small><b>{text(property.baths, copy.unknown)}</b></span><span><Maximize aria-hidden="true" /><small>Living area</small><b>{text(property.sqft, copy.unknown)}</b></span><span><TrendingUp aria-hidden="true" /><small>Cap rate</small><b>{property.capRate === null || property.capRate === undefined ? copy.unknown : percent(property.capRate, copy.unknown)}</b></span></section>
    {level === 3 ? <ConfidenceCard confidence={schema.presentation.analysisConfidence} copy={copy} /> : null}
    {level === 3 && executiveLines.length ? <section className="maxxis-v2-ai-summary"><small>MAXXIS EXECUTIVE SUMMARY</small>{executiveLines.map((line) => <span key={line}>{line}</span>)}</section> : null}
    <div className="maxxis-v2-info-grid"><InfoCard icon={User} title={copy.owner} rows={[["Owner", text(owner.name, copy.unknown)], ["Owner occupied", text(fact('ownerOccupied'), copy.unknown), factSource('ownerOccupied')], ["Ownership record", text(fact('ownershipRecordPresent'), copy.unknown), factSource('ownershipRecordPresent')], ["Latest sale", money(fact('latestSalePrice'), copy.unknown), factSource('latestSalePrice')], ["Sale date", text(fact('latestSaleDate'), copy.unknown), factSource('latestSaleDate')], ["Allowed contacts", text(contacts, copy.unknown)]]} /><InfoCard icon={Home} title={copy.characteristics} rows={[["Title", text(property.title, copy.unknown)], ["Price", money(property.price, copy.unknown)], ["Strategy", text(property.objective, copy.unknown)], ["Year built", text(fact('yearBuilt'), copy.unknown), factSource('yearBuilt')], ["Beds / Baths", `${text(fact('bedrooms', property.beds), copy.unknown)} / ${text(fact('bathrooms', property.baths), copy.unknown)}`], ["Living area", text(fact('livingAreaSqft', property.sqft), copy.unknown), factSource('livingAreaSqft')], ["Rehab", money(property.rehab, copy.unknown)]]} /><InfoCard icon={MapPin} title={copy.land} rows={[["Location", text(location, copy.unknown)], ["County", text(fact('county'), copy.unknown), factSource('county')], ["Lot size", text(fact('lotSizeSqft', property.lot), copy.unknown), factSource('lotSizeSqft')], ["Assessed value", money(fact('assessedValue'), copy.unknown), factSource('assessedValue')], ["Property tax", money(fact('annualPropertyTax'), copy.unknown), factSource('annualPropertyTax')], ["Source", text(property.source, copy.unknown)]]} /></div>
    <section className="maxxis-v2-photo-section"><SectionTitle icon={Camera}>{copy.photos}</SectionTitle>{images.length ? <div className="maxxis-v2-photos">{images.slice(0, 5).map((image, index) => <img key={`${image}-${index}`} src={image} alt={`${copy.photos} ${index + 1}`} />)}</div> : <p>{copy.unavailable}</p>}</section>
    <div className="maxxis-v2-bottom-grid"><section className="maxxis-v2-location"><SectionTitle icon={Map}>{copy.location}</SectionTitle><div role="img" aria-label={`${copy.location}: ${location || copy.unknown}`}><MapPin aria-hidden="true" /><b>{text(location, copy.unknown)}</b><small>{displayLabel(schema.presentation.map.status, copy.unavailable)}</small></div></section><section className="maxxis-v2-notes"><SectionTitle icon={FileText}>{copy.notes}</SectionTitle><p>{text(property.notes || property.description, copy.unknown)}</p></section></div>
  </div></article>;
}

function ComparableMarket({ schema, copy }) {
  const comps = available(schema.sections.comparableEvidence) || {};
  const groups = [['USED', list(comps.used)], ['SUPPORT', list(comps.supporting)], ['EXCLUDED', list(comps.excluded)]];
  const rows = groups.flatMap(([status, items]) => items.map((item) => ({ ...item, status })));
  return <article className="maxxis-v2-page" data-report-page="2" data-report-section="COMPARATIVE_MARKET_ANALYSIS"><ReportHeader page={2} level={3} subtitle={copy.cma} /><div className="maxxis-v2-page-body"><SectionTitle icon={MapPin}>{copy.cma}</SectionTitle>
    <div className="maxxis-v2-relative-map" role="img" aria-label={copy.relative}><span className="is-subject">S</span>{rows.map((item, index) => <span key={item.compIdentifier || `${item.address}-${index}`} className={`is-${item.status.toLowerCase()}`} style={{ '--comp-offset': `${Math.min(88, 18 + (item.distanceMiles || index + 1) * 18)}%` }}>{index + 1}</span>)}<small>{copy.relative}</small></div>
    <div className="maxxis-v2-table-wrap"><table><thead><tr><th>#</th><th>Address</th><th>Sale Price</th><th>Sale Date</th><th>Beds/Baths</th><th>Sqft</th><th>Distance</th><th>Similarity</th><th>Status</th></tr></thead><tbody>{rows.map((item, index) => <tr key={item.compIdentifier || `${item.address}-${index}`}><td>{index + 1}</td><td><strong>{text(item.address, copy.unknown)}</strong><small>{displayLabel(item.exclusionReason || item.inclusionReason || '')}</small></td><td>{money(item.salePrice, copy.unknown)}</td><td>{text(item.saleDate, copy.unknown)}</td><td>{text(item.beds, copy.unknown)} / {text(item.baths, copy.unknown)}</td><td>{text(item.sqft, copy.unknown)}</td><td>{item.distanceMiles !== null && item.distanceMiles !== undefined && item.distanceMiles !== '' && Number.isFinite(Number(item.distanceMiles)) ? `${Number(item.distanceMiles)} mi` : copy.unknown}</td><td>{percent(item.similarity, copy.unknown)}</td><td><Badge tone={item.status === 'EXCLUDED' ? 'muted' : item.status === 'SUPPORT' ? 'gold' : 'teal'}>{displayLabel(item.status)}</Badge></td></tr>)}</tbody></table></div><small>{copy.noExternal}</small>
  </div></article>;
}

function ScenarioCards({ title, values, formatter, copy }) {
  return <section className="maxxis-v2-kpi-block"><SectionTitle icon={TrendingUp}>{title}</SectionTitle><div>{list(values).map((item) => <span key={item.scenario}><small>{displayLabel(item.scenario)}</small><b>{formatter(item.value, copy.unknown)}</b></span>)}</div></section>;
}

function ValuationPage({ schema, copy }) {
  const valuation = available(schema.sections.valuationEvidence) || {};
  const scenarios = schema.presentation.kpiScenarios;
  const metrics = schema.presentation.existingMetrics || {};
  const property = available(schema.sections.propertySummary) || {};
  const range = valuation.status === 'ARV_UNAVAILABLE' ? null : valuation.range;
  const providerEstimate = valuation.providerEstimate;
  const chartValues = range ? [range.low, valuation.centralReference || ((range.low + range.high) / 2), range.high] : [];
  const max = Math.max(...chartValues, 1);
  return <article className="maxxis-v2-page" data-report-page="3" data-report-section="VALUATION_INTELLIGENCE"><ReportHeader page={3} level={3} subtitle={copy.valuation} /><div className="maxxis-v2-page-body">
    <section className="maxxis-v2-arv"><div><small>Estimated ARV Range</small><strong>{range ? `${money(range.low, copy.unknown)} – ${money(range.high, copy.unknown)}` : copy.unavailable}</strong></div><div><Badge tone={valuation.status === 'ARV_AVAILABLE' ? 'teal' : valuation.status === 'ARV_LIMITED' ? 'gold' : 'muted'}>{arvStatusText(valuation.status, copy)}</Badge><span>Confidence: <b>{valuation.confidence || 'LOW'}</b></span><span>Comps: <b>{valuation.compsUsed || 0}</b></span><span>Method: <b>{text(valuation.methodology, copy.unknown)}</b></span></div></section>{providerEstimate ? <section className="maxxis-v2-provider-estimate"><div><small>{copy.providerEstimate}</small><strong>{money(providerEstimate.value, copy.unknown)}</strong></div><Badge tone="gold">{evidenceText(providerEstimate.status, copy.unknown)}</Badge></section> : null}<Badge tone="navy">{copy.scenario}</Badge>
    {scenarios?.available ? <><ScenarioCards title={copy.spread} values={scenarios.potentialSpread} formatter={money} copy={copy} /><ScenarioCards title={copy.roi} values={scenarios.projectedRoi} formatter={percent} copy={copy} /><small>{scenarios.disclaimer}</small></> : <p>{copy.spread} / {copy.roi}: {copy.unavailable} — {evidenceText(scenarios?.reason, copy.unknown)}</p>}
    <div className="maxxis-v2-two-col"><InfoCard icon={DollarSign} title={copy.rental} rows={[["Estimated rent", copy.unknown], ["Rental yield", copy.unknown], ["NOI", copy.unknown], ["Reported cap rate", metrics.capRate?.value === null ? copy.unknown : percent(metrics.capRate?.value, copy.unknown), metrics.capRate?.sourceType]]} /><InfoCard icon={TrendingUp} title={copy.price} rows={[["List price", money(property.price, copy.unknown)], ["Market range", copy.unknown], ["Price / sqft", metrics.pricePerSqft?.value === null ? copy.unknown : money(metrics.pricePerSqft?.value, copy.unknown), metrics.pricePerSqft?.sourceType], ["Subject comparison", copy.unknown]]} /></div>
    <section className="maxxis-v2-chart"><SectionTitle icon={BarChart3}>{copy.distribution}</SectionTitle>{chartValues.length ? <div>{chartValues.map((value, index) => <span key={`${value}-${index}`} style={{ height: `${Math.max(15, (value / max) * 100)}%` }}><b>{money(value, copy.unknown)}</b></span>)}</div> : <p>{copy.unavailable}</p>}</section>{list(valuation.warnings).map((warning) => <p className="maxxis-v2-warning" key={warning}><AlertTriangle aria-hidden="true" size={14} /> {evidenceText(warning, copy.unknown)}</p>)}
  </div></article>;
}

function FitRiskPage({ schema, copy, page = 4, level = 3 }) {
  const fit = available(schema.sections.investmentProfile) || {};
  const risks = list(available(schema.sections.riskAssessment));
  const counts = schema.presentation.evidenceCounts || {};
  const perspective = schema.presentation.investorPerspective;
  const safeScore = Number.isFinite(Number(fit.score)) ? Math.max(0, Math.min(100, Number(fit.score))) : 0;
  return <article className="maxxis-v2-page" data-report-page={page} data-report-section="INVESTMENT_FIT_RISK"><ReportHeader page={page} level={level} subtitle={copy.fitRisk} /><div className="maxxis-v2-page-body"><div className="maxxis-v2-two-col"><InfoCard icon={User} title={copy.profile} rows={[["Strategy", displayLabel(fit.strategy?.status, copy.unknown)], ["Market", displayLabel(fit.targetMarket?.status, copy.unknown)], ["Range", copy.unknown], ["Property type", displayLabel(fit.propertyType?.status, copy.unknown)]]} /><section className="maxxis-v2-score"><SectionTitle icon={Target}>{copy.compatibility}</SectionTitle><div style={{ '--match-score': `${safeScore * 3.6}deg` }}><b>{percent(fit.score, copy.unknown)}</b></div><small>Match Score represents profile compatibility, not investment quality.</small></section></div>{perspective ? <section className="maxxis-v2-perspective"><div><small>{copy.perspective}</small><strong>{displayLabel(perspective.persona)}</strong><span>{perspective.message}</span></div><div>{list(perspective.priorities).map((item, index) => <Badge key={item} tone={index === 0 ? 'navy' : 'teal'}>{index + 1}. {displayLabel(item)}</Badge>)}</div></section> : null}<section><SectionTitle icon={AlertTriangle}>Risk Analysis</SectionTitle><div className="maxxis-v2-risk-grid">{risks.length ? risks.map((risk) => <div key={risk.code}><Badge tone={risk.severity === 'HIGH' ? 'danger' : risk.severity === 'MEDIUM' ? 'gold' : 'teal'}>{displayLabel(risk.severity)}</Badge><b>{displayLabel(risk.category)}</b><span>{displayLabel(risk.reason || risk.explanation)}</span></div>) : <p>{copy.unavailable}</p>}</div></section><section><SectionTitle icon={CheckCircle}>{copy.evidence}</SectionTitle><div className="maxxis-v2-evidence-counts">{Object.entries(counts).map(([key, value]) => <span key={key}><b>{value}</b><small>{key.replace(/([A-Z])/g, ' $1')}</small></span>)}</div></section></div></article>;
}

function InsightsPage({ schema, copy, page = 5, level = 3 }) {
  const executive = available(schema.sections.executiveSummary) || {};
  const observations = list(executive.observations);
  const limitations = list(available(schema.sections.limitations));
  const checks = list(available(schema.sections.verificationChecklist));
  return <article className="maxxis-v2-page" data-report-page={page} data-report-section="KEY_INSIGHTS_VERIFICATION"><ReportHeader page={page} level={level} subtitle={copy.insights} /><div className="maxxis-v2-page-body maxxis-v2-insight-grid"><InfoCard icon={CheckCircle} title={copy.positive} rows={observations.map((item, index) => [`${index + 1}`, text(item.explanation || item, copy.unknown), item.source || item.sourceType])} /><InfoCard icon={AlertTriangle} title={copy.missing} rows={limitations.filter((item) => /unknown|missing|unavailable|none/i.test(item)).map((item, index) => [`${index + 1}`, item])} /><InfoCard icon={Wrench} title={copy.considerations} rows={limitations.map((item, index) => [`${index + 1}`, item])} /><InfoCard icon={ListChecks} title={copy.steps} rows={checks.map((item, index) => [`${index + 1}`, item])} /></div></article>;
}

function MaxxisAnalysisPage({ schema, copy, page = 6, level = 3 }) {
  const executive = available(schema.sections.executiveSummary) || {};
  const risks = list(available(schema.sections.riskAssessment));
  const checks = list(available(schema.sections.verificationChecklist));
  const summary = executive.summary || executive || copy.unknown;
  const summaryLines = list(schema.presentation.executiveSummaryIntelligence?.lines);
  return <article className="maxxis-v2-page" data-report-page={page} data-report-section="MAXXIS_AI_ANALYSIS"><ReportHeader page={page} level={level} subtitle={copy.powered} /><div className="maxxis-v2-page-body"><section className="maxxis-v2-ai-summary"><SectionTitle icon={Brain}>MAXXIS EXECUTIVE SUMMARY</SectionTitle>{summaryLines.length ? summaryLines.map((line) => <span key={line}>{displayLabel(line)}</span>) : <strong>{displayLabel(summary)}</strong>}</section><div className="maxxis-v2-two-col"><InfoCard icon={Target} title={copy.conclusion} rows={[["Evidence", `Based on available evidence: ${displayLabel(schema.sections.propertyEvidence.sourceType, copy.unavailable)}`], ["Profile fit", text(available(schema.sections.investmentProfile)?.score, copy.unknown)], ["Valuation", displayLabel(available(schema.sections.valuationEvidence)?.status, copy.unavailable)]]} /><InfoCard icon={BarChart3} title={copy.topics} rows={risks.map((risk, index) => [`${index + 1}`, `${displayLabel(risk.category)}: ${displayLabel(risk.reason || risk.explanation)}`])} /></div><InfoCard icon={AlertTriangle} title={copy.questions} rows={checks.slice(0, 4).map((item, index) => [`${index + 1}`, item.endsWith('?') ? item : `${item.replace(/[.]$/, '')}?`])} /><InfoCard icon={ListChecks} title={copy.actions} rows={checks.map((item, index) => [`${index + 1}`, item])} /><p className="maxxis-v2-disclaimer">{copy.disclaimer}</p></div></article>;
}

export function MaxxisDealIntelligenceReportPreview({ schema, language = 'en', exportEntitlements = {} }) {
  if (!schema || schema.type !== 'maxxis_report_schema') return null;
  const copy = COPY[language] || COPY.en;
  const level = schema.reportType === 'DEAL_INTELLIGENCE' ? 3 : schema.reportType === 'MAXXIS_ANALYSIS' ? 2 : 1;
  return <details className="maxxis-report-preview maxxis-report-v2"><summary><span>{copy.open}</span><span className="maxxis-v2-open-hint"><i aria-hidden="true" />{OPEN_HINT[language] || OPEN_HINT.en}</span><Badge tone="navy">LEVEL {level}</Badge></summary><div className="maxxis-v2-report"><PropertyOverview schema={schema} copy={copy} level={level} />{level === 2 ? <><FitRiskPage schema={schema} copy={copy} page={2} level={2} /><InsightsPage schema={schema} copy={copy} page={3} level={2} /></> : null}{level === 3 ? <><ComparableMarket schema={schema} copy={copy} /><ValuationPage schema={schema} copy={copy} /><FitRiskPage schema={schema} copy={copy} /><InsightsPage schema={schema} copy={copy} /><MaxxisAnalysisPage schema={schema} copy={copy} /></> : null}</div><MaxxisReportExportActions schema={schema} exportEntitlements={exportEntitlements} language={language} /><footer className="maxxis-v2-export-state">PDF export uses the same validated report structure shown in this preview.</footer></details>;
}
