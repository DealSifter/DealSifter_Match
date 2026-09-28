import React from 'react';
import { MaxxisDealIntelligenceReportPreview } from './MaxxisDealIntelligenceReportPreview';
import { localizeMaxxisValue } from '../presentation/maxxisPresentationI18n';
import { explainMaxxisEvidenceState } from './maxxisUserFacingEvidence';

const COPY = {
  en: { title: 'Maxxis Deal Intelligence', overview: 'Executive deal overview', standsOut: 'Why this property stands out',
    fit: 'Investment fit', valuation: 'Current value and ARV', range: 'Estimated ARV range', confidence: 'Valuation confidence',
    basedOn: 'Based on', methodology: 'Methodology', warnings: 'Warnings', comps: 'Comparable evidence', used: 'Used comps',
    supporting: 'Supporting comps', excluded: 'Excluded', risks: 'Risk analysis', limitations: 'Limitations', next: 'Next verification steps',
    unavailable: 'Unavailable', noItems: 'None available', match: 'Profile fit', market: 'Target market', strategy: 'Strategy', propertyType: 'Property type', arvStatus: 'Residential ARV', similarity: 'Similarity', condition: 'Condition', askingPrice: 'Asking price', providerEstimate: 'Estimated Market Value', difference: 'Difference', confirmed: 'Confirmed', supportCount: 'Supporting', providerNote: 'Automated provider estimate — not an appraisal or ARV.', unavailableReason: (count) => `${count} structural candidate${count === 1 ? '' : 's'} ${count === 1 ? 'is' : 'are'} useful as market evidence, but ${count === 1 ? 'does' : 'do'} not yet meet every criterion for a defensible ARV.`, improve: 'To try to improve the analysis: confirm target condition, review rehab, and verify the condition compatibility of the supporting comps.', disclaimer: 'Evidence-based decision support. Not an appraisal, offer recommendation, or return guarantee.' },
  pt: { title: 'Inteligência Maxxis do Imóvel', overview: 'Visão executiva do imóvel', standsOut: 'Por que este imóvel se destaca',
    fit: 'Aderência ao investimento', valuation: 'Valor atual e ARV', range: 'Faixa estimada de ARV', confidence: 'Confiança do valuation',
    basedOn: 'Baseado em', methodology: 'Metodologia', warnings: 'Alertas', comps: 'Evidências comparáveis', used: 'Comparáveis usados',
    supporting: 'Comparáveis de apoio', excluded: 'Excluídos', risks: 'Análise de riscos', limitations: 'Limitações', next: 'Próximas verificações',
    unavailable: 'Indisponível', noItems: 'Nenhum disponível', match: 'Aderência', market: 'Mercado-alvo', strategy: 'Estratégia', propertyType: 'Tipo de imóvel', arvStatus: 'ARV residencial', similarity: 'Similaridade', condition: 'Condição', askingPrice: 'Preço pedido', providerEstimate: 'Estimativa atual de mercado', difference: 'Diferença', confirmed: 'Confirmados', supportCount: 'Apoio', providerNote: 'Estimativa automatizada do provedor — não é appraisal nem ARV.', unavailableReason: (count) => `${count} ${count === 1 ? 'comparável estrutural foi encontrado, mas ainda não atende' : 'comparáveis estruturais foram encontrados, mas nenhum atende ainda'} a todos os critérios para um ARV defensável.`, improve: 'Para tentar melhorar a análise: confirme a condição-alvo, revise o rehab e verifique a compatibilidade de condição dos comparáveis de apoio.', disclaimer: 'Suporte à decisão baseado em evidências. Não é laudo, recomendação de oferta ou garantia de retorno.' },
  es: { title: 'Inteligencia Maxxis del Deal', overview: 'Resumen ejecutivo', standsOut: 'Por qué se destaca esta propiedad',
    fit: 'Alineación de inversión', valuation: 'Valor actual y ARV', range: 'Rango ARV estimado', confidence: 'Confianza de la valoración',
    basedOn: 'Basado en', methodology: 'Metodología', warnings: 'Alertas', comps: 'Evidencia comparable', used: 'Comparables usados',
    supporting: 'Comparables de apoyo', excluded: 'Excluidos', risks: 'Análisis de riesgos', limitations: 'Limitaciones', next: 'Próximas verificaciones',
    unavailable: 'No disponible', noItems: 'Ninguno disponible', match: 'Afinidad', market: 'Mercado objetivo', strategy: 'Estrategia', propertyType: 'Tipo de propiedad', arvStatus: 'ARV residencial', similarity: 'Similitud', condition: 'Condición', askingPrice: 'Precio solicitado', providerEstimate: 'Estimación de valor de mercado', difference: 'Diferencia', confirmed: 'Confirmados', supportCount: 'De apoyo', providerNote: 'Estimación automatizada del proveedor — no es tasación ni ARV.', unavailableReason: (count) => `${count} ${count === 1 ? 'comparable estructural es útil' : 'comparables estructurales son útiles'} como evidencia de mercado, pero aún no cumplen todos los criterios para un ARV defendible.`, improve: 'Para intentar mejorar el análisis: confirma la condición objetivo, revisa la rehabilitación y verifica la compatibilidad de los comparables de apoyo.', disclaimer: 'Apoyo a decisiones basado en evidencia. No es tasación, recomendación de oferta ni garantía de retorno.' },
};

function money(value, unavailable) {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? `$${Number(value).toLocaleString('en-US')}` : unavailable;
}

function EvidenceList({ title, items, language }) {
  if (!items?.length) return null;
  return <div className="maxxis-deal-intelligence-section"><strong>{title}</strong><ul>{items.map((item) => (
    <li key={item.code || item.explanation}><span className="maxxis-provenance-badge">{localizeMaxxisValue(item.source, language)}</span> {explainMaxxisEvidenceState(item.explanation, language)}</li>
  ))}</ul></div>;
}

function CompList({ title, items, unavailable, language, copy }) {
  if (!items?.length) return null;
  return (
    <details className="maxxis-deal-intelligence-details">
      <summary>{title} ({items.length})</summary>
      <ol className="maxxis-deal-comp-list">{items.map((comp) => (
        <li key={comp.compIdentifier || `${comp.address}-${comp.saleDate}`}>
          <strong>{comp.address}</strong>
          <span>{money(comp.salePrice, unavailable)} · {comp.saleDate} · {comp.distanceMiles === null ? unavailable : `${comp.distanceMiles} mi`}</span>
          <span>{copy.similarity}: {comp.similarity === null ? unavailable : `${comp.similarity}%`} · {copy.condition}: {localizeMaxxisValue(comp.conditionStatus, language, unavailable)}</span>
          <span>{explainMaxxisEvidenceState(comp.exclusionReason || comp.inclusionReason || comp.transactionQuality, language) || unavailable}</span>
        </li>
      ))}</ol>
    </details>
  );
}

function percentageDifference(reference, current) {
  const base = Number(current);
  const compared = Number(reference);
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(compared) || compared <= 0) return null;
  const value = ((compared / base) - 1) * 100;
  return `${value >= 0 ? '+' : ''}${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
}

function MaxxisDealIntelligenceExperienceView({ report, reportSchema = null, language = 'en' }) {
  if (!report || report.type !== 'maxxis_deal_intelligence_report') return null;
  const t = COPY[language] || COPY.en;
  const valuation = report.valuationIntelligence || {};
  const range = valuation.range;
  const fit = report.investmentFit || {};
  const property = reportSchema?.sections?.propertySummary?.available
    ? reportSchema.sections.propertySummary.data || {}
    : {};
  const providerEstimate = valuation.providerEstimate;
  const supportingCount = report.comparableEvidence?.supporting?.length || 0;
  const providerDifference = percentageDifference(providerEstimate?.value, property.price);
  return (
    <section className="maxxis-deal-intelligence" aria-label={t.title}>
      <div className="maxxis-deal-intelligence-heading"><strong>{t.title}</strong><span>PREMIUM</span></div>
      <div className="maxxis-deal-intelligence-answer"><small>{t.overview}</small><strong>{explainMaxxisEvidenceState(report.executiveDealOverview, language)}</strong></div>
      <EvidenceList title={t.standsOut} items={report.whyThisPropertyStandsOut} language={language} />
      <div className="maxxis-deal-intelligence-section">
        <strong>{t.fit}</strong>
        <div className="maxxis-deal-intelligence-metrics">
          <span>{t.match} <strong>{fit.score === null ? t.unavailable : `${fit.score}%`}</strong></span>
          <span>{t.market} <strong>{localizeMaxxisValue(fit.targetMarket?.status, language, t.unavailable)}</strong></span>
          <span>{t.strategy} <strong>{localizeMaxxisValue(fit.strategy?.status, language, t.unavailable)}</strong></span>
          <span>{t.propertyType} <strong>{localizeMaxxisValue(fit.propertyType?.status, language, t.unavailable)}</strong></span>
        </div>
        <small>{explainMaxxisEvidenceState(fit.requiredMessage, language)}</small>
      </div>
      <div className="maxxis-deal-intelligence-section">
        <strong>{t.valuation}</strong>
        <dl className="maxxis-deal-valuation-lines">
          {Number(property.price) > 0 ? <div><dt>{t.askingPrice}</dt><dd>{money(property.price, t.unavailable)}</dd></div> : null}
          {providerEstimate?.value ? <div><dt>{t.providerEstimate}</dt><dd>{money(providerEstimate.value, t.unavailable)}</dd></div> : null}
          {providerDifference ? <div><dt>{t.difference}</dt><dd>{providerDifference}</dd></div> : null}
          <div><dt>{t.arvStatus}</dt><dd>{range ? `${money(range.low, t.unavailable)} – ${money(range.high, t.unavailable)}` : localizeMaxxisValue(valuation.status || 'ARV_UNAVAILABLE', language)}</dd></div>
          <div><dt>{t.confidence}</dt><dd>{localizeMaxxisValue(valuation.confidence || 'LOW', language)}</dd></div>
          <div><dt>{t.confirmed}</dt><dd>{valuation.compsUsed || 0}</dd></div>
          <div><dt>{t.supportCount}</dt><dd>{supportingCount}</dd></div>
        </dl>
        {providerEstimate?.value ? <small className="maxxis-market-estimate-note">{t.providerNote}</small> : null}
        {valuation.status === 'ARV_UNAVAILABLE' ? <p className="maxxis-arv-chat-guidance"><strong>{language === 'pt' ? 'Por quê?' : language === 'es' ? '¿Por qué?' : 'Why?'}</strong> {t.unavailableReason(supportingCount)}</p> : null}
        {valuation.status === 'ARV_UNAVAILABLE' ? <p className="maxxis-arv-chat-guidance">{t.improve}</p> : null}
        {valuation.methodology ? <small>{t.methodology}: <strong>{localizeMaxxisValue(valuation.methodology, language, t.unavailable)}</strong></small> : null}
        {valuation.warnings?.length ? <div className="maxxis-arv-warning-list" aria-label={t.warnings}>{valuation.warnings.map((warning) => <span key={warning}>⚠ {localizeMaxxisValue(warning, language)}</span>)}</div> : null}
      </div>
      <div className="maxxis-deal-intelligence-section">
        <strong>{t.comps}</strong>
        <CompList title={t.used} items={report.comparableEvidence?.used} unavailable={t.unavailable} language={language} copy={t} />
        <CompList title={t.supporting} items={report.comparableEvidence?.supporting} unavailable={t.unavailable} language={language} copy={t} />
        <CompList title={t.excluded} items={report.comparableEvidence?.excluded} unavailable={t.unavailable} language={language} copy={t} />
        {!report.comparableEvidence?.used?.length && !report.comparableEvidence?.supporting?.length && !report.comparableEvidence?.excluded?.length ? <span>{t.noItems}</span> : null}
      </div>
      {report.riskAnalysis?.length ? <div className="maxxis-deal-intelligence-section"><strong>{t.risks}</strong><ul>{report.riskAnalysis.map((risk) => <li key={risk.code}><span className={`maxxis-risk-severity is-${risk.severity.toLowerCase()}`}>{localizeMaxxisValue(risk.severity, language)}</span> <strong>{localizeMaxxisValue(risk.category, language)}</strong>: {explainMaxxisEvidenceState(risk.reason, language)}</li>)}</ul></div> : null}
      <div className="maxxis-deal-intelligence-section"><strong>{t.limitations}</strong><ul>{report.limitations?.map((item) => <li key={item}>{explainMaxxisEvidenceState(item, language)}</li>)}</ul></div>
      {report.nextVerificationSteps?.length ? <div className="maxxis-deal-intelligence-next"><strong>{t.next}</strong><ol>{report.nextVerificationSteps.map((item) => <li key={item}>{explainMaxxisEvidenceState(item, language)}</li>)}</ol></div> : null}
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
