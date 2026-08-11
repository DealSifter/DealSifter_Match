import type {
  DealAdvisorAnalysis,
  DealAdvisorAttentionPoint,
  DealAdvisorLimitation,
  DealAdvisorMissingField,
  DealAdvisorPositiveSignal,
  MaxxisPropertyDetails,
} from './types.ts';
import type { DealMetricsResult } from './dealMetrics.ts';

export type AnalyzeDealFactsInput = {
  property: MaxxisPropertyDetails;
  metrics: DealMetricsResult;
  missingFields: string[];
};

const ALLOWED_MISSING_FIELDS = new Set<DealAdvisorMissingField>([
  'type',
  'city',
  'state',
  'zip',
  'price',
  'sqft',
  'objective',
  'rehab',
  'capRate',
  'description',
  'images',
]);

const BASIC_FIELDS: DealAdvisorMissingField[] = ['type', 'city', 'state', 'zip', 'price'];

function canonicalMissingField(value: unknown): DealAdvisorMissingField | null {
  const field = String(value || '').trim();
  const canonical = field === 'cap_rate' ? 'capRate' : field;
  return ALLOWED_MISSING_FIELDS.has(canonical as DealAdvisorMissingField)
    ? canonical as DealAdvisorMissingField
    : null;
}

function consolidatedMissingInformation(
  missingFields: string[],
  metrics: DealMetricsResult,
): DealAdvisorMissingField[] {
  const output: DealAdvisorMissingField[] = [];
  const seen = new Set<DealAdvisorMissingField>();
  const candidates = [
    ...(Array.isArray(missingFields) ? missingFields : []),
    ...(Array.isArray(metrics?.missingInputs) ? metrics.missingInputs : []),
  ];
  candidates.forEach((value) => {
    const field = canonicalMissingField(value);
    if (!field || seen.has(field)) return;
    seen.add(field);
    output.push(field);
  });
  return output;
}

export function analyzeDealFacts(input: AnalyzeDealFactsInput): DealAdvisorAnalysis {
  const { property, metrics } = input;
  const missingInformation = consolidatedMissingInformation(input.missingFields, metrics);
  const missing = new Set(missingInformation);
  const positiveSignals = new Set<DealAdvisorPositiveSignal>();
  const attentionPoints = new Set<DealAdvisorAttentionPoint>();
  const limitations = new Set<DealAdvisorLimitation>([
    'analysis_depends_on_submitted_data',
    'property_data_not_independently_verified',
    'arv_not_structured',
    'roi_not_calculated',
  ]);

  if (property.published === true && property.dealClosed === false) {
    positiveSignals.add('property_published');
  }

  const basicDetailsPresent = Boolean(
    property.type
    && property.city
    && property.state
    && property.zip
    && typeof property.price === 'number'
    && Number.isFinite(property.price)
    && property.price > 0
  );
  if (basicDetailsPresent && BASIC_FIELDS.every((field) => !missing.has(field))) {
    positiveSignals.add('basic_details_complete');
  }

  const pricePerSqft = metrics.metrics.pricePerSqft;
  const acquisitionPlusRehab = metrics.metrics.acquisitionPlusRehab;
  const capRate = metrics.metrics.capRate;

  if (pricePerSqft.calculable && pricePerSqft.source === 'calculated') {
    positiveSignals.add('price_per_sqft_calculable');
  } else {
    attentionPoints.add('price_per_sqft_unavailable');
  }

  if (acquisitionPlusRehab.calculable && acquisitionPlusRehab.source === 'calculated') {
    positiveSignals.add('acquisition_plus_rehab_calculable');
  } else {
    attentionPoints.add('acquisition_plus_rehab_unavailable');
  }

  if (typeof property.rehab === 'number' && Number.isFinite(property.rehab) && property.rehab > 0 && !missing.has('rehab')) {
    positiveSignals.add('rehab_reported');
  }

  if (capRate.calculable && capRate.source === 'stored') {
    positiveSignals.add('cap_rate_reported');
    attentionPoints.add('cap_rate_reported_not_calculated');
    limitations.add('cap_rate_not_independently_verified');
  } else {
    attentionPoints.add('cap_rate_unavailable');
  }

  if (missingInformation.length) attentionPoints.add('property_information_incomplete');
  if (missing.has('price')) attentionPoints.add('price_missing_or_invalid');
  if (missing.has('sqft')) attentionPoints.add('sqft_missing_or_invalid');
  if (missing.has('rehab')) attentionPoints.add('rehab_missing_or_invalid');
  if (missing.has('description')) attentionPoints.add('description_missing');

  return {
    positiveSignals: Array.from(positiveSignals),
    attentionPoints: Array.from(attentionPoints),
    missingInformation,
    limitations: Array.from(limitations),
  };
}
