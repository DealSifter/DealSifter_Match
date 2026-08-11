import type { DealMetricsResult } from './dealMetrics.ts';

export type MaxxisLanguage = 'en' | 'pt' | 'es';
export type MaxxisPropertyResult = {
  id: string;
  title: string;
  city: string;
  state: string;
  zip: string;
  price: number;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  sqft: string;
  objective: string;
  image: string;
  status: 'active';
  match?: PropertyMatchResult;
};
export type MaxxisServiceResult = {
  id: string;
  title: string;
  serviceType: string;
  description: string;
  price: number | null;
  markets: string[];
  image: string;
  contactAccess?: ProviderContactAccess;
};
export type MaxxisPropertyDetails = {
  id: string;
  type: string;
  city: string;
  state: string;
  zip: string;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: string;
  improvement: string;
  lot: string;
  dealTag: string;
  objective: string;
  rehab: number | null;
  capRate: number | null;
  description: string;
  markets: string[];
  images: string[];
  published: boolean;
  dealClosed: boolean;
};
export type MaxxisInvestmentProfile = {
  version?: number;
  status?: 'draft' | 'complete';
  triggerCategories?: string[];
  profileStrength?: number;
  completedAt?: number | string;
  currentFocus?: string;
  investorRoles?: string[];
  lookingFor?: string[];
  targetMarkets?: string[];
  propertyTypes?: string[];
  strategies?: string[];
  accreditedInvestor?: 'yes' | 'no';
  dealSources?: string[];
  taxDealObjectives?: string[];
  taxDealObjectiveOtherText?: string;
  priceRange?: string;
  acceptableConditions?: string[];
  capitalReady?: 'yes' | 'no';
  dealsClosedLifetime?: string;
  dealsClosedLast12mo?: string;
  avgDealSize?: string;
  yearsInvesting?: string;
  currentlyActiveDeals?: number;
};
export type PropertyMatchClassification = 'low' | 'moderate' | 'good' | 'excellent' | 'unavailable';
export type PropertyMatchReason = {
  key: 'market' | 'price' | 'property_type' | 'strategy';
  label: string;
  status: 'matched' | 'not_matched' | 'not_evaluated';
  matched: boolean | null;
  points: number;
  maxPoints: number;
  detail?: string;
};
export type PropertyMatchProperty = {
  city?: string | null;
  state?: string | null;
  markets?: string[] | null;
  price?: number | string | null;
  type?: string | null;
  objective?: string | null;
};
export type PropertyMatchResult = {
  score: number | null;
  structuralScore?: number | null;
  behaviorAdjustment?: number;
  behaviorReasons?: BehaviorAffinityReason[];
  classification: PropertyMatchClassification;
  calculable: boolean;
  reasons: PropertyMatchReason[];
  evaluatedCriteria: number;
  possibleCriteria: number;
  earnedPoints: number;
  evaluatedWeight: number;
};
export type BehaviorPropertySnapshot = PropertyMatchProperty & {
  id: string;
};
export type UserPropertyBehaviorAction = {
  action: 'interested';
  signal: 'positive';
  entityId: string;
  updatedAt: string;
  property: BehaviorPropertySnapshot;
};
export type UserPropertyBehavior = {
  actions: UserPropertyBehaviorAction[];
  actionCount: number;
  resolvedActionCount: number;
  historyAvailable: boolean;
  windowDays: number;
  limit: number;
};
export type BehaviorAffinityTrend = {
  values: string[];
  observations: number;
  minimumOccurrences: number;
  evidenceCounts: Record<string, number>;
};
export type BehaviorAffinity = {
  available: boolean;
  actionCount: number;
  trends: {
    market: BehaviorAffinityTrend | null;
    propertyType: BehaviorAffinityTrend | null;
    objective: BehaviorAffinityTrend | null;
    priceRange: BehaviorAffinityTrend | null;
  };
};
export type BehaviorAffinityReason = {
  key: 'behavior_market_affinity' | 'behavior_property_type_affinity' | 'behavior_objective_affinity' | 'behavior_price_affinity';
  effect: number;
  detail: string;
};
export type BehaviorAdjustmentResult = {
  adjustment: number;
  reasons: BehaviorAffinityReason[];
};
export type ProfileDriftDimension = 'market' | 'property_type' | 'strategy';
export type ProfileDriftOperation = 'add_market' | 'add_property_type' | 'add_strategy';
export type ProfileDriftSuggestion = {
  dimension: ProfileDriftDimension;
  operation: ProfileDriftOperation;
  currentValue: string[];
  suggestedValue: string;
  confidence: 'medium' | 'high';
  evidenceCount: number;
  reason: string;
  pendingActionId?: string;
  expiresAt?: string;
};
export type ValidatedProfileSuggestion = {
  dimension: ProfileDriftDimension;
  operation: ProfileDriftOperation;
  suggestedValue: string;
};
export type InvestmentProfileDriftResult = {
  hasDrift: boolean;
  suggestions: ProfileDriftSuggestion[];
};
export type SearchMatchedPropertiesResult = {
  properties: MaxxisPropertyResult[];
  filters: unknown;
  personalized: boolean;
  profileAvailable: boolean;
  requiresProfile: boolean;
  evaluatedProperties: number;
  scoredProperties: number;
  rankingDurationMs: number;
  behaviorHistoryAvailable: boolean;
  behaviorActionCount: number;
  behaviorSignalApplied: boolean;
  behaviorDurationMs: number;
  profileSuggestions: ProfileDriftSuggestion[];
  profileDriftDetected: boolean;
  profileDriftDurationMs: number;
};
export type MaxxisComparisonProperty = {
  id: string;
  type: string;
  city: string;
  state: string;
  zip: string;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: string;
  objective: string;
  rehab: number | null;
  capRate: number | null;
};
export type PropertyComparisonItem = {
  id: string;
  property: MaxxisComparisonProperty;
  missingFields: string[];
  metrics: DealMetricsResult;
};
export type PropertyComparisonCriterion = {
  source: 'stored' | 'calculated';
  comparable: boolean;
  comparedPropertyIds: string[];
  unavailablePropertyIds: string[];
  lowestPropertyIds: string[];
  highestPropertyIds: string[];
};
export type PropertyComparisonResult = {
  properties: PropertyComparisonItem[];
  comparison: {
    price: PropertyComparisonCriterion;
    sqft: PropertyComparisonCriterion;
    rehab: PropertyComparisonCriterion;
    pricePerSqft: PropertyComparisonCriterion;
    acquisitionPlusRehab: PropertyComparisonCriterion;
    capRate: PropertyComparisonCriterion;
  };
};
export type DealAdvisorPositiveSignal =
  | 'property_published'
  | 'basic_details_complete'
  | 'price_per_sqft_calculable'
  | 'acquisition_plus_rehab_calculable'
  | 'rehab_reported'
  | 'cap_rate_reported';
export type DealAdvisorAttentionPoint =
  | 'property_information_incomplete'
  | 'price_missing_or_invalid'
  | 'sqft_missing_or_invalid'
  | 'rehab_missing_or_invalid'
  | 'price_per_sqft_unavailable'
  | 'acquisition_plus_rehab_unavailable'
  | 'cap_rate_unavailable'
  | 'cap_rate_reported_not_calculated'
  | 'description_missing';
export type DealAdvisorMissingField =
  | 'type'
  | 'city'
  | 'state'
  | 'zip'
  | 'price'
  | 'sqft'
  | 'objective'
  | 'rehab'
  | 'capRate'
  | 'description'
  | 'images';
export type DealAdvisorLimitation =
  | 'analysis_depends_on_submitted_data'
  | 'property_data_not_independently_verified'
  | 'arv_not_structured'
  | 'roi_not_calculated'
  | 'cap_rate_not_independently_verified';
export type DealAdvisorAnalysis = {
  positiveSignals: DealAdvisorPositiveSignal[];
  attentionPoints: DealAdvisorAttentionPoint[];
  missingInformation: DealAdvisorMissingField[];
  limitations: DealAdvisorLimitation[];
};
export type PropertyServiceType =
  | 'RE Investor'
  | 'Lender'
  | 'Cash Buyer'
  | 'Fix & Flip'
  | 'General Contractor'
  | 'Rehab Staff'
  | 'Services'
  | 'Drive4$'
  | 'Photography'
  | 'Drone Image'
  | 'Inspections'
  | 'Survey'
  | 'Title Company'
  | 'Accountant'
  | 'Notary'
  | 'Virtual Assistant'
  | 'RE Attorney'
  | 'R.E Auctions'
  | 'R.E Consultancy'
  | 'R.E Advisory';
export type PropertyServiceNeedConfidence = 'medium' | 'high';
export type PropertyServiceNeedReason =
  | 'rehab_reported'
  | 'new_construction_objective'
  | 'listing_images_missing'
  | 'sale_listing_images_missing'
  | 'physical_details_incomplete'
  | 'land_development_context';
export type PropertyServiceNeedSourceSignal =
  | 'property.rehab'
  | 'property.objective.new_construction'
  | 'property.objective.sell'
  | 'property.objective.develop'
  | 'property.type.land'
  | 'metrics.acquisitionPlusRehab.calculable'
  | 'analysis.positiveSignals.rehab_reported'
  | 'analysis.attentionPoints.sqft_missing_or_invalid'
  | 'analysis.missingInformation.images';
export type PropertyServiceNeed = {
  serviceType: PropertyServiceType;
  reasonCode: PropertyServiceNeedReason;
  confidence: PropertyServiceNeedConfidence;
  sourceSignals: PropertyServiceNeedSourceSignal[];
};
export type ServiceFitClassification = 'low_fit' | 'moderate_fit' | 'good_fit' | 'strong_fit' | 'unavailable';
export type ServiceFitReason = {
  key: 'service_type' | 'location';
  label: string;
  status: 'matched' | 'not_matched' | 'not_evaluated';
  matched: boolean | null;
  points: number;
  maxPoints: number;
  detail: 'exact_service_type' | 'different_service_type' | 'city_coverage' | 'state_coverage' | 'outside_coverage' | 'missing_data';
};
export type ServiceFitResult = {
  score: number | null;
  classification: ServiceFitClassification;
  calculable: boolean;
  reasons: ServiceFitReason[];
  evaluatedCriteria: number;
  possibleCriteria: number;
  earnedPoints: number;
  evaluatedWeight: number;
};
export type ProviderContactAccessStatus = 'locked' | 'already_unlocked' | 'insufficient_balance' | 'unavailable';
export type ProviderContactAccess = {
  status: ProviderContactAccessStatus;
  cost: number | null;
  currency: 'nuggets';
  profileScope?: 'personal' | 'professional' | 'fsbo';
  reason?: string | null;
};
export type MaxxisServiceWithFit = MaxxisServiceResult & {
  fit: ServiceFitResult;
};
export type PropertyServiceMatch = {
  serviceType: PropertyServiceType;
  confidence: PropertyServiceNeedConfidence;
  services: MaxxisServiceWithFit[];
};
export type NextBestActionCode =
  | 'review_missing_property_data'
  | 'search_service_provider'
  | 'review_service_matches'
  | 'unlock_provider_contact'
  | 'draft_provider_message'
  | 'review_provider_reply'
  | 'send_reviewed_reply'
  | 'review_deal_progress'
  | 'review_property_details'
  | 'action_pending';
export type NextBestActionPriority = 'high' | 'medium' | 'low';
export type NextBestActionConversationState =
  | 'no_conversation'
  | 'message_sent_waiting_reply'
  | 'provider_replied'
  | 'reply_pending_review'
  | 'conversation_active';
export type MaxxisNextBestAction = {
  code: NextBestActionCode;
  priority: NextBestActionPriority;
  reasonCode: string;
  reason: string;
  actionable: boolean;
  requiresConfirmation: boolean;
  target?: {
    propertyId?: string;
    serviceId?: string;
    serviceTitle?: string;
    serviceType?: string;
    workflowCode?: string;
  };
};
export type MaxxisNextBestActionResult = {
  nextBestAction: MaxxisNextBestAction | null;
  alternativeActions: MaxxisNextBestAction[];
  conversationState: NextBestActionConversationState;
};
export type DealWorkflowCode =
  | 'property_reviewed'
  | 'provider_found'
  | 'provider_unlocked'
  | 'provider_contacted'
  | 'provider_replied'
  | 'inspection_completed'
  | 'survey_completed'
  | 'rehab_quote_received';
export type DealWorkflowItem = {
  id?: string;
  propertyId: string;
  code: DealWorkflowCode;
  status: 'pending' | 'completed' | 'not_applicable';
  source: 'system' | 'user';
  metadata: Record<string, unknown>;
  createdAt?: string | null;
  updatedAt?: string | null;
  completedAt?: string | null;
};
export type DealWorkflowView = {
  items: DealWorkflowItem[];
  completed: number;
  pending: number;
  total: number;
  progressLabel: string;
};
export type MaxxisDealCopilotOverview = {
  propertySummary: Pick<MaxxisPropertyDetails, 'id' | 'type' | 'city' | 'state' | 'zip' | 'price' | 'beds' | 'baths' | 'sqft' | 'objective' | 'rehab'>;
  match?: unknown;
  metricsSummary: DealMetricsResult | null;
  advisorSummary: DealAdvisorAnalysis | null;
  workflow: DealWorkflowView | null;
  nextBestAction: MaxxisNextBestActionResult | null;
  serviceSummary: {
    needs: PropertyServiceNeed[];
    providers: Array<{ serviceId: string; title: string; serviceType: string }>;
  } | null;
  conversationSummary: {
    summary: string;
    facts: string[];
    openItems: string[];
    providerReplyFound: boolean;
    messageCount: number;
  } | null;
  capabilitiesLoaded: string[];
  capabilitiesUnavailable: string[];
  queryCount: number;
};
export type MaxxisResponse = {
  message: string;
  type: 'text' | 'properties' | 'services' | 'investment_profile' | 'property_details' | 'property_comparison' | 'deal_copilot_overview';
  data: null
    | { properties: MaxxisPropertyResult[]; personalized?: boolean; profileAvailable?: boolean; profileSuggestions?: ProfileDriftSuggestion[] }
    | { services: MaxxisServiceResult[] }
    | { profile: MaxxisInvestmentProfile | null; complete: boolean }
    | { property: MaxxisPropertyDetails | null; missingFields: string[]; metrics: DealMetricsResult | null; analysis: DealAdvisorAnalysis | null; serviceNeeds: PropertyServiceNeed[]; serviceMatches: PropertyServiceMatch[] | null; nextBestAction?: MaxxisNextBestActionResult | null; workflow?: DealWorkflowView | null }
    | MaxxisDealCopilotOverview
    | PropertyComparisonResult
    | { properties: []; comparison: null };
  actions: [];
  answer?: string;
  language?: MaxxisLanguage;
  unavailable?: boolean;
  error?: string;
};
