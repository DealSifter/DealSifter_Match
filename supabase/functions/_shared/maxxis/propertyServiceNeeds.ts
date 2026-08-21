import type { DealMetricsResult } from './dealMetrics.ts';
import type {
  DealAdvisorAnalysis,
  MaxxisPropertyDetails,
  PropertyServiceNeed,
  PropertyServiceNeedConfidence,
  PropertyServiceNeedReason,
  PropertyServiceNeedSourceSignal,
  PropertyServiceType,
} from './types.ts';

export const CANONICAL_PROPERTY_SERVICE_TYPES = [
  'RE Investor',
  'Lender',
  'Cash Buyer',
  'Fix & Flip',
  'General Contractor',
  'Rehab Staff',
  'Services',
  'Drive4$',
  'Photography',
  'Drone Image',
  'Inspections',
  'Survey',
  'Title Company',
  'Accountant',
  'Notary',
  'Virtual Assistant',
  'RE Attorney',
  'R.E Auctions',
  'R.E Consultancy',
  'R.E Advisory',
] as const satisfies readonly PropertyServiceType[];

export type IdentifyPropertyServiceNeedsInput = {
  property: MaxxisPropertyDetails;
  metrics: DealMetricsResult;
  analysis: DealAdvisorAnalysis;
};

const CANONICAL_SERVICE_TYPE_SET = new Set<PropertyServiceType>(CANONICAL_PROPERTY_SERVICE_TYPES);
const CONFIDENCE_WEIGHT: Record<PropertyServiceNeedConfidence, number> = { medium: 1, high: 2 };

function normalized(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

export function identifyPropertyServiceNeeds(
  input: IdentifyPropertyServiceNeedsInput,
): PropertyServiceNeed[] {
  const { property, metrics, analysis } = input;
  const needs = new Map<PropertyServiceType, PropertyServiceNeed>();

  const addNeed = (
    serviceType: PropertyServiceType,
    reasonCode: PropertyServiceNeedReason,
    confidence: PropertyServiceNeedConfidence,
    sourceSignals: PropertyServiceNeedSourceSignal[],
  ) => {
    if (!CANONICAL_SERVICE_TYPE_SET.has(serviceType)) return;
    const current = needs.get(serviceType);
    if (!current) {
      needs.set(serviceType, {
        serviceType,
        reasonCode,
        confidence,
        sourceSignals: Array.from(new Set(sourceSignals)),
      });
      return;
    }

    const stronger = CONFIDENCE_WEIGHT[confidence] > CONFIDENCE_WEIGHT[current.confidence];
    needs.set(serviceType, {
      ...current,
      ...(stronger ? { reasonCode, confidence } : {}),
      sourceSignals: Array.from(new Set([...current.sourceSignals, ...sourceSignals])),
    });
  };

  const rehabReported = typeof property.rehab === 'number'
    && Number.isFinite(property.rehab)
    && property.rehab > 0;
  if (rehabReported) {
    const sourceSignals: PropertyServiceNeedSourceSignal[] = ['property.rehab'];
    if (metrics.metrics.acquisitionPlusRehab.calculable) {
      sourceSignals.push('metrics.acquisitionPlusRehab.calculable');
    }
    if (analysis.positiveSignals.includes('rehab_reported')) {
      sourceSignals.push('analysis.positiveSignals.rehab_reported');
    }
    addNeed('General Contractor', 'rehab_reported', 'high', sourceSignals);
    addNeed('Rehab Staff', 'rehab_reported', 'medium', sourceSignals);
  }

  const objective = normalized(property.objective);
  if (objective === 'new construction') {
    addNeed(
      'General Contractor',
      'new_construction_objective',
      'high',
      ['property.objective.new_construction'],
    );
  }

  const imagesMissing = analysis.missingInformation.includes('images');
  if (imagesMissing) {
    addNeed('Photography', 'listing_images_missing', 'medium', ['analysis.missingInformation.images']);
    if (objective === 'sell') {
      addNeed(
        'Photography',
        'sale_listing_images_missing',
        'high',
        ['property.objective.sell', 'analysis.missingInformation.images'],
      );
    }
  }

  if (analysis.attentionPoints.includes('sqft_missing_or_invalid')) {
    addNeed(
      'Inspections',
      'physical_details_incomplete',
      'medium',
      ['analysis.attentionPoints.sqft_missing_or_invalid'],
    );
  }

  const propertyType = normalized(property.type);
  if (propertyType === 'land' && (objective === 'develop' || objective === 'new construction')) {
    addNeed(
      'Survey',
      'land_development_context',
      'high',
      [
        'property.type.land',
        objective === 'develop' ? 'property.objective.develop' : 'property.objective.new_construction',
      ],
    );
  }

  return Array.from(needs.values());
}
