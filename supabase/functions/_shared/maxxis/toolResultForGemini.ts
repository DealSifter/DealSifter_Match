import { buildAnalyticalInteractionInstruction } from './analyticalInteraction.ts';

const EMAIL_RE = /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/g;

const record = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
);

const safeText = (value: unknown, max = 160) => String(value || '')
  .replace(EMAIL_RE, '[Redacted]')
  .replace(PHONE_RE, '[Redacted]')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

const safeNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const safeDate = (value: unknown) => {
  const candidate = String(value || '').trim();
  if (!/^\d{4}(?:-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?)?$/.test(candidate)) return null;
  return candidate;
};

const safeList = (value: unknown, maxItems = 20) => (
  Array.isArray(value) ? value.map((item) => safeText(item, 120)).filter(Boolean).slice(0, maxItems) : []
);

function safeMatch(value: unknown) {
  const source = record(value);
  return {
    score: safeNumber(source.score),
    classification: safeText(source.classification, 30),
    calculable: Boolean(source.calculable),
    reasons: (Array.isArray(source.reasons) ? source.reasons : []).slice(0, 8).map((item) => {
      const reason = record(item);
      return {
        key: safeText(reason.key, 40),
        status: safeText(reason.status, 30),
        matched: typeof reason.matched === 'boolean' ? reason.matched : null,
        points: safeNumber(reason.points),
        maxPoints: safeNumber(reason.maxPoints),
      };
    }),
  };
}

function safeProperty(value: unknown) {
  const source = record(value);
  const match = record(source.match);
  return {
    id: safeText(source.id, 50),
    title: safeText(source.title || source.type || source.propertyType, 120),
    city: safeText(source.city, 80),
    state: safeText(source.state, 20),
    zip: safeText(source.zip, 12),
    price: safeNumber(source.price),
    propertyType: safeText(source.propertyType || source.type, 80),
    bedrooms: safeNumber(source.bedrooms ?? source.beds),
    bathrooms: safeNumber(source.bathrooms ?? source.baths),
    sqft: safeText(source.sqft, 30),
    objective: safeText(source.objective, 80),
    rehab: safeNumber(source.rehab),
    capRate: safeNumber(source.capRate),
    ...(Object.keys(match).length ? { match: safeMatch(match) } : {}),
  };
}

function safeContactAccess(value: unknown) {
  const source = record(value);
  return {
    status: safeText(source.status, 30),
    cost: safeNumber(source.cost),
    currency: source.currency === 'nuggets' ? 'nuggets' : '',
  };
}

function safeService(value: unknown) {
  const source = record(value);
  return {
    id: safeText(source.id || source.serviceId, 50),
    title: safeText(source.title, 120),
    serviceType: safeText(source.serviceType, 80),
    price: safeNumber(source.price),
    markets: safeList(source.markets, 12),
    ...(source.fit ? { fit: safeMatch(source.fit) } : {}),
    ...(source.contactAccess ? { contactAccess: safeContactAccess(source.contactAccess) } : {}),
  };
}

function safeMetric(value: unknown) {
  const source = record(value);
  return {
    value: safeNumber(source.value),
    calculable: Boolean(source.calculable),
    source: safeText(source.source, 30),
    missingInputs: safeList(source.missingInputs, 8),
    reason: safeText(source.reason, 40),
  };
}

function safeMetrics(value: unknown) {
  const source = record(value);
  const metrics = record(source.metrics);
  return {
    metrics: {
      pricePerSqft: safeMetric(metrics.pricePerSqft),
      acquisitionPlusRehab: safeMetric(metrics.acquisitionPlusRehab),
      capRate: safeMetric(metrics.capRate),
    },
    missingInputs: safeList(source.missingInputs, 8),
  };
}

function safeAdvisor(value: unknown) {
  const source = record(value);
  return {
    positiveSignals: safeList(source.positiveSignals, 20),
    attentionPoints: safeList(source.attentionPoints, 20),
    missingInformation: safeList(source.missingInformation, 20),
    limitations: safeList(source.limitations, 20),
  };
}

function safeWorkflow(value: unknown) {
  const source = record(value);
  return {
    items: (Array.isArray(source.items) ? source.items : []).slice(0, 30).map((item) => {
      const workflowItem = record(item);
      return {
        code: safeText(workflowItem.code, 60),
        status: safeText(workflowItem.status, 30),
        source: safeText(workflowItem.source, 20),
      };
    }),
    completed: safeNumber(source.completed),
    pending: safeNumber(source.pending),
    total: safeNumber(source.total),
    progressLabel: safeText(source.progressLabel, 80),
  };
}

function safeNextAction(value: unknown) {
  const source = record(value);
  const action = record(source.nextBestAction || source);
  return {
    code: safeText(action.code, 60),
    priority: safeText(action.priority, 20),
    reasonCode: safeText(action.reasonCode, 80),
    actionable: Boolean(action.actionable),
    requiresConfirmation: Boolean(action.requiresConfirmation),
  };
}

function safeServiceMatches(value: unknown) {
  return (Array.isArray(value) ? value : []).slice(0, 12).map((item) => {
    const match = record(item);
    return {
      serviceType: safeText(match.serviceType, 80),
      confidence: safeText(match.confidence, 20),
      services: (Array.isArray(match.services) ? match.services : []).slice(0, 8).map(safeService),
    };
  });
}

function safeProfile(value: unknown) {
  const source = record(value);
  return {
    status: safeText(source.status, 20),
    profileStrength: safeNumber(source.profileStrength),
    investorRoles: safeList(source.investorRoles),
    lookingFor: safeList(source.lookingFor),
    targetMarkets: safeList(source.targetMarkets),
    propertyTypes: safeList(source.propertyTypes),
    strategies: safeList(source.strategies),
    priceRange: safeText(source.priceRange, 60),
    acceptableConditions: safeList(source.acceptableConditions),
    capitalReady: safeText(source.capitalReady, 10),
  };
}

function safeEvidenceField(value: unknown) {
  const source = record(value);
  const rawValue = source.value;
  const safeValue = typeof rawValue === 'number'
    ? safeNumber(rawValue)
    : typeof rawValue === 'boolean'
      ? rawValue
      : rawValue === null || rawValue === undefined
        ? null
        : safeText(rawValue, 120);
  return {
    value: safeValue,
    status: safeText(source.status, 30),
    source: safeText(source.source, 40) || null,
    retrievedAt: safeDate(source.retrievedAt),
    effectiveDate: safeDate(source.effectiveDate),
  };
}

const PROPERTY_EVIDENCE_FIELDS = [
  'propertyType', 'bedrooms', 'bathrooms', 'livingAreaSqft', 'lotSizeSqft', 'yearBuilt',
  'county', 'latitude', 'longitude', 'assessedValue', 'assessmentYear', 'annualPropertyTax',
  'propertyTaxYear', 'latestSalePrice', 'latestSaleDate', 'ownerOccupied', 'ownershipRecordPresent',
  'askingPrice',
];

function safeEvidenceFields(value: unknown) {
  const source = record(value);
  return Object.fromEntries(PROPERTY_EVIDENCE_FIELDS
    .filter((field) => Object.hasOwn(source, field))
    .map((field) => [field, safeEvidenceField(source[field])]));
}

export function sanitizeToolResultForGemini(value: unknown): Record<string, unknown> {
  const source = record(value);
  const type = safeText(source.type, 50);
  if (type === 'properties') {
    return {
      type,
      properties: (Array.isArray(source.items) ? source.items : []).slice(0, 20).map(safeProperty),
      personalized: Boolean(source.personalized),
      profileAvailable: Boolean(source.profileAvailable),
      requiresProfile: Boolean(source.requiresProfile),
    };
  }
  if (type === 'services') {
    return { type, services: (Array.isArray(source.items) ? source.items : []).slice(0, 20).map(safeService) };
  }
  if (type === 'investment_profile') {
    return { type, exists: Boolean(source.exists), complete: Boolean(source.complete), profile: safeProfile(source.profile) };
  }
  if (type === 'property_details') {
    return {
      type,
      found: Boolean(source.found),
      property: safeProperty(source.property),
      missingFields: safeList(source.missingFields, 20),
      metrics: safeMetrics(source.metrics),
      analysis: safeAdvisor(source.analysis),
      serviceNeeds: (Array.isArray(source.serviceNeeds) ? source.serviceNeeds : []).slice(0, 12).map((item) => {
        const need = record(item);
        return { serviceType: safeText(need.serviceType, 80), reasonCode: safeText(need.reasonCode, 60), confidence: safeText(need.confidence, 20) };
      }),
      serviceMatches: safeServiceMatches(source.serviceMatches),
      nextBestAction: safeNextAction(source.nextBestAction),
      workflow: safeWorkflow(source.workflow),
    };
  }
  if (type === 'deal_insight') {
    const profile = record(source.investmentProfile);
    const capabilities = record(source.capabilities);
    const evidence: Record<string, unknown> = sanitizeToolResultForGemini(source.evidence);
    return {
      type,
      propertyId: safeText(source.propertyId, 50),
      state: safeText(source.state, 30),
      property: safeProperty(source.property),
      investmentProfile: {
        exists: Boolean(profile.exists),
        complete: Boolean(profile.complete),
        profile: safeProfile(profile.profile),
      },
      match: source.match ? { ...safeMatch(source.match), semantics: 'profile_fit_only' } : null,
      evidence,
      metrics: safeMetrics(source.metrics),
      analysis: safeAdvisor(source.analysis),
      capabilities: {
        canDiscussPricePerSqft: Boolean(capabilities.canDiscussPricePerSqft),
        canDiscussAcquisitionPlusRehab: Boolean(capabilities.canDiscussAcquisitionPlusRehab),
        hasReportedCapRate: Boolean(capabilities.hasReportedCapRate),
        canCalculateARV: false,
        canCalculateMAO: false,
        canCalculateROI: false,
        canCalculateCashFlow: false,
      },
    };
  }
  if (type === 'property_evidence') {
    const evidence = record(source.evidence);
    const evidenceSource = record(evidence.source);
    return {
      type,
      propertyId: safeText(source.propertyId, 50),
      state: safeText(source.state, 30),
      entitlementState: safeText(source.entitlementState, 30),
      cacheState: safeText(source.cacheState, 20),
      ...(source.state === 'available' ? {
        internalData: safeEvidenceFields(evidence.internalFields),
        publicEvidence: safeEvidenceFields(evidence.fields),
        conflicts: (Array.isArray(evidence.conflicts) ? evidence.conflicts : []).slice(0, 20).map((item) => {
          const conflict = record(item);
          return {
            field: safeText(conflict.field, 60),
            dealSifterValue: typeof conflict.dealSifterValue === 'number' ? safeNumber(conflict.dealSifterValue) : safeText(conflict.dealSifterValue, 120),
            publicRecordValue: typeof conflict.publicRecordValue === 'number' ? safeNumber(conflict.publicRecordValue) : safeText(conflict.publicRecordValue, 120),
            severity: safeText(conflict.severity, 20),
          };
        }),
        missingFields: safeList(evidence.missingFields, 30),
        source: {
          label: safeText(evidenceSource.label, 100),
          retrievedAt: safeDate(evidenceSource.updatedAt),
        },
      } : {}),
    };
  }
  if (type === 'deal_copilot_overview') {
    const overview = record(source.overview);
    const conversation = record(overview.conversationSummary);
    const serviceSummary = record(overview.serviceSummary);
    return {
      type,
      found: Boolean(source.found),
      propertySummary: safeProperty(overview.propertySummary),
      metricsSummary: safeMetrics(overview.metricsSummary),
      advisorSummary: safeAdvisor(overview.advisorSummary),
      workflow: safeWorkflow(overview.workflow),
      nextBestAction: safeNextAction(overview.nextBestAction),
      serviceSummary: {
        needs: (Array.isArray(serviceSummary.needs) ? serviceSummary.needs : []).slice(0, 12).map((item) => {
          const need = record(item);
          return { serviceType: safeText(need.serviceType, 80), reasonCode: safeText(need.reasonCode, 60), confidence: safeText(need.confidence, 20) };
        }),
        providers: (Array.isArray(serviceSummary.providers) ? serviceSummary.providers : []).slice(0, 12).map(safeService),
      },
      conversationState: {
        providerReplyFound: Boolean(conversation.providerReplyFound),
        messageCount: safeNumber(conversation.messageCount),
      },
    };
  }
  if (type === 'property_comparison') {
    return {
      type,
      properties: (Array.isArray(source.properties) ? source.properties : []).slice(0, 3).map((item) => {
        const comparisonItem = record(item);
        return {
          property: safeProperty(comparisonItem.property),
          missingFields: safeList(comparisonItem.missingFields, 20),
          metrics: safeMetrics(comparisonItem.metrics),
        };
      }),
      comparisonAvailable: Boolean(source.comparison),
    };
  }
  return { type: type || 'unknown', available: false };
}

export function buildToolInterpretationRequest(input: {
  contents: unknown[];
  modelParts: unknown[];
  toolName: string;
  functionCallId?: string;
  toolResult: unknown;
  language: string;
  generationConfig: Record<string, unknown>;
  safetySettings: unknown[];
  plainToolResult?: boolean;
}) {
  const safeResult = sanitizeToolResultForGemini(input.toolResult);
  const resultType = safeText((safeResult as Record<string, unknown>).type, 50);
  const interaction = buildAnalyticalInteractionInstruction(resultType === 'deal_insight' ? 'deal_insight' : 'tool_result');
  const systemText = `You are Maxxis Deal AI inside DealSifter. Interpret the authoritative structured tool result naturally in ${safeText(input.language, 8) || 'en'}. Do not expose hidden data or request another tool.
${interaction}
For property evidence, preserve provenance and effective/retrieval dates when material. For deal insight, use only the composed backend context. Evidence is not an appraisal or guaranteed truth. If ARV/MAO capability is false, explain that verified comps and an authorized calculation engine/rule are unavailable. Use at most 180 words for deal insight and 120 words otherwise; structured cards are rendered separately.`;
  if (input.plainToolResult) {
    const resultText = JSON.stringify(safeResult).slice(0, 12_000);
    return {
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [
        ...input.contents,
        {
          role: 'user',
          parts: [{
            text: `Authoritative ${safeText(input.toolName, 80)} result from DealSifter backend. Use only these facts:\n${resultText}`,
          }],
        },
      ],
      generationConfig: input.generationConfig,
      safetySettings: input.safetySettings,
    };
  }
  return {
    systemInstruction: {
      parts: [{ text: systemText }],
    },
    contents: [
      ...input.contents,
      { role: 'model', parts: input.modelParts },
      {
        role: 'user',
        parts: [{
          functionResponse: {
            ...(safeText(input.functionCallId, 160) ? { id: safeText(input.functionCallId, 160) } : {}),
            name: safeText(input.toolName, 80),
            response: { result: safeResult },
          },
        }],
      },
    ],
    generationConfig: input.generationConfig,
    safetySettings: input.safetySettings,
  };
}
