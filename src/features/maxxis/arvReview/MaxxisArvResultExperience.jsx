import React from 'react';
import { createArvExplanationContext } from './arvResultExperience';
import { localizeMaxxisValue } from '../presentation/maxxisPresentationI18n';

const COPY = {
  en: { title: 'ARV', range: 'Estimated ARV range', evaluation: 'ARV evaluation', unavailable: 'Not available yet', central: 'Central reference', confidence: 'Confidence', comps: 'confirmed comps', why: 'Why this result', limitations: 'Limitations', next: 'Next action', evidence: 'View evidence', used: 'used', excluded: 'not included', valuation: 'Valuation comps used', noneUsed: 'No comparable passed the deterministic valuation policy.', notIncluded: 'Not included in ARV calculation', noneExcluded: 'No excluded comparable evidence.', provider: 'External Provider Estimate', source: 'Source', type: 'Type', provenance: 'Evidence', providerNote: 'Displayed separately. It is not blended with the DealSifter ARV evaluation.', calculated: 'Calculated evidence, not a guaranteed market or sale value.', comparable: 'Comparable property', sale: 'Sale', saleDate: 'Sale date', distance: 'Distance', structural: 'Structural', completeness: 'Completeness', condition: 'Condition', weight: 'Weight', reasonIncluded: 'Reason included', reason: 'Reason', recordedSale: 'Recorded sale' },
  pt: { title: 'ARV', range: 'Faixa estimada de ARV', evaluation: 'Avaliação de ARV', unavailable: 'Ainda não disponível', central: 'Referência central', confidence: 'Confiança', comps: 'comparáveis confirmados', why: 'Por que este resultado?', limitations: 'Limitações', next: 'Próxima ação', evidence: 'Ver evidências', used: 'usados', excluded: 'não incluídos', valuation: 'Comparáveis usados na avaliação', noneUsed: 'Nenhum comparável passou pela política determinística de avaliação.', notIncluded: 'Não incluídos no cálculo do ARV', noneExcluded: 'Não há evidências comparáveis excluídas.', provider: 'Estimativa externa do provedor', source: 'Fonte', type: 'Tipo', provenance: 'Evidência', providerNote: 'Exibida separadamente; não é combinada com a avaliação de ARV da DealSifter.', calculated: 'Evidência calculada; não é garantia de valor de mercado ou venda.', comparable: 'Imóvel comparável', sale: 'Venda', saleDate: 'Data da venda', distance: 'Distância', structural: 'Semelhança estrutural', completeness: 'Completude', condition: 'Condição', weight: 'Peso', reasonIncluded: 'Motivo da inclusão', reason: 'Motivo', recordedSale: 'Venda registrada' },
  es: { title: 'ARV', range: 'Rango ARV estimado', evaluation: 'Evaluación de ARV', unavailable: 'Aún no disponible', central: 'Referencia central', confidence: 'Confianza', comps: 'comparables confirmados', why: '¿Por qué este resultado?', limitations: 'Limitaciones', next: 'Próxima acción', evidence: 'Ver evidencias', used: 'usados', excluded: 'no incluidos', valuation: 'Comparables usados', noneUsed: 'Ningún comparable pasó la política determinística.', notIncluded: 'No incluidos en el cálculo', noneExcluded: 'No hay evidencia excluida.', provider: 'Estimación externa del proveedor', source: 'Fuente', type: 'Tipo', provenance: 'Evidencia', providerNote: 'Se muestra por separado; no se combina con la evaluación ARV.', calculated: 'Evidencia calculada; no garantiza valor de mercado o venta.', comparable: 'Propiedad comparable', sale: 'Venta', saleDate: 'Fecha', distance: 'Distancia', structural: 'Estructural', completeness: 'Integridad', condition: 'Condición', weight: 'Peso', reasonIncluded: 'Motivo de inclusión', reason: 'Motivo', recordedSale: 'Venta registrada' },
};

function money(value, unavailable) {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? `$${Number(value).toLocaleString('en-US')}` : unavailable;
}

function date(value, language, unavailable) {
  const parsed = Date.parse(value);
  const locale = language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-US' : 'en-US';
  return Number.isFinite(parsed) ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(parsed)) : unavailable;
}

function CompEvidence({ comp, included, language, copy }) {
  return (
    <article className={`maxxis-arv-evidence-row ${included ? 'is-used' : 'is-excluded'}`}>
      <div className="maxxis-arv-evidence-title"><strong>{comp.address || copy.comparable}</strong><span>{localizeMaxxisValue(included ? 'USED' : 'EXCLUDED', language)}</span></div>
      <div className="maxxis-arv-evidence-grid">
        <span>{copy.sale}: <strong>{money(comp.recordedSalePrice, copy.unavailable)}</strong></span>
        <span>{copy.saleDate}: <strong>{date(comp.recordedSaleDate, language, copy.unavailable)}</strong></span>
        <span>{copy.distance}: <strong>{Number.isFinite(Number(comp.distanceMiles)) ? `${comp.distanceMiles} mi` : copy.unavailable}</strong></span>
        <span>{copy.structural}: <strong>{comp.structuralComparabilityScore ?? copy.unavailable}%</strong></span>
        <span>{copy.completeness}: <strong>{comp.dataCompletenessScore ?? copy.unavailable}%</strong></span>
        <span>{copy.condition}: <strong>{localizeMaxxisValue(comp.conditionCompatibility, language, copy.unavailable)}</strong></span>
        <span>{copy.weight}: <strong>{included ? comp.valuationWeight : 0}</strong></span>
      </div>
      <p><strong>{included ? copy.reasonIncluded : copy.reason}:</strong> {comp.reason}</p>
      <small>{copy.recordedSale}: {localizeMaxxisValue(comp.provenance.recordedSale, language)} · {copy.condition}: {localizeMaxxisValue(comp.provenance.conditionReview, language)}</small>
    </article>
  );
}

export function MaxxisArvResultExperience({ evaluation, language = 'en' }) {
  const context = createArvExplanationContext(evaluation, language);
  if (!context) return null;
  const t = COPY[language] || COPY.en;
  const available = context.status !== 'ARV_UNAVAILABLE';
  return (
    <section className={`maxxis-arv-result is-${context.status.toLowerCase().replaceAll('_', '-')}`} aria-label={`${t.title} Maxxis`}>
      <div className="maxxis-arv-result-heading"><strong>{t.title}</strong><span>{context.statusLabel}</span></div>
      <div className="maxxis-arv-primary-result">
        <div><small>{available ? t.range : t.evaluation}</small><strong className="maxxis-arv-range">{available ? `${money(context.range.low, t.unavailable)} – ${money(context.range.high, t.unavailable)}` : t.unavailable}</strong></div>
        {available ? <div><small>{t.central}</small><strong>{money(context.centralReference, t.unavailable)}</strong></div> : null}
      </div>
      <div className="maxxis-arv-result-metrics">
        <span>{t.confidence} <strong>{language === 'en' ? context.confidence : localizeMaxxisValue(context.confidence, language, t.unavailable)}</strong></span>
        <span><strong>{context.eligibleCompCount}</strong> {t.comps}</span>
      </div>
      <details className="maxxis-arv-explanation-block"><summary>{t.why}</summary><p>{context.statement}</p><ul>{context.why.map((item) => <li key={item}>{item}</li>)}</ul></details>
      {context.limitations.length ? <details className="maxxis-arv-explanation-block"><summary>{t.limitations}</summary><ul>{context.limitations.map((item) => <li key={item.code}>{item.message}</li>)}</ul></details> : null}
      {context.warnings.length ? <div className="maxxis-arv-warning-list">{context.warnings.map((warning) => <span key={warning.code}>⚠ {language === 'en' ? warning.code.replaceAll('_', ' ') : warning.message}</span>)}</div> : null}
      <div className="maxxis-arv-next-action"><strong>{t.next}</strong><span>{context.nextAction}</span></div>
      <details className="maxxis-arv-evidence-details">
        <summary>{t.evidence} ({context.usedComps.length} {t.used}, {context.notIncludedComps.length} {t.excluded})</summary>
        <div className="maxxis-arv-evidence-drawer">
          <section><h4>{t.valuation}</h4>{context.usedComps.length ? context.usedComps.map((comp) => <CompEvidence key={comp.compIdentifier || comp.address} comp={comp} included language={language} copy={t} />) : <p>{t.noneUsed}</p>}</section>
          <section><h4>{t.notIncluded}</h4>{context.notIncludedComps.length ? context.notIncludedComps.map((comp) => <CompEvidence key={comp.compIdentifier || comp.address} comp={comp} included={false} language={language} copy={t} />) : <p>{t.noneExcluded}</p>}</section>
          {context.providerEstimate ? <section className="maxxis-arv-provider-estimate"><h4>{t.provider}</h4><strong>{money(context.providerEstimate.value, t.unavailable)}</strong><span>{t.source}: {context.providerEstimate.source}</span><span>{t.type}: {localizeMaxxisValue(context.providerEstimate.type, language)}</span><span>{t.provenance}: {localizeMaxxisValue(context.providerEstimate.evidenceStatus, language)}</span><small>{t.providerNote}</small></section> : null}
        </div>
      </details>
      <small>{t.calculated}</small>
    </section>
  );
}
