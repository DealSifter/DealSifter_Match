import React from 'react';
import { C } from '../../../theme/colors';
import { INTELLIGENCE_REPORT_TYPES } from '../../../domain/intelligenceAccess';

const COPY = {
  en: {
    title: 'Choose analysis level',
    analysis: 'Professional Analysis',
    analysisDescription: 'Maxxis interpretation, attention points, questions, and next steps.',
    deal: 'Enterprise Deal Intelligence',
    dealDescription: 'Evidence, sold comps, ARV range, confidence, warnings, and verification actions.',
    included: 'Included in your plan',
    unlock: 'Unlock deeper intelligence with Nuggets',
    pending: 'Nugget price pending configuration',
  },
  pt: {
    title: 'Escolha o nível de análise',
    analysis: 'Análise Profissional',
    analysisDescription: 'Interpretação do Maxxis, pontos de atenção, perguntas e próximos passos.',
    deal: 'Inteligência Enterprise do Deal',
    dealDescription: 'Evidências, vendas comparáveis, faixa de ARV, confiança, alertas e ações de verificação.',
    included: 'Incluído no seu plano',
    unlock: 'Desbloquear inteligência aprofundada com Nuggets',
    pending: 'Preço em Nuggets aguardando configuração',
  },
  es: {
    title: 'Elige el nivel de análisis',
    analysis: 'Análisis Profesional',
    analysisDescription: 'Interpretación de Maxxis, puntos de atención, preguntas y próximos pasos.',
    deal: 'Inteligencia Enterprise del Deal',
    dealDescription: 'Evidencia, ventas comparables, rango ARV, confianza, alertas y acciones de verificación.',
    included: 'Incluido en tu plan',
    unlock: 'Desbloquear inteligencia profunda con Nuggets',
    pending: 'Precio en Nuggets pendiente de configuración',
  },
};

export function IntelligenceAnalysisChooser({ options = [], language = 'en', onSelect = null, onRequestUnlock = null }) {
  const t = COPY[String(language || 'en').slice(0, 2)] || COPY.en;
  return (
    <div data-testid="intelligence-analysis-chooser" style={{ display: 'grid', gap: 8, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
      <strong style={{ color: C.t1, fontSize: 12 }}>{t.title}</strong>
      {options.map((option) => {
        const isDeal = option.reportType === INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE;
        const costReady = Number.isFinite(option.nuggetCost) && option.nuggetCost > 0 && option.paidUnlockEnabled;
        const label = isDeal ? t.deal : t.analysis;
        const description = isDeal ? t.dealDescription : t.analysisDescription;
        return (
          <button
            key={option.reportType}
            type="button"
            data-report-type={option.reportType}
            data-access-state={option.state}
            onClick={() => option.allowed ? onSelect?.(option) : onRequestUnlock?.(option)}
            style={{
              display: 'grid', gap: 3, textAlign: 'left', borderRadius: 10, padding: 10,
              border: `1px solid ${option.allowed ? C.accent : C.gold}`,
              background: option.allowed ? C.alpha(C.accent, 0.1) : C.alpha(C.gold, 0.09),
              color: C.t1, cursor: 'pointer',
            }}
          >
            <span style={{ fontWeight: 900, fontSize: 11 }}>{label}</span>
            <span style={{ color: C.t2, fontSize: 10, lineHeight: 1.35 }}>{description}</span>
            <span style={{ color: option.allowed ? C.accent : C.gold, fontSize: 10, fontWeight: 800 }}>
              {option.allowed ? t.included : (costReady ? `${t.unlock} · ${option.nuggetCost}` : `${t.unlock} · ${t.pending}`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
