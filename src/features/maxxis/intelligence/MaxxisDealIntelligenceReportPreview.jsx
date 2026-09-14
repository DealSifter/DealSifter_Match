import React from 'react';
import { MaxxisReportExportActions } from '../export/MaxxisReportExportActions';

const COPY = {
  en: { open: 'Open investor report experience', release: 'Investor-ready property release', property: 'Property Overview', owner: 'Owner Information', characteristics: 'Property Characteristics', land: 'Land Information', photos: 'Property Photos', location: 'Location Map', notes: 'Notes', cma: 'Comparative Market Analysis', relative: 'Relative distance view — not geographic coordinates', valuation: 'Valuation Intelligence', spread: 'Potential Spread', roi: 'Projected ROI Range', rental: 'Rental Intelligence', price: 'Price Analysis', distribution: 'Value Distribution', fitRisk: 'Investment Fit & Risk Analysis', profile: 'Investor Profile', compatibility: 'Profile Compatibility', evidence: 'Evidence Summary', insights: 'Key Insights & Verification', positive: 'Positive Signals', missing: 'Missing Information', considerations: 'Considerations', steps: 'Recommended Verification Steps', powered: 'Powered by MAXXIS AI', conclusion: 'Segmented Conclusion', topics: 'Main Topics', questions: 'Questions', actions: 'Recommended Actions', confidence: 'Maxxis Analysis Confidence', contributors: 'Positive contributors', limitations: 'Limitations', perspective: 'Investor Perspective', unknown: 'UNKNOWN', unavailable: 'Unavailable', scenario: 'Scenario-based', noExternal: 'Property records only — no external comparable images.', disclaimer: 'This report provides evidence-based investment analysis only and does not constitute appraisal, financial advice, or recommendation to buy or sell.' },
  pt: { open: 'Abrir experiência do relatório do investidor', release: 'Relatório de imóvel pronto para investidores', property: 'Visão Geral do Imóvel', owner: 'Informações do Proprietário', characteristics: 'Características do Imóvel', land: 'Informações do Terreno', photos: 'Fotos do Imóvel', location: 'Mapa de Localização', notes: 'Notas', cma: 'Análise Comparativa de Mercado', relative: 'Visão de distância relativa — não representa coordenadas geográficas', valuation: 'Inteligência de Avaliação', spread: 'Spread Potencial', roi: 'Faixa de ROI Projetado', rental: 'Inteligência de Locação', price: 'Análise de Preço', distribution: 'Distribuição de Valor', fitRisk: 'Aderência e Análise de Risco', profile: 'Perfil do Investidor', compatibility: 'Compatibilidade com o Perfil', evidence: 'Resumo das Evidências', insights: 'Insights e Verificação', positive: 'Sinais Positivos', missing: 'Informações Ausentes', considerations: 'Considerações', steps: 'Etapas Recomendadas de Verificação', powered: 'Powered by MAXXIS AI', conclusion: 'Conclusão Segmentada', topics: 'Tópicos Principais', questions: 'Perguntas', actions: 'Ações Recomendadas', confidence: 'Confiança da Análise Maxxis', contributors: 'Contribuições positivas', limitations: 'Limitações', perspective: 'Perspectiva do Investidor', unknown: 'DESCONHECIDO', unavailable: 'Indisponível', scenario: 'Baseado em cenários', noExternal: 'Somente registros dos imóveis — sem imagens externas de comparáveis.', disclaimer: 'Este relatório fornece apenas análise de investimento baseada em evidências e não constitui avaliação oficial, aconselhamento financeiro ou recomendação de compra ou venda.' },
  es: { open: 'Abrir experiencia del informe del inversor', release: 'Informe de propiedad listo para inversores', property: 'Resumen de la Propiedad', owner: 'Información del Propietario', characteristics: 'Características de la Propiedad', land: 'Información del Terreno', photos: 'Fotos de la Propiedad', location: 'Mapa de Ubicación', notes: 'Notas', cma: 'Análisis Comparativo de Mercado', relative: 'Vista de distancia relativa — no representa coordenadas geográficas', valuation: 'Inteligencia de Valoración', spread: 'Margen Potencial', roi: 'Rango de ROI Proyectado', rental: 'Inteligencia de Alquiler', price: 'Análisis de Precio', distribution: 'Distribución de Valor', fitRisk: 'Alineación y Análisis de Riesgo', profile: 'Perfil del Inversor', compatibility: 'Compatibilidad con el Perfil', evidence: 'Resumen de Evidencias', insights: 'Insights y Verificación', positive: 'Señales Positivas', missing: 'Información Faltante', considerations: 'Consideraciones', steps: 'Pasos Recomendados de Verificación', powered: 'Powered by MAXXIS AI', conclusion: 'Conclusión Segmentada', topics: 'Temas Principales', questions: 'Preguntas', actions: 'Acciones Recomendadas', confidence: 'Confianza del Análisis Maxxis', contributors: 'Contribuciones positivas', limitations: 'Limitaciones', perspective: 'Perspectiva del Inversor', unknown: 'DESCONOCIDO', unavailable: 'No disponible', scenario: 'Basado en escenarios', noExternal: 'Solo registros de propiedades — sin imágenes externas de comparables.', disclaimer: 'Este informe ofrece únicamente análisis de inversión basado en evidencia y no constituye tasación, asesoramiento financiero ni recomendación de compra o venta.' },
};

const list = (value) => Array.isArray(value) ? value : [];
const available = (section) => section?.available ? section.data : null;
const text = (value, unknown) => value === null || value === undefined || value === '' ? unknown : String(value);
const money = (value, unknown) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return unknown;
  return number < 0 ? `-$${Math.abs(number).toLocaleString('en-US')}` : `$${number.toLocaleString('en-US')}`;
};
const percent = (value, unknown) => Number.isFinite(Number(value)) ? `${Number(value).toLocaleString('en-US')}%` : unknown;

function ReportHeader({ page, level, subtitle }) {
  return <header className="maxxis-v2-header"><div><strong>DealSifter <i>Match</i></strong><small>{subtitle}</small></div><span>LEVEL {level} · {String(page).padStart(2, '0')}</span></header>;
}

function Badge({ children, tone = 'teal' }) {
  return <span className={`maxxis-v2-badge is-${tone}`}>{children}</span>;
}

function InfoCard({ title, rows }) {
  return <section className="maxxis-v2-info-card"><strong>{title}</strong><dl>{rows.length ? rows.map(([label, value, source]) => <div key={`${label}-${value}`}><dt>{label}</dt><dd>{value}{source ? <small>{source}</small> : null}</dd></div>) : <div><dt>Status</dt><dd>UNKNOWN</dd></div>}</dl></section>;
}

function ConfidenceCard({ confidence, copy }) {
  if (!confidence) return null;
  return <section className="maxxis-v2-confidence"><div><small>{copy.confidence}</small><strong>{percent(confidence.score, copy.unknown)}</strong><Badge tone={confidence.classification === 'HIGH' ? 'teal' : confidence.classification === 'MODERATE' ? 'gold' : 'muted'}>{confidence.classification}</Badge><em>Analysis completeness and reliability — not property quality.</em></div><div><strong>{copy.contributors}</strong>{list(confidence.contributors).map((item) => <span key={item}>✓ {item}</span>)}</div><div><strong>{copy.limitations}</strong>{list(confidence.limitations).map((item) => <span key={item}>⚠ {item}</span>)}</div></section>;
}

function PropertyOverview({ schema, copy, level }) {
  const property = available(schema.sections.propertySummary) || {};
  const owner = property.owner || {};
  const images = list(property.images);
  const status = property.dealClosed ? 'CLOSED' : property.published ? 'PUBLISHED' : 'DRAFT';
  const location = [property.address, property.city, property.state, property.zip].filter(Boolean).join(', ');
  const contacts = list(owner.allowedContacts).map((item) => item.label || item.type || item.value).filter(Boolean).join(', ');
  const executiveLines = list(schema.presentation.executiveSummaryIntelligence?.lines);
  return <article className="maxxis-v2-page" data-report-page="1" data-report-section="PROPERTY_OVERVIEW"><ReportHeader page={1} level={level} subtitle={copy.release} /><div className="maxxis-v2-page-body">
    <section className="maxxis-v2-property-hero">{images[0] ? <img src={images[0]} alt="" /> : <div className="maxxis-v2-image-empty" aria-label={copy.unavailable}>⌂</div>}<div><div className="maxxis-v2-badges"><Badge>{text(property.type, copy.unknown)}</Badge><Badge tone="navy">{status}</Badge></div><h3>{text(property.title || property.address, copy.unknown)}</h3><span>{text([property.city, property.state].filter(Boolean).join(', '), copy.unknown)}</span><strong className="maxxis-v2-price">{money(property.price, copy.unknown)}</strong></div></section>
    {level === 3 ? <ConfidenceCard confidence={schema.presentation.analysisConfidence} copy={copy} /> : null}
    {level === 3 && executiveLines.length ? <section className="maxxis-v2-ai-summary"><small>MAXXIS EXECUTIVE SUMMARY</small>{executiveLines.map((line) => <span key={line}>{line}</span>)}</section> : null}
    <div className="maxxis-v2-info-grid"><InfoCard title={copy.owner} rows={[["Name", text(owner.name, copy.unknown)], ["Type", text(owner.type, copy.unknown)], ["Status", text(owner.status, copy.unknown)], ["Allowed contacts", text(contacts, copy.unknown)]]} /><InfoCard title={copy.characteristics} rows={[["Title", text(property.title, copy.unknown)], ["Price", money(property.price, copy.unknown)], ["Strategy", text(property.objective, copy.unknown)], ["Cap rate", property.capRate === null || property.capRate === undefined ? copy.unknown : percent(property.capRate, copy.unknown)], ["Beds / Baths", `${text(property.beds, copy.unknown)} / ${text(property.baths, copy.unknown)}`], ["Living area", text(property.sqft, copy.unknown)], ["Rehab", money(property.rehab, copy.unknown)]]} /><InfoCard title={copy.land} rows={[["Location", text(location, copy.unknown)], ["Lot size", text(property.lot, copy.unknown)], ["Source", text(property.source, copy.unknown)], ["Portfolio", text(property.portfolio, copy.unknown)], ["Labels", text(list(property.labels).join(', '), copy.unknown)]]} /></div>
    <section className="maxxis-v2-location"><strong>{copy.location}</strong><div role="img" aria-label={`${copy.location}: ${location || copy.unknown}`}><span>⌖</span><b>{text(location, copy.unknown)}</b><small>{schema.presentation.map.status.replaceAll('_', ' ')}</small></div></section>
    <section><strong>{copy.photos}</strong>{images.length ? <div className="maxxis-v2-photos">{images.map((image, index) => <img key={`${image}-${index}`} src={image} alt={`${copy.photos} ${index + 1}`} />)}</div> : <p>{copy.unavailable}</p>}</section>
    <section><strong>{copy.notes}</strong><p>{text(property.notes || property.description, copy.unknown)}</p></section>
  </div></article>;
}

function ComparableMarket({ schema, copy }) {
  const comps = available(schema.sections.comparableEvidence) || {};
  const groups = [['USED', list(comps.used)], ['SUPPORT', list(comps.supporting)], ['EXCLUDED', list(comps.excluded)]];
  const rows = groups.flatMap(([status, items]) => items.map((item) => ({ ...item, status })));
  return <article className="maxxis-v2-page" data-report-page="2" data-report-section="COMPARATIVE_MARKET_ANALYSIS"><ReportHeader page={2} level={3} subtitle={copy.cma} /><div className="maxxis-v2-page-body">
    <div className="maxxis-v2-relative-map" role="img" aria-label={copy.relative}><span className="is-subject">S</span>{rows.map((item, index) => <span key={item.compIdentifier || `${item.address}-${index}`} className={`is-${item.status.toLowerCase()}`} style={{ '--comp-offset': `${Math.min(88, 18 + (item.distanceMiles || index + 1) * 18)}%` }}>{index + 1}</span>)}<small>{copy.relative}</small></div>
    <div className="maxxis-v2-table-wrap"><table><thead><tr><th>#</th><th>Address</th><th>Sale Price</th><th>Sale Date</th><th>Beds/Baths</th><th>Sqft</th><th>Distance</th><th>Similarity</th><th>Status</th></tr></thead><tbody>{rows.map((item, index) => <tr key={item.compIdentifier || `${item.address}-${index}`}><td>{index + 1}</td><td><strong>{text(item.address, copy.unknown)}</strong><small>{item.exclusionReason || item.inclusionReason || ''}</small></td><td>{money(item.salePrice, copy.unknown)}</td><td>{text(item.saleDate, copy.unknown)}</td><td>{text(item.beds, copy.unknown)} / {text(item.baths, copy.unknown)}</td><td>{text(item.sqft, copy.unknown)}</td><td>{item.distanceMiles !== null && item.distanceMiles !== undefined && item.distanceMiles !== '' && Number.isFinite(Number(item.distanceMiles)) ? `${Number(item.distanceMiles)} mi` : copy.unknown}</td><td>{percent(item.similarity, copy.unknown)}</td><td><Badge tone={item.status === 'EXCLUDED' ? 'muted' : item.status === 'SUPPORT' ? 'gold' : 'teal'}>{item.status}</Badge></td></tr>)}</tbody></table></div><small>{copy.noExternal}</small>
  </div></article>;
}

function ScenarioCards({ title, values, formatter, copy }) {
  return <section className="maxxis-v2-kpi-block"><strong>{title}</strong><div>{list(values).map((item) => <span key={item.scenario}><small>{item.scenario}</small><b>{formatter(item.value, copy.unknown)}</b></span>)}</div></section>;
}

function ValuationPage({ schema, copy }) {
  const valuation = available(schema.sections.valuationEvidence) || {};
  const scenarios = schema.presentation.kpiScenarios;
  const metrics = schema.presentation.existingMetrics || {};
  const property = available(schema.sections.propertySummary) || {};
  const range = valuation.status === 'ARV_UNAVAILABLE' ? null : valuation.range;
  const chartValues = range ? [range.low, valuation.centralReference || ((range.low + range.high) / 2), range.high] : [];
  const max = Math.max(...chartValues, 1);
  return <article className="maxxis-v2-page" data-report-page="3" data-report-section="VALUATION_INTELLIGENCE"><ReportHeader page={3} level={3} subtitle={copy.valuation} /><div className="maxxis-v2-page-body">
    <section className="maxxis-v2-arv"><div><small>Estimated ARV Range</small><strong>{range ? `${money(range.low, copy.unknown)} – ${money(range.high, copy.unknown)}` : copy.unavailable}</strong></div><div><Badge tone={valuation.status === 'ARV_AVAILABLE' ? 'teal' : valuation.status === 'ARV_LIMITED' ? 'gold' : 'muted'}>{valuation.status || 'ARV_UNAVAILABLE'}</Badge><span>Confidence: <b>{valuation.confidence || 'LOW'}</b></span><span>Comps: <b>{valuation.compsUsed || 0}</b></span><span>Method: <b>{text(valuation.methodology, copy.unknown)}</b></span></div></section><Badge tone="navy">{copy.scenario}</Badge>
    {scenarios?.available ? <><ScenarioCards title={copy.spread} values={scenarios.potentialSpread} formatter={money} copy={copy} /><ScenarioCards title={copy.roi} values={scenarios.projectedRoi} formatter={percent} copy={copy} /><small>{scenarios.disclaimer}</small></> : <p>{copy.spread} / {copy.roi}: {copy.unavailable} — {scenarios?.reason || copy.unknown}</p>}
    <div className="maxxis-v2-two-col"><InfoCard title={copy.rental} rows={[["Estimated rent", copy.unknown], ["Rental yield", copy.unknown], ["NOI", copy.unknown], ["Reported cap rate", metrics.capRate?.value === null ? copy.unknown : percent(metrics.capRate?.value, copy.unknown), metrics.capRate?.sourceType]]} /><InfoCard title={copy.price} rows={[["List price", money(property.price, copy.unknown)], ["Market range", copy.unknown], ["Price / sqft", metrics.pricePerSqft?.value === null ? copy.unknown : money(metrics.pricePerSqft?.value, copy.unknown), metrics.pricePerSqft?.sourceType], ["Subject comparison", copy.unknown]]} /></div>
    <section className="maxxis-v2-chart"><strong>{copy.distribution}</strong>{chartValues.length ? <div>{chartValues.map((value, index) => <span key={`${value}-${index}`} style={{ height: `${Math.max(15, (value / max) * 100)}%` }}><b>{money(value, copy.unknown)}</b></span>)}</div> : <p>{copy.unavailable}</p>}</section>{list(valuation.warnings).map((warning) => <p className="maxxis-v2-warning" key={warning}>⚠ {warning.replaceAll('_', ' ')}</p>)}
  </div></article>;
}

function FitRiskPage({ schema, copy }) {
  const fit = available(schema.sections.investmentProfile) || {};
  const risks = list(available(schema.sections.riskAssessment));
  const counts = schema.presentation.evidenceCounts || {};
  const perspective = schema.presentation.investorPerspective;
  return <article className="maxxis-v2-page" data-report-page="4" data-report-section="INVESTMENT_FIT_RISK"><ReportHeader page={4} level={3} subtitle={copy.fitRisk} /><div className="maxxis-v2-page-body"><div className="maxxis-v2-two-col"><InfoCard title={copy.profile} rows={[["Strategy", text(fit.strategy?.status, copy.unknown)], ["Market", text(fit.targetMarket?.status, copy.unknown)], ["Range", copy.unknown], ["Property type", text(fit.propertyType?.status, copy.unknown)]]} /><section className="maxxis-v2-score"><strong>{copy.compatibility}</strong><b>{percent(fit.score, copy.unknown)}</b><small>Match Score represents profile compatibility, not investment quality.</small></section></div>{perspective ? <section className="maxxis-v2-perspective"><div><small>{copy.perspective}</small><strong>{perspective.persona.replaceAll('_', ' ')}</strong><span>{perspective.message}</span></div><div>{list(perspective.priorities).map((item, index) => <Badge key={item} tone={index === 0 ? 'navy' : 'teal'}>{index + 1}. {item}</Badge>)}</div></section> : null}<section><strong>Risk Analysis</strong><div className="maxxis-v2-risk-grid">{risks.length ? risks.map((risk) => <div key={risk.code}><Badge tone={risk.severity === 'HIGH' ? 'danger' : risk.severity === 'MEDIUM' ? 'gold' : 'teal'}>{risk.severity}</Badge><b>{risk.category?.replaceAll('_', ' ')}</b><span>{risk.reason || risk.explanation}</span></div>) : <p>{copy.unavailable}</p>}</div></section><section><strong>{copy.evidence}</strong><div className="maxxis-v2-evidence-counts">{Object.entries(counts).map(([key, value]) => <span key={key}><b>{value}</b><small>{key.replace(/([A-Z])/g, ' $1')}</small></span>)}</div></section></div></article>;
}

function InsightsPage({ schema, copy }) {
  const executive = available(schema.sections.executiveSummary) || {};
  const observations = list(executive.observations);
  const limitations = list(available(schema.sections.limitations));
  const checks = list(available(schema.sections.verificationChecklist));
  return <article className="maxxis-v2-page" data-report-page="5" data-report-section="KEY_INSIGHTS_VERIFICATION"><ReportHeader page={5} level={3} subtitle={copy.insights} /><div className="maxxis-v2-page-body maxxis-v2-insight-grid"><InfoCard title={copy.positive} rows={observations.map((item, index) => [`${index + 1}`, text(item.explanation || item, copy.unknown), item.source || item.sourceType])} /><InfoCard title={copy.missing} rows={limitations.filter((item) => /unknown|missing|unavailable|none/i.test(item)).map((item, index) => [`${index + 1}`, item])} /><InfoCard title={copy.considerations} rows={limitations.map((item, index) => [`${index + 1}`, item])} /><InfoCard title={copy.steps} rows={checks.map((item, index) => [`${index + 1}`, item])} /></div></article>;
}

function MaxxisAnalysisPage({ schema, copy, page = 6, level = 3 }) {
  const executive = available(schema.sections.executiveSummary) || {};
  const risks = list(available(schema.sections.riskAssessment));
  const checks = list(available(schema.sections.verificationChecklist));
  const summary = executive.summary || executive || copy.unknown;
  const summaryLines = list(schema.presentation.executiveSummaryIntelligence?.lines);
  return <article className="maxxis-v2-page" data-report-page={page} data-report-section="MAXXIS_AI_ANALYSIS"><ReportHeader page={page} level={level} subtitle={copy.powered} /><div className="maxxis-v2-page-body"><section className="maxxis-v2-ai-summary"><small>MAXXIS EXECUTIVE SUMMARY</small>{summaryLines.length ? summaryLines.map((line) => <span key={line}>{line}</span>) : <strong>{summary}</strong>}</section><div className="maxxis-v2-two-col"><InfoCard title={copy.conclusion} rows={[["Evidence", `Based on available evidence: ${schema.sections.propertyEvidence.sourceType}`], ["Profile fit", text(available(schema.sections.investmentProfile)?.score, copy.unknown)], ["Valuation", text(available(schema.sections.valuationEvidence)?.status, copy.unknown)]]} /><InfoCard title={copy.topics} rows={risks.map((risk, index) => [`${index + 1}`, `${risk.category}: ${risk.reason || risk.explanation}`])} /></div><InfoCard title={copy.questions} rows={checks.slice(0, 4).map((item, index) => [`${index + 1}`, item.endsWith('?') ? item : `${item.replace(/[.]$/, '')}?`])} /><InfoCard title={copy.actions} rows={checks.map((item, index) => [`${index + 1}`, item])} /><p className="maxxis-v2-disclaimer">{copy.disclaimer}</p></div></article>;
}

export function MaxxisDealIntelligenceReportPreview({ schema, language = 'en', exportEntitlements = {} }) {
  if (!schema || schema.type !== 'maxxis_report_schema') return null;
  const copy = COPY[language] || COPY.en;
  const level = schema.reportType === 'DEAL_INTELLIGENCE' ? 3 : schema.reportType === 'MAXXIS_ANALYSIS' ? 2 : 1;
  return <details className="maxxis-report-preview maxxis-report-v2"><summary>{copy.open}<Badge tone="navy">LEVEL {level}</Badge></summary><MaxxisReportExportActions schema={schema} exportEntitlements={exportEntitlements} language={language} /><div className="maxxis-v2-report"><PropertyOverview schema={schema} copy={copy} level={level} />{level === 2 ? <MaxxisAnalysisPage schema={schema} copy={copy} page={2} level={2} /> : null}{level === 3 ? <><ComparableMarket schema={schema} copy={copy} /><ValuationPage schema={schema} copy={copy} /><FitRiskPage schema={schema} copy={copy} /><InsightsPage schema={schema} copy={copy} /><MaxxisAnalysisPage schema={schema} copy={copy} /></> : null}</div><footer className="maxxis-v2-export-state">PDF · EMAIL · SHARE — PREPARED, NOT ACTIVE</footer></details>;
}
