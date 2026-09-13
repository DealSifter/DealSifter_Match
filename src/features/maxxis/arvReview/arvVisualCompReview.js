export const ARV_TARGET_CONDITIONS = Object.freeze([
  'AS_IS', 'LIGHT_REHAB', 'STANDARD_RENOVATION', 'FULL_RENOVATION',
  'HIGH_END', 'TURN_KEY', 'NEW_CONSTRUCTION', 'UNKNOWN',
]);

export const ARV_CONDITION_COMPATIBILITIES = Object.freeze([
  'MATCHES_TARGET', 'PARTIAL_MATCH', 'SUPERIOR_TO_TARGET', 'INFERIOR_TO_TARGET',
  'DIFFERENT_PRODUCT_CLASS', 'NOT_COMPARABLE', 'UNKNOWN',
]);

const PROVIDER_HOSTS = Object.freeze({
  ZILLOW: ['zillow.com', 'www.zillow.com'],
  REDFIN: ['redfin.com', 'www.redfin.com'],
});

export function isArvVisualCompReviewIntent(message, controlledIntent = '') {
  if (String(controlledIntent || '').toUpperCase() === 'ARV_VISUAL_COMP_REVIEW') return true;
  const text = String(message || '').toLowerCase();
  return /\barv\b|after[ -]repair value|valor ap[oó]s reforma|valor depois da reforma|valor p[oó]s-reforma/.test(text);
}

function safeDirectUrl(provider, value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || !PROVIDER_HOSTS[provider]?.includes(url.hostname.toLowerCase())) return '';
    return url.toString();
  } catch {
    return '';
  }
}

export function resolveExternalCompReviewLink({ provider, address, directUrl = '' }) {
  const normalizedProvider = String(provider || '').toUpperCase();
  if (!PROVIDER_HOSTS[normalizedProvider]) return null;
  const trustedDirectUrl = safeDirectUrl(normalizedProvider, directUrl);
  if (trustedDirectUrl) return {
    provider: normalizedProvider, mode: 'DIRECT', url: trustedDirectUrl, source: 'SYSTEM_GENERATED_NAVIGATION',
  };
  const query = String(address || '').trim();
  if (!query) return null;
  const encoded = encodeURIComponent(query);
  return {
    provider: normalizedProvider,
    mode: 'ADDRESS_SEARCH',
    url: normalizedProvider === 'ZILLOW'
      ? `https://www.zillow.com/homes/${encoded}_rb/`
      : `https://www.redfin.com/search?query=${encoded}`,
    source: 'SYSTEM_GENERATED_NAVIGATION',
  };
}

export function arvReviewGuidance(summary, language = 'en', evaluation = null) {
  const lang = ['pt', 'es'].includes(language) ? language : 'en';
  const copy = {
    en: {
      none: (total) => `I found ${total} structurally comparable recorded sales. Review visible condition before any future ARV evaluation.`,
      progress: (reviewed, total) => `${reviewed} of ${total} comps reviewed. Review at least one more comparable when possible.`,
      ready: (count) => `${count} condition-compatible comps are available. Evidence is ready for a limited future ARV evaluation; no ARV was calculated.`,
      insufficient: 'The review is complete, but there is insufficient compatible condition evidence for ARV evaluation.',
      available: (count, confidence) => `${count} condition-compatible recorded sales support the current deterministic ARV range with ${String(confidence).toLowerCase()} confidence.`,
      limited: (count) => `I found ${count} condition-compatible recorded sales. The ARV reference is limited because the evidence set, completeness, or dispersion constrains confidence.`,
      unavailable: 'I do not have enough defensible condition-compatible evidence to produce an ARV reference yet.',
    },
    pt: {
      none: (total) => `Encontrei ${total} vendas registradas estruturalmente comparáveis. Revise a condição visível antes de qualquer futura avaliação de ARV.`,
      progress: (reviewed, total) => `${reviewed} de ${total} comps revisados. Revise ao menos mais um comparável quando possível.`,
      ready: (count) => `${count} comps compatíveis em condição estão disponíveis. A evidência está pronta para uma futura avaliação limitada de ARV; nenhum ARV foi calculado.`,
      insufficient: 'A revisão terminou, mas não há evidência de condição compatível suficiente para avaliar ARV.',
      available: (count, confidence) => `${count} vendas registradas compatíveis em condição sustentam o range determinístico de ARV atual com confiança ${String(confidence).toLowerCase()}.`,
      limited: (count) => `Encontrei ${count} vendas registradas compatíveis em condição. A referência de ARV é limitada porque o conjunto, a completude ou a dispersão restringe a confiança.`,
      unavailable: 'Ainda não há evidência defensável e compatível em condição suficiente para produzir uma referência de ARV.',
    },
    es: {
      none: (total) => `Encontré ${total} ventas registradas estructuralmente comparables. Revisa la condición visible antes de cualquier futura evaluación de ARV.`,
      progress: (reviewed, total) => `${reviewed} de ${total} comps revisados. Revisa al menos un comparable más cuando sea posible.`,
      ready: (count) => `${count} comps compatibles en condición están disponibles. La evidencia está lista para una futura evaluación limitada de ARV; no se calculó ARV.`,
      insufficient: 'La revisión terminó, pero no hay evidencia de condición compatible suficiente para evaluar ARV.',
      available: (count, confidence) => `${count} ventas registradas compatibles en condición respaldan el rango determinístico de ARV con confianza ${String(confidence).toLowerCase()}.`,
      limited: (count) => `Encontré ${count} ventas registradas compatibles en condición. La referencia ARV es limitada porque el conjunto, la integridad o la dispersión restringe la confianza.`,
      unavailable: 'Aún no hay evidencia defendible y compatible en condición suficiente para producir una referencia de ARV.',
    },
  }[lang];
  if (evaluation?.status === 'ARV_AVAILABLE') return copy.available(evaluation.eligibleCompCount || 0, evaluation.confidence);
  if (evaluation?.status === 'ARV_LIMITED') return copy.limited(evaluation.eligibleCompCount || 0);
  if (evaluation?.status === 'ARV_UNAVAILABLE' && (summary?.reviewedCount || 0) > 0) return copy.unavailable;
  if (summary?.status === 'READY_FOR_ARV_EVALUATION') return copy.ready(summary.compatibleCount || 0);
  if (summary?.status === 'INSUFFICIENT_CONDITION_EVIDENCE') return copy.insufficient;
  if (summary?.status === 'IN_PROGRESS') return copy.progress(summary.reviewedCount || 0, summary.totalStructuralCandidates || 0);
  return copy.none(summary?.totalStructuralCandidates || 0);
}

export function formatCompAddress(address) {
  if (address?.formatted) return String(address.formatted);
  return [address?.line1, address?.city, address?.state, address?.zipCode].filter(Boolean).join(', ');
}
