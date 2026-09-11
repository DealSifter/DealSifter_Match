export const PROPERTY_INTELLIGENCE_FLAG_NAME = 'VITE_PROPERTY_INTELLIGENCE_ENABLED';

export function parsePropertyIntelligenceEnabled(value) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

export function isPropertyIntelligenceEnabled(env = import.meta.env) {
  return parsePropertyIntelligenceEnabled(env?.[PROPERTY_INTELLIGENCE_FLAG_NAME]);
}
