export const INVESTMENT_TRIGGER_CATEGORY_IDS = ['lender', 'buyer', 'investor', 'ff', 'tax'];

export const INVESTMENT_ROLE_OPTIONS = [
  'Lender / Capital Partner',
  'Cash Buyer',
  'RE Investor',
  'Wholesaler',
  'Flipper',
  'Buy & Hold Landlord',
  'Tax Deed Buyer',
];

export const INVESTMENT_LOOKING_FOR_OPTIONS = [
  'Off-market deals',
  'On-market deals',
  'JV partners',
  'Borrowers',
  'Private lenders',
  'Cash buyers',
  'Wholesalers',
  'Contractors',
];

export const INVESTMENT_PROPERTY_TYPE_OPTIONS = [
  'Single Family',
  'Multi-Family 2-4',
  'Multi-Family 5+',
  'Condo / Townhouse',
  'Land',
  'Commercial',
  'Mixed-Use',
  'Mobile / Manufactured',
];

export const INVESTMENT_STRATEGY_OPTIONS = [
  'Buy & Hold',
  'Fix & Flip',
  'BRRRR',
  'Wholesale',
  'Wholetail',
  'Short-Term Rental',
  'Mid-Term Rental',
  'Development',
  'Value-Add',
  'Creative Finance',
  'Distressed Assets',
  'Tax Strategies',
  'Notes / Paper',
];

export const INVESTMENT_DEAL_SOURCE_OPTIONS = [
  'MLS',
  'Off-Market',
  'Distressed',
  'Foreclosure',
  'Tax Sale',
  'Probate',
  'FSBO',
  'Via Wholesaler',
];

export const INVESTMENT_TAX_OBJECTIVE_OPTIONS = [
  'Buy & Hold',
  'New Construction',
  'Fix & Flip',
  'Only Flip',
  'Rent',
  'Wholesale',
  'Other',
];

export const INVESTMENT_CONDITION_OPTIONS = [
  'Turnkey',
  'Light Cosmetic',
  'Medium Rehab',
  'Heavy Rehab',
  'Tear-down / Land Value',
];

export const INVESTMENT_PRICE_RANGE_OPTIONS = [
  { value: '', label: 'Select' },
  { value: 'lt_100k', label: 'Below $100K' },
  { value: '100_200k', label: '$100K - $200K' },
  { value: '200_400k', label: '$200K - $400K' },
  { value: '400_800k', label: '$400K - $800K' },
  { value: '800k_plus', label: '$800K+' },
];

export const INVESTMENT_DEALS_COUNT_OPTIONS = [
  { value: '0', label: '0' },
  { value: '1_5', label: '1-5' },
  { value: '6_15', label: '6-15' },
  { value: '16_30', label: '16-30' },
  { value: '31_plus', label: '31+' },
];

export const INVESTMENT_AVG_DEAL_SIZE_OPTIONS = [
  { value: 'lt_250k', label: 'Less than $250K' },
  { value: '250_500k', label: '$250K - $500K' },
  { value: '500k_1m', label: '$500K - $1M' },
  { value: '1m_plus', label: '$1M+' },
];

export const INVESTMENT_YEARS_OPTIONS = [
  { value: '0_1', label: '0-1' },
  { value: '1_3', label: '1-3' },
  { value: '4_7', label: '4-7' },
  { value: '8_plus', label: '8+' },
];

export const INVESTMENT_EMPTY_DRAFT = {
  version: 1,
  status: 'draft',
  triggerCategories: [],
  profileStrength: 0,
  completedAt: null,
  currentFocus: '',
  investorRoles: [],
  lookingFor: [],
  targetMarkets: [],
  propertyTypes: [],
  strategies: [],
  accreditedInvestor: '',
  dealSources: [],
  taxDealObjectives: [],
  taxDealObjectiveOtherText: '',
  priceRange: '',
  acceptableConditions: [],
  capitalReady: '',
  dealsClosedLifetime: '0',
  dealsClosedLast12mo: '0',
  avgDealSize: 'lt_250k',
  yearsInvesting: '1_3',
  currentlyActiveDeals: 0,
};

export function normalizeInvestmentDraft(value) {
  const source = value && typeof value === 'object' ? value : {};
  const list = (raw) => Array.from(new Set((Array.isArray(raw) ? raw : []).map((item) => String(item || '').trim()).filter(Boolean)));
  const activeDealsRaw = Number(source.currentlyActiveDeals);
  return {
    ...INVESTMENT_EMPTY_DRAFT,
    ...source,
    triggerCategories: list(source.triggerCategories),
    investorRoles: list(source.investorRoles),
    lookingFor: list(source.lookingFor),
    targetMarkets: list(source.targetMarkets),
    propertyTypes: list(source.propertyTypes),
    strategies: list(source.strategies),
    dealSources: list(source.dealSources),
    taxDealObjectives: list(source.taxDealObjectives),
    taxDealObjectiveOtherText: String(source.taxDealObjectiveOtherText || '').trim(),
    currentFocus: String(source.currentFocus || '').trim(),
    accreditedInvestor: source.accreditedInvestor === 'yes' || source.accreditedInvestor === 'no' ? source.accreditedInvestor : '',
    priceRange: String(source.priceRange || '').trim(),
    acceptableConditions: list(source.acceptableConditions),
    capitalReady: source.capitalReady === 'yes' || source.capitalReady === 'no' ? source.capitalReady : '',
    dealsClosedLifetime: String(source.dealsClosedLifetime || '0').trim(),
    dealsClosedLast12mo: String(source.dealsClosedLast12mo || '0').trim(),
    avgDealSize: String(source.avgDealSize || 'lt_250k').trim(),
    yearsInvesting: String(source.yearsInvesting || '1_3').trim(),
    currentlyActiveDeals: Number.isFinite(activeDealsRaw) ? Math.max(0, Math.min(99, Math.round(activeDealsRaw))) : 0,
    status: source.status === 'complete' ? 'complete' : 'draft',
    profileStrength: Number.isFinite(Number(source.profileStrength)) ? Number(source.profileStrength) : 0,
    completedAt: source.completedAt || null,
  };
}

export function computeInvestmentProfileStrength(draft) {
  const scoreItems = [
    Boolean(String(draft.currentFocus || '').trim()),
    (draft.investorRoles || []).length > 0,
    (draft.lookingFor || []).length > 0,
    (draft.targetMarkets || []).length > 0,
    (draft.propertyTypes || []).length > 0,
    (draft.strategies || []).length > 0,
    (draft.dealSources || []).length > 0,
    Boolean(String(draft.priceRange || '').trim()),
    (draft.acceptableConditions || []).length > 0,
    draft.capitalReady === 'yes' || draft.capitalReady === 'no',
    draft.accreditedInvestor === 'yes' || draft.accreditedInvestor === 'no',
  ];
  return Math.round((scoreItems.filter(Boolean).length / scoreItems.length) * 100);
}
