import React from 'react';
import { MaxxisDealIntelligenceReportPreview } from './MaxxisDealIntelligenceReportPreview';
import { formatVerifiedSoldComps, localizeMaxxisValue } from '../presentation/maxxisPresentationI18n';

const COPY = {
  en: { title: 'Maxxis Deal Intelligence', overview: 'Executive deal overview', standsOut: 'Why this property stands out',
    fit: 'Investment fit', valuation: 'Valuation intelligence', range: 'Estimated ARV range', confidence: 'Confidence',
    basedOn: 'Based on', methodology: 'Methodology', warnings: 'Warnings', comps: 'Comparable evidence', used: 'Used comps',
    supporting: 'Supporting comps', excluded: 'Excluded', risks: 'Risk analysis', limitations: 'Limitations', next: 'Next verification steps',
    unavailable: 'Unavailable', noItems: 'None available', match: 'Match Score', market: 'Target market', strategy: 'Strategy', propertyType: 'Property type', arvStatus: 'ARV status', similarity: 'Similarity', condition: 'Condition', disclaimer: 'Evidence-based decision support. Not an appraisal, offer recommendation, or return guarantee.' },
  pt: { title: 'Inteligência Maxxis do Deal', overview: 'Visão executiva do deal', standsOut: 'Por que este imóvel se destaca',
    fit: 'Aderência ao investimento', valuation: 'Inteligência de avaliação', range: 'Faixa estimada de ARV', confidence: 'Confiança',
    basedOn: 'Baseado em', methodology: 'Metodologia', warnings: 'Alertas', comps: 'Evidências comparáveis', used: 'Comparáveis usados',
    supporting: 'Comparáveis de apoio', excluded: 'Excluídos', risks: 'Análise de riscos', limitations: 'Limitações', next: 'Próximas verificações',
    unavailable: 'Indisponível', noItems: 'Nenhum disponível', match: 'Aderência', market: 'Mercado-alvo', strategy: 'Estratégia', propertyType: 'Tipo de imóvel', arvStatus: 'Status do ARV', similarity: 'Similaridade', condition: 'Condição', disclaimer: 'Suporte à decisão baseado em evidências. Não é laudo, recomendação de oferta ou garantia de retorno.' },
  es: { title: 'Inteligencia Maxxis del Deal', overview: 'Resumen ejecutivo', standsOut: 'Por qué se destaca esta propiedad',
    fit: 'Alineación de inversión', valuation: 'Inteligencia de valoración', range: 'Rango ARV estimado', confidence: 'Confianza',
    basedOn: 'Basado en', methodology: 'Metodología', warnings: 'Alertas', comps: 'Evidencia comparable', used: 'Comparables usados',
    supporting: 'Comparables de apoyo', excluded: 'Excluidos', risks: 'Análisis de riesgos', limitations: 'Limitaciones', next: 'Próximas verificaciones',
    unavailable: 'No disponible', noItems: 'Ninguno disponible', match: 'Afinidad', market: 'Mercado objetivo', strategy: 'Estrategia', propertyType: 'Tipo de propiedad', arvStatus: 'Estado del ARV', similarity: 'Similitud', condition: 'Condición', disclaimer: 'Apoyo a decisiones basado en evidencia. No es tasación, recomendación de oferta ni garantía de retorno.' },
};

function money(value, unavailable) {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? `$${Number(value).toLocaleString('en-US')}` : unavailable;
}

function EvidenceList({ title, items, language }) {
  if (!items?.length) return null;
  return <div className="maxxis-deal-intelligence-section"><strong>{title}</strong><ul>{items.map((item) => (
    <li key={item.code || item.explanation}><span className="maxxis-provenance-badge">{localizeMaxxisValue(item.source, language)}</span> {item.explanation}</li>
  ))}</ul></div>;
}

function CompList({ title, items, unavailable, language, copy }) {
  if (!items?.length) return null;
  return (
    <details className="maxxis-deal-intelligence-details">
      <summary>{title} ({items.length})</summary>
      <div className="maxxis-deal-comp-list">{items.map((comp) => (
        <article key={comp.compIdentifier || `${comp.address}-${comp.saleDate}`}>
          <strong>{comp.address}</strong>
          <span>{money(comp.salePrice, unavailable)} · {comp.saleDate} · {comp.distanceMiles === null ? unavailable : `${comp.distanceMiles} mi`}</span>
          <span>{copy.similarity}: {comp.similarity === null ? unavailable : `${comp.similarity}%`} · {copy.condition}: {localizeMaxxisValue(comp.conditionStatus, language, unavailable)}</span>
          <span>{localizeMaxxisValue(comp.exclusionReason || comp.inclusionReason || comp.transactionQuality, language, unavailable)}</span>
        </article>
      ))}</div>
    </details>
  );
}

function MaxxisDealIntelligenceExperienceView({ report, reportSchema = null, language = 'en' }) {
  if (!report || report.type !== 'maxxis_deal_intelligence_report') return null;
  const t = COPY[language] || COPY.en;
  const valuation = report.valuationIntelligence || {};
  const range = valuation.range;
  const fit = report.investmentFit || {};
  return (
    <section className="maxxis-deal-intelligence" aria-label={t.title}>
      <div className="maxxis-deal-intelligence-heading"><strong>{t.title}</strong><span>PREMIUM</span></div>
      <div className="maxxis-deal-intelligence-answer"><small>{t.overview}</small><strong>{report.executiveDealOverview}</strong></div>
      <EvidenceList title={t.standsOut} items={report.whyThisPropertyStandsOut} language={language} />
      <div className="maxxis-deal-intelligence-section">
        <strong>{t.fit}</strong>
        <div className="maxxis-deal-intelligence-metrics">
          <span>{t.match} <strong>{fit.score === null ? t.unavailable : `${fit.score}%`}</strong></span>
          <span>{t.market} <strong>{localizeMaxxisValue(fit.targetMarket?.status, language, t.unavailable)}</strong></span>
          <span>{t.strategy} <strong>{localizeMaxxisValue(fit.strategy?.status, language, t.unavailable)}</strong></span>
          <span>{t.propertyType} <strong>{localizeMaxxisValue(fit.propertyType?.status, language, t.unavailable)}</strong></span>
        </div>
        <small>{fit.requiredMessage}</small>
      </div>
      <div className="maxxis-deal-intelligence-section">
        <strong>{t.valuation}</strong>
        <div className="maxxis-deal-intelligence-metrics">
          <span>{t.arvStatus} <strong>{localizeMaxxisValue(valuation.status || 'ARV_UNAVAILABLE', language)}</strong></span>
          <span>{t.range} <strong>{range ? `${money(range.low, t.unavailable)} – ${money(range.high, t.unavailable)}` : t.unavailable}</strong></span>
          <span>{t.confidence} <strong>{localizeMaxxisValue(valuation.confidence || 'LOW', language)}</strong></span>
          <span>{t.basedOn} <strong>{formatVerifiedSoldComps(valuation.compsUsed, language)}</strong></span>
        </div>
        <span>{t.methodology}: <strong>{valuation.methodology || t.unavailable}</strong></span>
        {valuation.warnings?.length ? <div className="maxxis-arv-warning-list" aria-label={t.warnings}>{valuation.warnings.map((warning) => <span key={warning}>⚠ {localizeMaxxisValue(warning, language)}</span>)}</div> : null}
      </div>
      <div className="maxxis-deal-intelligence-section">
        <strong>{t.comps}</strong>
        <CompList title={t.used} items={report.comparableEvidence?.used} unavailable={t.unavailable} language={language} copy={t} />
        <CompList title={t.supporting} items={report.comparableEvidence?.supporting} unavailable={t.unavailable} language={language} copy={t} />
        <CompList title={t.excluded} items={report.comparableEvidence?.excluded} unavailable={t.unavailable} language={language} copy={t} />
        {!report.comparableEvidence?.used?.length && !report.comparableEvidence?.supporting?.length && !report.comparableEvidence?.excluded?.length ? <span>{t.noItems}</span> : null}
      </div>
      {report.riskAnalysis?.length ? <div className="maxxis-deal-intelligence-section"><strong>{t.risks}</strong><ul>{report.riskAnalysis.map((risk) => <li key={risk.code}><span className={`maxxis-risk-severity is-${risk.severity.toLowerCase()}`}>{localizeMaxxisValue(risk.severity, language)}</span> <strong>{localizeMaxxisValue(risk.category, language)}</strong>: {risk.reason}</li>)}</ul></div> : null}
      <div className="maxxis-deal-intelligence-section"><strong>{t.limitations}</strong><ul>{report.limitations?.map((item) => <li key={item}>{localizeMaxxisValue(item, language)}</li>)}</ul></div>
      {report.nextVerificationSteps?.length ? <div className="maxxis-deal-intelligence-next"><strong>{t.next}</strong><ol>{report.nextVerificationSteps.map((item) => <li key={item}>{item}</li>)}</ol></div> : null}
      <MaxxisDealIntelligenceReportPreview schema={reportSchema} language={language} />
      <small>{t.disclaimer}</small>
    </section>
  );
}

const sameReportExperience = (previous, next) => previous.report === next.report
  && previous.reportSchema === next.reportSchema
  && previous.language === next.language
  && previous.generatedAt === next.generatedAt
  && previous.exportEntitlements?.PDF?.allowed === next.exportEntitlements?.PDF?.allowed
  && previous.exportEntitlements?.PDF?.state === next.exportEntitlements?.PDF?.state;

const MemoizedMaxxisDealIntelligenceExperience = React.memo(MaxxisDealIntelligenceExperienceView, sameReportExperience);

export function MaxxisDealIntelligenceExperience(props) {
  return <MemoizedMaxxisDealIntelligenceExperience {...props} />;
}
