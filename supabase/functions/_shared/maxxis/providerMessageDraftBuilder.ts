import type { DealAdvisorAnalysis, MaxxisLanguage } from './types.ts';

export type ProviderMessageContext = {
  serviceId: string;
  providerId: string;
  propertyId: string;
  serviceTitle: string;
  serviceType: string;
  property: {
    city: string;
    state: string;
    type: string;
    objective?: string;
    rehab?: number | null;
  };
  dealAdvisor?: Pick<DealAdvisorAnalysis, 'positiveSignals' | 'attentionPoints'> | null;
};

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

function cleanText(value: unknown, max = 120) {
  return String(value || '')
    .replace(CONTROL_CHARS, ' ')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted]')
    .replace(/https?:\/\/\S+/gi, '[redacted]')
    .replace(/(?:\+?\d[\d().\s-]{7,}\d)/g, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanUuid(value: unknown) {
  return cleanText(value, 50);
}

function cleanMoney(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number < 100_000_000 ? Math.round(number) : null;
}

function formatMoney(value: number) {
  return `$${value.toLocaleString('en-US')}`;
}

function greeting(language: MaxxisLanguage) {
  if (language === 'pt') return 'Hi, I found your provider profile on DealSifter Match.';
  if (language === 'es') return 'Hi, I found your provider profile on DealSifter Match.';
  return 'Hi, I found your provider profile on DealSifter Match.';
}

function closing(language: MaxxisLanguage) {
  if (language === 'pt') return 'Could you let me know if this is within your service scope and what details you would need to review next?';
  if (language === 'es') return 'Could you let me know if this is within your service scope and what details you would need to review next?';
  return 'Could you let me know if this is within your service scope and what details you would need to review next?';
}

export function normalizeProviderMessageContext(input: ProviderMessageContext): ProviderMessageContext {
  const rehab = cleanMoney(input?.property?.rehab);
  return {
    serviceId: cleanUuid(input?.serviceId),
    providerId: cleanUuid(input?.providerId),
    propertyId: cleanUuid(input?.propertyId),
    serviceTitle: cleanText(input?.serviceTitle, 120),
    serviceType: cleanText(input?.serviceType, 80),
    property: {
      city: cleanText(input?.property?.city, 80),
      state: cleanText(input?.property?.state, 2).toUpperCase(),
      type: cleanText(input?.property?.type, 80),
      ...(cleanText(input?.property?.objective, 120) ? { objective: cleanText(input.property.objective, 120) } : {}),
      ...(rehab ? { rehab } : {}),
    },
    dealAdvisor: input?.dealAdvisor
      ? {
        positiveSignals: Array.isArray(input.dealAdvisor.positiveSignals)
          ? input.dealAdvisor.positiveSignals.slice(0, 4)
          : [],
        attentionPoints: Array.isArray(input.dealAdvisor.attentionPoints)
          ? input.dealAdvisor.attentionPoints.slice(0, 4)
          : [],
      }
      : null,
  };
}

export function buildProviderMessageDraft(input: ProviderMessageContext, language: MaxxisLanguage = 'en') {
  const context = normalizeProviderMessageContext(input);
  const location = [context.property.city, context.property.state].filter(Boolean).join(', ');
  const propertyType = context.property.type || 'property';
  const serviceType = context.serviceType || 'your service';
  const lines = [
    greeting(language),
    `I am evaluating a ${propertyType}${location ? ` in ${location}` : ''} and may need help with ${serviceType}.`,
  ];

  if (context.property.objective) {
    lines.push(`The current listed objective is ${context.property.objective}.`);
  }
  if (context.property.rehab) {
    lines.push(`A rehab amount of ${formatMoney(context.property.rehab)} is listed in the property details.`);
  }

  const hasIncompleteSignal = context.dealAdvisor?.attentionPoints?.includes('property_information_incomplete');
  if (hasIncompleteSignal) {
    lines.push('Some property details may still need to be reviewed against the registered information.');
  }

  lines.push(closing(language));
  return lines.filter(Boolean).join('\n\n');
}
