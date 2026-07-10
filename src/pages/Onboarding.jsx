import { CATEGORIES, CARDS, SERVICE_PORTFOLIO, PROPERTIES } from '../data/mockData';
import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { C } from '../theme/colors';
import { Modal } from '../components/ui/Modal';
import { SwipeCard } from '../components/cards/SwipeCard';
import { PropertyCard } from '../components/cards/PropertyCard';
import { SmartImage } from '../components/ui/SmartImage';
import { Icon } from '../components/ui/Icon';
import { InvestmentProfileModal } from '../components/onboarding/InvestmentProfileModal';
import { ProfessionalPropertyForm } from '../components/onboarding/ProfessionalPropertyForm';
import { PrimaryProfileSelect } from '../components/onboarding/PrimaryProfileSelect';
import { Chip, MarketsSelector, SectionCard } from '../components/onboarding/OnboardingUi';
import { useT } from '../i18n/translations';
// removed unused import: toggleHidden
import { genId } from '../lib/id';
import { createProfessionalProperty } from '../lib/propertyFactory';
import { validateProfessionalPropertyDraft } from '../lib/propertyValidation';
import { getPortfolioVideoBlob, setPortfolioVideoBlob, clearPortfolioVideoBlob } from '../lib/localforageHelper';
import { getMatchPressure } from '../lib/matchPressure';
import { formatCompactUsd } from '../lib/formatMoney';
import { INVESTMENT_TRIGGER_CATEGORY_IDS, computeInvestmentProfileStrength, normalizeInvestmentDraft } from '../lib/investmentProfile';
import { readAndCompressFiles } from '../lib/onboardingMedia';
import { clearPendingDeal, getPendingDealRemainingDays, isPendingDealActive, isPendingDealExpired, markPendingDeal } from '../lib/pendingDeal';
import { useMediaQuery } from '../hooks/useMediaQuery';
import {
  CARD_PRIORITY_OPTIONS,
  CONTACT_METHOD_PRESETS,
  FEED_TASKBAR_CATEGORY_OPTIONS,
  PREVIEW_PLACEHOLDER_IMAGE,
  PROFILE_PRIORITY_KEYS,
  SKILL_PRESETS,
  US_STATES,
} from '../lib/onboardingConstants';
import {
  hasDuplicateCardPriorities,
  isTruthyFlag,
  normalizeMarkets,
  normalizeUniqueCardPriorities,
  normalizeUsStateCode,
} from '../lib/onboardingHelpers';


export function Onboarding({
  setPage,
  authSession,
  onResendVerificationEmail,
  onRefreshAuthSession,
  setUserProfile,
  profileSyncStatus = 'idle',
  portfolioSyncStatus = 'idle',
  accountType,
  setAccountType,
  personalProfile,
  setPersonalProfile,
  professionalProfile,
  setProfessionalProfile,
  servicePortfolio,
  setServicePortfolio,
  propertyPortfolio,
  setPropertyPortfolio,
  onDeletePropertyRecord,
  onDeleteServiceRecord,
  initialProfileTab = 'personal',
}) {
  const t = useT('onboarding').onboarding;
  const readStoredPriority = (profile, key) => {
    if (!profile || typeof profile !== 'object') return '';
    if (!Object.prototype.hasOwnProperty.call(profile, key)) return '';
    return String(profile[key] || '').trim().toLowerCase();
  };
  const [selectedMarkets, setSelectedMarkets] = useState(professionalProfile?.markets || []);
  const [selectedSkills, setSelectedSkills] = useState(professionalProfile?.skills || []);
  const [selectedServices, setSelectedServices] = useState(professionalProfile?.services || []);
  const [pitch, setPitch] = useState(professionalProfile?.pitch || '');

  const [portfolioAddress, setPortfolioAddress] = useState('');
  const [portfolioCity, setPortfolioCity] = useState('');
  const [portfolioZip, setPortfolioZip] = useState('');
  const [portfolioType, setPortfolioType] = useState('');
  const [portfolioPrice, setPortfolioPrice] = useState('');
  const [portfolioBeds, setPortfolioBeds] = useState('');
  const [portfolioBaths, setPortfolioBaths] = useState('');
  const [portfolioSqft, setPortfolioSqft] = useState('');
  const [portfolioLot, setPortfolioLot] = useState('');
  const [portfolioRehab, setPortfolioRehab] = useState('');
  const [portfolioCapRate, setPortfolioCapRate] = useState('');
  const [portfolioObjective, setPortfolioObjective] = useState('');
  const [portfolioMarkets, setPortfolioMarkets] = useState([]);
  const [primaryProfileScope, setPrimaryProfileScope] = useState(''); // property scope only
  const [portfolioDescription, setPortfolioDescription] = useState('');
  // Keep temporary uploads separated by onboarding branch to avoid cross-reflection.
  const shouldUseTempStorage = true;
  const activeTempStorageKey = accountType === 'fsbo_owner' ? 'tempUploads_fsbo' : 'tempUploads_professional';
  const _savedTemp = (() => {
    if (!shouldUseTempStorage || !activeTempStorageKey) return {};
    try {
      return JSON.parse(localStorage.getItem(activeTempStorageKey) || '{}');
    } catch {
      return {};
    }
  })();
  const savedThumbA = Object.prototype.hasOwnProperty.call(_savedTemp, 'profileThumb')
    ? (_savedTemp.profileThumb || '')
    : (accountType === 'professional' ? (professionalProfile?.photoA || '') : (personalProfile?.photo || ''));
  const savedThumbB = Object.prototype.hasOwnProperty.call(_savedTemp, 'profileThumbB')
    ? (_savedTemp.profileThumbB || '')
    : (professionalProfile?.photoB || '');
  const [name, setName] = useState(accountType === 'professional' ? (professionalProfile?.fullNameA || '') : (personalProfile?.fullName || ''));
  const [loc, setLoc] = useState(normalizeUsStateCode(accountType === 'professional' ? professionalProfile?.locA : personalProfile?.loc));
  const [selectedCategories, setSelectedCategories] = useState(professionalProfile?.categories || []);
  const [primaryCategory, setPrimaryCategory] = useState(professionalProfile?.primaryCategory || (professionalProfile?.categories || [])[0] || '');
  const [profileThumb, setProfileThumb] = useState(savedThumbA);
  const [profileThumbClearRequested, setProfileThumbClearRequested] = useState(false);
  const [contactMethods, setContactMethods] = useState(accountType === 'professional' ? (professionalProfile?.contactMethodsA || []) : (personalProfile?.contactMethods || []));
  const [personalPrimaryPhone, setPersonalPrimaryPhone] = useState(accountType === 'professional' ? (professionalProfile?.primaryPhoneA || professionalProfile?.phoneA || '') : (personalProfile?.primaryPhone || personalProfile?.phone || ''));
  const [personalSecondaryPhone, setPersonalSecondaryPhone] = useState(accountType === 'professional' ? (professionalProfile?.secondaryPhoneA || '') : (personalProfile?.secondaryPhone || ''));
  const [personalTertiaryPhone, setPersonalTertiaryPhone] = useState(accountType === 'professional' ? (professionalProfile?.tertiaryPhoneA || '') : (personalProfile?.tertiaryPhone || ''));
  const [personalEmail, setPersonalEmail] = useState(accountType === 'professional' ? (professionalProfile?.emailA || '') : (personalProfile?.email || ''));
  const hasExplicitPriorityA = accountType === 'professional'
    ? professionalProfile?.cardPriorityAExplicit === true
    : (professionalProfile?.cardPriorityAExplicit === true || personalProfile?.cardPriorityAExplicit === true);
  const [cardPriorityA, setCardPriorityA] = useState(
    hasExplicitPriorityA
      ? (accountType === 'professional'
        ? readStoredPriority(professionalProfile, 'cardPriorityA')
        : (readStoredPriority(personalProfile, 'cardPriorityA') || readStoredPriority(professionalProfile, 'cardPriorityA')))
      : ''
  );

  const [nameB, setNameB] = useState(professionalProfile?.fullNameB || '');
  const [locB, setLocB] = useState(normalizeUsStateCode(professionalProfile?.locB));
  const [selectedCategoriesB, setSelectedCategoriesB] = useState(professionalProfile?.categoriesB || []);
  const [primaryCategoryB, setPrimaryCategoryB] = useState(professionalProfile?.primaryCategoryB || (professionalProfile?.categoriesB || [])[0] || '');
  const [selectedMarketsB, setSelectedMarketsB] = useState(professionalProfile?.marketsB || []);
  const [selectedSkillsB, setSelectedSkillsB] = useState(professionalProfile?.skillsB || []);
  const [selectedServicesB, setSelectedServicesB] = useState(professionalProfile?.servicesB || []);
  const [goal, setGoal] = useState(professionalProfile?.goal || '');
  const [goalB, setGoalB] = useState(professionalProfile?.goalB || '');
  const [pitchB, _setPitchB] = useState(professionalProfile?.pitchB || '');
  // setter intentionally unused in this component
  void _setPitchB;
  const [profileThumbB, setProfileThumbB] = useState(savedThumbB);
  const [profileThumbBClearRequested, setProfileThumbBClearRequested] = useState(false);
  const [contactMethodsB, setContactMethodsB] = useState(professionalProfile?.contactMethodsB || []);
  const [personalPrimaryPhoneB, setPersonalPrimaryPhoneB] = useState(professionalProfile?.primaryPhoneB || professionalProfile?.phoneB || '');
  const [personalSecondaryPhoneB, setPersonalSecondaryPhoneB] = useState(professionalProfile?.secondaryPhoneB || '');
  const [personalTertiaryPhoneB, setPersonalTertiaryPhoneB] = useState(professionalProfile?.tertiaryPhoneB || '');
  const [personalEmailB, setPersonalEmailB] = useState(professionalProfile?.emailB || '');
  const hasExplicitPriorityB = professionalProfile?.cardPriorityBExplicit === true;
  const hasExplicitPriorityC = accountType === 'professional'
    ? professionalProfile?.cardPriorityCExplicit === true
    : (professionalProfile?.cardPriorityCExplicit === true || personalProfile?.cardPriorityCExplicit === true);
  const [cardPriorityB, setCardPriorityB] = useState(hasExplicitPriorityB ? (professionalProfile?.cardPriorityB || '') : '');
  const [cardPriorityC, setCardPriorityC] = useState(
    hasExplicitPriorityC
      ? (accountType === 'professional'
        ? readStoredPriority(professionalProfile, 'cardPriorityC')
        : (readStoredPriority(personalProfile, 'cardPriorityC') || readStoredPriority(professionalProfile, 'cardPriorityC')))
      : ''
  );

  const [portfolioImages, setPortfolioImages] = useState(_savedTemp.portfolioImages || []);
  const [portfolioVideo, setPortfolioVideo] = useState('');
  const [editingImagesId, setEditingImagesId] = useState(null);
  const [editingPropertyId, setEditingPropertyId] = useState(null);
  const [propertyEditDraft, setPropertyEditDraft] = useState({ address: '', city: '', zip: '', price: '', capRate: '', rehab: '', beds: '', baths: '', sqft: '', lot: '', type: '', objective: '', description: '', primaryProfile: 'personal', markets: [] });
  const [portfolioMsg, setPortfolioMsg] = useState('');
  const [portfolioEntryType, setPortfolioEntryType] = useState('property');
  const [portfolioRecordsTab, setPortfolioRecordsTab] = useState('properties');

  const [serviceTitle, setServiceTitle] = useState('');
  const [serviceCategory, setServiceCategory] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [serviceMarkets, setServiceMarkets] = useState([]);
  const [serviceImages, setServiceImages] = useState(_savedTemp.serviceImages || []);
  const [servicePrimaryProfileScope, setServicePrimaryProfileScope] = useState('');
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [serviceEditDraft, setServiceEditDraft] = useState({ title: '', category: '', description: '', price: '', primaryProfile: '', markets: [] });
  const [showArchivedImages, _setShowArchivedImages] = useState({});
  const [propertyImageIndex, setPropertyImageIndex] = useState({});

  const [profileTab, setProfileTab] = useState(initialProfileTab || 'personal');
  const activePersonal = profileTab === 'personal';
  const activeSkills = profileTab === 'skills';
  const activeProfessional = profileTab === 'professional';
  const activeOperation = profileTab === 'operation';
  const isMobileViewport = useMediaQuery('(max-width: 1024px)');
  const isPhoneViewport = useMediaQuery('(max-width: 767px)');
  const isTabletPortraitViewport = useMediaQuery('(min-width: 480px) and (max-width: 1024px) and (orientation: portrait)');
  const isTabletViewport = useMediaQuery('(min-width: 480px) and (max-width: 1199px)');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewServiceIndex, setPreviewServiceIndex] = useState(0);
  const [previewPropertyIndex, setPreviewPropertyIndex] = useState(0);
  const [previewGroupIndex, setPreviewGroupIndex] = useState(0);
  const [previewMode, setPreviewMode] = useState('properties');
  const onboardingGridRef = useRef(null);

  const [previewDragIndex, setPreviewDragIndex] = useState(null);
  const [previewDragOverIndex, setPreviewDragOverIndex] = useState(null);
  const INLINE_EDIT_ENABLED = false;
  const [basicRequiredMsg, setBasicRequiredMsg] = useState('');
  const [inlineValidationHint, setInlineValidationHint] = useState({ target: '', message: '' });
  const [inlineValidationHintPos, setInlineValidationHintPos] = useState({ top: 0, left: 0 });
  const [publishToast, setPublishToast] = useState('');
  const [verificationModal, setVerificationModal] = useState({ open: false, scope: 'personal', error: '', info: '' });
  const [saveProfilesBaseline, setSaveProfilesBaseline] = useState('');
  const [isSaveProfilesDirty, setIsSaveProfilesDirty] = useState(false);
  const [pendingProfileClearScope, setPendingProfileClearScope] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isPreviewToFeedDirty, setIsPreviewToFeedDirty] = useState(false);
  const [investmentProfileDraft, setInvestmentProfileDraft] = useState(() => normalizeInvestmentDraft(professionalProfile?.investmentProfile));
  const [investmentModalOpen, setInvestmentModalOpen] = useState(false);
  const [investmentMarketInput, setInvestmentMarketInput] = useState('');

  const investmentTriggerCategories = useMemo(() => {
    const fromA = Array.isArray(selectedCategories) ? selectedCategories : [];
    const fromB = Array.isArray(selectedCategoriesB) ? selectedCategoriesB : [];
    return Array.from(new Set([...fromA, ...fromB].filter((id) => INVESTMENT_TRIGGER_CATEGORY_IDS.includes(String(id || '').trim()))));
  }, [selectedCategories, selectedCategoriesB]);

  const requiresInvestmentProfile = accountType === 'professional' && investmentTriggerCategories.length > 0;
  const investmentProfileStrength = useMemo(() => computeInvestmentProfileStrength(investmentProfileDraft), [investmentProfileDraft]);
  const showInvestmentProfileAction = accountType === 'professional' && (requiresInvestmentProfile || investmentProfileStrength > 0);
  const investmentScoreMeta = useMemo(() => {
    const score = Math.max(0, Math.min(100, Number(investmentProfileStrength || 0)));
    if (score === 100) {
      return {
        label: t.investmentScoreRangeExcellent || 'Excellent',
        alert: t.investmentScoreAlertExcellent || 'Excellent profile. Keep this level to maximize quality matches.',
        icon: 'shieldCheck',
        color: C.success,
      };
    }
    if (score >= 90) {
      return {
        label: t.investmentScoreRangeGood || 'Good',
        alert: t.investmentScoreAlertGood || 'Good profile. Add a few more details to reach excellent quality.',
        icon: 'shieldCheck',
        color: C.accent,
      };
    }
    if (score >= 60) {
      return {
        label: t.investmentScoreRangeNotBad || 'Not bad (can be increased)',
        alert: t.investmentScoreAlertNotBad || 'Not bad. Completing missing fields will improve match relevance.',
        icon: 'activity',
        color: C.warning,
      };
    }
    return {
      label: t.investmentScoreRangeNeedsTlc || 'Needs TLC for better matches',
      alert: t.investmentScoreAlertNeedsTlc || 'Needs attention. Add key details to avoid weak matches.',
      icon: 'info',
      color: C.danger,
    };
  }, [investmentProfileStrength, t]);
  const investmentProfileRequiredComplete = investmentProfileStrength >= 50;

  const getPersistedInvestmentProfile = useCallback((opts = {}) => {
    const strength = computeInvestmentProfileStrength(investmentProfileDraft);
    const isComplete = Boolean(opts.forceComplete ?? investmentProfileRequiredComplete);
    return normalizeInvestmentDraft({
      ...investmentProfileDraft,
      triggerCategories: investmentTriggerCategories,
      profileStrength: strength,
      status: isComplete ? 'complete' : 'draft',
      completedAt: isComplete ? (investmentProfileDraft.completedAt || Date.now()) : null,
    });
  }, [investmentProfileDraft, investmentTriggerCategories, investmentProfileRequiredComplete]);

  const openInvestmentProfileModal = useCallback(() => {
    setInvestmentProfileDraft(normalizeInvestmentDraft(professionalProfile?.investmentProfile));
    setInvestmentModalOpen(true);
  }, [professionalProfile?.investmentProfile]);

  const profileSyncVisual = useMemo(() => {
    const isSyncing = profileSyncStatus === 'syncing' || portfolioSyncStatus === 'syncing';
    const hasError = profileSyncStatus === 'error' || portfolioSyncStatus === 'degraded';
    const allSynced = profileSyncStatus === 'synced' && portfolioSyncStatus === 'synced';

    if (allSynced) {
      return { ring: '#2f8f4e', dot: '#35c201', title: t.profileSyncAllSynced || 'Profiles and portfolio synced with database' };
    }
    if (isSyncing) {
      return { ring: C.accent, dot: C.accent, title: t.profileSyncAllSyncing || 'Syncing profiles and portfolio with database' };
    }
    if (hasError) {
      return { ring: C.danger, dot: C.danger, title: t.profileSyncAllError || 'Profile and portfolio sync failed' };
    }
    if (profileSyncStatus === 'synced') {
      return { ring: '#2f8f4e', dot: '#35c201', title: t.profileSyncOneSynced || 'Profile synced with database' };
    }
    if (profileSyncStatus === 'syncing') {
      return { ring: C.accent, dot: C.accent, title: t.profileSyncOneSyncing || 'Syncing profile with database' };
    }
    if (profileSyncStatus === 'error') {
      return { ring: C.danger, dot: C.danger, title: t.profileSyncOneError || 'Profile sync failed' };
    }
    return { ring: C.border, dot: C.t3, title: t.profileSyncIdle || 'No active profile sync' };
  }, [profileSyncStatus, portfolioSyncStatus, t]);

  const personalTabRef = useRef(null);
  const skillsTabRef = useRef(null);
  const businessTabRef = useRef(null);
  const operationTabRef = useRef(null);
  const profileAFieldsRef = useRef(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setProfileTab(initialProfileTab || 'personal'), 0);
    return () => window.clearTimeout(timer);
  }, [initialProfileTab]);

  const applyCardPrioritySet = (priorities, preferredKey = 'A') => {
    const normalized = normalizeUniqueCardPriorities(priorities, preferredKey);
    setCardPriorityA(normalized.A);
    setCardPriorityB(normalized.B);
    setCardPriorityC(normalized.C);
  };

  const applyCardPriorityChange = (profileKey, nextPriority) => {
    const current = { A: cardPriorityA, B: cardPriorityB, C: cardPriorityC };
    const myOldPriority = current[profileKey];

    // If user selects empty ("Select"), just clear this profile - no swap needed
    if (!nextPriority) {
      current[profileKey] = '';
      applyCardPrioritySet(current, profileKey);
      return;
    }

    // Auto-swap: if another profile already holds this priority, swap them
    const conflictKey = PROFILE_PRIORITY_KEYS.find(
      (key) => key !== profileKey && String(current[key] || '').toLowerCase() === String(nextPriority || '').toLowerCase()
    );
    if (conflictKey) {
      // Swap: the conflicting profile gets our old priority (or empty if we had none)
      current[conflictKey] = myOldPriority || '';
    }
    current[profileKey] = nextPriority;

    applyCardPrioritySet(current, profileKey);
  };

  const cardPriorityByProfile = {
    A: String(cardPriorityA || '').toLowerCase(),
    B: String(cardPriorityB || '').toLowerCase(),
    C: String(cardPriorityC || '').toLowerCase(),
  };

  const _isPriorityOptionTakenByAnotherProfile = (profileKey, optionValue) => {
    const normalizedOption = String(optionValue || '').toLowerCase();
    if (cardPriorityByProfile[profileKey] === normalizedOption) return false;
    return PROFILE_PRIORITY_KEYS.some((key) => key !== profileKey && cardPriorityByProfile[key] === normalizedOption);
  };
  void _isPriorityOptionTakenByAnotherProfile;

  const clearInlineValidationHint = () => setInlineValidationHint({ target: '', message: '' });
  const showInlineValidationHint = (target, message) => setInlineValidationHint({ target, message });
  const _isInlineValidationTarget = (target) => inlineValidationHint.target === target && String(inlineValidationHint.message || '').trim().length > 0;
  void _isInlineValidationTarget;

  const resolveInlineValidationAnchor = useCallback(() => {
    switch (inlineValidationHint.target) {
      case 'tab-personal':
        return personalTabRef.current;
      case 'tab-skills':
        return skillsTabRef.current;
      case 'tab-business':
        return businessTabRef.current;
      case 'tab-operation':
        return operationTabRef.current;
      case 'profile-a-fields':
        return profileAFieldsRef.current;
      default:
        return null;
    }
  }, [inlineValidationHint.target]);

  useEffect(() => {
    const message = String(inlineValidationHint.message || '').trim();
    if (!message) return;

    const updatePosition = () => {
      const anchor = resolveInlineValidationAnchor();
      if (!anchor) {
        setInlineValidationHintPos({ top: 84, left: 24 });
        return;
      }
      const rect = anchor.getBoundingClientRect();
      const hintWidth = 320;
      const margin = 12;
      const nextLeft = Math.max(margin, Math.min(rect.left, window.innerWidth - hintWidth - margin));
      const nextTop = Math.max(margin, Math.min(rect.bottom + 8, window.innerHeight - 80));
      setInlineValidationHintPos({ top: nextTop, left: nextLeft });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [inlineValidationHint, accountType, profileTab, resolveInlineValidationAnchor]);

  useEffect(() => {
    const current = {
      A: cardPriorityA,
      B: cardPriorityB,
      C: cardPriorityC,
    };
    if (!hasDuplicateCardPriorities(current)) return;

    const preferred = accountType === 'fsbo_owner'
      ? 'C'
      : (activeProfessional || activeOperation ? 'B' : 'A');
    const timer = window.setTimeout(() => applyCardPrioritySet(current, preferred), 0);
    return () => window.clearTimeout(timer);
  }, [accountType, activeOperation, activeProfessional, cardPriorityA, cardPriorityB, cardPriorityC]);

  const normalizePortfolioProfileScope = useCallback((scope) => {
    const normalized = String(scope || '').trim().toLowerCase();
    if (normalized === 'personal' || normalized === 'primary' || normalized === 'a') return 'personal';
    if (
      normalized === 'professional'
      || normalized === 'secondary'
      || normalized === 'business'
      || normalized === 'operation'
      || normalized === 'operations'
      || normalized === 'b'
    ) return 'professional';
    if (normalized === 'fsbo' || normalized === 'c') return 'fsbo';
    return '';
  }, []);

  const isOwnPropertyRecord = (record) => {
    if (!record) return false;
    const src = String(record.source || '').trim();
    return src === 'portfolio' || src === 'fsbo' || src === 'supabase';
  };

  const isOwnServiceRecord = (record) => {
    if (!record) return false;
    const src = String(record.source || '').trim();
    return src === 'portfolio' || src === 'supabase';
  };

  const isPropertyVisibleInPreview = useCallback((property) => (
    Boolean(property)
    && Boolean(normalizePortfolioProfileScope(property.primaryProfile))
    && isTruthyFlag(property.includeInPreview, false)
    && property.dealClosed !== true
  ), [normalizePortfolioProfileScope]);

  const isServiceVisibleInPreview = useCallback((service) => (
    Boolean(service)
    && Boolean(normalizePortfolioProfileScope(service.primaryProfile))
    && isTruthyFlag(service.includeInPreview, false)
    && service.dealClosed !== true
  ), [normalizePortfolioProfileScope]);

  const allProfiles = useMemo(
    () => CATEGORIES.filter((c) => c.id !== 'all').flatMap((c) => (c.sub ? [{ ...c, sub: null }, ...c.sub] : [c])),
    []
  );

  const myPortfolio = useMemo(() => (
    propertyPortfolio.filter((p) => isOwnPropertyRecord(p))
  ), [propertyPortfolio]);
  const previewPropertiesCount = useMemo(
    () => (myPortfolio || []).filter((p) => isPropertyVisibleInPreview(p)).length,
    [isPropertyVisibleInPreview, myPortfolio]
  );

  useEffect(() => {
    if (previewPropertyIndex < previewPropertiesCount) return;
    const timer = window.setTimeout(() => setPreviewPropertyIndex(0), 0);
    return () => window.clearTimeout(timer);
  }, [previewPropertyIndex, previewPropertiesCount]);
  const dedupePreviewRecords = useCallback((records, fallbackPrefix) => {
    const seen = new Set();
    return (records || []).filter((record, index) => {
      const key = String(record?.id || `${fallbackPrefix}:${record?.title || record?.address || index}`).trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, []);
  const propertiesForPreview = useMemo(
    () => dedupePreviewRecords((myPortfolio || []).filter((p) => isPropertyVisibleInPreview(p)), 'property'),
    [dedupePreviewRecords, isPropertyVisibleInPreview, myPortfolio]
  );

  useEffect(() => {
    if ((propertiesForPreview || []).length > 0) return;
    const timer = window.setTimeout(() => setPreviewMode('services'), 0);
    return () => window.clearTimeout(timer);
  }, [propertiesForPreview]);

  const myServicePortfolio = useMemo(
    () => (servicePortfolio || []).filter((service) => isOwnServiceRecord(service)),
    [servicePortfolio]
  );
  const servicesForPreview = useMemo(() => (
    dedupePreviewRecords((myServicePortfolio || []).filter((s) => isServiceVisibleInPreview(s)), 'service')
  ), [dedupePreviewRecords, isServiceVisibleInPreview, myServicePortfolio]);
  const _servicePortfolioImages = useMemo(() => servicesForPreview.flatMap((s) => {
    const base = (s.media?.images || []).filter(Boolean).map((src) => ({ src, title: s.title }));
    const archived = (showArchivedImages[s.id] ? (s.media?.archivedImages || []).filter(Boolean).map((src) => ({ src, title: s.title })) : []);
    return [...base, ...archived];
  }), [servicesForPreview, showArchivedImages]);
  void _servicePortfolioImages;

  useEffect(() => {
    if (previewServiceIndex < servicesForPreview.length) return;
    const timer = window.setTimeout(() => setPreviewServiceIndex(0), 0);
    return () => window.clearTimeout(timer);
  }, [previewServiceIndex, servicesForPreview.length]);

  useEffect(() => {
    if (previewMode === 'services' && servicesForPreview.length === 0 && propertiesForPreview.length > 0) {
      const timer = window.setTimeout(() => setPreviewMode('properties'), 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [previewMode, servicesForPreview.length, propertiesForPreview.length]);
  const previewShowcaseItems = useMemo(() => {
    const scopes = ['personal', 'professional', 'fsbo'];
    return scopes.map((scope) => {
      const properties = (propertiesForPreview || []).filter((property) => normalizePortfolioProfileScope(property?.primaryProfile) === scope);
      const services = (servicesForPreview || []).filter((service) => normalizePortfolioProfileScope(service?.primaryProfile) === scope);
      if (!properties.length && !services.length) return null;
      return {
        kind: 'profile-group',
        profileScope: scope,
        data: { id: `profile-group-${scope}` },
        properties,
        services,
      };
    }).filter(Boolean);
  }, [normalizePortfolioProfileScope, propertiesForPreview, servicesForPreview]);

  const previewShowcaseCount = previewShowcaseItems.length;
  const previewUnifiedIndex = useMemo(() => {
    if (!previewShowcaseCount) return 0;
    return Math.max(0, Math.min(previewShowcaseCount - 1, previewGroupIndex || 0));
  }, [previewGroupIndex, previewShowcaseCount]);

  const setPreviewByUnifiedIndex = useCallback((nextUnifiedIndex) => {
    const total = previewShowcaseCount;
    if (!total) return;
    const normalized = Math.max(0, Math.min(total - 1, Number(nextUnifiedIndex) || 0));
    const group = previewShowcaseItems[normalized];
    setPreviewGroupIndex(normalized);
    if ((group?.properties || []).length > 0) {
      setPreviewMode('properties');
      setPreviewPropertyIndex(0);
    } else {
      setPreviewMode('services');
      setPreviewServiceIndex(0);
    }
  }, [previewShowcaseCount, previewShowcaseItems]);

  useEffect(() => {
    if (previewGroupIndex < previewShowcaseCount) return;
    const timer = window.setTimeout(() => setPreviewGroupIndex(0), 0);
    return () => window.clearTimeout(timer);
  }, [previewGroupIndex, previewShowcaseCount]);

  const handlePreviewPrev = () => {
    if (!previewShowcaseCount) return;
    setPreviewByUnifiedIndex(previewUnifiedIndex - 1);
  };

  const handlePreviewNext = () => {
    if (!previewShowcaseCount) return;
    setPreviewByUnifiedIndex(previewUnifiedIndex + 1);
  };

  const registeredServiceSkills = useMemo(() => {
    const raw = myServicePortfolio.flatMap((svc) => [svc?.category, svc?.title]);
    return Array.from(new Set(raw.map((x) => String(x || '').trim()).filter(Boolean)));
  }, [myServicePortfolio]);
  const effectiveProfileSkills = useMemo(() => {
    const raw = [...selectedSkills, ...registeredServiceSkills];
    return Array.from(new Set(raw.map((x) => String(x || '').trim()).filter(Boolean)));
  }, [selectedSkills, registeredServiceSkills]);

  const saveProfilesFingerprint = useMemo(() => JSON.stringify({
    accountType,
    name,
    loc,
    contactMethods,
    personalPrimaryPhone,
    personalSecondaryPhone,
    personalTertiaryPhone,
    personalEmail,
    cardPriorityA,
    cardPriorityB,
    cardPriorityC,
    selectedCategories,
    primaryCategory,
    selectedMarkets,
    selectedSkills,
    selectedServices,
    goal,
    pitch,
    profileThumb,
    nameB,
    locB,
    selectedCategoriesB,
    primaryCategoryB,
    selectedMarketsB,
    selectedSkillsB,
    selectedServicesB,
    goalB,
    pitchB,
    profileThumbB,
    contactMethodsB,
    personalPrimaryPhoneB,
    personalSecondaryPhoneB,
    personalTertiaryPhoneB,
    personalEmailB,
    portfolioAddress,
    portfolioCity,
    portfolioZip,
    portfolioType,
    portfolioPrice,
    portfolioBeds,
    portfolioBaths,
    portfolioSqft,
    portfolioLot,
    portfolioRehab,
    portfolioCapRate,
    portfolioObjective,
    portfolioMarkets,
    primaryProfileScope,
    portfolioDescription,
    portfolioImages,
    serviceTitle,
    serviceCategory,
    serviceDescription,
    servicePrice,
    serviceMarkets,
    serviceImages,
    servicePrimaryProfileScope,
    investmentProfileDraft,
    investmentTriggerCategories,
  }), [
    accountType,
    name,
    loc,
    contactMethods,
    personalPrimaryPhone,
    personalSecondaryPhone,
    personalTertiaryPhone,
    personalEmail,
    cardPriorityA,
    cardPriorityB,
    cardPriorityC,
    selectedCategories,
    primaryCategory,
    selectedMarkets,
    selectedSkills,
    selectedServices,
    goal,
    pitch,
    profileThumb,
    nameB,
    locB,
    selectedCategoriesB,
    primaryCategoryB,
    selectedMarketsB,
    selectedSkillsB,
    selectedServicesB,
    goalB,
    pitchB,
    profileThumbB,
    contactMethodsB,
    personalPrimaryPhoneB,
    personalSecondaryPhoneB,
    personalTertiaryPhoneB,
    personalEmailB,
    portfolioAddress,
    portfolioCity,
    portfolioZip,
    portfolioType,
    portfolioPrice,
    portfolioBeds,
    portfolioBaths,
    portfolioSqft,
    portfolioLot,
    portfolioRehab,
    portfolioCapRate,
    portfolioObjective,
    portfolioMarkets,
    primaryProfileScope,
    portfolioDescription,
    portfolioImages,
    serviceTitle,
    serviceCategory,
    serviceDescription,
    servicePrice,
    serviceMarkets,
    serviceImages,
    servicePrimaryProfileScope,
    investmentProfileDraft,
    investmentTriggerCategories,
  ]);

  useEffect(() => {
    if (pendingProfileClearScope) {
      const timer = window.setTimeout(() => setIsSaveProfilesDirty(true), 0);
      return () => window.clearTimeout(timer);
    }
    if (!saveProfilesBaseline) {
      const timer = window.setTimeout(() => {
        setSaveProfilesBaseline(saveProfilesFingerprint);
        setIsSaveProfilesDirty(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => setIsSaveProfilesDirty(saveProfilesFingerprint !== saveProfilesBaseline), 0);
    return () => window.clearTimeout(timer);
  }, [saveProfilesFingerprint, saveProfilesBaseline, pendingProfileClearScope]);
  const effectiveProfileServices = useMemo(() => {
    const raw = [...selectedServices, ...registeredServiceSkills];
    return Array.from(new Set(raw.map((x) => String(x || '').trim()).filter(Boolean)));
  }, [selectedServices, registeredServiceSkills]);
  const stateNameByCode = useMemo(() => US_STATES.reduce((acc, s) => ({ ...acc, [s.code]: s.name }), {}), []);

  const toggleMulti = (setArr, value) => {
    setArr((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]));
  };

  const toggleArrayValue = (arr, value) => (arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value]);
  const toggleInvestmentField = (field, value) => {
    setInvestmentProfileDraft((prev) => ({
      ...prev,
      [field]: toggleArrayValue(prev?.[field] || [], value),
    }));
  };
  const setInvestmentField = (field, value) => {
    setInvestmentProfileDraft((prev) => ({ ...prev, [field]: value }));
  };
  const addInvestmentMarket = () => {
    const nextValue = String(investmentMarketInput || '').trim();
    if (!nextValue) return;
    setInvestmentProfileDraft((prev) => ({
      ...prev,
      targetMarkets: Array.from(new Set([...(prev?.targetMarkets || []), nextValue])),
    }));
    setInvestmentMarketInput('');
  };
  const removeInvestmentMarket = (market) => {
    setInvestmentProfileDraft((prev) => ({
      ...prev,
      targetMarkets: (prev?.targetMarkets || []).filter((item) => item !== market),
    }));
  };
  const saveInvestmentProfileDraft = (opts = {}) => {
    const nextProfile = getPersistedInvestmentProfile(opts);
    setInvestmentProfileDraft(nextProfile);
    setProfessionalProfile((prev) => ({ ...(prev || {}), investmentProfile: nextProfile }));
    return nextProfile;
  };

  const renderMarketsSelector = (selected, onToggle, opts = {}) => (
    <MarketsSelector
      selected={selected}
      onToggle={onToggle}
      stateOptions={US_STATES}
      label={opts?.inlineLabel || t.labelStateShort || 'State'}
      showSummary={opts?.showSummary !== false}
      selectPlaceholder={t.optionSelectPlaceholder || 'Select'}
      selectedSummaryLabel={t.selectedStatesLabel || 'Selected'}
      emptySummaryLabel={t.noStatesSelected || 'No states selected'}
      ariaLabel={t.operatingStatesAriaLabel || 'Operating states'}
      labelStyle={portfolioFieldLabelStyle}
      selectStyle={portfolioFieldSelectStyle({ minHeight: 32, paddingLeft: 72 })}
    />
  );

  const togglePropertyDealClosed = (propertyId) => {
    setPropertyPortfolio((prev) => prev.map((prop) => {
      if (prop.id !== propertyId) return prop;
      // If already closed, toggle back open (reactivate)
      if (prop.dealClosed) {
        return clearPendingDeal({ ...prop, dealClosed: false });
      }
      return clearPendingDeal({
        ...prop,
        dealClosed: true,
        publishToShowcase: false,
        includeInPreview: false,
      });
    }));
  };

  const togglePropertyPendingDeal = (propertyId) => {
    setPropertyPortfolio((prev) => prev.map((prop) => {
      if (prop.id !== propertyId || prop.dealClosed) return prop;
      if (isPendingDealActive(prop)) return clearPendingDeal(prop);
      return markPendingDeal(prop);
    }));
  };

  const renderPropertyPendingDealButton = (property) => {
    if (!property || property.dealClosed) return null;
    const isActive = isPendingDealActive(property);
    const isExpired = isPendingDealExpired(property);
    const daysLeft = getPendingDealRemainingDays(property);
    const title = isActive
      ? `Pending deal active - ${daysLeft}d left. Click to remove.`
      : isExpired
        ? 'Pending deal expired - click to reactivate for 7 days.'
        : 'Mark as pending deal for 7 days.';
    return (
      <button
        type="button"
        onClick={() => togglePropertyPendingDeal(property.id)}
        title={title}
        aria-label={title}
        style={{
          background: isActive ? 'rgba(107,114,128,0.16)' : isExpired ? 'rgba(245,158,11,0.10)' : 'none',
          border: isActive ? '1px solid rgba(156,163,175,0.55)' : isExpired ? '1px solid rgba(245,158,11,0.42)' : '1px solid transparent',
          borderRadius: 6,
          cursor: 'pointer',
          padding: '0 5px',
          lineHeight: 1,
          flexShrink: 0,
          color: isActive ? '#6b7280' : isExpired ? '#d97706' : C.t3,
        }}
      >
        <Icon name="hourglass" size={14} color={isActive ? '#6b7280' : isExpired ? '#d97706' : C.t3} strokeWidth={2.2} />
      </button>
    );
  };

  const toggleServiceDealClosed = (serviceId) => {
    setServicePortfolio((prev) => prev.map((svc) => {
      if (svc.id !== serviceId) return svc;
      if (svc.dealClosed) return { ...svc, dealClosed: false };
      return {
        ...svc,
        dealClosed: true,
        publishToConnections: false,
        includeInPreview: false,
      };
    }));
  };

  const toggleCategoryB = (catId) => {
    setSelectedCategoriesB((prev) => {
      const has = prev.includes(catId);
      if (!has) {
        const next = [...prev, catId];
        if (!String(primaryCategoryB || '').trim() || !next.includes(primaryCategoryB)) {
          setPrimaryCategoryB(catId);
        }
        return next;
      }
      const next = prev.filter((x) => x !== catId);
      if (!next.length) {
        setPrimaryCategoryB('');
        return next;
      }
      if (primaryCategoryB === catId || !next.includes(primaryCategoryB)) setPrimaryCategoryB(next[0]);
      return next;
    });
  };

  const formatCurrencyInput = (value) => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
    if (!digits) return '';
    return Number(digits).toLocaleString('en-US');
  };

  const formatRateInput = (value) => {
    const normalized = String(value || '').replace(/,/g, '.').replace(/[^\d.]/g, '');
    const [whole = '', ...rest] = normalized.split('.');
    const decimal = rest.join('').slice(0, 2);
    const clippedWhole = whole.slice(0, 2);
    if (!clippedWhole && !decimal) return '';
    return decimal ? `${clippedWhole}.${decimal}` : clippedWhole;
  };

  const parseCurrencyInput = (value) => {
    const normalized = String(value || '').replace(/,/g, '');
    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : 0;
  };

  const normalizePrimaryProfileScope = (scope) => {
    return normalizePortfolioProfileScope(scope);
  };

  const getPrimaryProfileId = (scope) => {
    const normalized = normalizePrimaryProfileScope(scope);
    if (normalized === 'professional') return 'B';
    if (normalized === 'fsbo') return 'C';
    return 'A';
  };

  const toPreviewScope = (scope) => normalizePrimaryProfileScope(scope);

  // Resolve which profile scope currently has "primary" card priority
  const getPrimaryProfileScope = useCallback(() => {
    if (String(cardPriorityA).toLowerCase() === 'primary') return 'personal';
    if (String(cardPriorityB).toLowerCase() === 'primary') return 'professional';
    if (String(cardPriorityC).toLowerCase() === 'primary') return 'fsbo';
    return '';
  }, [cardPriorityA, cardPriorityB, cardPriorityC]);

  const _getGeneratedAddressLabel = (type) => `${type || 'Property'} listing`;
  void _getGeneratedAddressLabel;

  const _renderServiceImages = (svc) => {
    try {
      const baseImgs = (svc?.media?.images || []).filter(Boolean);
      const archivedImgs = (showArchivedImages[svc?.id] ? (svc?.media?.archivedImages || []).filter(Boolean) : []);
      const imgs = [...baseImgs, ...archivedImgs];
      if (!imgs || imgs.length === 0) return <div style={{ color: C.t3, fontSize: 12, padding: 24, textAlign: 'center' }}>{t.uploadedImagesEmpty}</div>;

      const onDragStart = (e, idx) => { setPreviewDragIndex(idx); e.dataTransfer.effectAllowed = 'move'; };
      const onDragEnd = () => { setPreviewDragIndex(null); setPreviewDragOverIndex(null); };
      const onDragOver = (e, idx) => { e.preventDefault(); setPreviewDragOverIndex(idx); };
      const onDrop = (e, toIdx) => {
        e.preventDefault();
        const fromIdx = previewDragIndex;
        if (fromIdx == null || fromIdx === toIdx) { setPreviewDragIndex(null); setPreviewDragOverIndex(null); return; }
        const next = [...(svc.media?.images || [])];
        const item = next.splice(fromIdx, 1)[0];
        next.splice(toIdx, 0, item);
        setServicePortfolio(prev => prev.map(s => s.id === svc.id ? { ...s, media: { ...(s.media || {}), images: next } } : s));
        setPreviewDragIndex(null);
        setPreviewDragOverIndex(null);
      };
      const removeImage = (src) => {
        setServicePortfolio((prev) => prev.map((s) => {
          if (s.id !== svc.id) return s;
          const images = [...(s.media?.images || [])];
          const archived = [...(s.media?.archivedImages || [])];
          const imageIdx = images.indexOf(src);
          if (imageIdx >= 0) {
            images.splice(imageIdx, 1);
            return { ...s, media: { ...(s.media || {}), images } };
          }
          const archivedIdx = archived.indexOf(src);
          if (archivedIdx >= 0) {
            archived.splice(archivedIdx, 1);
            return { ...s, media: { ...(s.media || {}), archivedImages: archived } };
          }
          return s;
        }));
      };

      if (imgs.length === 1) {
        return (
          <div style={{ position: 'relative', aspectRatio: isMobileViewport ? '4/3' : '16/10', borderRadius: 8, overflow: 'hidden', background: C.alpha(C.t1, 0.06), minHeight: isMobileViewport ? 220 : 250, cursor: 'grab' }}>
            <SmartImage src={imgs[0]} alt={svc?.title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <button
              type="button"
              onClick={() => removeImage(imgs[0])}
              title={t.actionRemove}
              aria-label={t.actionRemove}
              style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 999, border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <Icon name="trash" size={13} color="#fff" />
            </button>
          </div>
        );
      }

      return (
        <div style={{ display: 'grid', gridTemplateColumns: imgs.length === 2 ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
          {imgs.map((src, idx) => (
            <div
              key={`${svc.id}-img-${idx}`}
              draggable
              onDragStart={(e) => onDragStart(e, idx)}
              onDragEnd={onDragEnd}
              onDragOver={(e) => onDragOver(e, idx)}
              onDrop={(e) => onDrop(e, idx)}
              style={{ position: 'relative', aspectRatio: '16/10', minHeight: 140, borderRadius: 8, overflow: 'hidden', background: (previewDragOverIndex === idx ? C.alpha(C.accent, 0.06) : C.alpha(C.t1, 0.06)), border: previewDragIndex === idx ? `2px dashed ${C.accent}` : `1px solid ${C.border}`, cursor: previewDragIndex === idx ? 'grabbing' : 'grab' }}
            >
              <SmartImage src={src} alt={svc?.title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeImage(src); }}
                title={t.actionRemove}
                aria-label={t.actionRemove}
                style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 999, border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <Icon name="trash" size={13} color="#fff" />
              </button>
            </div>
          ))}
        </div>
      );
    } catch (e) { if (import.meta.env.DEV) console.warn('renderServiceImages error', e); return null; }
  };

    const _renderPreviewPropertyImages = (prop) => {
      try {
        const imgs = (prop?.images || []).filter(Boolean);
        if (!imgs || imgs.length === 0) return <div style={{ color: C.t3, fontSize: 12, padding: 24, textAlign: 'center' }}>{t.recordsNoProperty}</div>;

          // Single image: render normally
          if (imgs.length === 1) {
            return (
              <div style={{ aspectRatio: '16/9', borderRadius: 8, overflow: 'hidden', background: C.alpha(C.t1, 0.06) }}>
                <SmartImage src={imgs[0]} alt={prop?.address || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            );
          }

          // Multiple images: show as carousel with prev/next
          const idx = Number(propertyImageIndex[prop.id] || 0);
          const prev = () => setPropertyImageIndex(prevMap => ({ ...prevMap, [prop.id]: (idx - 1 + imgs.length) % imgs.length }));
          const next = () => setPropertyImageIndex(prevMap => ({ ...prevMap, [prop.id]: (idx + 1) % imgs.length }));

          return (
            <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: C.alpha(C.t1, 0.02) }}>
              <div style={{ aspectRatio: '16/9', width: '100%', height: '100%', overflow: 'hidden' }}>
                <SmartImage src={imgs[idx]} alt={`${prop?.address || ''} - ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              <button onClick={prev} aria-label="Previous image" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: C.alpha(C.bg, 0.6), border: 'none', borderRadius: 999, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Icon name="chevLeft" size={16} color={C.t1} />
              </button>
              <button onClick={next} aria-label="Next image" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: C.alpha(C.bg, 0.6), border: 'none', borderRadius: 999, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Icon name="chevDown" size={16} style={{ transform: 'rotate(-90deg)' }} color={C.t1} />
              </button>
              <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 8, display: 'flex', gap: 6 }}>
                {imgs.map((_, i) => (
                  <div key={`dot-${prop.id}-${i}`} onClick={() => setPropertyImageIndex(prevMap => ({ ...prevMap, [prop.id]: i }))} style={{ width: 8, height: 8, borderRadius: 999, background: i === idx ? C.accent : C.alpha(C.t1, 0.18), cursor: 'pointer' }} />
                ))}
              </div>
            </div>
          );
      } catch (e) { if (import.meta.env.DEV) console.warn('renderPreviewPropertyImages error', e); return null; }
    };
  void _renderServiceImages;
  void _renderPreviewPropertyImages;

  const renderPreviewContent = () => {
    const hasPreviewProperty = propertiesForPreview.length > 0;
    const hasPreviewService = servicesForPreview.length > 0;
    const hasPreviewItems = hasPreviewProperty || hasPreviewService;
    const activePreviewGroup = previewShowcaseItems[previewUnifiedIndex] || previewShowcaseItems[0] || null;
    const activePreviewProfileScope = (() => {
      if (activePreviewGroup?.profileScope) return activePreviewGroup.profileScope;
      if (previewMode === 'properties') {
        const activeProperty = previewShowcaseCard || propertiesForPreview[previewPropertyIndex] || propertiesForPreview[0];
        return normalizePrimaryProfileScope(activeProperty?.primaryProfile);
      }
      const activeService = servicesForPreview[previewServiceIndex] || servicesForPreview[0];
      return normalizePrimaryProfileScope(activeService?.primaryProfile);
    })();
    const activePreviewFeedCard = activePreviewProfileScope === 'professional'
      ? previewProfessionalFeedCard
      : (activePreviewProfileScope === 'fsbo' ? previewFsboFeedCard : previewPersonalFeedCard);
    const personalPreviewTitle = accountType === 'fsbo_owner'
      ? (t.previewBasicCardTitle || t.previewPersonalCardTitle)
      : t.previewPersonalCardTitle;
    const previewCardWidth = isMobileViewport ? 340 : 654;
    const previewCardHeight = isMobileViewport ? 576 : 400;
    const previewDeckHeight = previewCardHeight + 24;

    return (
      <div style={{ display: 'grid', gridTemplateColumns: isMobileViewport ? '1fr' : `minmax(${previewCardWidth}px, 1fr) minmax(${previewCardWidth}px, 1fr)`, gap: isMobileViewport ? 14 : 18, alignItems: 'stretch' }}>
        {/* â”€â”€ Left: Feed / Connection Card â”€â”€ */}
        <section style={{ border: `1px solid ${C.border}`, borderRadius: 14, background: C.card, overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto 1fr auto' }}>
          <div style={{ minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.t3, textTransform: 'uppercase', fontWeight: 700 }}>
            <span>{personalPreviewTitle}</span>
            {previewShowcaseCount > 1 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  aria-label="Previous profile"
                  disabled={previewUnifiedIndex <= 0}
                  onClick={handlePreviewPrev}
                  style={{ border: 'none', background: 'transparent', cursor: previewUnifiedIndex <= 0 ? 'not-allowed' : 'pointer', padding: 4, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icon name="chevronLeft" size={22} color={previewUnifiedIndex <= 0 ? C.t3 : C.t1} />
                </button>
                <span style={{ fontSize: 11, color: C.t2, minWidth: 48, textAlign: 'center', display: 'inline-block' }}>
                  {previewUnifiedIndex + 1} / {previewShowcaseCount}
                </span>
                <button
                  type="button"
                  aria-label="Next profile"
                  disabled={previewUnifiedIndex >= previewShowcaseCount - 1}
                  onClick={handlePreviewNext}
                  style={{ border: 'none', background: 'transparent', cursor: previewUnifiedIndex >= previewShowcaseCount - 1 ? 'not-allowed' : 'pointer', padding: 4, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icon name="chevronRight" size={22} color={previewUnifiedIndex >= previewShowcaseCount - 1 ? C.t3 : C.t1} />
                </button>
              </div>
            ) : null}
          </div>
          <div style={{
            padding: 12,
            minHeight: previewDeckHeight,
            height: isMobileViewport ? 'auto' : previewDeckHeight,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxSizing: 'border-box',
          }}>
            <div style={{ width: `min(${previewCardWidth}px, 100%)`, height: isMobileViewport ? 'auto' : previewCardHeight, minHeight: isMobileViewport ? previewCardHeight : undefined, margin: '0 auto', boxSizing: 'border-box' }}>
              <SwipeCard
                card={activePreviewFeedCard}
                action={null}
                isUnlocked
                isSkipped={false}
                previewOnly
                showActions={false}
                onSwipe={() => {}}
                onUndo={() => {}}
              />
            </div>
          </div>
          {previewShowcaseCount > 1 ? (
            <div style={{ padding: '0 12px 12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
              {previewShowcaseItems.map((entry, dotIdx) => {
                const isActive = dotIdx === previewUnifiedIndex;
                return (
                  <button
                    key={`preview-profile-dot-${entry.profileScope || dotIdx}`}
                    type="button"
                    onClick={() => setPreviewByUnifiedIndex(dotIdx)}
                    aria-label={`Profile card ${dotIdx + 1}`}
                    style={{ width: isActive ? 16 : 8, height: 8, borderRadius: 999, border: 'none', background: isActive ? C.accent : C.alpha(C.t1, 0.2), cursor: 'pointer', transition: 'all .15s ease' }}
                  />
                );
              })}
            </div>
          ) : null}
        </section>

        {/* â”€â”€ Right: Showcase / Portfolio Cards â”€â”€ */}

        <section style={{ border: `1px solid ${C.border}`, borderRadius: 14, background: C.card, overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
          <div style={{ minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.t3, textTransform: 'uppercase', fontWeight: 700 }}>
            <span>{t.previewShowcaseCardTitle}</span>
          </div>
          {hasPreviewItems ? (
            <div
              className="onb-preview-showcase-scroll"
              style={{
                overflowY: 'auto',
                overflowX: 'hidden',
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-y',
                minHeight: previewDeckHeight,
                maxHeight: isMobileViewport ? 'min(72vh, 680px)' : previewDeckHeight,
                padding: 12,
                boxSizing: 'border-box',
              }}
            >
              {(() => {
                const item = activePreviewGroup;
                const groupScope = item?.profileScope;
                const groupProfileCard = activePreviewFeedCard;
                const groupItems = [
                  ...(item?.properties || []).map((property) => ({ kind: 'property', data: property })),
                  ...(item?.services || []).map((service) => ({ kind: 'service', data: service })),
                ];
                if (!item || groupItems.length === 0) {
                  return (
                    <div style={{ height: isMobileViewport ? 260 : previewDeckHeight - 24, border: `1px dashed ${C.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.t3, fontSize: 12 }}>
                      {t.recordsNoProperty}
                    </div>
                  );
                }
                return (
                  <div key={`preview-linked-items-${groupScope || previewUnifiedIndex}`} style={{ width: `min(${previewCardWidth}px, 100%)`, margin: '0 auto', display: 'grid', gap: 12, boxSizing: 'border-box' }}>
                    {groupItems.map((entry, entryIdx) => {
                      if (entry.kind === 'property') {
                        return (
                          <div key={`preview-group-property-${entry.data?.id || entryIdx}`} style={{ height: isMobileViewport ? 'auto' : previewCardHeight, minHeight: isMobileViewport ? previewCardHeight : undefined }}>
                            <PropertyCard
                              property={entry.data}
                              action={null}
                              statusAction={null}
                              previewOnly
                              onInterest={(act) => {
                                try { if (act === 'next' || act === 'pass') handlePreviewNext(); } catch (e) { void e; }
                              }}
                              owner={groupProfileCard}
                            />
                          </div>
                        );
                      }
                      const svc = entry.data;
                      const svcImages = (svc?.media?.images || []).filter(Boolean);
                      return (
                        <div key={`preview-group-service-${svc?.id || entryIdx}`} style={{ padding: 12, border: `1px solid ${C.border}`, borderRadius: 16, boxSizing: 'border-box' }}>
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{svc?.title || t.serviceFallbackName}</div>
                            {svc?.description && <div style={{ fontSize: 12, color: C.t2, marginTop: 2 }}>{svc.description}</div>}
                            {svc?.category && <div style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 12, background: C.alpha(C.accent, 0.08), border: `1px solid ${C.alpha(C.accent, 0.15)}`, fontSize: 10, color: C.accent, fontWeight: 700 }}>{svc.category}</div>}
                          </div>
                          {svcImages.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: svcImages.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                              {svcImages.map((src, imageIdx) => (
                                <div key={`svc-prev-img-${previewUnifiedIndex}-${entryIdx}-${imageIdx}`} style={{ position: 'relative', aspectRatio: svcImages.length === 1 ? '16/9' : '1', borderRadius: 8, overflow: 'hidden', background: C.alpha(C.t1, 0.06), border: `1px solid ${C.border}` }}>
                                  <SmartImage src={src} alt={svc?.title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ height: 160, border: `1px dashed ${C.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.t3, fontSize: 12 }}>
                              {t.uploadedImagesEmpty}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div style={{ margin: 12, height: isMobileViewport ? 260 : previewDeckHeight, border: `1px dashed ${C.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.t3, fontSize: 12 }}>
              {t.recordsNoProperty}
            </div>
          )}
        </section>
      </div>
    );
  };

  const toggleCategory = (catId) => {
    setSelectedCategories((prev) => {
      const has = prev.includes(catId);
      if (!has) {
        const next = [...prev, catId];
        if (!String(primaryCategory || '').trim() || !next.includes(primaryCategory)) {
          setPrimaryCategory(catId);
        }
        return next;
      }
      const next = prev.filter((x) => x !== catId);
      if (!next.length) {
        setPrimaryCategory('');
        return next;
      }
      if (primaryCategory === catId || !next.includes(primaryCategory)) setPrimaryCategory(next[0]);
      return next;
    });
  };

  useEffect(() => {
    let timer = null;
    if (selectedCategories.length === 0) {
      if (primaryCategory) timer = window.setTimeout(() => setPrimaryCategory(''), 0);
    } else if (!selectedCategories.includes(primaryCategory)) {
      timer = window.setTimeout(() => setPrimaryCategory(selectedCategories[0]), 0);
    }
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [selectedCategories, primaryCategory]);

  useEffect(() => {
    let timer = null;
    if (selectedCategoriesB.length === 0) {
      if (primaryCategoryB) timer = window.setTimeout(() => setPrimaryCategoryB(''), 0);
    } else if (!selectedCategoriesB.includes(primaryCategoryB)) {
      timer = window.setTimeout(() => setPrimaryCategoryB(selectedCategoriesB[0]), 0);
    }
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [selectedCategoriesB, primaryCategoryB]);

  const handleProfileThumb = (e) => {
    const file = e.target.files?.[0];
    if (!file) { if (e?.target) e.target.value = ''; return; }
    readAndCompressFiles([file], 512, 0.85).then(([url]) => {
      if (url) {
        setProfileThumbClearRequested(false);
        setProfileThumb(url);
      }
    });
    if (e?.target) e.target.value = '';
  };

  const handleProfileThumbB = (e) => {
    const file = e.target.files?.[0];
    if (!file) { if (e?.target) e.target.value = ''; return; }
    readAndCompressFiles([file], 512, 0.85).then(([url]) => {
      if (url) {
        setProfileThumbBClearRequested(false);
        setProfileThumbB(url);
      }
    });
    if (e?.target) e.target.value = '';
  };

  const removeProfileThumb = () => {
    setProfileThumb('');
    setProfileThumbClearRequested(true);
  };
  const removeProfileThumbB = () => {
    setProfileThumbB('');
    setProfileThumbBClearRequested(true);
  };

  const clearProfileAFields = () => {
    const profileKey = accountType === 'fsbo_owner' ? 'C' : 'A';
    setName('');
    setLoc('');
    setProfileThumb('');
    setProfileThumbClearRequested(true);
    setPersonalPrimaryPhone('');
    setPersonalSecondaryPhone('');
    setPersonalTertiaryPhone('');
    setPersonalEmail('');
    setContactMethods([]);
    setSelectedCategories([]);
    setPrimaryCategory('');
    setSelectedMarkets([]);
    setSelectedSkills([]);
    setSelectedServices([]);
    setPitch('');
    if (profileKey === 'C') setCardPriorityC('');
    else setCardPriorityA('');
    setIsSaveProfilesDirty(true);
    setSaveProfilesBaseline('');
    setPendingProfileClearScope(profileKey);
  };

  const clearProfileBFields = () => {
    setNameB('');
    setLocB('');
    setProfileThumbB('');
    setProfileThumbBClearRequested(true);
    setPersonalPrimaryPhoneB('');
    setPersonalSecondaryPhoneB('');
    setPersonalTertiaryPhoneB('');
    setPersonalEmailB('');
    setContactMethodsB([]);
    setSelectedCategoriesB([]);
    setPrimaryCategoryB('');
    setSelectedMarketsB([]);
    setSelectedSkillsB([]);
    setSelectedServicesB([]);
    _setPitchB('');
    setCardPriorityB('');
    setIsSaveProfilesDirty(true);
    setSaveProfilesBaseline('');
    setPendingProfileClearScope('B');
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!shouldUseTempStorage || !activeTempStorageKey) {
        try { localStorage.removeItem('tempUploads_fsbo'); } catch (e) { void e; }
        setPortfolioImages([]);
        setServiceImages([]);
      } else {
        try {
          const saved = JSON.parse(localStorage.getItem(activeTempStorageKey) || '{}');
          setPortfolioImages(Array.isArray(saved.portfolioImages) ? saved.portfolioImages : []);
          setServiceImages(Array.isArray(saved.serviceImages) ? saved.serviceImages : []);
          if (Object.prototype.hasOwnProperty.call(saved, 'profileThumb')) {
            setProfileThumb(saved.profileThumb || '');
          }
          if (Object.prototype.hasOwnProperty.call(saved, 'profileThumbB')) {
            setProfileThumbB(saved.profileThumbB || '');
          }
        } catch (e) {
          void e;
          setPortfolioImages([]);
          setServiceImages([]);
        }
      }

      // Keep forms isolated between professional and FSBO branches.
      setPortfolioAddress('');
      setPortfolioCity('');
      setPortfolioZip('');
      setPortfolioPrice('');
      setPortfolioType('SFR');
      setPortfolioBeds('');
      setPortfolioBaths('');
      setPortfolioSqft('');
      setPortfolioLot('');
      setPortfolioRehab('');
      setPortfolioCapRate('');
      setPortfolioDescription('');
      setPortfolioVideo('');
      clearPortfolioVideoBlob(`portfolioVideo_${accountType}`).catch(() => {});
      setPortfolioMsg('');
      setPortfolioMarkets([]);
      setPreviewOpen(false);

      if (accountType === 'fsbo_owner') {
        setPortfolioObjective('Sell');
        setPrimaryProfileScope('fsbo');
      } else {
        setPortfolioObjective('Sell');
        setPrimaryProfileScope(getPrimaryProfileScope());
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [accountType, activeTempStorageKey, shouldUseTempStorage, getPrimaryProfileScope]);

  useEffect(() => {
    if (pendingProfileClearScope) return undefined;
    const timer = window.setTimeout(() => {
      if (accountType === 'fsbo_owner') {
        setName(personalProfile?.fullName || '');
        setLoc(normalizeUsStateCode(personalProfile?.loc));
        setContactMethods(personalProfile?.contactMethods || []);
        setPersonalPrimaryPhone(personalProfile?.primaryPhone || personalProfile?.phone || '');
        setPersonalSecondaryPhone(personalProfile?.secondaryPhone || '');
        setPersonalTertiaryPhone(personalProfile?.tertiaryPhone || '');
        setPersonalEmail(personalProfile?.email || '');
        const priorityBExplicit = professionalProfile?.cardPriorityBExplicit === true;
        const priorityCExplicit = personalProfile?.cardPriorityCExplicit === true || professionalProfile?.cardPriorityCExplicit === true;
        applyCardPrioritySet({
          A: '',
          B: priorityBExplicit ? readStoredPriority(professionalProfile, 'cardPriorityB') : '',
          C: priorityCExplicit
            ? (readStoredPriority(personalProfile, 'cardPriorityC') || readStoredPriority(professionalProfile, 'cardPriorityC'))
            : '',
        }, 'C');
        setProfileThumb(personalProfile?.photo || '');
        setProfileThumbB(professionalProfile?.photoB || '');
        setSelectedCategories([]);
        setPrimaryCategory('');
        setSelectedMarkets([]);
        setSelectedSkills([]);
        setSelectedServices([]);
        setGoal('');
        setPitch('');
        setSelectedCategoriesB([]);
        setPrimaryCategoryB('');
        setSelectedMarketsB([]);
        setSelectedSkillsB([]);
        setSelectedServicesB([]);
        setGoalB('');
        setSaveProfilesBaseline('');
        return;
      }

      setName(professionalProfile?.fullNameA || '');
      setLoc(normalizeUsStateCode(professionalProfile?.locA));
      setContactMethods(professionalProfile?.contactMethodsA || []);
      setPersonalPrimaryPhone(professionalProfile?.primaryPhoneA || professionalProfile?.phoneA || '');
      setPersonalSecondaryPhone(professionalProfile?.secondaryPhoneA || '');
      setPersonalTertiaryPhone(professionalProfile?.tertiaryPhoneA || '');
      setPersonalEmail(professionalProfile?.emailA || '');
      const priorityAExplicit = professionalProfile?.cardPriorityAExplicit === true;
      const priorityBExplicit = professionalProfile?.cardPriorityBExplicit === true;
      const priorityCExplicit = professionalProfile?.cardPriorityCExplicit === true;
      applyCardPrioritySet({
        A: priorityAExplicit ? readStoredPriority(professionalProfile, 'cardPriorityA') : '',
        B: priorityBExplicit ? readStoredPriority(professionalProfile, 'cardPriorityB') : '',
        C: priorityCExplicit ? readStoredPriority(professionalProfile, 'cardPriorityC') : '',
      }, 'A');
      const nextCategoriesA = Array.isArray(professionalProfile?.categories) ? professionalProfile.categories : [];
      setSelectedCategories(nextCategoriesA);
      setPrimaryCategory(professionalProfile?.primaryCategory || '');
      setSelectedMarkets(normalizeMarkets(professionalProfile?.markets));
      setSelectedSkills(Array.isArray(professionalProfile?.skills) ? professionalProfile.skills : []);
      setSelectedServices(Array.isArray(professionalProfile?.services) ? professionalProfile.services : []);
      setGoal(professionalProfile?.goal || '');
      setPitch(professionalProfile?.pitch || '');
      setNameB(professionalProfile?.fullNameB || '');
      setLocB(normalizeUsStateCode(professionalProfile?.locB));
      setContactMethodsB(professionalProfile?.contactMethodsB || []);
      setPersonalPrimaryPhoneB(professionalProfile?.primaryPhoneB || '');
      setPersonalSecondaryPhoneB(professionalProfile?.secondaryPhoneB || '');
      setPersonalTertiaryPhoneB(professionalProfile?.tertiaryPhoneB || '');
      setPersonalEmailB(professionalProfile?.emailB || '');
      const nextCategoriesB = Array.isArray(professionalProfile?.categoriesB) ? professionalProfile.categoriesB : [];
      setSelectedCategoriesB(nextCategoriesB);
      setPrimaryCategoryB(professionalProfile?.primaryCategoryB || '');
      setSelectedMarketsB(normalizeMarkets(professionalProfile?.marketsB));
      setSelectedSkillsB(Array.isArray(professionalProfile?.skillsB) ? professionalProfile.skillsB : []);
      setSelectedServicesB(Array.isArray(professionalProfile?.servicesB) ? professionalProfile.servicesB : []);
      setGoalB(professionalProfile?.goalB || '');
      setProfileThumb(professionalProfile?.photoA || '');
      setProfileThumbB(professionalProfile?.photoB || '');
      setSaveProfilesBaseline('');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [accountType, personalProfile, professionalProfile, pendingProfileClearScope]);

  // persist temporary uploads so the user doesn't need to re-upload on dev reload
  useEffect(() => {
    if (!shouldUseTempStorage || !activeTempStorageKey) return;
    try {
      const cur = JSON.parse(localStorage.getItem(activeTempStorageKey) || '{}');
      cur.portfolioImages = portfolioImages || [];
      localStorage.setItem(activeTempStorageKey, JSON.stringify(cur));
    } catch (e) { void e; }
  }, [portfolioImages, activeTempStorageKey, shouldUseTempStorage]);

  useEffect(() => {
    if (!shouldUseTempStorage || !activeTempStorageKey) return;
    try {
      const cur = JSON.parse(localStorage.getItem(activeTempStorageKey) || '{}');
      cur.serviceImages = serviceImages || [];
      localStorage.setItem(activeTempStorageKey, JSON.stringify(cur));
    } catch (e) { void e; }
  }, [serviceImages, activeTempStorageKey, shouldUseTempStorage]);

  useEffect(() => {
    if (!shouldUseTempStorage || !activeTempStorageKey) return;
    try {
      const cur = JSON.parse(localStorage.getItem(activeTempStorageKey) || '{}');
      cur.profileThumb = profileThumb || '';
      cur.profileThumbB = profileThumbB || '';
      localStorage.setItem(activeTempStorageKey, JSON.stringify(cur));
    } catch (e) { void e; }
  }, [profileThumb, profileThumbB, activeTempStorageKey, shouldUseTempStorage]);

  // Restore video blob from IndexedDB on mount/accountType change
  useEffect(() => {
    let cancelled = false;
    let blobUrl = '';
    getPortfolioVideoBlob(`portfolioVideo_${accountType}`).then((blob) => {
      if (cancelled || !blob) return;
      blobUrl = URL.createObjectURL(blob);
      setPortfolioVideo(blobUrl);
    }).catch(() => {});
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [accountType]);

  const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

  const handlePortfolioImages = (e) => {
    const files = Array.from(e.target.files || []).filter((f) => f.size <= MAX_FILE_SIZE_BYTES);
    if (!files.length) { if (e?.target) e.target.value = ''; return; }
    readAndCompressFiles(files).then((urls) => {
      if (urls.length) setPortfolioImages((prev) => [...prev, ...urls].slice(0, 10));
      if (e?.target) e.target.value = '';
    });
  };

  const handleEditImages = (e, id) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) { if (e?.target) e.target.value = ''; return; }
    readAndCompressFiles(files).then((urls) => {
      if (urls.length) {
        setPropertyPortfolio((prev) =>
          prev.map((x) => {
            if (x.id !== id) return x;
            const existing = Array.isArray(x.images) ? x.images : [];
            return { ...x, images: [...existing, ...urls].slice(0, 10) };
          })
        );
      }
      setEditingImagesId(null);
      if (e?.target) e.target.value = '';
    });
  };

  // Drag & drop helpers for portfolio ordering and image ordering
  const movePortfolioTo = (fromIdx, toIdx) => {
    setPropertyPortfolio((prev) => {
      const scoped = prev.filter((x) => (
        String(x.ownerId || '') === String(getPublishOwnerId() || '')
      ));
      const fromItem = scoped[fromIdx];
      const toItem = scoped[toIdx];
      if (!fromItem || !toItem) return prev;

      const next = [...prev];
      const fromActualIdx = next.findIndex((x) => x.id === fromItem.id);
      const toActualIdx = next.findIndex((x) => x.id === toItem.id);
      if (fromActualIdx < 0 || toActualIdx < 0) return prev;

      const [item] = next.splice(fromActualIdx, 1);
      const insertIdx = fromActualIdx < toActualIdx ? toActualIdx - 1 : toActualIdx;
      next.splice(insertIdx, 0, item);
      return next;
    });
  };

  const moveImageTo = (propertyId, fromIdx, toIdx) => {
    setPropertyPortfolio((prev) => prev.map((x) => {
      if (x.id !== propertyId) return x;
      const imgs = [...(x.images || [])];
      if (fromIdx < 0 || fromIdx >= imgs.length || toIdx < 0 || toIdx >= imgs.length) return x;
      const [it] = imgs.splice(fromIdx, 1);
      imgs.splice(toIdx, 0, it);
      return { ...x, images: imgs };
      }));
  };

  const handlePortfolioVideo = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      if (e?.target) e.target.value = '';
      return;
    }
    const videoUrl = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      if (v.duration > 60) {
        setPortfolioMsg(t.videoMax60);
        URL.revokeObjectURL(videoUrl);
        return;
      }
      setPortfolioVideo(videoUrl);
      setPortfolioMsg('');
      setPortfolioVideoBlob(`portfolioVideo_${accountType}`, file).catch(() => {});
      if (e?.target) e.target.value = '';
    };
    v.onerror = () => {
      setPortfolioMsg(t.videoValidateError);
      URL.revokeObjectURL(videoUrl);
      if (e?.target) e.target.value = '';
    };
    v.src = videoUrl;
  };

  const handleServiceImages = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) { if (e?.target) e.target.value = ''; return; }
    readAndCompressFiles(files).then((urls) => {
      if (urls.length) setServiceImages((prev) => [...prev, ...urls].slice(0, 10));
      if (e?.target) e.target.value = '';
    });
  };

  const startEditService = (svc) => {
    setEditingServiceId(svc.id);
    setServiceEditDraft({
      title: svc.title || '',
      category: svc.category || '',
      description: svc.description || '',
      price: svc.price ? Number(svc.price).toLocaleString('en-US') : '',
      primaryProfile: svc.primaryProfile || '',
      markets: normalizeMarkets(svc.markets),
    });
  };

  const startEditProperty = (p) => {
    setEditingPropertyId(p.id);
    setPropertyEditDraft({
      address: p.address || '',
      city: p.city || '',
      zip: p.zip || '',
      price: p.price ? Number(p.price).toLocaleString('en-US') : '',
      capRate: p.capRate ? String(p.capRate) : '',
      rehab: p.rehab ? Number(p.rehab).toLocaleString('en-US') : '',
      beds: p.beds ? String(p.beds) : '',
      baths: p.baths ? String(p.baths) : '',
      sqft: p.sqft || '',
      lot: p.lot || '',
      type: p.type || '',
      objective: p.objective || '',
      description: p.description || '',
      primaryProfile: p.primaryProfile || '',
      markets: normalizeMarkets(p.markets),
    });
  };

  const saveEditProperty = (id) => {
    const currentRecord = propertyPortfolio.find((prop) => prop.id === id);
    const shouldEmphasizePreview = Boolean(
      currentRecord
      && currentRecord.dealClosed !== true
      && !isTruthyFlag(currentRecord.publishToShowcase, true)
    );
    const numericPrice = parseCurrencyInput(propertyEditDraft.price);
    const rehab = parseCurrencyInput(propertyEditDraft.rehab);
    const capRate = Number(propertyEditDraft.capRate) || 0;
    const beds = Number(propertyEditDraft.beds) || 0;
    const baths = Number(propertyEditDraft.baths) || 0;
    const nextMarkets = normalizeMarkets(propertyEditDraft.markets);
    setPropertyPortfolio((prev) => prev.map((prop) => (
      prop.id === id
        ? {
            ...prop,
            address: propertyEditDraft.address || prop.address,
            city: propertyEditDraft.city || prop.city,
            zip: propertyEditDraft.zip || prop.zip,
            price: numericPrice,
            capRate,
            rehab,
            beds,
            baths,
            sqft: propertyEditDraft.sqft || prop.sqft,
            lot: propertyEditDraft.lot || prop.lot,
            type: propertyEditDraft.type || prop.type,
            objective: propertyEditDraft.objective || prop.objective,
            description: propertyEditDraft.description || prop.description,
            primaryProfile: normalizePrimaryProfileScope(propertyEditDraft.primaryProfile || prop.primaryProfile),
            primaryProfileId: getPrimaryProfileId(propertyEditDraft.primaryProfile || prop.primaryProfile),
            markets: nextMarkets,
            state: nextMarkets[0] || prop.state || '',
          }
        : prop
    )));
    setEditingPropertyId(null);
    if (shouldEmphasizePreview) setIsPreviewToFeedDirty(true);
  };

  const saveEditService = (id) => {
    const currentRecord = servicePortfolio.find((svc) => svc.id === id);
    const shouldEmphasizePreview = Boolean(
      currentRecord
      && currentRecord.dealClosed !== true
      && !isTruthyFlag(currentRecord.publishToConnections, true)
    );
    if (!serviceEditDraft.primaryProfile) return;
    const numericPrice = parseCurrencyInput(serviceEditDraft.price);
    setServicePortfolio((prev) => prev.map((svc) => (
      svc.id === id
        ? {
            ...svc,
            title: serviceEditDraft.title || t.serviceFallbackName,
            category: serviceEditDraft.category,
            description: serviceEditDraft.description,
            price: Number.isFinite(numericPrice) && numericPrice > 0 ? numericPrice : 0,
            primaryProfile: normalizePrimaryProfileScope(serviceEditDraft.primaryProfile || svc.primaryProfile),
            primaryProfileId: getPrimaryProfileId(serviceEditDraft.primaryProfile || svc.primaryProfile),
            markets: normalizeMarkets(serviceEditDraft.markets),
          }
        : svc
    )));
    setEditingServiceId(null);
    if (shouldEmphasizePreview) setIsPreviewToFeedDirty(true);
  };

  const editingPropertyRecord = editingPropertyId ? propertyPortfolio.find((p) => p.id === editingPropertyId) || null : null;
  const editingServiceRecord = editingServiceId ? servicePortfolio.find((svc) => svc.id === editingServiceId) || null : null;

  const handleEditServiceImages = (e, id) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) { if (e?.target) e.target.value = ''; return; }
    readAndCompressFiles(files).then((urls) => {
      if (urls.length) {
        setServicePortfolio((prev) => prev.map((svc) => (
          svc.id === id
            ? {
                ...svc,
                media: {
                  ...(svc.media || {}),
                  images: [
                    ...(Array.isArray(svc.media?.images) ? svc.media.images : []),
                    ...urls,
                  ].slice(0, 10),
                },
              }
            : svc
        )));
      }
      if (e?.target) e.target.value = '';
    });
  };

  const addProfessionalPortfolioProperty = () => {
    const validation = validateProfessionalPropertyDraft({
      address: portfolioAddress,
      city: portfolioCity,
      price: portfolioPrice,
      primaryProfileScope,
    });
    if (!validation.valid) {
      setPortfolioMsg(validation.reason === 'invalid_price' ? t.errorPropertyPriceInvalid : t.errorPropertyRequiresCityPrice);
      return null;
    }

    const publishOwnerId = requirePublishOwnerId();
    if (!publishOwnerId) return null;
    const newItem = createProfessionalProperty({
      ownerId: publishOwnerId,
      type: portfolioType,
      address: portfolioAddress,
      city: portfolioCity,
      zip: portfolioZip,
      price: validation.parsedPrice,
      beds: portfolioBeds,
      baths: portfolioBaths,
      sqft: portfolioSqft,
      lot: portfolioLot,
      objective: portfolioObjective,
      rehab: parseCurrencyInput(portfolioRehab),
      capRate: Number(portfolioCapRate),
      markets: normalizeMarkets(portfolioMarkets),
      description: portfolioDescription,
      images: portfolioImages,
      video: portfolioVideo,
      primaryProfileScope,
    });
    setPropertyPortfolio((prev) => [
      ...prev,
      {
        ...newItem,
        publishToShowcase: false,
        includeInPreview: true,
        _localDraft: true,
        _localDraftAt: Date.now(),
      },
    ]);

  setPortfolioAddress('');
    setPortfolioCity('');
    setPortfolioZip('');
    setPortfolioPrice('');
    setPortfolioType('SFR');
  setPortfolioBeds('');
  setPortfolioBaths('');
  setPortfolioSqft('');
  setPortfolioLot('');
    setPortfolioRehab('');
    setPortfolioCapRate('');
    setPortfolioObjective('Sell');
    setPortfolioMarkets([]);
    setPortfolioDescription('');
    setPortfolioImages([]);
    setPortfolioVideo('');
    clearPortfolioVideoBlob(`portfolioVideo_${accountType}`).catch(() => {});
    setPortfolioMsg('');
    setIsPreviewToFeedDirty(true);

    return newItem.id;
  };


  const addProfessionalPortfolioService = () => {
    if (!serviceTitle || !serviceCategory || !servicePrimaryProfileScope) return;
    const numericPrice = parseCurrencyInput(servicePrice);

    const publishOwnerId = requirePublishOwnerId();
    if (!publishOwnerId) return;
    setServicePortfolio((prev) => [
      ...prev,
      {
        id: genId(),
        ownerId: publishOwnerId,
        title: serviceTitle,
        category: serviceCategory,
        description: serviceDescription || '',
        price: Number.isFinite(numericPrice) && numericPrice > 0 ? numericPrice : 0,
        markets: normalizeMarkets(serviceMarkets),
        media: { images: serviceImages },
        primaryProfile: normalizePrimaryProfileScope(servicePrimaryProfileScope),
        primaryProfileId: getPrimaryProfileId(servicePrimaryProfileScope),
        tags: ['service', 'portfolio'],
        publishToConnections: false,
        includeInPreview: true,
        dealClosed: false,
        source: 'portfolio',
        _localDraft: true,
        _localDraftAt: Date.now(),
      },
    ]);

    setServiceTitle('');
    setServiceCategory('');
    setServiceDescription('');
    setServicePrice('');
    setServiceMarkets([]);
    setServiceImages([]);
    setServicePrimaryProfileScope('');
    setIsPreviewToFeedDirty(true);
  };

  const toggleServiceShowInConnections = (serviceId) => {
    setServicePortfolio((prev) => prev.map((item) => {
      if (item.id !== serviceId) return item;
      return {
        ...item,
        publishToConnections: !isTruthyFlag(item.publishToConnections, true),
      };
    }));
  };

  const toggleServicePreviewInclusion = (serviceId) => {
    setServicePortfolio((prev) => prev.map((item) => {
      if (item.id !== serviceId) return item;
      if (item.dealClosed) return item;
      return {
        ...item,
        includeInPreview: !isTruthyFlag(item.includeInPreview, false),
      };
    }));
  };

  const togglePropertyShowInShowcase = (propertyId) => {
    setPropertyPortfolio((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        if (item.id !== propertyId) return item;
        changed = true;
        const nextShowIn = !isTruthyFlag(item.publishToShowcase, true);
        return {
          ...item,
          publishToShowcase: nextShowIn,
        };
      });
      // Garante nova referência mesmo se nada mudar (edge case)
      return changed ? next : [...prev];
    });
  };

  const togglePropertyPreviewInclusion = (propertyId) => {
    setPropertyPortfolio((prev) => prev.map((item) => {
      if (item.id !== propertyId) return item;
      if (item.dealClosed) return item;
      return { ...item, includeInPreview: !isTruthyFlag(item.includeInPreview, false) };
    }));
  };

  // User-created records should always belong to the local authenticated profile.
  const getPublishOwnerId = () => {
    return authSession?.userId || authSession?.id || '';
  };

  const requirePublishOwnerId = () => {
    const ownerId = String(getPublishOwnerId() || '').trim();
    if (!ownerId) {
      setPortfolioMsg(t.saveProfilesFirst || 'Save your profile before adding portfolio records.');
      return '';
    }
    return ownerId;
  };

  const requestDeletePortfolioRecord = (type, record) => {
    if (!record) return;
    setDeleteConfirm({
      type,
      id: record.id,
      title: type === 'property'
        ? (record.address || record.title || t.recordsPropertiesTab || 'Property')
        : (record.title || record.name || t.recordsServicesTab || 'Service'),
    });
  };

  const confirmDeletePortfolioRecord = async () => {
    const pending = deleteConfirm;
    if (!pending?.id) {
      setDeleteConfirm(null);
      return;
    }
    try {
      if (pending.type === 'property') {
        setPropertyPortfolio((prev) => (prev || []).filter((item) => String(item?.id) !== String(pending.id)));
        if (typeof onDeletePropertyRecord === 'function') await onDeletePropertyRecord(pending.id);
      } else {
        setServicePortfolio((prev) => (prev || []).filter((item) => String(item?.id) !== String(pending.id)));
        if (typeof onDeleteServiceRecord === 'function') await onDeleteServiceRecord(pending.id);
      }
      setPortfolioMsg(t.recordDeleted || 'Record deleted.');
    } catch (error) {
      setPortfolioMsg(t.recordDeleteFailed || 'Could not delete this record. Try again.');
      if (import.meta.env.DEV) console.warn('Portfolio record delete failed', error);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const buildPreviewFeedCard = (scope = 'personal') => {
    const isProfessionalScope = scope === 'professional';
    const isFsboScope = scope === 'fsbo';
    const previewBadge = isFsboScope ? 'FSBO' : (isProfessionalScope ? 'Business' : 'Personal');
    const categoryId = isProfessionalScope ? primaryCategoryB : (isFsboScope ? 'fsbo' : primaryCategory);
    const bestCategory = isFsboScope ? 'FSBO' : (allProfiles.find((p) => p.id === categoryId)?.label || '');
    const scopedProperties = (myPortfolio || []).filter((p) => toPreviewScope(p.primaryProfile) === scope);
    const scopedServices = (myServicePortfolio || []).filter((s) => {
      const serviceScope = s.primaryProfile;
      return toPreviewScope(serviceScope) === scope && isServiceVisibleInPreview(s);
    });
    const autoDeals = scopedProperties.length || scopedServices.length ? Math.max(1, (scopedProperties.length + scopedServices.length) * 3) : 0;
    const autoReviews = autoDeals > 0 ? Math.max(8, autoDeals * 2) : 0;
    const autoRating = autoDeals > 0 ? 4.9 : 0;
    const scopedServiceDescriptions = scopedServices
      .map((s) => (s.description && String(s.description).trim() ? s.description.trim() : null))
      .filter(Boolean);
    const normalizeSkillTag = (raw) => {
      const base = String(raw || '').trim();
      if (!base) return '';
      const cleaned = base.replace(/^svc[_-]/i, '').replace(/[_-]+/g, ' ').trim();
      if (!cleaned) return '';
      // Human-friendly title case for compact chip labels.
      return cleaned.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
    };
    const scopedServiceTags = Array.from(
      new Set(
        scopedServices
          .flatMap((svc) => [svc?.category, svc?.title])
          .map(normalizeSkillTag)
          .filter(Boolean)
      )
    );
    const scopedManualSkills = isProfessionalScope ? selectedSkillsB : selectedSkills;

    const previewTags = isFsboScope
      ? []
      : (scopedServiceTags.length ? scopedServiceTags.slice(0, 4) : ((scopedManualSkills || []).slice(0, 4)));

    return {
      id: isProfessionalScope ? 'preview-professional' : (isFsboScope ? 'preview-fsbo' : 'preview-personal'),
      photo: (isProfessionalScope ? profileThumbB : profileThumb) || '',
      name: isProfessionalScope ? (nameB || '') : (name || ''),
      type: bestCategory,
      badge: previewBadge,
      loc: isProfessionalScope ? (locB ? `${stateNameByCode[locB]}, ${locB}` : '') : (loc ? `${stateNameByCode[loc]}, ${loc}` : ''),
      rating: autoRating,
      reviews: autoReviews,
      portfolioCount: scopedProperties.length,
      deals: autoDeals,
      phone: isProfessionalScope ? (personalPrimaryPhoneB || '') : (personalPrimaryPhone || ''),
      email: isProfessionalScope ? (personalEmailB || '') : (personalEmail || ''),
      desc: (() => {
        const parts = [];
        try {
          const scopePitch = isProfessionalScope ? pitchB : pitch;
          if (scopePitch && String(scopePitch).trim().length) parts.push(String(scopePitch).trim());
          if (scopedServiceDescriptions.length) parts.push(...scopedServiceDescriptions);
        } catch (e) { void e; }
        return parts.length ? parts.join(' • ') : '';
      })(),
      tags: previewTags,
    };
  };

  const previewPersonalFeedCard = buildPreviewFeedCard('personal');
  const previewProfessionalFeedCard = buildPreviewFeedCard('professional');
  const previewFsboFeedCard = buildPreviewFeedCard('fsbo');

  const previewShowcaseCard = (() => {
    const total = propertiesForPreview.length;
    const safeIndex = total > 0
      ? ((previewPropertyIndex % total) + total) % total
      : 0;
    const firstPortfolio = total > 0 ? propertiesForPreview[safeIndex] : null;
    if (firstPortfolio) {
      return {
        ...firstPortfolio,
        images: firstPortfolio.images?.length ? firstPortfolio.images : [PREVIEW_PLACEHOLDER_IMAGE],
        dealTag: firstPortfolio.dealTag === 'FSBO'
          ? (accountType === 'fsbo_owner' ? 'FSBO' : 'Portfolio')
          : (firstPortfolio.dealTag || (accountType === 'fsbo_owner' ? 'FSBO' : 'Portfolio')),
        objective: firstPortfolio.objective || 'Sell',
        sqft: firstPortfolio.sqft || '-',
        improvement: '-',
        lot: firstPortfolio.lot || '-',
      };
    }

    return null;
  })();

  const portfolioFieldLabelStyle = {
    position: 'absolute',
    left: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 10,
    color: C.t3,
    fontWeight: 700,
    pointerEvents: 'none',
    lineHeight: 1,
    whiteSpace: 'nowrap',
  };

  const portfolioTextareaLabelStyle = {
    ...portfolioFieldLabelStyle,
    top: 8,
    transform: 'none',
    lineHeight: 1.1,
  };

  const portfolioFieldBaseStyle = {
    width: '100%',
    minHeight: 0,
    padding: '8px 10px 8px 72px',
    borderRadius: 9,
    border: `1px solid ${C.border}`,
    background: C.card,
    color: C.t1,
    fontSize: 11,
    fontFamily: 'inherit',
    lineHeight: 'normal',
    boxSizing: 'border-box',
    minWidth: 0,
  };

  const portfolioFieldInputStyle = (overrides = {}) => ({
    ...portfolioFieldBaseStyle,
    ...overrides,
  });

  const portfolioFieldSelectStyle = (overrides = {}) => ({
    ...portfolioFieldBaseStyle,
    padding: '8px 28px 8px 72px',
    ...overrides,
  });

  const portfolioFieldTextareaStyle = (overrides = {}) => ({
    width: '100%',
    minHeight: 72,
    padding: '24px 10px 8px 10px',
    borderRadius: 9,
    border: `1px solid ${C.border}`,
    background: C.card,
    color: C.t1,
    boxSizing: 'border-box',
    fontSize: 11,
    fontFamily: 'inherit',
    fontWeight: 400,
    resize: 'vertical',
    ...overrides,
  });

  const portfolioFormValues = {
    portfolioAddress,
    portfolioCity,
    portfolioZip,
    portfolioType,
    portfolioPrice,
    portfolioBeds,
    portfolioBaths,
    portfolioSqft,
    portfolioLot,
    portfolioRehab,
    portfolioCapRate,
    portfolioObjective,
    portfolioMarkets,
    primaryProfileScope,
    portfolioDescription,
    portfolioImages,
    portfolioMsg,
  };

  const handlePortfolioFieldChange = (field, value) => {
    switch (field) {
      case 'portfolioAddress': setPortfolioAddress(value); break;
      case 'portfolioCity': setPortfolioCity(value); break;
      case 'portfolioZip': setPortfolioZip(value); break;
      case 'portfolioType': setPortfolioType(value); break;
      case 'portfolioPrice': setPortfolioPrice(value); break;
      case 'portfolioBeds': setPortfolioBeds(value); break;
      case 'portfolioBaths': setPortfolioBaths(value); break;
      case 'portfolioSqft': setPortfolioSqft(value); break;
      case 'portfolioLot': setPortfolioLot(value); break;
      case 'portfolioRehab': setPortfolioRehab(value); break;
      case 'portfolioCapRate': setPortfolioCapRate(value); break;
      case 'portfolioObjective': setPortfolioObjective(value); break;
      case 'portfolioMarkets': setPortfolioMarkets(Array.isArray(value) ? value : []); break;
      case 'primaryProfileScope': setPrimaryProfileScope(value); break;
      case 'portfolioDescription': setPortfolioDescription(value); break;
      case 'portfolioImages': setPortfolioImages(Array.isArray(value) ? value : []); break;
      default: break;
    }
  };

  const getMissingRequiredForProfileA = () => {
    const missing = [];
    if (!String(name || '').trim()) missing.push(t.requiredFullName);
    if (!String(personalPrimaryPhone || '').trim()) missing.push(t.requiredPriorityPhone);
    if (!String(personalEmail || '').trim()) missing.push(t.requiredEmail);
    if (!contactMethods.length) missing.push(t.requiredBusinessContactOptions);
    return missing;
  };

  const getMissingRequiredForProfileB = () => {
    const missing = [];
    if (!String(nameB || '').trim()) missing.push(t.requiredFullName);
    if (!String(personalPrimaryPhoneB || '').trim()) missing.push(t.requiredPriorityPhone);
    if (!String(personalEmailB || '').trim()) missing.push(t.requiredEmail);
    if (!contactMethodsB.length) missing.push(t.requiredBusinessContactOptions);
    return missing;
  };

  const _hasAnyValue = (...values) => values.some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    return String(value || '').trim().length > 0;
  });
  void _hasAnyValue;

  const profileASkillsComplete = (
    Array.isArray(selectedCategories) && selectedCategories.length > 0
    && Array.isArray(selectedMarkets) && selectedMarkets.length > 0
    && String(primaryCategory || '').trim().length > 0
  );

  const profileBOpsComplete = (
    Array.isArray(selectedCategoriesB) && selectedCategoriesB.length > 0
    && Array.isArray(selectedMarketsB) && selectedMarketsB.length > 0
    && String(primaryCategoryB || '').trim().length > 0
  );

  const profileAComplete = getMissingRequiredForProfileA().length === 0;
  const profileBComplete = getMissingRequiredForProfileB().length === 0;
  const profileAReady = getMissingRequiredForProfileA().length === 0 && profileASkillsComplete;
  const profileBReady = getMissingRequiredForProfileB().length === 0 && profileBOpsComplete;
  const preferProfessionalPath = profileTab === 'professional' || profileTab === 'operation';

  const showValidationBorders = Boolean(basicRequiredMsg);
  const missingProfileAFullName = !String(name || '').trim();
  const missingProfileAPhone = !String(personalPrimaryPhone || '').trim();
  const missingProfileAEmail = !String(personalEmail || '').trim();
  const missingProfileAContactMethods = !contactMethods.length;

  const missingProfileBFullName = !String(nameB || '').trim();
  const missingProfileBPhone = !String(personalPrimaryPhoneB || '').trim();
  const missingProfileBEmail = !String(personalEmailB || '').trim();
  const missingProfileBContactMethods = !contactMethodsB.length;

  const missingSkillsCategories = !(Array.isArray(selectedCategories) && selectedCategories.length > 0);
  const missingSkillsMarkets = !(Array.isArray(selectedMarkets) && selectedMarkets.length > 0);
  const missingSkillsPrimaryCategory = !String(primaryCategory || '').trim();

  const missingOpsCategories = !(Array.isArray(selectedCategoriesB) && selectedCategoriesB.length > 0);
  const missingOpsMarkets = !(Array.isArray(selectedMarketsB) && selectedMarketsB.length > 0);
  const missingOpsPrimaryCategory = !String(primaryCategoryB || '').trim();

  const missingPortfolioAddress = !String(portfolioAddress || '').trim();
  const missingPortfolioCity = !String(portfolioCity || '').trim();
  const missingPortfolioZip = !String(portfolioZip || '').trim();
  const missingPortfolioPrice = !String(portfolioPrice || '').trim();
  const missingPortfolioType = !String(portfolioType || '').trim();
  const missingPortfolioPrimaryProfile = !String(primaryProfileScope || '').trim();

  const missingServiceTitle = !String(serviceTitle || '').trim();
  const missingServiceCategory = !String(serviceCategory || '').trim();
  const missingServicePrice = !String(servicePrice || '').trim();
  const missingServicePrimaryProfile = !String(servicePrimaryProfileScope || '').trim();

  const requiresSkillsTab = accountType === 'professional' && !profileAReady && !profileBReady && profileAComplete && !profileASkillsComplete && !preferProfessionalPath;
  const requiresProfessionalTab = accountType === 'professional' && !profileAReady && !profileBReady && preferProfessionalPath && !profileBComplete;
  const requiresOperationsTab = accountType === 'professional' && !profileAReady && !profileBReady && profileBComplete && !profileBOpsComplete;

  const validateMinimumProfileCompletion = () => {
    const missingA = getMissingRequiredForProfileA();
    const missingB = getMissingRequiredForProfileB();
    const profileAComplete = missingA.length === 0;
    const profileBComplete = missingB.length === 0;

    // FSBO path: only needs name + (phone OR email)
    if (accountType === 'fsbo_owner') {
      const fsboMissing = [];
      if (!String(name || '').trim()) fsboMissing.push(t.requiredFullName || 'Full name');
      if (!String(personalPrimaryPhone || '').trim() && !String(personalEmail || '').trim()) {
        fsboMissing.push(t.requiredPriorityPhone || 'Priority phone');
      }

      if (fsboMissing.length > 0) {
        const hintMessage = `${t.requiredPrefix}: ${fsboMissing.join(' | ')}`;
        setBasicRequiredMsg(hintMessage);
        showInlineValidationHint('profile-a-fields', hintMessage);
        return { valid: false, primaryProfile: null, profileAComplete, profileBComplete };
      }
      setBasicRequiredMsg('');
      clearInlineValidationHint();
      return { valid: true, primaryProfile: 'A', profileAComplete, profileBComplete };
    }

    // Professional path: AT LEAST ONE complete path suffices:
    //   Path 1: Personal (A) + Skills  OR  Path 2: Business (B) + Operations
    if (profileAReady || profileBReady) {
      setBasicRequiredMsg('');
      clearInlineValidationHint();
      return {
        valid: true,
        primaryProfile: profileBReady && !profileAReady
          ? 'B'
          : (profileAReady && !profileBReady ? 'A' : (preferProfessionalPath ? 'B' : 'A')),
        profileAComplete,
        profileBComplete,
      };
    }

    // Neither path fully ready - guide user based on their active tab
    if (preferProfessionalPath) {
      if (!profileBComplete) {
        const hintMessage = t.errorCompleteBusinessProfile || 'Complete the Business profile: full name, priority phone, email and contact methods.';
        setBasicRequiredMsg(hintMessage);
        showInlineValidationHint('tab-business', hintMessage);
        return { valid: false, primaryProfile: null, profileAComplete, profileBComplete };
      }
      const hintMessage = t.errorCompleteOperationsTab || 'Complete Operations tab for Business: category, primary category and at least one state.';
      setBasicRequiredMsg(hintMessage);
      showInlineValidationHint('tab-operation', hintMessage);
      return { valid: false, primaryProfile: null, profileAComplete, profileBComplete };
    }

    if (!profileAComplete) {
      const hintMessage = t.errorCompletePersonalProfile || 'Complete the Personal profile: full name, priority phone, email and contact methods.';
      setBasicRequiredMsg(hintMessage);
      showInlineValidationHint('tab-personal', hintMessage);
      return { valid: false, primaryProfile: null, profileAComplete, profileBComplete };
    }

    const hintMessage = t.errorCompleteSkillsTab || 'Complete Skills tab for Personal: category, primary category and at least one state.';
    setBasicRequiredMsg(hintMessage);
    showInlineValidationHint('tab-skills', hintMessage);
    return { valid: false, primaryProfile: null, profileAComplete, profileBComplete };
  };

  const openPreviewToFeed = () => {
    if (!validateMinimumProfileCompletion().valid) return;
    setIsPreviewToFeedDirty(false);
    setPreviewOpen(true);
  };

  const mobileStepCompletionMap = useMemo(() => ({
    profileAName: !missingProfileAFullName,
    profileAPhone: !missingProfileAPhone,
    profileAEmail: !missingProfileAEmail,
    profileAEmailOrPhone: !missingProfileAPhone || !missingProfileAEmail,
    profileAContact: !missingProfileAContactMethods,
    skillsCategories: !missingSkillsCategories,
    skillsMarkets: !missingSkillsMarkets,
    skillsPrimaryCategory: !missingSkillsPrimaryCategory,
    profileBName: !missingProfileBFullName,
    profileBPhone: !missingProfileBPhone,
    profileBEmail: !missingProfileBEmail,
    profileBContact: !missingProfileBContactMethods,
    opsCategories: !missingOpsCategories,
    opsMarkets: !missingOpsMarkets,
    opsPrimaryCategory: !missingOpsPrimaryCategory,
    portfolioAddress: !missingPortfolioAddress,
    portfolioCity: !missingPortfolioCity,
    portfolioZip: !missingPortfolioZip,
    portfolioPrice: !missingPortfolioPrice,
    portfolioType: !missingPortfolioType,
    portfolioPrimaryProfile: !missingPortfolioPrimaryProfile,
    serviceTitle: !missingServiceTitle,
    serviceCategory: !missingServiceCategory,
    servicePrice: !missingServicePrice,
    servicePrimaryProfile: !missingServicePrimaryProfile,
  }), [
    missingProfileAFullName,
    missingProfileAPhone,
    missingProfileAEmail,
    missingProfileAContactMethods,
    missingSkillsCategories,
    missingSkillsMarkets,
    missingSkillsPrimaryCategory,
    missingProfileBFullName,
    missingProfileBPhone,
    missingProfileBEmail,
    missingProfileBContactMethods,
    missingOpsCategories,
    missingOpsMarkets,
    missingOpsPrimaryCategory,
    missingPortfolioAddress,
    missingPortfolioCity,
    missingPortfolioZip,
    missingPortfolioPrice,
    missingPortfolioType,
    missingPortfolioPrimaryProfile,
    missingServiceTitle,
    missingServiceCategory,
    missingServicePrice,
    missingServicePrimaryProfile,
  ]);

  const mobileStepOrder = useMemo(() => {
    if (accountType === 'professional') {
      const profileSteps = activePersonal
        ? ['profileAName', 'profileAPhone', 'profileAEmail', 'profileAContact']
        : activeSkills
          ? ['skillsCategories', 'skillsMarkets', 'skillsPrimaryCategory']
          : activeProfessional
            ? ['profileBName', 'profileBPhone', 'profileBEmail', 'profileBContact']
            : ['opsCategories', 'opsMarkets', 'opsPrimaryCategory'];

      const portfolioSteps = portfolioEntryType === 'property'
        ? ['portfolioAddress', 'portfolioCity', 'portfolioZip', 'portfolioPrice', 'portfolioType', 'portfolioPrimaryProfile']
        : ['serviceTitle', 'serviceCategory', 'servicePrice', 'servicePrimaryProfile'];

      return [...profileSteps, ...portfolioSteps];
    }

    return ['profileAName', 'profileAEmailOrPhone', 'profileAContact', 'portfolioAddress', 'portfolioCity', 'portfolioZip', 'portfolioPrice', 'portfolioType', 'portfolioPrimaryProfile'];
  }, [accountType, activePersonal, activeSkills, activeProfessional, portfolioEntryType]);

  const mobileAutoStepPrevCompletionRef = useRef({});

  useEffect(() => {
    if (!isMobileViewport) return;
    mobileAutoStepPrevCompletionRef.current = { ...mobileStepCompletionMap };
  }, [isMobileViewport, accountType, profileTab, portfolioEntryType, mobileStepCompletionMap]);

  useEffect(() => {
    if (!isMobileViewport) return;
    const prev = mobileAutoStepPrevCompletionRef.current;
    const hasPrevSnapshot = Object.keys(prev || {}).length > 0;

    if (!hasPrevSnapshot) {
      mobileAutoStepPrevCompletionRef.current = { ...mobileStepCompletionMap };
      return;
    }

    const completedNowKey = mobileStepOrder.find((stepKey) => mobileStepCompletionMap[stepKey] && !prev[stepKey]);
    if (!completedNowKey) {
      mobileAutoStepPrevCompletionRef.current = { ...mobileStepCompletionMap };
      return;
    }

    const completedIdx = mobileStepOrder.indexOf(completedNowKey);
    const nextStepKey = mobileStepOrder.slice(completedIdx + 1).find((stepKey) => !mobileStepCompletionMap[stepKey]);
    if (nextStepKey) {
      const target = onboardingGridRef.current?.querySelector(`[data-mobile-step="${nextStepKey}"]`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }

    mobileAutoStepPrevCompletionRef.current = { ...mobileStepCompletionMap };
  }, [isMobileViewport, mobileStepOrder, mobileStepCompletionMap]);

  const handleSaveProfiles = () => {
    const allowExplicitProfileClearSave = Boolean(pendingProfileClearScope && isSaveProfilesDirty);
    const validation = allowExplicitProfileClearSave
      ? {
        valid: true,
        primaryProfile: pendingProfileClearScope,
        profileAComplete: false,
        profileBComplete: false,
      }
      : validateMinimumProfileCompletion();
    if (!validation.valid) return;

    // Permite qualquer perfil ser neutro/não ativo, apenas impede duplicidade
    const safeCardPriorities = normalizeUniqueCardPriorities(
      {
        A: cardPriorityA,
        B: cardPriorityB,
        C: cardPriorityC,
      }
    );
    if (hasDuplicateCardPriorities(safeCardPriorities)) {
      const msg = t.errorPriorityTaken || 'Duplicidade de prioridade detectada. Ajuste as prioridades antes de salvar.';
      showInlineValidationHint('profile-a-fields', msg);
      setBasicRequiredMsg(msg);
      return;
    }
    applyCardPrioritySet(safeCardPriorities);
    const persistedInvestmentProfile = requiresInvestmentProfile
      ? getPersistedInvestmentProfile()
      : normalizeInvestmentDraft(professionalProfile?.investmentProfile);
    const isClearingProfileA = pendingProfileClearScope === 'A';
    const isClearingProfileB = pendingProfileClearScope === 'B';
    const isClearingProfileC = pendingProfileClearScope === 'C';
    const isClearingActiveProfile = isClearingProfileA || isClearingProfileB || isClearingProfileC;

    // Save profile data per account branch to avoid cross-populating forms.
    try {
      if (accountType === 'fsbo_owner') {
        const nextPersonalProfile = {
          ...(personalProfile || {}),
          fullName: name || '',
          loc: normalizeUsStateCode(loc),
          photo: profileThumb || '',
          photoClearRequested: profileThumbClearRequested === true,
          phone: personalPrimaryPhone,
          primaryPhone: personalPrimaryPhone,
          secondaryPhone: personalSecondaryPhone,
          tertiaryPhone: personalTertiaryPhone,
          email: personalEmail,
          cardPriorityC: safeCardPriorities.C,
          cardPriorityA: '',
          cardPriorityAExplicit: false,
          cardPriorityCExplicit: Boolean(safeCardPriorities.C),
          contactMethods,
          visibility: 'profile_only',
        };
        const nextProfessionalProfile = {
          ...(professionalProfile || {}),
          // FSBO mode can still expose Business profile (B), so priorities must remain
          // synchronized across both profile stores to avoid stale payload hydration.
          // Keep B fields scoped here too; otherwise FSBO edits can rehydrate stale
          // secondary-profile identity/media from a previous save.
          fullNameB: nameB || '',
          fullName: nameB || '',
          locB: normalizeUsStateCode(locB),
          photoB: profileThumbB || '',
          photoBUrl: profileThumbB || '',
          photo: profileThumbB || '',
          photoBClearRequested: profileThumbBClearRequested === true,
          categoryB: primaryCategoryB,
          primaryCategoryB,
          goalB,
          categoriesB: selectedCategoriesB,
          auxiliaryCategoriesB: selectedCategoriesB.filter((c) => c !== primaryCategoryB),
          marketsB: selectedMarketsB,
          skillsB: selectedSkillsB,
          servicesB: selectedServicesB,
          pitchB: pitchB || '',
          phoneB: personalPrimaryPhoneB,
          primaryPhoneB: personalPrimaryPhoneB,
          secondaryPhoneB: personalSecondaryPhoneB,
          tertiaryPhoneB: personalTertiaryPhoneB,
          emailB: personalEmailB,
          contactMethodsB,
          cardPriorityA: '',
          cardPriorityAExplicit: false,
          cardPriorityB: safeCardPriorities.B,
          cardPriorityBExplicit: Boolean(safeCardPriorities.B),
          cardPriorityC: safeCardPriorities.C,
          cardPriorityCExplicit: Boolean(safeCardPriorities.C),
          investmentProfile: persistedInvestmentProfile,
        };
        setPersonalProfile(nextPersonalProfile);
        setProfessionalProfile(nextProfessionalProfile);
        try {
          localStorage.setItem('personalProfile', JSON.stringify(nextPersonalProfile));
          localStorage.setItem('professionalProfile', JSON.stringify(nextProfessionalProfile));
        } catch {
          // ignore localStorage quota/transient failures
        }
      } else {
        const nextProfessionalProfile = {
          ...(professionalProfile || {}),
          investmentProfile: persistedInvestmentProfile,
          // Profile A (Personal tab within Professional category)
          fullNameA: name || '',
          locA: normalizeUsStateCode(loc),
          photoA: profileThumb || '',
          photoAClearRequested: profileThumbClearRequested === true,
          phoneA: personalPrimaryPhone,
          primaryPhoneA: personalPrimaryPhone,
          secondaryPhoneA: personalSecondaryPhone,
          tertiaryPhoneA: personalTertiaryPhone,
          emailA: personalEmail,
          cardPriorityA: safeCardPriorities.A,
          cardPriorityAExplicit: Boolean(safeCardPriorities.A),
          contactMethodsA: contactMethods,
          category: primaryCategory,
          primaryCategory,
          goal,
          categories: selectedCategories,
          auxiliaryCategories: selectedCategories.filter((c) => c !== primaryCategory),
          markets: selectedMarkets,
          skills: effectiveProfileSkills,
          services: effectiveProfileServices,
          pitch: pitch || '',

          // Profile B (Professional/Operations)
          fullNameB: nameB || '',
          fullName: nameB || '',
          locB: normalizeUsStateCode(locB),
          photoB: profileThumbB || '',
          photoBUrl: profileThumbB || '',
          photo: profileThumbB || '',
          photoBClearRequested: profileThumbBClearRequested === true,
          categoryB: primaryCategoryB,
          primaryCategoryB,
          goalB,
          categoriesB: selectedCategoriesB,
          auxiliaryCategoriesB: selectedCategoriesB.filter((c) => c !== primaryCategoryB),
          marketsB: selectedMarketsB,
          skillsB: selectedSkillsB,
          servicesB: selectedServicesB,
          pitchB: pitchB || '',
          phoneB: personalPrimaryPhoneB,
          primaryPhoneB: personalPrimaryPhoneB,
          secondaryPhoneB: personalSecondaryPhoneB,
          tertiaryPhoneB: personalTertiaryPhoneB,
          emailB: personalEmailB,
          cardPriorityB: safeCardPriorities.B,
          cardPriorityBExplicit: Boolean(safeCardPriorities.B),
          cardPriorityC: safeCardPriorities.C,
          cardPriorityCExplicit: Boolean(safeCardPriorities.C),
          contactMethodsB,
        };
        setProfessionalProfile(nextProfessionalProfile);
        try {
          localStorage.setItem('professionalProfile', JSON.stringify(nextProfessionalProfile));
        } catch {
          // ignore localStorage quota/transient failures
        }
      }

      // Keep top-level profile in sync so feed/matches cards don't keep stale avatar/data.
      const activeHeaderPhoto = accountType === 'professional'
        ? ((activePersonal || activeSkills) ? (profileThumb || '') : (profileThumbB || ''))
        : (profileThumb || '');
      const activeName = accountType === 'professional'
        ? ((activePersonal || activeSkills) ? (name || '') : (nameB || name || ''))
        : (name || '');
      const activeLoc = accountType === 'professional'
        ? ((activePersonal || activeSkills) ? (loc || '') : (locB || loc || ''))
        : (loc || '');
      setUserProfile((prev) => ({
        ...prev,
        name: isClearingActiveProfile ? activeName : (activeName || prev?.name || ''),
        photo: activeHeaderPhoto,
        location: activeLoc ? `${stateNameByCode[activeLoc]}, ${activeLoc}` : (isClearingActiveProfile ? '' : (prev?.location || '')),
      }));

      // Fix 4: If only 1 profile is truly filled, reassign ONLY orphaned records to it.
      // Never override cards already linked explicitly by the user.
      const activeScopes = [];
      if (accountType === 'fsbo_owner') {
        if (String(name || '').trim()) activeScopes.push('fsbo');
        if (String(nameB || '').trim() && selectedCategoriesB.length > 0) activeScopes.push('professional');
      } else {
        if (String(name || '').trim()) activeScopes.push('personal');
        if (String(nameB || '').trim() && selectedCategoriesB.length > 0) activeScopes.push('professional');
      }
      if (activeScopes.length === 1) {
        const onlyScope = activeScopes[0];
        const normalizedOnly = normalizePrimaryProfileScope(onlyScope);
        const hasExplicitScope = (value) => String(value || '').trim().length > 0;
        setPropertyPortfolio((prev) => (prev || []).map((p) => {
          if (!hasExplicitScope(p.primaryProfile)) {
            return { ...p, primaryProfile: normalizedOnly, primaryProfileId: getPrimaryProfileId(normalizedOnly) };
          }
          return p;
        }));
        setServicePortfolio((prev) => (prev || []).map((s) => {
          if (!hasExplicitScope(s.primaryProfile)) {
            return { ...s, primaryProfile: normalizedOnly, primaryProfileId: getPrimaryProfileId(normalizedOnly) };
          }
          return s;
        }));
      }

      setPublishToast(t.savedProfilesToast || 'Profiles saved');
      setTimeout(() => setPublishToast(''), 2200);
      setSaveProfilesBaseline(saveProfilesFingerprint);
      setIsSaveProfilesDirty(false);
      setPendingProfileClearScope('');
      setProfileThumbClearRequested(false);
      setProfileThumbBClearRequested(false);
      setBasicRequiredMsg('');
      clearInlineValidationHint();

      if (requiresInvestmentProfile && !investmentProfileRequiredComplete) {
        openInvestmentProfileModal(1);
      }
    } catch (e) {
      if (import.meta.env.DEV) console.warn('Failed saving profiles', e);
    }
  };

  const publishRegistration = () => {
    const validation = validateMinimumProfileCompletion();
    if (!validation.valid) {
      setPreviewOpen(false);
      return;
    }

    if (requiresInvestmentProfile && !investmentProfileRequiredComplete) {
      const hintMessage = t.investmentProfileValidationHint || 'Complete at least 50% of Investor Profile to continue with selected categories.';
      setBasicRequiredMsg(hintMessage);
      openInvestmentProfileModal(1);
      setPreviewOpen(false);
      return;
    }

    const useProfileB = accountType === 'professional' && validation.primaryProfile === 'B';

    const preferredPriorityKey = accountType === 'fsbo_owner'
      ? 'C'
      : (useProfileB ? 'B' : 'A');
    const safeCardPriorities = normalizeUniqueCardPriorities(
      {
        A: cardPriorityA,
        B: cardPriorityB,
        C: cardPriorityC,
      },
      preferredPriorityKey
    );
    applyCardPrioritySet(safeCardPriorities, preferredPriorityKey);
    const persistedInvestmentProfile = requiresInvestmentProfile
      ? getPersistedInvestmentProfile()
      : normalizeInvestmentDraft(professionalProfile?.investmentProfile);
    const effectiveName = accountType === 'fsbo_owner'
      ? (name || '')
      : (useProfileB ? (nameB || name || '') : (name || nameB || ''));
    const effectiveLoc = accountType === 'fsbo_owner'
      ? normalizeUsStateCode(loc)
      : (useProfileB
        ? (normalizeUsStateCode(locB) || normalizeUsStateCode(loc) || '')
        : (normalizeUsStateCode(loc) || normalizeUsStateCode(locB) || ''));
    const effectivePrimaryPhone = accountType === 'fsbo_owner'
      ? (personalPrimaryPhone || '')
      : (useProfileB ? (personalPrimaryPhoneB || personalPrimaryPhone || '') : (personalPrimaryPhone || personalPrimaryPhoneB || ''));
    const effectiveSecondaryPhone = accountType === 'fsbo_owner'
      ? (personalSecondaryPhone || '')
      : (useProfileB ? (personalSecondaryPhoneB || personalSecondaryPhone || '') : (personalSecondaryPhone || personalSecondaryPhoneB || ''));
    const effectiveTertiaryPhone = accountType === 'fsbo_owner'
      ? (personalTertiaryPhone || '')
      : (useProfileB ? (personalTertiaryPhoneB || personalTertiaryPhone || '') : (personalTertiaryPhone || personalTertiaryPhoneB || ''));
    const effectiveEmail = accountType === 'fsbo_owner'
      ? (personalEmail || '')
      : (useProfileB ? (personalEmailB || personalEmail || '') : (personalEmail || personalEmailB || ''));
    const effectiveContactMethods = accountType === 'fsbo_owner'
      ? (contactMethods || [])
      : (useProfileB ? (contactMethodsB.length ? contactMethodsB : contactMethods) : (contactMethods.length ? contactMethods : contactMethodsB));
    const effectivePrimaryCategory = useProfileB ? (primaryCategoryB || primaryCategory) : (primaryCategory || primaryCategoryB);

    const selectedProfile = allProfiles.find((p) => p.id === effectivePrimaryCategory);
    const finalName = effectiveName;
    const finalLocation = effectiveLoc ? `${stateNameByCode[effectiveLoc]}, ${effectiveLoc}` : 'Location not set';

    setUserProfile({
      name: finalName,
      category: effectivePrimaryCategory,
      type: selectedProfile?.label || 'Business',
      location: finalLocation,
      badge: selectedProfile?.label || 'Business',
      photo: useProfileB ? (profileThumbB || '') : (profileThumb || ''),
    });

    if (accountType === 'fsbo_owner') {
      setPersonalProfile((prev) => ({
        ...prev,
        fullName: finalName,
        loc: effectiveLoc || normalizeUsStateCode(prev.loc) || '',
        photo: profileThumb || '',
        photoClearRequested: profileThumbClearRequested === true,
        phone: effectivePrimaryPhone,
        primaryPhone: effectivePrimaryPhone,
        secondaryPhone: effectiveSecondaryPhone,
        tertiaryPhone: effectiveTertiaryPhone,
        email: effectiveEmail,
        cardPriorityC: safeCardPriorities.C,
        cardPriorityA: '',
        cardPriorityAExplicit: false,
        cardPriorityCExplicit: Boolean(safeCardPriorities.C),
        contactMethods: effectiveContactMethods,
        visibility: 'profile_only',
      }));
      setProfessionalProfile((prev) => ({
        ...(prev || {}),
        cardPriorityA: '',
        cardPriorityAExplicit: false,
        cardPriorityB: safeCardPriorities.B,
        cardPriorityBExplicit: Boolean(safeCardPriorities.B),
        cardPriorityC: safeCardPriorities.C,
        cardPriorityCExplicit: Boolean(safeCardPriorities.C),
        investmentProfile: persistedInvestmentProfile,
      }));
    } else {
      setProfessionalProfile((prev) => ({
        ...prev,
        investmentProfile: persistedInvestmentProfile,
        // A
        fullNameA: name || '',
        locA: normalizeUsStateCode(loc),
        photoA: profileThumb || '',
        photoAClearRequested: profileThumbClearRequested === true,
        phoneA: personalPrimaryPhone,
        primaryPhoneA: personalPrimaryPhone,
        secondaryPhoneA: personalSecondaryPhone,
        tertiaryPhoneA: personalTertiaryPhone,
        emailA: personalEmail,
        cardPriorityA: safeCardPriorities.A,
        cardPriorityAExplicit: Boolean(safeCardPriorities.A),
        contactMethodsA: contactMethods,
        category: primaryCategory,
        primaryCategory,
        goal,
        categories: selectedCategories,
        auxiliaryCategories: selectedCategories.filter((c) => c !== primaryCategory),
        markets: selectedMarkets,
        skills: effectiveProfileSkills,
        services: effectiveProfileServices,
        pitch,
        // B
        fullNameB: nameB || '',
        fullName: nameB || '',
        locB: normalizeUsStateCode(locB),
        photoB: profileThumbB || '',
        photoBUrl: profileThumbB || '',
        photo: profileThumbB || '',
        photoBClearRequested: profileThumbBClearRequested === true,
        categoryB: primaryCategoryB,
        primaryCategoryB,
        goalB,
        categoriesB: selectedCategoriesB,
        auxiliaryCategoriesB: selectedCategoriesB.filter((c) => c !== primaryCategoryB),
        marketsB: selectedMarketsB,
        skillsB: selectedSkillsB,
        servicesB: selectedServicesB,
        pitchB: pitchB || '',
        phoneB: personalPrimaryPhoneB,
        primaryPhoneB: personalPrimaryPhoneB,
        secondaryPhoneB: personalSecondaryPhoneB,
        tertiaryPhoneB: personalTertiaryPhoneB,
        emailB: personalEmailB,
        cardPriorityB: safeCardPriorities.B,
        cardPriorityBExplicit: Boolean(safeCardPriorities.B),
        cardPriorityC: safeCardPriorities.C,
        cardPriorityCExplicit: Boolean(safeCardPriorities.C),
        contactMethodsB,
      }));
    }

    // Services are only created explicitly through the service form.

    // Se houver um rascunho de propriedade preenchido, publique-o antes de navegar
    // para o dashboard para garantir que apareça no Showcase/feed.
    let autoAddedPropertyId = null;
    if (portfolioEntryType === 'property' && portfolioAddress && portfolioCity && portfolioPrice) {
      autoAddedPropertyId = addProfessionalPortfolioProperty();
    }

    // Publish items that were included in the PREVIEW when the user confirmed publish.
    // Publish step: compute what will be published for the toast
    const propsToPublish = propertiesForPreview || [];
    const servicesToPublish = servicesForPreview || [];
    const propertyIdsToPublish = new Set(propsToPublish.map((p) => String(p.id)));
    if (autoAddedPropertyId) propertyIdsToPublish.add(String(autoAddedPropertyId));
    const serviceIdsToPublish = new Set(servicesToPublish.map((s) => String(s.id)));
    const propsCount = propertyIdsToPublish.size;
    const servicesCount = serviceIdsToPublish.size;

    try {
      // Properties: anything shown in preview must remain actively published in Showcase.
      setPropertyPortfolio((prev) => prev.map((p) => {
        if (!propertyIdsToPublish.has(String(p.id))) return p;
        return {
          ...p,
          publishToShowcase: true,
          includeInPreview: true,
          isActive: true,
          dealClosed: false,
        };
      }));

      // Services: anything shown in preview must remain actively published in Connections.
      setServicePortfolio((prev) => prev.map((s) => {
        if (!serviceIdsToPublish.has(String(s.id))) return s;
        return {
          ...s,
          publishToConnections: true,
          includeInPreview: true,
          dealClosed: false,
        };
      }));

      // Show a brief toast confirming published counts
      const msgParts = [];
      if (propsCount > 0) msgParts.push(`${propsCount} ${propsCount === 1 ? t.toastPropertyPublishedOne : t.toastPropertyPublishedOther}`);
      if (servicesCount > 0) msgParts.push(`${servicesCount} ${servicesCount === 1 ? t.toastServicePublishedOne : t.toastServicePublishedOther}`);
      const toastMsg = msgParts.length ? `${t.published}: ${msgParts.join(' · ')}` : t.nothingPublished;
      setPublishToast(toastMsg);
      setTimeout(() => setPublishToast(''), 2800);
      setSaveProfilesBaseline(saveProfilesFingerprint);
      setIsSaveProfilesDirty(false);
      setProfileThumbClearRequested(false);
      setProfileThumbBClearRequested(false);
    } catch (e) {
      if (import.meta.env.DEV) console.warn('Publish step failed during registration publish.', e);
    }

    setPage('dashboard');
  };

  const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

  const getVerificationScopeLabel = (scope) => {
    if (scope === 'professional') return t.verificationScopeBusiness || 'Business profile';
    if (scope === 'fsbo') return t.verificationScopeFsbo || 'FSBO profile';
    return accountType === 'professional'
      ? (t.verificationScopePersonal || 'Personal profile')
      : (t.verificationScopeGeneric || 'profile');
  };

  const getVerificationRecord = (scope) => {
    if (scope === 'professional') {
      return professionalProfile?.verificationB || (professionalProfile?.verifiedB === true ? { verified: true, channels: {} } : null);
    }
    if (scope === 'fsbo') {
      return personalProfile?.verificationFsbo || (personalProfile?.verifiedFsbo === true ? { verified: true, channels: {} } : null);
    }
    if (accountType === 'professional') {
      return professionalProfile?.verificationA || (professionalProfile?.verifiedA === true ? { verified: true, channels: {} } : null);
    }
    return personalProfile?.verificationPersonal || (personalProfile?.verifiedPersonal === true ? { verified: true, channels: {} } : null);
  };

  const setVerificationRecord = (scope, nextRecord) => {
    const isVerified = nextRecord?.verified === true;
    if (scope === 'professional') {
      setProfessionalProfile((prev) => ({ ...(prev || {}), verificationB: nextRecord, verifiedB: isVerified }));
      return;
    }
    if (scope === 'fsbo') {
      setPersonalProfile((prev) => ({ ...(prev || {}), verificationFsbo: nextRecord, verifiedFsbo: isVerified }));
      return;
    }
    if (accountType === 'professional') {
      setProfessionalProfile((prev) => ({ ...(prev || {}), verificationA: nextRecord, verifiedA: isVerified }));
      return;
    }
    setPersonalProfile((prev) => ({ ...(prev || {}), verificationPersonal: nextRecord, verifiedPersonal: isVerified }));
  };

  const resolveVerificationEmail = (scope) => {
    if (scope === 'professional') {
      return normalizeEmail(personalEmailB || professionalProfile?.emailB || '');
    }
    if (scope === 'fsbo') {
      return normalizeEmail(personalEmail || personalProfile?.email || '');
    }
    return normalizeEmail(personalEmail || professionalProfile?.emailA || personalProfile?.email || '');
  };

  const getAuthEmailSnapshot = (sessionLike = authSession) => normalizeEmail(sessionLike?.email || '');

  const canAutoConfirmProfileEmail = (profileEmail, sessionLike = authSession) => {
    const authEmail = getAuthEmailSnapshot(sessionLike);
    return Boolean(profileEmail && authEmail && profileEmail === authEmail && sessionLike?.emailVerified === true);
  };

  const setEmailChannelRecord = ({ scope, email, status = 'sent', sentAt = null, confirmedAt = null }) => {
    const current = getVerificationRecord(scope) || {};
    const now = Date.now();
    const fallbackSentAt = current?.channels?.email?.sentAt || now;
    const nextRecord = {
      ...current,
      scope,
      verified: status === 'confirmed',
      verifiedAt: status === 'confirmed' ? (confirmedAt || now) : null,
      optedInAt: current?.optedInAt || now,
      channels: {
        email: {
          ...(current?.channels?.email || {}),
          key: 'email',
          label: 'Email',
          target: email,
          status,
          sentAt: sentAt || fallbackSentAt,
          confirmedAt: status === 'confirmed' ? (confirmedAt || now) : null,
        },
      },
    };
    setVerificationRecord(scope, nextRecord);
  };

  const activeVerificationScope = accountType === 'professional'
    ? ((activeProfessional || activeOperation) ? 'professional' : 'personal')
    : 'fsbo';
  const activeVerificationRecord = getVerificationRecord(activeVerificationScope);
  const isActiveScopeVerified = activeVerificationRecord?.verified === true;

  const openVerificationFlow = () => {
    setVerificationModal({ open: true, scope: activeVerificationScope, error: '', info: '' });
  };

  const closeVerificationFlow = () => {
    setVerificationModal({ open: false, scope: activeVerificationScope, error: '', info: '' });
  };

  const startVerificationFlow = async () => {
    const scope = verificationModal.scope;
    const profileEmail = resolveVerificationEmail(scope);
    if (!profileEmail) {
      setVerificationModal((prev) => ({ ...prev, error: t.verificationNeedProfileEmailStart || 'Fill in the profile email in onboarding to start verification.', info: '' }));
      return false;
    }

    const authEmail = getAuthEmailSnapshot();
    if (!authEmail) {
      setVerificationModal((prev) => ({ ...prev, error: t.verificationNeedLogin || 'Sign in to verify this profile using your account email.', info: '' }));
      return false;
    }

    if (profileEmail !== authEmail) {
      setVerificationModal((prev) => ({
        ...prev,
        error: t.verificationEmailMustMatch || 'In simple mode, the profile email must match the signed-in account email.',
        info: '',
      }));
      return false;
    }

    if (canAutoConfirmProfileEmail(profileEmail, authSession)) {
      setEmailChannelRecord({ scope, email: profileEmail, status: 'confirmed' });
      setVerificationModal((prev) => ({ ...prev, error: '', info: t.verificationAlreadyConfirmedInfo || 'Account email already confirmed. Profile verification completed and badge unlocked.' }));
      setPublishToast(t.verificationToastSuccess || 'Profile verified successfully. Verified badge applied.');
      setTimeout(() => setPublishToast(''), 2600);
      return true;
    }

    if (typeof onResendVerificationEmail === 'function') {
      const result = await onResendVerificationEmail({ email: authEmail, scopeLabel: getVerificationScopeLabel(scope) });
      if (!result?.ok) {
        setVerificationModal((prev) => ({ ...prev, error: String(result?.message || t.verificationSendError || 'Unable to send confirmation email right now.'), info: '' }));
        return false;
      }
    }

    setEmailChannelRecord({ scope, email: profileEmail, status: 'sent' });
    setVerificationModal((prev) => ({
      ...prev,
      error: '',
      info: t.verificationSentInfo || 'We sent a confirmation to your account email. Confirm in your inbox and then click Update profile status.',
    }));
    return true;
  };

  const continueWithParallelVerification = () => {
    const isVerified = verificationModalRecord?.verified === true;
    const canUseEmailFlow = Boolean(verificationModalEmail && verificationEmailMatchesAccount);

    closeVerificationFlow();

    if (isVerified) {
      setPublishToast(t.verificationParallelAlreadyVerified || 'Registration kept. This profile is already verified.');
      setTimeout(() => setPublishToast(''), 2600);
      return;
    }

    if (!canUseEmailFlow) {
      setPublishToast(t.verificationParallelMismatchedEmail || 'Registration continues normally with different emails. Verification remains pending until profile and account emails match.');
      setTimeout(() => setPublishToast(''), 3200);
      return;
    }

    if (verificationEmailStatus === 'sent') {
      setPublishToast(t.verificationParallelSent || 'Registration continues normally. Verification proceeds in parallel and will be completed after account email confirmation.');
      setTimeout(() => setPublishToast(''), 3000);
      return;
    }

    setPublishToast(t.verificationParallelNotStarted || 'Registration continues normally. Start profile verification anytime using your signed-in account email.');
    setTimeout(() => setPublishToast(''), 2600);
  };

  const syncVerificationStatus = async () => {
    const scope = verificationModal.scope;
    const profileEmail = resolveVerificationEmail(scope);
    if (!profileEmail) {
      setVerificationModal((prev) => ({ ...prev, error: t.verificationNeedProfileEmailValidate || 'Fill in the profile email in onboarding to validate.', info: '' }));
      return;
    }

    let sessionSnapshot = authSession;
    if (typeof onRefreshAuthSession === 'function') {
      const refreshed = await onRefreshAuthSession();
      if (refreshed?.session) sessionSnapshot = refreshed.session;
    }

    if (canAutoConfirmProfileEmail(profileEmail, sessionSnapshot)) {
      setEmailChannelRecord({ scope, email: profileEmail, status: 'confirmed' });
      setVerificationModal((prev) => ({ ...prev, error: '', info: t.verificationConfirmedInfo || 'Email confirmed. Profile verification completed and badge unlocked.' }));
      setPublishToast(t.verificationToastSuccess || 'Profile verified successfully. Verified badge applied.');
      setTimeout(() => setPublishToast(''), 2600);
      return;
    }

    setVerificationModal((prev) => ({
      ...prev,
      error: t.verificationNotDetectedYet || 'We still have not detected account email confirmation. Open your inbox and confirm to finish profile verification.',
      info: '',
    }));
  };

  const verificationModalRecord = verificationModal.open ? getVerificationRecord(verificationModal.scope) : null;
  const verificationModalEmail = verificationModal.open ? resolveVerificationEmail(verificationModal.scope) : '';
  const verificationEmailChannel = verificationModalRecord?.channels?.email || null;
  const verificationEmailStatus = verificationEmailChannel?.status || 'draft';
  const verificationAuthEmail = getAuthEmailSnapshot();
  const verificationEmailMatchesAccount = Boolean(verificationModalEmail && verificationAuthEmail && verificationModalEmail === verificationAuthEmail);
  const verificationAccountEmailConfirmed = authSession?.emailVerified === true;

  const headerThumbSrc = accountType === 'professional'
    ? ((activePersonal || activeSkills) ? profileThumb : profileThumbB)
    : profileThumb;
  const handleHeaderThumbRemove = accountType === 'professional'
    ? ((activePersonal || activeSkills) ? removeProfileThumb : removeProfileThumbB)
    : removeProfileThumb;

  return (
    <div style={{ height: isMobileViewport ? 'auto' : 'calc(var(--app-vh, 1vh) * 100)', minHeight: isMobileViewport ? 'calc(var(--app-vh, 1vh) * 100)' : 0, padding: '66px 12px 4px', boxSizing: 'border-box', overflowX: 'hidden', overflowY: isMobileViewport ? 'auto' : 'hidden', WebkitOverflowScrolling: 'touch', position: 'relative', zIndex: 10 }}>
      <style>{`
        @keyframes blink-deal {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.25; transform: scale(0.88); }
        }
        .deal-blink { animation: blink-deal 0.9s ease-in-out infinite; }
        .onb-shell { width: 100%; max-width: 1690px; height: 699px; min-height: 699px; max-height: 699px; box-sizing: border-box; display: flex; flex-direction: column; position: relative; z-index: 10; margin: 0 auto; }
          .onb-head { display:flex; align-items:center; justify-content:center; gap:6px; width: 100%; margin:0 auto 4px; }
          .onb-head > div { width: 100%; text-align: center; }
            .onb-grid {
            flex: 1;
            min-height: 0;
            display: grid;
              grid-template-columns: minmax(260px, 1fr) minmax(480px, 1.875fr) minmax(260px, 1fr);
            gap: 8px;
            width: 100%;
            margin: 0 auto;
              overflow: hidden;
              justify-content: stretch;
            align-items: stretch; /* stretch columns to same height so footers align */
            padding-right: 0;
            box-sizing: border-box;
          }
          .onb-col { display: grid; gap: 6px; min-height: 0; min-width: 0; padding: 0; }
            .onb-col-left { width: 100%; min-width: 0; max-width: none; height: 600px; max-height: 600px; overflow: hidden; grid-template-rows: auto minmax(0, 1fr); padding-top: 0; padding-bottom: 0; }
          /* Make the middle column behave like the left FSBO column: keep sections compact
            and avoid excessive vertical length so the footer isn't cut off. */
            .onb-col-mid { width: 100%; min-width: 0; max-width: none; height: 600px; max-height: 600px; overflow: hidden; padding: 0; grid-template-rows: auto minmax(0, 1fr); min-height: 600px; }
            .onb-col-mid > section { width: 100%; min-width: 0; max-width: none; height: 600px; max-height: 600px; overflow: hidden; padding: 8px; box-sizing: border-box; }
          .onb-col-right { width: 100%; min-width: 0; max-width: none; height: 600px; min-height: 600px; max-height: 600px; overflow: hidden; grid-template-rows: auto 1fr; }
        .onb-col > section { min-height: 0; display: flex; flex-direction: column; }
        .onb-scroll-chips { max-height: 84px; overflow-y: auto; padding-right: 4px; }
        .onb-scroll-list { max-height: 170px; overflow-y: auto; padding-right: 4px; grid-auto-rows: minmax(28px, auto); grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }

        /* Prevent children from overflowing their column/container */
        .onb-col { box-sizing: border-box; min-width: 0; }
        .onb-col * { box-sizing: border-box; max-width: 100%; }
        .onb-col input, .onb-col textarea, .onb-col select, .onb-col button { max-width: 100%; }
        .onb-col-mid { min-width: 0; }
        .onb-col-left > section > div:first-child { padding-top: 0; padding-bottom: 0; }
        .onb-col-left > section > div:last-child { padding-top: 0; padding-bottom: 0; }

        /* Removed visual scaling to ensure requested fixed visual height (655px) */

        /* Normalize details/summary inside onboarding and provide select-like multi-select appearance */
        details { display: block; }
        details.summary-reset summary { list-style: none; }
        details summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 6px 8px; color: var(--t2); font-size: 11px; font-weight: 600; }
        details summary::-webkit-details-marker { display: none; }
        details > *:not(summary) { margin-top: 6px; }

        /* .onb-multiselect: make the closed summary look like a native select with fixed height */
        .onb-multiselect { position: relative; overflow: visible; }
        .onb-multiselect summary { height: 33px; min-height: 33px; align-items: center; padding: 0 9px; font-size: 12px; font-weight: 400; background: var(--card); border-radius: 8px; display:flex; justify-content: space-between; }
        .onb-multiselect summary > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .onb-multiselect summary svg { width: 14px; height: 14px; color: var(--t3); transition: transform .18s ease, color .18s ease; display:inline-block; margin-left:8px; flex-shrink:0; }
        .onb-multiselect[open] summary svg { transform: rotate(180deg); color: var(--t2); }
        .onb-multiselect .onb-scroll-list {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          margin-top: 0;
          max-height: 220px;
          overflow: auto;
          padding: 8px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--card);
          box-shadow: 0 12px 30px rgb(0 0 0 / 0.12);
          z-index: 60;
        }

        .onb-thumb-inline-action {
          position: relative;
          width: 42px;
          height: 42px;
          border-radius: 999px;
          overflow: visible;
        }
        .onb-thumb-inline-remove {
          position: absolute;
          right: -4px;
          top: -4px;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--card);
          color: var(--t2);
          font-size: 12px;
          line-height: 1;
          font-weight: 800;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transform: scale(0.9);
          pointer-events: none;
          transition: opacity .16s ease, transform .16s ease;
        }
        .onb-thumb-inline-action:hover .onb-thumb-inline-remove,
        .onb-thumb-inline-action:focus-within .onb-thumb-inline-remove {
          opacity: 1;
          transform: scale(1);
          pointer-events: auto;
        }
        .onb-account-btn {
          transition: box-shadow .22s ease, transform .18s ease, border-color .2s ease, background-color .2s ease, color .2s ease;
        }
        .onb-account-btn:hover {
          box-shadow: 0 0 0 1px rgba(61, 211, 255, 0.35), 0 0 14px rgba(61, 211, 255, 0.24);
        }
        .onb-account-btn.is-active {
          box-shadow: 0 0 0 1px rgba(61, 211, 255, 0.55), 0 0 18px rgba(61, 211, 255, 0.36), inset 0 0 12px rgba(61, 211, 255, 0.18);
          text-shadow: 0 0 10px rgba(61, 211, 255, 0.45);
          transform: translateY(-1px);
        }
        @keyframes onbSaveProfilesBlink {
          0% {
            filter: brightness(1) saturate(1);
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(53, 202, 201, 0);
          }
          28% {
            filter: brightness(1.38) saturate(1.35);
            transform: scale(1.015);
            box-shadow:
              0 0 0 2px rgba(53, 202, 201, 0.62),
              0 0 20px rgba(53, 202, 201, 0.72),
              0 0 34px rgba(53, 202, 201, 0.36);
          }
          52% {
            filter: brightness(0.82) saturate(0.94);
            transform: scale(0.995);
            box-shadow:
              0 0 0 1px rgba(8, 18, 24, 0.35),
              0 0 10px rgba(8, 18, 24, 0.28);
          }
          76% {
            filter: brightness(1.42) saturate(1.42);
            transform: scale(1.02);
            box-shadow:
              0 0 0 3px rgba(53, 202, 201, 0.68),
              0 0 28px rgba(53, 202, 201, 0.78),
              0 0 44px rgba(53, 202, 201, 0.42);
          }
          100% {
            filter: brightness(1) saturate(1);
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(53, 202, 201, 0);
          }
        }
        .onb-save-profiles,
        .onb-preview-feed {
          transition: box-shadow .2s ease, transform .2s ease, filter .2s ease;
        }
        .onb-save-profiles.is-dirty,
        .onb-preview-feed.is-dirty {
          animation: onbSaveProfilesBlink 0.72s cubic-bezier(0.22, 0.61, 0.36, 1) infinite;
          will-change: filter, box-shadow, transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .onb-save-profiles.is-dirty,
          .onb-preview-feed.is-dirty {
            animation-duration: 1.2s;
          }
        }
        .onb-preview-showcase-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          scroll-behavior: auto;
          contain: layout paint;
        }
        .onb-preview-showcase-scroll::-webkit-scrollbar {
          display: none;
        }
        @media (hover: none), (pointer: coarse) {
          .onb-thumb-inline-remove { opacity: 1; transform: scale(1); pointer-events: auto; }
        }

        @media (max-width: 1024px) {
          .onb-shell {
            height: auto;
            min-height: 0;
            max-height: none;
          }
          .onb-head {
            margin-bottom: 8px;
          }
          .onb-grid {
            grid-template-columns: 1fr;
            gap: 10px;
            overflow: visible;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
            padding: 0 2px 8px;
          }
          .onb-col,
          .onb-col-left,
          .onb-col-mid,
          .onb-col-right,
          .onb-col-mid > section,
          .onb-col-left > section,
          .onb-col-right > section {
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            grid-template-rows: auto !important;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
          }
          .onb-mobile-single-grid {
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)) !important;
          }
          .onb-account-grid {
            grid-template-columns: 1fr 1fr !important;
          }
          .onb-mobile-single-grid > * {
            min-width: 0;
          }
          .onb-col > section {
            margin-bottom: 10px;
          }
          .onb-col > section:last-child {
            margin-bottom: 0;
          }
          .onb-scroll-list {
            max-height: 220px;
          }
        }

        @media (min-width: 1200px) {
          .onb-grid { grid-template-columns: minmax(260px, 1fr) minmax(480px, 1.875fr) minmax(260px, 1fr); overflow: hidden; justify-content: stretch; align-items: stretch; padding-right: 0; box-sizing: border-box; }
          .onb-col-left { grid-template-rows: auto minmax(0, 1fr); min-height: 600px; height: 600px; max-height: 600px; padding-top: 0; padding-bottom: 0; }
          .onb-col-left > section:last-child { min-height: 0; height: 100%; }
          .onb-col-mid { width: 100%; min-width: 0; max-width: none; height: 600px; max-height: 600px; overflow: hidden; padding: 0; grid-template-rows: auto minmax(0, 1fr); min-height: 600px; }
          .onb-col-mid > section { width: 100%; min-width: 0; max-width: none; height: 600px; max-height: 600px; overflow: hidden; padding: 8px; box-sizing: border-box; }
          .onb-col-right { width: 100%; min-width: 0; max-width: none; height: 600px; min-height: 600px; max-height: 600px; overflow: hidden; grid-template-rows: auto 1fr; }
          .onb-col:not(.onb-col-mid) { overflow: hidden; padding: 0; }
          .onb-col > section { min-height: 0; display: flex; flex-direction: column; }
        }

      `}</style>

      <div className="onb-shell">
        <div className="onb-head">
          <div>
            <h2 style={{ margin: 0, fontSize: 'clamp(17px,2.5vw,22px)', color: C.t1, fontWeight: 800 }}>{t.quickRegistrationTitle}</h2>
          </div>
        </div>

        {publishToast ? (
          <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 9999 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: '10px 14px', borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,0.12)', color: C.t1, fontWeight: 700 }}>
              {publishToast}
            </div>
          </div>
        ) : null}

        {String(inlineValidationHint.message || '').trim() ? (
          <div style={{ position: 'fixed', top: inlineValidationHintPos.top, left: inlineValidationHintPos.left, zIndex: 12000, minWidth: 240, maxWidth: 320, padding: '7px 9px', borderRadius: 8, border: `1px solid ${C.danger}`, background: C.card, color: C.danger, fontSize: 10, lineHeight: 1.25, boxShadow: '0 10px 22px rgba(0,0,0,0.16)', pointerEvents: 'none' }}>
            {inlineValidationHint.message}
          </div>
        ) : null}

        <div className="onb-grid" ref={onboardingGridRef}>
          <div className="onb-col onb-col-left">
            <SectionCard title={t.sectionAccount} subtitle={t.sectionAccountSub}>
              <div className="onb-mobile-single-grid onb-account-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <button className={`onb-account-btn ${accountType === 'professional' ? 'is-active' : ''}`} onClick={() => setAccountType('professional')} style={{ padding: 9, borderRadius: 9, border: `1px solid ${accountType === 'professional' ? C.accent : C.border}`, background: 'transparent', color: accountType === 'professional' ? C.accent : C.t2, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>{t.accountProfessional}</button>
                <button className={`onb-account-btn ${accountType === 'fsbo_owner' ? 'is-active' : ''}`} onClick={() => setAccountType('fsbo_owner')} style={{ padding: 9, borderRadius: 9, border: `1px solid ${accountType === 'fsbo_owner' ? C.accent : C.border}`, background: 'transparent', color: accountType === 'fsbo_owner' ? C.accent : C.t2, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>{t.accountFsboOwner}</button>
              </div>
            </SectionCard>

            <SectionCard
              title={(
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span>{accountType === 'professional' ? t.sectionProfile : t.sectionBasicProfile}</span>
                  <span title={profileSyncVisual.title} aria-label={profileSyncVisual.title} style={{ width: 11, height: 11, borderRadius: '50%', border: `1px solid ${profileSyncVisual.ring}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: profileSyncVisual.dot }} />
                  </span>
                </span>
              )}
              subtitle={accountType === 'professional' ? t.sectionProfileSubProfessional : t.sectionProfileSubBasic}
              grow
              scrollBody={!isMobileViewport}
              headerRight={(
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {headerThumbSrc ? (
                    <div className="onb-thumb-inline-action">
                      <SmartImage src={headerThumbSrc} alt={t.labelProfileThumbnail} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${C.border}` }} />
                      <button type="button" className="onb-thumb-inline-remove" onClick={handleHeaderThumbRemove} aria-label={t.actionRemove}>
                        x
                      </button>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={openVerificationFlow}
                    style={{
                      border: `1px solid ${isActiveScopeVerified ? C.alpha(C.accent, 0.62) : C.border}`,
                      background: isActiveScopeVerified ? C.alpha(C.accent, 0.1) : 'transparent',
                      color: isActiveScopeVerified ? C.accent : C.t2,
                      borderRadius: 999,
                      padding: '5px 10px',
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      whiteSpace: 'nowrap',
                    }}
                    title={isActiveScopeVerified ? (t.verificationStatusVerified || 'Verified profile') : (t.verificationCtaBecome || 'Become a verified user')}
                  >
                    {isActiveScopeVerified ? <Icon name="shieldCheck" size={12} color={C.accent} strokeWidth={2.35} /> : null}
                    {isActiveScopeVerified ? (t.verificationStatusUserVerified || 'Verified user') : (t.verificationCtaBecome || 'Become a verified user')}
                  </button>
                </div>
              )}
            >
              {accountType === 'professional' ? (
                <div style={{ display: 'flex', gap: 4, marginBottom: 10, paddingBottom: 2, borderBottom: `1px solid ${C.border}` }}>
                  <div>
                    <button ref={personalTabRef} onClick={() => { clearInlineValidationHint(); setProfileTab('personal'); }} style={{ padding: '8px 14px 7px', borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, border: `1px solid ${activePersonal ? C.border : 'transparent'}`, borderBottom: activePersonal ? `1px solid ${C.card}` : `1px solid transparent`, background: activePersonal ? C.card : C.alpha(C.t1, 0.04), color: activePersonal ? C.t1 : C.t2, fontWeight: 700, fontSize: 11, cursor: 'pointer', marginBottom: -3, boxShadow: activePersonal ? `inset 0 2px 0 ${C.accent}` : 'none' }}>
                      {t.tabBasic}
                    </button>
                  </div>
                  <div>
                    <button ref={skillsTabRef} onClick={() => { clearInlineValidationHint(); setProfileTab('skills'); }} style={{ padding: '8px 14px 7px', borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, border: `1px solid ${activeSkills ? C.border : 'transparent'}`, borderBottom: activeSkills ? `1px solid ${C.card}` : `1px solid transparent`, background: activeSkills ? C.card : C.alpha(C.t1, 0.04), color: activeSkills ? C.t1 : C.t2, fontWeight: 700, fontSize: 11, cursor: 'pointer', marginBottom: -3, boxShadow: activeSkills ? `inset 0 2px 0 ${C.accent}` : 'none' }}>
                      Skills{requiresSkillsTab ? ' *' : ''}
                    </button>
                  </div>
                  <div>
                    <button ref={businessTabRef} onClick={() => { clearInlineValidationHint(); setProfileTab('professional'); }} style={{ padding: '8px 14px 7px', borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, border: `1px solid ${activeProfessional ? C.border : 'transparent'}`, borderBottom: activeProfessional ? `1px solid ${C.card}` : `1px solid transparent`, background: activeProfessional ? C.card : C.alpha(C.t1, 0.04), color: activeProfessional ? C.t1 : C.t2, fontWeight: 700, fontSize: 11, cursor: 'pointer', marginBottom: -3, boxShadow: activeProfessional ? `inset 0 2px 0 #4280ba` : 'none' }}>
                      Business{requiresProfessionalTab ? ' *' : ''}
                    </button>
                  </div>
                  <div>
                    <button ref={operationTabRef} onClick={() => { clearInlineValidationHint(); setProfileTab('operation'); }} style={{ padding: '8px 14px 7px', borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, border: `1px solid ${activeOperation ? C.border : 'transparent'}`, borderBottom: activeOperation ? `1px solid ${C.card}` : `1px solid transparent`, background: activeOperation ? C.card : C.alpha(C.t1, 0.04), color: activeOperation ? C.t1 : C.t2, fontWeight: 700, fontSize: 11, cursor: 'pointer', marginBottom: -3, boxShadow: activeOperation ? `inset 0 2px 0 #4280ba` : 'none' }}>
                      Operations{requiresOperationsTab ? ' *' : ''}
                    </button>
                  </div>
                </div>
              ) : null}

              {showInvestmentProfileAction ? (
                <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 10, border: `1px solid ${requiresInvestmentProfile && !investmentProfileRequiredComplete ? C.warning : C.border}`, background: requiresInvestmentProfile && !investmentProfileRequiredComplete ? C.alpha(C.warning, 0.1) : C.alpha(C.accent, 0.08), display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: C.t1 }}>{t.investmentProfileTitle || 'Investor Profile'}</div>
                    <div style={{ fontSize: 10, color: C.t3 }}>
                      {(t.investmentProfileStrength || 'Profile strength')}: <strong style={{ color: investmentProfileStrength >= 70 ? C.accent : C.warning }}>{investmentProfileStrength}%</strong>
                      {requiresInvestmentProfile && !investmentProfileRequiredComplete ? ` · ${t.investmentProfileRequiredHint || 'Required for selected categories'}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openInvestmentProfileModal(1)}
                    style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {investmentProfileStrength > 0 ? (t.investmentProfileEdit || 'Edit') : (t.investmentProfileStart || 'Start')}
                  </button>
                </div>
              ) : null}

              {(accountType !== 'professional' || activePersonal) ? (
              <>
              <div className="onb-mobile-single-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, marginBottom: 8 }}>
                <label ref={profileAFieldsRef} style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase' }}>{t.labelFullName} <span style={{ color: C.danger }}>*</span></span>
                  <input data-mobile-step="profileAName" value={name} onChange={(e) => setName(e.target.value)} required placeholder={t.placeholderFullName} style={{ width: '100%', padding: '9px 10px', borderRadius: 9, border: `1px solid ${showValidationBorders && missingProfileAFullName ? C.danger : C.border}`, background: C.card, color: C.t1, boxSizing: 'border-box', fontSize: 12 }} />
                </label>
                <label style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase' }}>{t.labelLocationState}</span>
                  <select value={loc} onChange={(e) => setLoc(e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.card, color: C.t1, boxSizing: 'border-box', fontSize: 12 }}>
                    <option value="">{t.placeholderSelectState}</option>
                    {US_STATES.map((state) => <option key={state.code} value={state.code}>{state.name} ({state.code})</option>)}
                  </select>
                </label>
              </div>

              <div data-mobile-step="profileAEmailOrPhone" className="onb-mobile-single-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, marginBottom: 8 }}>
                <label style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase' }}>{t.labelPriorityPhone} <span style={{ color: C.danger }}>*</span></span>
                  <input data-mobile-step="profileAPhone" value={personalPrimaryPhone} onChange={(e) => setPersonalPrimaryPhone(e.target.value)} required placeholder={t.placeholderPhoneExample} style={{ width: '100%', padding: '9px 10px', borderRadius: 9, border: `1px solid ${showValidationBorders && missingProfileAPhone ? C.danger : C.border}`, background: C.card, color: C.t1, boxSizing: 'border-box', fontSize: 12 }} />
                </label>
                <label style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase' }}>{t.labelEmail} <span style={{ color: C.danger }}>*</span></span>
                  <input data-mobile-step="profileAEmail" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} required placeholder={t.placeholderEmailExample} style={{ width: '100%', padding: '9px 10px', borderRadius: 9, border: `1px solid ${showValidationBorders && missingProfileAEmail ? C.danger : C.border}`, background: C.card, color: C.t1, boxSizing: 'border-box', fontSize: 12 }} />
                </label>
              </div>

              <div className="onb-mobile-single-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, marginBottom: 8 }}>
                <label style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase' }}>{t.labelSecondaryPhone}</span>
                  <input value={personalSecondaryPhone} onChange={(e) => setPersonalSecondaryPhone(e.target.value)} placeholder={t.placeholderPhoneExample} style={{ width: '100%', padding: '9px 10px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.card, color: C.t1, boxSizing: 'border-box', fontSize: 12 }} />
                </label>
                <label style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase' }}>Dashboard Card Priority</span>
                  <select value={accountType === 'fsbo_owner' ? cardPriorityC : cardPriorityA} onChange={(e) => {
                    clearInlineValidationHint();
                    const next = e.target.value;
                    const profileKey = accountType === 'fsbo_owner' ? 'C' : 'A';
                    applyCardPriorityChange(profileKey, next);
                  }} style={{ width: '100%', padding: '9px 10px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.card, color: C.t1, boxSizing: 'border-box', fontSize: 12 }}>
                    <option value="" >Select</option>
                    {CARD_PRIORITY_OPTIONS.map((opt) => (
                      <option key={`prio-a-${opt.value}`} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: C.t3, marginBottom: 4, textTransform: 'uppercase' }}>{t.labelBusinessContactOptions} <span style={{ color: C.danger }}>*</span></div>
                <div data-mobile-step="profileAContact" className="onb-scroll-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, border: showValidationBorders && missingProfileAContactMethods ? `1px solid ${C.danger}` : 'none', borderRadius: 9, padding: showValidationBorders && missingProfileAContactMethods ? 6 : 0 }}>
                  {CONTACT_METHOD_PRESETS.map((method) => (
                    <Chip key={method} active={contactMethods.includes(method)} onClick={() => toggleMulti(setContactMethods, method)}>{method}</Chip>
                  ))}
                </div>
                {showValidationBorders && missingProfileAContactMethods ? <div style={{ marginTop: 4, fontSize: 10, color: C.danger }}>{t.errorSelectContactOption}</div> : null}
              </div>

              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase' }}>{t.labelProfileThumbnail}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="file" accept="image/*" onChange={handleProfileThumb} style={{ fontSize: 11 }} />
                  <button type="button" onClick={clearProfileAFields} title={t.clearProfile || 'Limpar perfil'} style={{ padding: '6px 8px', borderRadius: 8, border: `1px solid ${C.danger}`, background: 'transparent', color: C.danger, cursor: 'pointer', fontSize: 11 }}>
                    {t.clear || 'Limpar'}
                  </button>
                </div>
              </label>
              {/* profile thumbnail applied text removed per UI request */}
              </>
              ) : null}

              {accountType === 'professional' && activeSkills ? (
              <>
                <div className="onb-mobile-single-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.t3, marginBottom: 4, textTransform: 'uppercase' }}>{t.labelCategoriesMultiple}</div>
                    <details data-mobile-step="skillsCategories" className="onb-multiselect" style={{ border: `1px solid ${showValidationBorders && missingSkillsCategories ? C.danger : C.border}`, borderRadius: 9, padding: '4px 6px', background: C.card }}>
                      <summary style={{ cursor: 'pointer', color: C.t2, fontSize: 12, height: 33, alignItems: 'center', padding: '0 9px', background: C.card, borderRadius: 8 }}>
                        <span style={{ display:'inline-block', flex:1, paddingLeft:2, fontWeight: selectedCategories.length ? 700 : 400 }}>{selectedCategories.length ? `${selectedCategories.length} ${t.suffixSelected}` : t.placeholderSelectCategories}</span>
                        <Icon name="chevDown" size={14} color={selectedCategories.length ? C.t1 : C.t3} strokeWidth={selectedCategories.length ? 2 : 1.5} />
                      </summary>
                      <div className="onb-scroll-list" style={{ display: 'grid', gap: 6, alignItems: 'start' }}>
                        {allProfiles.map((p) => (
                          <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minHeight: 28, padding: '4px 6px' }}>
                            <input type="checkbox" style={{ marginRight: 8 }} checked={selectedCategories.includes(p.id)} onChange={() => toggleCategory(p.id)} />
                            <span style={{ color: C.t2, fontSize: 11, lineHeight: '1.2' }}>{p.label}</span>
                          </label>
                        ))}
                      </div>
                    </details>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, color: C.t3, marginBottom: 4, textTransform: 'uppercase' }}>{t.labelMarketsStates}</div>
                    <details data-mobile-step="skillsMarkets" className="onb-multiselect" style={{ border: `1px solid ${showValidationBorders && missingSkillsMarkets ? C.danger : C.border}`, borderRadius: 9, padding: '4px 6px', background: C.card }}>
                      <summary style={{ cursor: 'pointer', color: C.t2, fontSize: 12, height: 33, alignItems: 'center', padding: '0 9px', background: C.card, borderRadius: 8 }}>
                        <span style={{ display:'inline-block', flex:1, paddingLeft:2, fontWeight: selectedMarkets.length ? 700 : 400 }}>{selectedMarkets.length ? `${selectedMarkets.length} ${t.suffixStatesSelected}` : t.placeholderSelectStates}</span>
                        <Icon name="chevDown" size={14} color={selectedMarkets.length ? C.t1 : C.t3} strokeWidth={selectedMarkets.length ? 2 : 1.5} />
                      </summary>
                      <div className="onb-scroll-list" style={{ display: 'grid', gap: 6, alignItems: 'start' }}>
                        {US_STATES.map((state) => (
                          <label key={state.code} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minHeight: 28, padding: '4px 6px' }}>
                            <input type="checkbox" style={{ marginRight: 8 }} checked={selectedMarkets.includes(state.code)} onChange={() => toggleMulti(setSelectedMarkets, state.code)} />
                            <span style={{ color: C.t2, fontSize: 11, lineHeight: '1.2' }}>{state.name} ({state.code})</span>
                          </label>
                        ))}
                      </div>
                    </details>
                  </div>
                </div>

                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: C.t3, marginBottom: 4, textTransform: 'uppercase' }}>{t.labelPrimaryCategory}</div>
                  <div className="onb-mobile-single-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
                    <select
                      data-mobile-step="skillsPrimaryCategory"
                      value={primaryCategory}
                      onChange={(e) => setPrimaryCategory(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 9, border: `1px solid ${showValidationBorders && missingSkillsPrimaryCategory ? C.danger : C.border}`, background: C.card, color: C.t1, fontSize: 11 }}
                    >
                      <option value="" >Select</option>
                      {selectedCategories.map((catId) => {
                        const cat = allProfiles.find((p) => p.id === catId);
                        return <option key={catId} value={catId}>{cat?.label || catId}</option>;
                      })}
                    </select>
                    <select value={goal} onChange={(e) => setGoal(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.card, color: C.t1, fontSize: 11 }}>
                      <option value="" >Select</option>
                      <option value="Sell">Sell</option>
                      <option value="Rent">Rent</option>
                      <option value="Partner JV">Partner JV</option>
                      <option value="Seller Financing">Seller Financing</option>
                      <option value="BRRRR">BRRRR</option>
                      <option value="SUB-TO">SUB-TO</option>
                      <option value="New Construction">New Construction</option>
                      <option value="Develop">Develop</option>
                      <option value="Commercial Point">Commercial Point</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: C.t3, marginBottom: 4, textTransform: 'uppercase' }}>{t.labelSkills}</div>
                  <div className="onb-scroll-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {SKILL_PRESETS.map((s) => <Chip key={s} active={selectedSkills.includes(s)} onClick={() => toggleMulti(setSelectedSkills, s)}>{s}</Chip>)}
                  </div>
                </div>
              </>
              ) : null}

              {accountType === 'professional' && activeOperation ? (
              <>
                <div className="onb-mobile-single-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.t3, marginBottom: 4, textTransform: 'uppercase' }}>{t.labelCategoriesMultiple}</div>
                    <details data-mobile-step="opsCategories" className="onb-multiselect" style={{ border: `1px solid ${showValidationBorders && missingOpsCategories ? C.danger : C.border}`, borderRadius: 9, padding: '4px 6px', background: C.card }}>
                      <summary style={{ cursor: 'pointer', color: C.t2, fontSize: 12, height: 33, alignItems: 'center', padding: '0 9px', background: C.card, borderRadius: 8 }}>
                        <span style={{ display:'inline-block', flex:1, paddingLeft:2, fontWeight: selectedCategoriesB.length ? 700 : 400 }}>{selectedCategoriesB.length ? `${selectedCategoriesB.length} ${t.suffixSelected}` : t.placeholderSelectCategories}</span>
                        <Icon name="chevDown" size={14} color={selectedCategoriesB.length ? C.t1 : C.t3} strokeWidth={selectedCategoriesB.length ? 2 : 1.5} />
                      </summary>
                      <div className="onb-scroll-list" style={{ display: 'grid', gap: 6, alignItems: 'start' }}>
                        {allProfiles.map((p) => (
                          <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minHeight: 28, padding: '4px 6px' }}>
                            <input type="checkbox" style={{ marginRight: 8 }} checked={selectedCategoriesB.includes(p.id)} onChange={() => toggleCategoryB(p.id)} />
                            <span style={{ color: C.t2, fontSize: 11, lineHeight: '1.2' }}>{p.label}</span>
                          </label>
                        ))}
                      </div>
                    </details>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, color: C.t3, marginBottom: 4, textTransform: 'uppercase' }}>{t.labelMarketsStates}</div>
                    <details data-mobile-step="opsMarkets" className="onb-multiselect" style={{ border: `1px solid ${showValidationBorders && missingOpsMarkets ? C.danger : C.border}`, borderRadius: 9, padding: '4px 6px', background: C.card }}>
                      <summary style={{ cursor: 'pointer', color: C.t2, fontSize: 12, height: 33, alignItems: 'center', padding: '0 9px', background: C.card, borderRadius: 8 }}>
                        <span style={{ display:'inline-block', flex:1, paddingLeft:2, fontWeight: selectedMarketsB.length ? 700 : 400 }}>{selectedMarketsB.length ? `${selectedMarketsB.length} ${t.suffixStatesSelected}` : t.placeholderSelectStates}</span>
                        <Icon name="chevDown" size={14} color={selectedMarketsB.length ? C.t1 : C.t3} strokeWidth={selectedMarketsB.length ? 2 : 1.5} />
                      </summary>
                      <div className="onb-scroll-list" style={{ display: 'grid', gap: 6, alignItems: 'start' }}>
                        {US_STATES.map((state) => (
                          <label key={state.code} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minHeight: 28, padding: '4px 6px' }}>
                            <input type="checkbox" style={{ marginRight: 8 }} checked={selectedMarketsB.includes(state.code)} onChange={() => toggleMulti(setSelectedMarketsB, state.code)} />
                            <span style={{ color: C.t2, fontSize: 11, lineHeight: '1.2' }}>{state.name} ({state.code})</span>
                          </label>
                        ))}
                      </div>
                    </details>
                  </div>
                </div>

                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: C.t3, marginBottom: 4, textTransform: 'uppercase' }}>{t.labelPrimaryCategory}</div>
                  <div className="onb-mobile-single-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
                    <select
                      data-mobile-step="opsPrimaryCategory"
                      value={primaryCategoryB}
                      onChange={(e) => setPrimaryCategoryB(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 9, border: `1px solid ${showValidationBorders && missingOpsPrimaryCategory ? C.danger : C.border}`, background: C.card, color: C.t1, fontSize: 11 }}
                    >
                      <option value="" >Select</option>
                      {selectedCategoriesB.map((catId) => {
                        const cat = allProfiles.find((p) => p.id === catId);
                        return <option key={catId} value={catId}>{cat?.label || catId}</option>;
                      })}
                    </select>
                    <select value={goalB} onChange={(e) => setGoalB(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.card, color: C.t1, fontSize: 11 }}>
                      <option value="" >Select</option>
                      <option value="Sell">Sell</option>
                      <option value="Rent">Rent</option>
                      <option value="Partner JV">Partner JV</option>
                      <option value="Seller Financing">Seller Financing</option>
                      <option value="BRRRR">BRRRR</option>
                      <option value="SUB-TO">SUB-TO</option>
                      <option value="New Construction">New Construction</option>
                      <option value="Develop">Develop</option>
                      <option value="Commercial Point">Commercial Point</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: C.t3, marginBottom: 4, textTransform: 'uppercase' }}>{t.labelSkills}</div>
                  <div className="onb-scroll-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {SKILL_PRESETS.map((s) => <Chip key={s} active={selectedSkillsB.includes(s)} onClick={() => toggleMulti(setSelectedSkillsB, s)}>{s}</Chip>)}
                  </div>
                </div>
              </>
              ) : null}

              {accountType === 'professional' && activeProfessional ? (
              <>
              <div className="onb-mobile-single-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, marginBottom: 8 }}>
                <label style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase' }}>{t.labelFullName} <span style={{ color: C.danger }}>*</span></span>
                  <input data-mobile-step="profileBName" value={nameB} onChange={(e) => setNameB(e.target.value)} required placeholder={t.placeholderFullName} style={{ width: '100%', padding: '9px 10px', borderRadius: 9, border: `1px solid ${showValidationBorders && missingProfileBFullName ? C.danger : C.border}`, background: C.card, color: C.t1, boxSizing: 'border-box', fontSize: 12 }} />
                </label>
                <label style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase' }}>{t.labelLocationState}</span>
                  <select value={locB} onChange={(e) => setLocB(e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.card, color: C.t1, boxSizing: 'border-box', fontSize: 12 }}>
                    <option value="">{t.placeholderSelectState}</option>
                    {US_STATES.map((state) => <option key={state.code} value={state.code}>{state.name} ({state.code})</option>)}
                  </select>
                </label>
              </div>

              <div className="onb-mobile-single-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, marginBottom: 8 }}>
                <label style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase' }}>{t.labelPriorityPhone} <span style={{ color: C.danger }}>*</span></span>
                  <input data-mobile-step="profileBPhone" value={personalPrimaryPhoneB} onChange={(e) => setPersonalPrimaryPhoneB(e.target.value)} required placeholder={t.placeholderPhoneExample} style={{ width: '100%', padding: '9px 10px', borderRadius: 9, border: `1px solid ${showValidationBorders && missingProfileBPhone ? C.danger : C.border}`, background: C.card, color: C.t1, boxSizing: 'border-box', fontSize: 12 }} />
                </label>
                <label style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase' }}>{t.labelEmail} <span style={{ color: C.danger }}>*</span></span>
                  <input data-mobile-step="profileBEmail" value={personalEmailB} onChange={(e) => setPersonalEmailB(e.target.value)} required placeholder={t.placeholderEmailExample} style={{ width: '100%', padding: '9px 10px', borderRadius: 9, border: `1px solid ${showValidationBorders && missingProfileBEmail ? C.danger : C.border}`, background: C.card, color: C.t1, boxSizing: 'border-box', fontSize: 12 }} />
                </label>
              </div>

              <div className="onb-mobile-single-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, marginBottom: 8 }}>
                <label style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase' }}>{t.labelSecondaryPhone}</span>
                  <input value={personalSecondaryPhoneB} onChange={(e) => setPersonalSecondaryPhoneB(e.target.value)} placeholder={t.placeholderPhoneExample} style={{ width: '100%', padding: '9px 10px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.card, color: C.t1, boxSizing: 'border-box', fontSize: 12 }} />
                </label>
                <label style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase' }}>Dashboard Card Priority</span>
                  <select value={cardPriorityB} onChange={(e) => {
                    clearInlineValidationHint();
                    applyCardPriorityChange('B', e.target.value);
                  }} style={{ width: '100%', padding: '9px 10px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.card, color: C.t1, boxSizing: 'border-box', fontSize: 12 }}>
                    <option value="" >Select</option>
                    {CARD_PRIORITY_OPTIONS.map((opt) => (
                      <option key={`prio-b-${opt.value}`} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: C.t3, marginBottom: 4, textTransform: 'uppercase' }}>{t.labelBusinessContactOptions} <span style={{ color: C.danger }}>*</span></div>
                <div data-mobile-step="profileBContact" className="onb-scroll-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, border: showValidationBorders && missingProfileBContactMethods ? `1px solid ${C.danger}` : 'none', borderRadius: 9, padding: showValidationBorders && missingProfileBContactMethods ? 6 : 0 }}>
                  {CONTACT_METHOD_PRESETS.map((method) => (
                    <Chip key={method} active={contactMethodsB.includes(method)} onClick={() => toggleMulti(setContactMethodsB, method)}>{method}</Chip>
                  ))}
                </div>
                {showValidationBorders && missingProfileBContactMethods ? <div style={{ marginTop: 4, fontSize: 10, color: C.danger }}>{t.errorSelectContactOption}</div> : null}
              </div>

              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase' }}>{t.labelProfileThumbnail}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="file" accept="image/*" onChange={handleProfileThumbB} style={{ fontSize: 11 }} />
                  <button type="button" onClick={clearProfileBFields} title={t.clearProfile || 'Limpar perfil'} style={{ padding: '6px 8px', borderRadius: 8, border: `1px solid ${C.danger}`, background: 'transparent', color: C.danger, cursor: 'pointer', fontSize: 11 }}>
                    {t.clear || 'Limpar'}
                  </button>
                </div>
              </label>
              {/* profile thumbnail applied text removed per UI request */}
              </>
              ) : null}

              <div style={{ marginTop: 8 }}>
                <button className={`onb-save-profiles ${isSaveProfilesDirty ? 'is-dirty' : ''}`} onClick={handleSaveProfiles} style={{ width: '100%', padding: '8px 0', background: 'rgb(53,202,201)', border: 'none', borderRadius: 9, color: '#081218', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                  {t.buttonSaveProfiles || 'Save profiles'}
                </button>
              </div>
            </SectionCard>
          </div>

          <div className="onb-col onb-col-mid">
              <SectionCard title={t.sectionPortfolio} subtitle={t.sectionPortfolioSub} grow={true}>
                {/* scrollable form area: tab1 + form + add-preview buttons */}
                <div style={{ flex: isMobileViewport ? '0 0 auto' : 1, minHeight: isMobileViewport ? 'auto' : 0, overflowY: isMobileViewport ? 'visible' : 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', paddingBottom: isMobileViewport ? 8 : 14, paddingRight: isMobileViewport ? 0 : 4 }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 10, paddingBottom: 2, borderBottom: `1px solid ${C.border}` }}>
                  <button onClick={() => setPortfolioEntryType('property')} style={{ padding: '8px 14px 7px', borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, border: `1px solid ${portfolioEntryType === 'property' ? C.border : 'transparent'}`, borderBottom: portfolioEntryType === 'property' ? `1px solid ${C.card}` : `1px solid transparent`, background: portfolioEntryType === 'property' ? C.card : C.alpha(C.t1, 0.04), color: portfolioEntryType === 'property' ? C.t1 : C.t2, fontWeight: 700, fontSize: 11, cursor: 'pointer', marginBottom: -3, boxShadow: portfolioEntryType === 'property' ? `inset 0 2px 0 ${C.accent}` : 'none' }}>
                    {t.tabProperty}
                  </button>
                  <button onClick={() => setPortfolioEntryType('service')} style={{ padding: '8px 14px 7px', borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, border: `1px solid ${portfolioEntryType === 'service' ? C.border : 'transparent'}`, borderBottom: portfolioEntryType === 'service' ? `1px solid ${C.card}` : `1px solid transparent`, background: portfolioEntryType === 'service' ? C.card : C.alpha(C.t1, 0.04), color: portfolioEntryType === 'service' ? C.t1 : C.t2, fontWeight: 700, fontSize: 11, cursor: 'pointer', marginBottom: -3, boxShadow: portfolioEntryType === 'service' ? `inset 0 2px 0 ${C.accent}` : 'none' }}>
                    {t.tabService}
                  </button>
                </div>

                {portfolioEntryType === 'property' ? (
                  <ProfessionalPropertyForm
                    t={t}
                    C={C}
                    isMobileViewport={isMobileViewport}
                    isTabletPortraitViewport={isTabletPortraitViewport}
                    values={portfolioFormValues}
                    onChange={handlePortfolioFieldChange}
                    formatCurrencyInput={formatCurrencyInput}
                    formatRateInput={formatRateInput}
                    renderMarketsSelector={renderMarketsSelector}
                    togglePortfolioMarket={(code) => toggleMulti(setPortfolioMarkets, code)}
                    handlePortfolioImages={handlePortfolioImages}
                    handlePortfolioVideo={handlePortfolioVideo}
                    portfolioFieldLabelStyle={portfolioFieldLabelStyle}
                    portfolioFieldInputStyle={portfolioFieldInputStyle}
                    portfolioFieldSelectStyle={portfolioFieldSelectStyle}
                    portfolioTextareaLabelStyle={portfolioTextareaLabelStyle}
                    portfolioFieldTextareaStyle={portfolioFieldTextareaStyle}
                  />
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobileViewport ? 'repeat(2, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))', gap: 6, marginBottom: 8 }}>
                      <div style={{ position: 'relative', minWidth: 0 }}>
                        <span style={portfolioFieldLabelStyle}>{t.placeholderServiceName.toUpperCase()}</span>
                        <input data-mobile-step="serviceTitle" value={serviceTitle} onChange={(e) => setServiceTitle(e.target.value)} placeholder="" style={portfolioFieldInputStyle({ padding: isMobileViewport ? '8px 10px 8px 92px' : '8px 10px 8px 118px' })} />
                      </div>
                      <select data-mobile-step="serviceCategory" value={serviceCategory} onChange={(e) => setServiceCategory(e.target.value)} style={portfolioFieldSelectStyle({ paddingLeft: 10, paddingRight: 28 })}>
                        <option value="">{t.placeholderServiceCategory}</option>
                        {FEED_TASKBAR_CATEGORY_OPTIONS.map((svc) => <option key={`service-cat-${svc}`} value={svc}>{svc}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobileViewport ? 'repeat(2, minmax(0, 1fr))' : 'minmax(110px, 1fr) minmax(130px, 1fr) minmax(180px, 1.2fr)', gap: 6, marginBottom: 8 }}>
                      <div style={{ position: 'relative', minWidth: 0 }}>
                        <span style={portfolioFieldLabelStyle}>{t.labelUsdPriceShort}</span>
                        <input data-mobile-step="servicePrice" value={servicePrice} onChange={(e) => setServicePrice(formatCurrencyInput(e.target.value))} inputMode="decimal" placeholder="" style={portfolioFieldInputStyle()} />
                      </div>
                      <PrimaryProfileSelect
                        t={t}
                        C={C}
                        value={servicePrimaryProfileScope}
                        onChange={setServicePrimaryProfileScope}
                        labelStyle={portfolioFieldLabelStyle}
                        selectStyle={portfolioFieldSelectStyle}
                        selectStyleOverrides={{ paddingLeft: isMobileViewport ? 102 : 124 }}
                        dataMobileStep="servicePrimaryProfile"
                        required
                      />
                      <div style={{ position: 'relative', minWidth: 0, gridColumn: isMobileViewport ? '1 / -1' : 'auto' }}>
                        {renderMarketsSelector(serviceMarkets, (code) => toggleMulti(setServiceMarkets, code), { showSummary: false, inlineLabel: 'States' })}
                      </div>
                    </div>
                    <div style={{ marginBottom: serviceImages.length > 0 ? 10 : 8 }}>
                      <label style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', width: 'auto', gap: 8 }}>
                        {t.labelImagesOptional}
                        <input type="file" accept="image/*" multiple onChange={handleServiceImages} style={{ display: 'block', marginTop: 4, fontSize: 11 }} />
                      </label>
                    </div>
                    {serviceImages.length > 0 && (
                      <div style={{
                        position: 'relative',
                        zIndex: 1,
                        width: '100%',
                        minHeight: 104,
                        marginTop: 6,
                        marginBottom: 18,
                        display: 'grid',
                        gridAutoFlow: 'column',
                        gridAutoColumns: '120px',
                        gap: 8,
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        padding: '8px 0 14px',
                        boxSizing: 'border-box',
                        clear: 'both',
                      }}>
                        {serviceImages.map((src, idx) => (
                          <div key={`service-upload-preview-${idx}`} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: C.alpha(C.t1, 0.02), border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 120, height: 72, flex: '0 0 120px' }}>
                            <SmartImage src={src} alt={`service-img-${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            <div style={{ position: 'absolute', right: 6, top: 6, display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (idx <= 0) return;
                                  setServiceImages((prev) => prev.map((_, i, arr) => {
                                    if (i === idx - 1) return arr[idx];
                                    if (i === idx) return arr[idx - 1];
                                    return arr[i];
                                  }));
                                }}
                                title={t.moveUp}
                                style={{ background: 'rgba(0,0,0,0.35)', border: 'none', color: '#fff', borderRadius: 6, width: 26, height: 26, cursor: idx <= 0 ? 'default' : 'pointer' }}
                              >
                                {'<'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (idx >= serviceImages.length - 1) return;
                                  setServiceImages((prev) => prev.map((_, i, arr) => {
                                    if (i === idx + 1) return arr[idx];
                                    if (i === idx) return arr[idx + 1];
                                    return arr[i];
                                  }));
                                }}
                                title={t.moveDown}
                                style={{ background: 'rgba(0,0,0,0.35)', border: 'none', color: '#fff', borderRadius: 6, width: 26, height: 26, cursor: idx >= serviceImages.length - 1 ? 'default' : 'pointer' }}
                              >
                                {'>'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setServiceImages((prev) => prev.filter((_, i) => i !== idx))}
                                title={t.actionRemove}
                                style={{ background: 'rgba(0,0,0,0.35)', border: 'none', color: '#fff', borderRadius: 6, width: 26, height: 26, cursor: 'pointer' }}
                              >
                                x
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ position: 'relative', minWidth: 0, marginBottom: 8 }}>
                      <span style={portfolioTextareaLabelStyle}>{t.placeholderDescription.toUpperCase()}</span>
                      <textarea value={serviceDescription} onChange={(e) => setServiceDescription(e.target.value)} placeholder="" style={portfolioFieldTextareaStyle()} />
                    </div>
                    <div style={{ fontSize: 10, color: C.t3, marginBottom: 8 }}>{t.serviceImagesSelected.replace('{count}', String(serviceImages.length))}</div>
                  </>
                )}

                <div style={{ display: 'flex', flexDirection: (isTabletViewport || !isMobileViewport) ? 'row' : 'column', gap: 8, alignItems: (isTabletViewport || !isMobileViewport) ? 'center' : 'stretch', marginTop: 8, marginBottom: 12 }}>
                  <button onClick={portfolioEntryType === 'property' ? addProfessionalPortfolioProperty : addProfessionalPortfolioService} style={{ flex: 1, padding: '8px 10px', borderRadius: 9, border: `1px solid ${C.accent}`, background: 'transparent', color: C.accent, fontWeight: 700, cursor: 'pointer', fontSize: 11 }}>
                    + Add to Portfolio
                  </button>
                  <button className={`onb-preview-feed ${isPreviewToFeedDirty ? 'is-dirty' : ''}`} onClick={openPreviewToFeed} style={{ flex: 1, padding: '8px 10px', borderRadius: 9, border: 'none', background: C.accent, color: '#1a1a1a', fontWeight: 700, cursor: 'pointer', fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Icon name="eye" size={13} color="#1a1a1a" />
                    <span>{t.saveAndPreview}</span>
                  </button>
                </div>

                </div>{/* end scrollable form area */}
                <div style={{ display: 'flex', gap: 4, marginTop: isMobileViewport ? 10 : 16, paddingBottom: 2, borderBottom: `1px solid ${C.border}` }}>
                  <button
                    onClick={() => setPortfolioRecordsTab('properties')}
                    style={{
                      padding: '8px 14px 7px',
                      borderTopLeftRadius: 10,
                      borderTopRightRadius: 10,
                      borderBottomLeftRadius: 0,
                      borderBottomRightRadius: 0,
                      border: `1px solid ${portfolioRecordsTab === 'properties' ? C.border : 'transparent'}`,
                      borderBottom: portfolioRecordsTab === 'properties' ? `1px solid ${C.card}` : `1px solid transparent`,
                      background: portfolioRecordsTab === 'properties' ? C.card : C.alpha(C.t1, 0.04),
                      color: portfolioRecordsTab === 'properties' ? C.t1 : C.t2,
                      fontWeight: 700,
                      fontSize: 11,
                      cursor: 'pointer',
                      marginBottom: -3,
                      boxShadow: portfolioRecordsTab === 'properties' ? `inset 0 2px 0 ${C.accent}` : 'none',
                    }}
                  >
                    {t.recordsPropertiesTab}
                  </button>
                  <button
                    onClick={() => setPortfolioRecordsTab('services')}
                    style={{
                      padding: '8px 14px 7px',
                      borderTopLeftRadius: 10,
                      borderTopRightRadius: 10,
                      borderBottomLeftRadius: 0,
                      borderBottomRightRadius: 0,
                      border: `1px solid ${portfolioRecordsTab === 'services' ? C.border : 'transparent'}`,
                      borderBottom: portfolioRecordsTab === 'services' ? `1px solid ${C.card}` : `1px solid transparent`,
                      background: portfolioRecordsTab === 'services' ? C.card : C.alpha(C.t1, 0.04),
                      color: portfolioRecordsTab === 'services' ? C.t1 : C.t2,
                      fontWeight: 700,
                      fontSize: 11,
                      cursor: 'pointer',
                      marginBottom: -3,
                      boxShadow: portfolioRecordsTab === 'services' ? `inset 0 2px 0 ${C.accent}` : 'none',
                    }}
                  >
                    {t.recordsServicesTab}
                  </button>
                </div>

                <div className="onb-scroll-list" style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, background: C.card, marginTop: 8, flex: isMobileViewport ? '1 1 auto' : '0 0 130px', height: isMobileViewport ? 'auto' : '130px', minHeight: isMobileViewport ? 0 : '130px', maxHeight: isMobileViewport ? 'none' : '130px', overflowY: 'auto', overflowX: 'hidden' }}>
                  {portfolioRecordsTab === 'properties' ? (
                    myPortfolio.length === 0 ? (
                      <div style={{ fontSize: 11, color: C.t3 }}>{t.recordsNoProperty}</div>
                    ) : (
                      myPortfolio.slice(0, 5).map((p, i) => (
                        <div
                          key={p.id}
                          draggable
                          onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move'; }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => { const from = Number(e.dataTransfer.getData('text/plain')); if (!Number.isNaN(from)) movePortfolioTo(from, i); }}
                          style={{ borderBottom: i < myPortfolio.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                          <div style={{ display: 'flex', flexWrap: isPhoneViewport ? 'wrap' : 'nowrap', alignItems: 'center', gap: 6, padding: '7px 0', minWidth: 0 }}>
                            <div style={{
                              minWidth: 0,
                              flex: isPhoneViewport ? '1 1 100%' : '0 1 50%',
                              maxWidth: isPhoneViewport ? '100%' : '52%',
                              fontSize: 11,
                              color: C.t1,
                              fontWeight: 700,
                              lineHeight: 1.2,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: (isPhoneViewport && (p.dealClosed || !isTruthyFlag(p.publishToShowcase, true))) ? 'normal' : 'nowrap',
                              display: (isPhoneViewport && (p.dealClosed || !isTruthyFlag(p.publishToShowcase, true))) ? '-webkit-box' : 'block',
                              WebkitLineClamp: (isPhoneViewport && (p.dealClosed || !isTruthyFlag(p.publishToShowcase, true))) ? 2 : 1,
                              WebkitBoxOrient: 'vertical',
                            }}>
                              {p.address} · {p.city} · {formatCompactUsd(p.price || 0)} · {p.images?.length || 0} img
                            </div>
                            <div style={{ display:'flex', alignItems:'center', justifyContent: isPhoneViewport ? 'flex-start' : 'flex-end', gap:6, width: isPhoneViewport ? '100%' : 'auto', flex: isPhoneViewport ? '0 0 100%' : '1 1 0', flexWrap: 'nowrap', marginLeft: isPhoneViewport ? 0 : 'auto', minWidth: 0 }}>
                              {!p.dealClosed ? (
                                <Chip active={isTruthyFlag(p.publishToShowcase, true)} onClick={() => {
                                  togglePropertyShowInShowcase(p.id);
                                }}
                                aria-label={isTruthyFlag(p.publishToShowcase, true) ? t.publishInShowcaseInactive : t.publishInShowcaseActive}
                                aria-pressed={isTruthyFlag(p.publishToShowcase, true)}
                                title={isTruthyFlag(p.publishToShowcase, true) ? t.publishInShowcaseInactive : t.publishInShowcaseActive}
                                style={{
                                  marginRight: isPhoneViewport ? 'auto' : 0,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  background: isTruthyFlag(p.publishToShowcase, true) ? C.alpha(C.danger, 0.08) : C.alpha(C.accent, 0.1),
                                  border: `1px solid ${isTruthyFlag(p.publishToShowcase, true) ? C.danger : C.accent}`,
                                  color: isTruthyFlag(p.publishToShowcase, true) ? C.danger : C.accent,
                                  fontSize: isPhoneViewport ? 9 : 10.5,
                                  padding: isPhoneViewport ? '5px 8px' : '6px 11px',
                                  minWidth: isPhoneViewport ? undefined : 116,
                                }}>
                                  {isTruthyFlag(p.publishToShowcase, true) ? t.publishInShowcaseInactive : t.publishInShowcaseActive}
                                </Chip>
                              ) : null}
                              {!p.dealClosed ? (
                                <button
                                  type="button"
                                  onClick={() => togglePropertyPreviewInclusion(p.id)}
                                  title={t.useInPreview}
                                  aria-label={t.useInPreview}
                                  aria-pressed={isTruthyFlag(p.includeInPreview, false)}
                                  style={{
                                    background: isTruthyFlag(p.includeInPreview, false) ? C.alpha(C.accent, 0.12) : 'none',
                                    border: isTruthyFlag(p.includeInPreview, false) ? `1px solid ${C.alpha(C.accent, 0.65)}` : '1px solid transparent',
                                    borderRadius: 8,
                                    boxShadow: isTruthyFlag(p.includeInPreview, false) ? `0 0 10px ${C.alpha(C.accent, 0.65)}, inset 0 0 6px ${C.alpha(C.accent, 0.28)}` : 'none',
                                    cursor: 'pointer',
                                    padding: '0 6px',
                                    fontSize: 14,
                                    lineHeight: 1,
                                    flexShrink: 0,
                                    transition: 'box-shadow .18s ease, border-color .18s ease, background .18s ease'
                                  }}
                                >
                                  <Icon name="eye" size={14} color={isTruthyFlag(p.includeInPreview, false) ? C.accent : C.t3} />
                                </button>
                              ) : null}
                              {/* â”€â”€ Deal-closed "$" button â”€â”€ */}
                              {renderPropertyPendingDealButton(p)}
                              {(() => {
                                const pressure = getMatchPressure(p.id);
                                const isClosed = !!p.dealClosed;
                                const isActive = pressure > 0 && !isClosed;
                                return (
                                  <button
                                    type="button"
                                    onClick={() => togglePropertyDealClosed(p.id)}
                                    title={isClosed
                                      ? (t.dealClosedReopen || 'Deal closed - click to reopen')
                                      : (t.dealCloseWithPressure || '{pressure}% of users accessed - mark deal as closed').replace('{pressure}', pressure)}
                                    aria-label={isClosed ? (t.dealClosed || 'Deal closed') : (t.closeDeal || 'Close deal')}
                                    className={isActive ? 'deal-blink' : undefined}
                                    style={{
                                      background: isClosed ? 'rgba(39,174,96,0.12)' : isActive ? 'rgba(213,38,20,0.10)' : 'none',
                                      border: isClosed ? '1px solid rgba(39,174,96,0.4)' : isActive ? '1px solid rgba(213,38,20,0.3)' : '1px solid transparent',
                                      borderRadius: 6,
                                      cursor: 'pointer',
                                      padding: '0 5px',
                                      fontSize: 13,
                                      fontWeight: 900,
                                      lineHeight: 1,
                                      flexShrink: 0,
                                      color: isClosed ? '#27ae60' : isActive ? C.danger : C.t3,
                                    }}
                                  >
                                    $
                                  </button>
                                );
                              })()}
                              {!p.dealClosed ? (
                                <button type="button" onClick={() => startEditProperty(p)} title={t.actionEditService} aria-label={t.actionEditService} style={{ background: 'none', border: 'none', cursor: 'pointer', color: editingPropertyId === p.id ? C.accent : C.t3, padding: '0 6px', fontSize: 14, lineHeight: 1, flexShrink: 0 }}>
                                  <Icon name="edit" size={14} color={editingPropertyId === p.id ? C.accent : C.t3} />
                                </button>
                              ) : null}
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <button type="button" onClick={() => setPropertyPortfolio(prev => {
                                  const idx = prev.findIndex(x => x.id === p.id);
                                  if (idx <= 0) return prev;
                                  const next = [...prev]; const tmp = next[idx-1]; next[idx-1] = next[idx]; next[idx] = tmp; return next;
                                })} title={t.moveUp} aria-label={t.moveUp} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px', flexShrink: 0 }}>
                                  <Icon name="chevUp" size={14} color={C.t3} />
                                </button>
                                <button type="button" onClick={() => setPropertyPortfolio(prev => {
                                  const idx = prev.findIndex(x => x.id === p.id);
                                  if (idx === -1 || idx >= prev.length-1) return prev;
                                  const next = [...prev]; const tmp = next[idx+1]; next[idx+1] = next[idx]; next[idx] = tmp; return next;
                                })} title={t.moveDown} aria-label={t.moveDown} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px', flexShrink: 0 }}>
                                  <Icon name="chevDown" size={14} color={C.t3} />
                                </button>
                                <button type="button" onClick={() => requestDeletePortfolioRecord('property', p)} title={t.actionRemove} aria-label={t.actionRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px', flexShrink: 0 }}>
                                  <Icon name="trash" size={14} color={C.danger} />
                                </button>
                              </div>
                            </div>
                          </div>
                          {INLINE_EDIT_ENABLED && editingPropertyId === p.id && (
                            <div style={{ paddingBottom: 8 }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1.6fr) minmax(84px, 0.8fr) minmax(118px, 1.1fr)', gap: 6, paddingBottom: 8, width: '100%', minWidth: 0 }}>
                                                  <div style={{ position: 'relative', minWidth: 0 }}>
                                                    <span style={portfolioFieldLabelStyle}>{t.labelAddrShort}</span>
                                                    <input value={propertyEditDraft.address} onChange={(e) => setPropertyEditDraft(prev => ({ ...prev, address: e.target.value }))} placeholder="" style={portfolioFieldInputStyle()} />
                                                  </div>
                                                  <div style={{ position: 'relative', minWidth: 0 }}>
                                                    <span style={portfolioFieldLabelStyle}>{t.labelCityShort}</span>
                                                    <input value={propertyEditDraft.city} onChange={(e) => setPropertyEditDraft(prev => ({ ...prev, city: e.target.value }))} placeholder="" style={portfolioFieldInputStyle()} />
                                                  </div>
                                                  <div style={{ position: 'relative', minWidth: 0 }}>
                                                    <span style={portfolioFieldLabelStyle}>{t.labelZipShort}</span>
                                                    <input value={propertyEditDraft.zip} onChange={(e) => setPropertyEditDraft(prev => ({ ...prev, zip: e.target.value }))} placeholder="" style={portfolioFieldInputStyle()} />
                                                  </div>
                                                  <div style={{ position: 'relative', minWidth: 0 }}>
                                                    <span style={portfolioFieldLabelStyle}>{t.labelCapShort}</span>
                                                    <input value={propertyEditDraft.capRate || ''} onChange={(e) => setPropertyEditDraft(prev => ({ ...prev, capRate: formatRateInput(e.target.value) }))} inputMode="decimal" maxLength={5} placeholder="" style={portfolioFieldInputStyle()} />
                                                  </div>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 1.2fr) minmax(110px, 1.2fr) minmax(68px, 0.7fr) minmax(68px, 0.7fr)', gap: 6, marginBottom: 8, width: '100%', minWidth: 0 }}>
                                                  <div style={{ position: 'relative', minWidth: 0 }}>
                                                    <span style={portfolioFieldLabelStyle}>{t.labelUsdPriceShort}</span>
                                                    <input value={propertyEditDraft.price} onChange={(e) => setPropertyEditDraft(prev => ({ ...prev, price: formatCurrencyInput(e.target.value) }))} inputMode="decimal" placeholder="" style={portfolioFieldInputStyle()} />
                                                  </div>
                                                  <div style={{ position: 'relative', minWidth: 0 }}>
                                                    <span style={portfolioFieldLabelStyle}>{t.labelUsdRehabShort}</span>
                                                    <input value={propertyEditDraft.rehab || ''} onChange={(e) => setPropertyEditDraft(prev => ({ ...prev, rehab: formatCurrencyInput(e.target.value) }))} inputMode="decimal" placeholder="" style={portfolioFieldInputStyle()} />
                                                  </div>
                                                  <div style={{ position: 'relative', minWidth: 0 }}>
                                                    <span style={portfolioFieldLabelStyle}>{t.labelBedsShort}</span>
                                                    <input value={propertyEditDraft.beds} onChange={(e) => setPropertyEditDraft(prev => ({ ...prev, beds: e.target.value }))} inputMode="numeric" maxLength={2} placeholder="" style={portfolioFieldInputStyle()} />
                                                  </div>
                                                  <div style={{ position: 'relative', minWidth: 0 }}>
                                                    <span style={portfolioFieldLabelStyle}>{t.labelBathsShort}</span>
                                                    <input value={propertyEditDraft.baths} onChange={(e) => setPropertyEditDraft(prev => ({ ...prev, baths: e.target.value }))} inputMode="numeric" maxLength={2} placeholder="" style={portfolioFieldInputStyle()} />
                                                  </div>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(80px, 0.9fr) minmax(110px, 1.1fr) minmax(90px, 1fr)', gap: 6, marginBottom: 8, width: '100%', minWidth: 0 }}>
                                                  <div style={{ position: 'relative', minWidth: 0 }}>
                                                    <span style={portfolioFieldLabelStyle}>{t.labelSqftShort}</span>
                                                    <input value={propertyEditDraft.sqft} onChange={(e) => setPropertyEditDraft(prev => ({ ...prev, sqft: e.target.value }))} inputMode="numeric" maxLength={7} placeholder="" style={portfolioFieldInputStyle()} />
                                                  </div>
                                                  <div style={{ position: 'relative', minWidth: 0 }}>
                                                    <span style={portfolioFieldLabelStyle}>{t.labelImprovementShort || 'IMPROV.'}</span>
                                                    <input value={propertyEditDraft.improvement || ''} onChange={(e) => setPropertyEditDraft(prev => ({ ...prev, improvement: e.target.value }))} placeholder="" style={portfolioFieldInputStyle({ paddingLeft: 64 })} />
                                                  </div>
                                                  <div style={{ position: 'relative', minWidth: 0 }}>
                                                    <span style={portfolioFieldLabelStyle}>{t.labelLotShort}</span>
                                                    <input value={propertyEditDraft.lot} onChange={(e) => setPropertyEditDraft(prev => ({ ...prev, lot: e.target.value }))} placeholder="" style={portfolioFieldInputStyle()} />
                                                  </div>
                                                </div>
                              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                                <div style={{ flex: '0 0 220px', position: 'relative' }}>
                                  <span style={portfolioFieldLabelStyle}>{t.labelTypeShort}</span>
                                  <select value={propertyEditDraft.type} onChange={(e) => setPropertyEditDraft(prev => ({ ...prev, type: e.target.value }))} style={portfolioFieldSelectStyle()}>
                                    <option value="" >Select</option>
                                    <option value="SFR">SFR</option>
                                    <option value="Commercial">{t.optionTypeCommercial}</option>
                                    <option value="Multifamily">{t.optionTypeMultifamily}</option>
                                    <option value="Land">{t.optionTypeLand}</option>
                                  </select>
                                </div>
                                <div style={{ flex: '0 0 160px', position: 'relative' }}>
                                  <span style={portfolioFieldLabelStyle}>{t.labelGoalShort}</span>
                                  <select value={propertyEditDraft.objective} onChange={(e) => setPropertyEditDraft(prev => ({ ...prev, objective: e.target.value }))} style={portfolioFieldSelectStyle()}>
                                    <option value="" >Select</option>
                                    <option value="Sell">{t.optionGoalSell}</option>
                                    <option value="Rent">{t.optionGoalRent}</option>
                                    <option value="Partner">{t.optionGoalPartner}</option>
                                    <option value="Seller Financing">Seller Financing</option>
                                    <option value="BRRRR">BRRRR</option>
                                    <option value="SUB-TO">SUB-TO</option>
                                    <option value="New Construction">New Construction</option>
                                    <option value="Develop">Develop</option>
                                    <option value="Commercial Point">Commercial Point</option>
                                  </select>
                                </div>
                                <PrimaryProfileSelect
                                  t={t}
                                  value={propertyEditDraft.primaryProfile}
                                  onChange={(nextValue) => setPropertyEditDraft(prev => ({ ...prev, primaryProfile: nextValue }))}
                                  labelStyle={portfolioFieldLabelStyle}
                                  selectStyle={portfolioFieldSelectStyle}
                                  selectStyleOverrides={{ paddingLeft: 124 }}
                                  containerStyle={{ flex: '0 0 200px' }}
                                />
                              </div>
                              <div style={{ paddingBottom: 8 }}>
                                <div style={{ position: 'relative' }}>
                                  <span style={portfolioTextareaLabelStyle}>{t.labelDescShort || 'Description'}</span>
                                  <textarea value={propertyEditDraft.description} onChange={(e) => setPropertyEditDraft(prev => ({ ...prev, description: e.target.value }))} placeholder="" style={portfolioFieldTextareaStyle({ minHeight: 60, borderRadius: 8 })} />
                                </div>
                                      {/* existing images for this property - editable (3-column grid) */}
                                      <div style={{ marginTop: 8 }}>
                                        {(p.images?.length || 0) > 0 ? (
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
                                            {p.images.map((src, imgIdx) => (
                                              <div
                                                key={`${p.id}-edit-img-${imgIdx}`}
                                                draggable
                                                onDragStart={(e) => { e.dataTransfer.setData('text/plain', `${p.id}|${imgIdx}`); e.dataTransfer.effectAllowed = 'move'; }}
                                                onDragOver={(e) => e.preventDefault()}
                                                onDrop={(e) => { const raw = e.dataTransfer.getData('text/plain') || ''; const [propId, fromIdx] = raw.split('|'); const from = Number(fromIdx); if (propId === p.id && !Number.isNaN(from)) moveImageTo(p.id, from, imgIdx); }}
                                                style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 6, background: C.alpha(C.t1, 0.02), display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                                <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, color: C.t2 }}>{t.labelImageItem} {imgIdx + 1}</div>
                                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                  <button type="button" onClick={() => {
                                                    if (imgIdx <= 0) return;
                                                    setPropertyPortfolio(prev => prev.map(x => {
                                                      if (x.id !== p.id) return x;
                                                      const imgs = [...(x.images || [])]; const next = imgs.slice(); const tmp = next[imgIdx-1]; next[imgIdx-1] = next[imgIdx]; next[imgIdx] = tmp; return { ...x, images: next };
                                                    }));
                                                  }} title={t.moveUp} aria-label={t.moveUp} style={{ background: 'none', border: 'none', cursor: imgIdx <= 0 ? 'default' : 'pointer', padding: '0 6px' }}>
                                                    <Icon name="chevUp" size={12} color={imgIdx <= 0 ? C.border : C.t3} />
                                                  </button>
                                                  <button type="button" onClick={() => {
                                                    if (imgIdx >= (p.images || []).length - 1) return;
                                                    setPropertyPortfolio(prev => prev.map(x => {
                                                      if (x.id !== p.id) return x;
                                                      const imgs = [...(x.images || [])]; const next = imgs.slice(); const tmp = next[imgIdx+1]; next[imgIdx+1] = next[imgIdx]; next[imgIdx] = tmp; return { ...x, images: next };
                                                    }));
                                                  }} title={t.moveDown} aria-label={t.moveDown} style={{ background: 'none', border: 'none', cursor: imgIdx >= (p.images || []).length - 1 ? 'default' : 'pointer', padding: '0 6px' }}>
                                                    <Icon name="chevDown" size={12} color={imgIdx >= (p.images || []).length - 1 ? C.border : C.t3} />
                                                  </button>
                                                  <button type="button" onClick={() => setPropertyPortfolio(prev => prev.map(x => (
                                                    x.id === p.id ? { ...x, images: (x.images || []).filter((__, i) => i !== imgIdx) } : x
                                                  )))} title={t.actionRemove} aria-label={t.actionRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px' }}>
                                                    <Icon name="trash" size={12} color={C.danger} />
                                                  </button>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <div style={{ fontSize: 11, color: C.t3 }}>{t.uploadedImagesEmpty}</div>
                                        )}

                                        <div style={{ marginTop: 8 }}>
                                          <label style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase' }}>
                                            {t.actionReplaceImagesUpTo10}
                                            <input type="file" accept="image/*" multiple onChange={(e) => handleEditImages(e, p.id)} style={{ display: 'block', marginTop: 6, fontSize: 11 }} />
                                          </label>
                                        </div>
                                      </div>
                                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                                  <button onClick={() => saveEditProperty(p.id)} style={{ padding: '6px 9px', borderRadius: 8, border: `1px solid ${C.accent}`, background: 'transparent', color: C.accent, fontWeight: 700, cursor: 'pointer', fontSize: 10 }}>{t.actionSave}</button>
                                  <button onClick={() => setEditingPropertyId(null)} style={{ padding: '6px 9px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, fontWeight: 700, cursor: 'pointer', fontSize: 10 }}>{t.actionCancel}</button>
                                </div>
                              </div>
                            </div>
                          )}
                          {editingImagesId === p.id && (
                            <div style={{ paddingBottom: 8 }}>
                              <label style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase' }}>
                                {t.actionReplaceImagesUpTo10}
                                <input type="file" accept="image/*" multiple onChange={(e) => handleEditImages(e, p.id)} style={{ display: 'block', marginTop: 4, fontSize: 11 }} />
                              </label>
                              {(p.images?.length || 0) > 0 ? (
                                <div style={{ marginTop: 6, display: 'grid', gap: 6, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', alignItems: 'start' }}>
                                  {p.images.map((_, imgIdx) => (
                                    <div
                                      key={`${p.id}-img-${imgIdx}`}
                                      draggable
                                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', `${p.id}|${imgIdx}`); e.dataTransfer.effectAllowed = 'move'; }}
                                      onDragOver={(e) => e.preventDefault()}
                                      onDrop={(e) => { const raw = e.dataTransfer.getData('text/plain') || ''; const [propId, fromIdx] = raw.split('|'); const from = Number(fromIdx); if (propId === p.id && !Number.isNaN(from)) moveImageTo(p.id, from, imgIdx); }}
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 10, color: C.t2, border: `1px solid ${C.border}`, borderRadius: 7, padding: '4px 6px' }}>
                                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.labelImageItem} {imgIdx + 1}</span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <button type="button"
                                          onClick={() => {
                                            if (imgIdx <= 0) return;
                                            setPropertyPortfolio((prev) => prev.map((x) => {
                                              if (x.id !== p.id) return x;
                                              const imgs = [...(x.images || [])]; const next = imgs.slice(); const tmp = next[imgIdx-1]; next[imgIdx-1] = next[imgIdx]; next[imgIdx] = tmp; return { ...x, images: next };
                                            }));
                                          }}
                                          title={t.moveUp}
                                          aria-label={t.moveUp}
                                          style={{ background: 'none', border: 'none', cursor: imgIdx <= 0 ? 'default' : 'pointer', padding: '0 6px', flexShrink: 0 }}
                                        >
                                          <Icon name="chevUp" size={12} color={imgIdx <= 0 ? C.border : C.t3} />
                                        </button>
                                        <button type="button"
                                          onClick={() => {
                                            if (imgIdx >= (p.images || []).length - 1) return;
                                            setPropertyPortfolio((prev) => prev.map((x) => {
                                              if (x.id !== p.id) return x;
                                              const imgs = [...(x.images || [])]; const next = imgs.slice(); const tmp = next[imgIdx+1]; next[imgIdx+1] = next[imgIdx]; next[imgIdx] = tmp; return { ...x, images: next };
                                            }));
                                          }}
                                          title={t.moveDown}
                                          aria-label={t.moveDown}
                                          style={{ background: 'none', border: 'none', cursor: imgIdx >= (p.images || []).length - 1 ? 'default' : 'pointer', padding: '0 6px', flexShrink: 0 }}
                                        >
                                          <Icon name="chevDown" size={12} color={imgIdx >= (p.images || []).length - 1 ? C.border : C.t3} />
                                        </button>
                                        <button type="button"
                                          onClick={() => {
                                            setPropertyPortfolio((prev) => prev.map((x) => (
                                              x.id === p.id
                                                ? { ...x, images: (x.images || []).filter((__, i) => i !== imgIdx) }
                                                : x
                                            )));
                                          }}
                                          title={t.actionRemove}
                                          aria-label={t.actionRemove}
                                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px', flexShrink: 0 }}
                                        >
                                          <Icon name="trash" size={12} color={C.t2} />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ marginTop: 6, fontSize: 10, color: C.t3 }}>{t.uploadedImagesEmpty}</div>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )
                  ) : (
                    myServicePortfolio.length === 0 ? (
                      <div style={{ fontSize: 11, color: C.t3 }}>{t.recordsNoService}</div>
                    ) : (
                      myServicePortfolio.map((svc, i) => (
                        <div key={svc.id || `svc-rec-${i}`} style={{ borderBottom: i < myServicePortfolio.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                          <div style={{ display: 'flex', flexWrap: isPhoneViewport ? 'wrap' : 'nowrap', alignItems: 'center', gap: 6, padding: '7px 0', minWidth: 0 }}>
                            <div style={{
                              minWidth: 0,
                              flex: isPhoneViewport ? '1 1 100%' : '0 1 50%',
                              maxWidth: isPhoneViewport ? '100%' : '52%',
                              fontSize: 11,
                              color: C.t1,
                              fontWeight: 700,
                              lineHeight: 1.2,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: (isPhoneViewport && (svc.dealClosed || !isTruthyFlag(svc.publishToConnections, true))) ? 'normal' : 'nowrap',
                              display: (isPhoneViewport && (svc.dealClosed || !isTruthyFlag(svc.publishToConnections, true))) ? '-webkit-box' : 'block',
                              WebkitLineClamp: (isPhoneViewport && (svc.dealClosed || !isTruthyFlag(svc.publishToConnections, true))) ? 2 : 1,
                              WebkitBoxOrient: 'vertical',
                            }}>
                              {svc.title || t.serviceFallbackName}{svc.category ? ` · ${svc.category}` : ''} · {svc.media?.images?.length || 0} img
                            </div>
                            <div style={{ display:'flex', alignItems:'center', justifyContent: isPhoneViewport ? 'flex-start' : 'flex-end', gap:6, width: isPhoneViewport ? '100%' : 'auto', flex: isPhoneViewport ? '0 0 100%' : '1 1 0', flexWrap: 'nowrap', marginLeft: isPhoneViewport ? 0 : 'auto', minWidth: 0 }}>
                              {!svc.dealClosed ? (
                                <Chip active={isTruthyFlag(svc.publishToConnections, true)} onClick={() => {
                                  toggleServiceShowInConnections(svc.id);
                                }}
                                aria-label={isTruthyFlag(svc.publishToConnections, true) ? t.labelConnectionsInactive : t.labelConnectionsActive}
                                aria-pressed={isTruthyFlag(svc.publishToConnections, true)}
                                title={isTruthyFlag(svc.publishToConnections, true) ? t.labelConnectionsInactive : t.labelConnectionsActive}
                                style={{
                                  marginRight: isPhoneViewport ? 'auto' : 0,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  background: isTruthyFlag(svc.publishToConnections, true) ? C.alpha(C.danger, 0.08) : C.alpha(C.accent, 0.1),
                                  border: `1px solid ${isTruthyFlag(svc.publishToConnections, true) ? C.danger : C.accent}`,
                                  color: isTruthyFlag(svc.publishToConnections, true) ? C.danger : C.accent,
                                  fontSize: isPhoneViewport ? 9 : 10.5,
                                  padding: isPhoneViewport ? '5px 8px' : '6px 11px',
                                  minWidth: isPhoneViewport ? undefined : 126,
                                }}>
                                  {isTruthyFlag(svc.publishToConnections, true) ? t.labelConnectionsInactive : t.labelConnectionsActive}
                                </Chip>
                              ) : null}
                              {!svc.dealClosed ? (
                                <button
                                  type="button"
                                  onClick={() => toggleServicePreviewInclusion(svc.id)}
                                  title={t.useInPreview}
                                  aria-label={t.useInPreview}
                                  aria-pressed={isTruthyFlag(svc.includeInPreview, false)}
                                  style={{ background: isTruthyFlag(svc.includeInPreview, false) ? C.alpha(C.accent, 0.12) : 'none', border: isTruthyFlag(svc.includeInPreview, false) ? `1px solid ${C.alpha(C.accent, 0.65)}` : '1px solid transparent', borderRadius: 8, boxShadow: isTruthyFlag(svc.includeInPreview, false) ? `0 0 10px ${C.alpha(C.accent, 0.65)}, inset 0 0 6px ${C.alpha(C.accent, 0.28)}` : 'none', cursor: 'pointer', padding: '0 6px', flexShrink: 0, transition: 'box-shadow .18s ease, border-color .18s ease, background .18s ease' }}
                                >
                                  <Icon name="eye" size={14} color={isTruthyFlag(svc.includeInPreview, false) ? C.accent : C.t3} />
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => toggleServiceDealClosed(svc.id)}
                                title={svc.dealClosed ? (t.dealClosedReopen || 'Deal closed - click to reopen') : (t.markDealClosed || 'Mark deal as closed')}
                                aria-label={svc.dealClosed ? (t.dealClosed || 'Deal closed') : (t.closeDeal || 'Close deal')}
                                style={{
                                  background: svc.dealClosed ? 'rgba(39,174,96,0.12)' : 'none',
                                  border: svc.dealClosed ? '1px solid rgba(39,174,96,0.4)' : '1px solid transparent',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  padding: '0 5px',
                                  fontSize: 13,
                                  fontWeight: 900,
                                  lineHeight: 1,
                                  flexShrink: 0,
                                  color: svc.dealClosed ? '#27ae60' : C.t3,
                                }}
                              >
                                $
                              </button>
                              {!svc.dealClosed ? (
                                <button type="button" onClick={() => startEditService(svc)} title={t.actionEditService} aria-label={t.actionEditService} style={{ background: 'none', border: 'none', cursor: 'pointer', color: editingServiceId === svc.id ? C.accent : C.t3, padding: '0 6px', fontSize: 14, lineHeight: 1, flexShrink: 0 }}>
                                  <Icon name="edit" size={14} color={editingServiceId === svc.id ? C.accent : C.t3} />
                                </button>
                              ) : null}
                              {/* Move / Remove controls (same row as chips) */}
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, marginLeft: 'auto' }}>
                                <button type="button" onClick={() => setServicePortfolio(prev => {
                                  const idx = prev.findIndex(x => x.id === svc.id);
                                  if (idx <= 0) return prev;
                                  const next = [...prev]; const tmp = next[idx-1]; next[idx-1] = next[idx]; next[idx] = tmp; return next;
                                })} title={t.moveUp} aria-label={t.moveUp} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px', flexShrink: 0 }}>
                                  <Icon name="chevUp" size={14} color={C.t3} />
                                </button>
                                <button type="button" onClick={() => setServicePortfolio(prev => {
                                  const idx = prev.findIndex(x => x.id === svc.id);
                                  if (idx === -1 || idx >= prev.length-1) return prev;
                                  const next = [...prev]; const tmp = next[idx+1]; next[idx+1] = next[idx]; next[idx] = tmp; return next;
                                })} title={t.moveDown} aria-label={t.moveDown} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px', flexShrink: 0 }}>
                                  <Icon name="chevDown" size={14} color={C.t3} />
                                </button>
                                <button type="button" onClick={() => requestDeletePortfolioRecord('service', svc)} title={t.actionRemove} aria-label={t.actionRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px', flexShrink: 0 }}>
                                  <Icon name="trash" size={14} color={C.danger} />
                                </button>
                              </div>
                            </div>
                          </div>
                          {INLINE_EDIT_ENABLED && editingServiceId === svc.id && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, paddingBottom: 8 }}>
                              <input value={serviceEditDraft.title} onChange={(e) => setServiceEditDraft((prev) => ({ ...prev, title: e.target.value }))} placeholder={t.placeholderServiceName} style={{ padding: '7px 8px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.t1, fontSize: 11 }} />
                              <select value={serviceEditDraft.category || ''} onChange={(e) => setServiceEditDraft((prev) => ({ ...prev, category: e.target.value }))} style={{ padding: '7px 8px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.t1, fontSize: 11 }}>
                                <option value="">{t.placeholderCategory || 'Select category'}</option>
                                {serviceEditDraft.category && !FEED_TASKBAR_CATEGORY_OPTIONS.some((opt) => opt === serviceEditDraft.category) ? (
                                  <option value={serviceEditDraft.category}>{serviceEditDraft.category}</option>
                                ) : null}
                                {FEED_TASKBAR_CATEGORY_OPTIONS.map((opt) => (
                                  <option key={`feed-taskbar-category-inline-${opt}`} value={opt}>{opt}</option>
                                ))}
                              </select>
                              <input value={serviceEditDraft.price} onChange={(e) => setServiceEditDraft((prev) => ({ ...prev, price: e.target.value }))} placeholder={t.placeholderPrice} style={{ padding: '7px 8px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.t1, fontSize: 11 }} />
                              <PrimaryProfileSelect
                                t={t}
                                C={C}
                                value={serviceEditDraft.primaryProfile || ''}
                                onChange={(nextValue) => setServiceEditDraft((prev) => ({ ...prev, primaryProfile: nextValue }))}
                                selectStyle={{ padding: '7px 8px', borderRadius: 8, border: `1px solid ${serviceEditDraft.primaryProfile ? C.border : C.danger}`, background: C.card, color: C.t1, fontSize: 11 }}
                                showLabel={false}
                                required
                              />
                              <label style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase' }}>
                                {t.actionReplaceImages}
                                <input type="file" accept="image/*" multiple onChange={(e) => handleEditServiceImages(e, svc.id)} style={{ display: 'block', marginTop: 4, fontSize: 11 }} />
                              </label>
                              <div style={{ gridColumn: '1 / -1' }}>
                                {(svc.media?.images?.length || 0) > 0 ? (
                                  <div style={{ marginTop: 2, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, alignItems: 'start' }}>
                                    {svc.media.images.map((_, imgIdx) => (
                                      <div key={`${svc.id}-img-${imgIdx}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 10, color: C.t2, border: `1px solid ${C.border}`, borderRadius: 7, padding: '4px 6px' }}>
                                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.labelImageItem} {imgIdx + 1}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <button type="button"
                                            onClick={() => {
                                              if (imgIdx <= 0) return;
                                              setServicePortfolio((prev) => prev.map((x) => {
                                                if (x.id !== svc.id) return x;
                                                const imgs = [...(x.media?.images || [])]; const next = imgs.slice(); const tmp = next[imgIdx-1]; next[imgIdx-1] = next[imgIdx]; next[imgIdx] = tmp; return { ...x, media: { ...(x.media || {}), images: next } };
                                              }));
                                            }}
                                            title={t.moveUp}
                                            aria-label={t.moveUp}
                                            style={{ background: 'none', border: 'none', cursor: imgIdx <= 0 ? 'default' : 'pointer', padding: '0 6px', flexShrink: 0 }}
                                          >
                                            <Icon name="chevUp" size={12} color={imgIdx <= 0 ? C.border : C.t3} />
                                          </button>
                                          <button type="button"
                                            onClick={() => {
                                              if (imgIdx >= (svc.media?.images || []).length - 1) return;
                                              setServicePortfolio((prev) => prev.map((x) => {
                                                if (x.id !== svc.id) return x;
                                                const imgs = [...(x.media?.images || [])]; const next = imgs.slice(); const tmp = next[imgIdx+1]; next[imgIdx+1] = next[imgIdx]; next[imgIdx] = tmp; return { ...x, media: { ...(x.media || {}), images: next } };
                                              }));
                                            }}
                                            title={t.moveDown}
                                            aria-label={t.moveDown}
                                            style={{ background: 'none', border: 'none', cursor: imgIdx >= (svc.media?.images || []).length - 1 ? 'default' : 'pointer', padding: '0 6px', flexShrink: 0 }}
                                          >
                                            <Icon name="chevDown" size={12} color={imgIdx >= (svc.media?.images || []).length - 1 ? C.border : C.t3} />
                                          </button>
                                          <button type="button"
                                            onClick={() => {
                                              setServicePortfolio((prev) => prev.map((x) => (
                                                x.id === svc.id
                                                  ? { ...x, media: { ...(x.media || {}), images: (x.media?.images || []).filter((__, i) => i !== imgIdx) } }
                                                  : x
                                              )));
                                            }}
                                            title={t.actionRemove}
                                            aria-label={t.actionRemove}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px', flexShrink: 0 }}
                                          >
                                            <Icon name="trash" size={12} color={C.danger} />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div style={{ marginTop: 2, fontSize: 10, color: C.t3 }}>{t.uploadedImagesEmpty}</div>
                                )}
                              </div>
                              <textarea value={serviceEditDraft.description} onChange={(e) => setServiceEditDraft((prev) => ({ ...prev, description: e.target.value }))} placeholder={t.placeholderDescription} style={{ ...portfolioFieldTextareaStyle({ minHeight: 58, borderRadius: 8 }), gridColumn: '1 / -1' }} />
                              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 6 }}>
                                <button onClick={() => saveEditService(svc.id)} style={{ padding: '6px 9px', borderRadius: 8, border: `1px solid ${C.accent}`, background: 'transparent', color: C.accent, fontWeight: 700, cursor: 'pointer', fontSize: 10 }}>{t.actionSave}</button>
                                <button onClick={() => setEditingServiceId(null)} style={{ padding: '6px 9px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, fontWeight: 700, cursor: 'pointer', fontSize: 10 }}>{t.actionCancel}</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )
                  )}
                </div>
              </SectionCard>
          </div>

          <div className="onb-col onb-col-right">
            {accountType === 'professional' ? (
              <>
                <SectionCard title={t.sectionServicesComplement} subtitle={t.sectionServicesComplementSub}>
                  <div className="onb-scroll-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {registeredServiceSkills.length ? (
                      registeredServiceSkills.map((s) => <Chip key={s} active onClick={() => {}}>{s}</Chip>)
                    ) : (
                      <div style={{ fontSize: 10, color: C.t3, padding: '6px 0' }}>
                        {t.addServiceSkillsHint}
                      </div>
                    )}
                  </div>
                  <textarea value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder={t.placeholderShortPresentation} style={{ width: '100%', minHeight: 90, padding: '8px 10px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.card, color: C.t1, boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 11 }} />
                </SectionCard>

                <SectionCard title={t.sectionSelections} subtitle={t.sectionSelectionsSub}>
                  <div className="onb-scroll-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 36, alignItems: 'center' }}>
                    {selectedCategories.map((catId) => {
                      const cat = allProfiles.find((p) => p.id === catId);
                      const isPrimary = catId === primaryCategory;
                      return <Chip key={catId} active={isPrimary} onClick={() => setPrimaryCategory(catId)}>{isPrimary ? `Primary: ${cat?.label || catId}` : (cat?.label || catId)}</Chip>;
                    })}
                  </div>
                  <div className="onb-scroll-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, minHeight: 36, alignItems: 'center' }}>
                    {selectedMarkets.map((code) => <Chip key={code} active onClick={() => toggleMulti(setSelectedMarkets, code)}>{code}</Chip>)}
                  </div>
                </SectionCard>

                <SectionCard title={t.sectionStatistics} subtitle={t.sectionStatisticsSub}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
                    <div style={{ padding: '7px 8px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.alpha(C.t1, 0.03), textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.t1 }}>{previewPersonalFeedCard.rating}</div>
                      <div style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase' }}>{t.labelRating}</div>
                    </div>
                    <div style={{ padding: '7px 8px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.alpha(C.t1, 0.03), textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.t1 }}>{previewPersonalFeedCard.reviews}</div>
                      <div style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase' }}>{t.labelReviews}</div>
                    </div>
                    <div style={{ padding: '7px 8px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.alpha(C.t1, 0.03), textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.t1 }}>{previewPersonalFeedCard.deals}</div>
                      <div style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase' }}>{t.labelDeals}</div>
                    </div>
                  </div>
                </SectionCard>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {investmentModalOpen ? (
        <InvestmentProfileModal
          addInvestmentMarket={addInvestmentMarket}
          investmentMarketInput={investmentMarketInput}
          investmentProfileDraft={investmentProfileDraft}
          investmentProfileStrength={investmentProfileStrength}
          investmentScoreMeta={investmentScoreMeta}
          investmentTriggerCategories={investmentTriggerCategories}
          isMobileViewport={isMobileViewport}
          onClose={() => {
            saveInvestmentProfileDraft({ forceComplete: false });
            setInvestmentModalOpen(false);
          }}
          onSave={() => {
            saveInvestmentProfileDraft({ forceComplete: investmentProfileRequiredComplete });
            setInvestmentModalOpen(false);
          }}
          removeInvestmentMarket={removeInvestmentMarket}
          requiresInvestmentProfile={requiresInvestmentProfile}
          setInvestmentField={setInvestmentField}
          setInvestmentMarketInput={setInvestmentMarketInput}
          t={t}
          toggleInvestmentField={toggleInvestmentField}
        />
      ) : null}

      {verificationModal.open ? (
        <Modal onClose={closeVerificationFlow} maxWidth={620}>
          <h3 style={{ margin: '0 0 6px', color: C.t1, fontSize: 20, fontWeight: 800 }}>{t.verificationModalTitle || 'Profile verification by email'}</h3>
          <p style={{ margin: '0 0 12px', color: C.t3, fontSize: 12 }}>
            {(t.verificationModalIntro || 'This step validates the {scope} from onboarding using the signed-in account email.')
              .replace('{scope}', getVerificationScopeLabel(verificationModal.scope))}
          </p>

          {verificationModalRecord?.verified ? (
            <div style={{ border: `1px solid ${C.alpha(C.accent, 0.5)}`, borderRadius: 10, background: C.alpha(C.accent, 0.08), padding: '10px 12px', fontSize: 12, color: C.t1, marginBottom: 10, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Icon name="shieldCheck" size={14} color={C.accent} strokeWidth={2.35} />
              {t.verificationBadgeActive || 'Verified badge active for this profile.'}
            </div>
          ) : null}

          <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, background: C.card, marginBottom: 10, display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 11, color: C.t2 }}>{t.verificationProfileEmailLabel || 'Profile email (onboarding)'}: <strong style={{ color: C.t1 }}>{verificationModalEmail || '-'}</strong></div>
            <div style={{ fontSize: 11, color: C.t2 }}>{t.verificationAccountEmailLabel || 'Signed-in account email'}: <strong style={{ color: C.t1 }}>{verificationAuthEmail || '-'}</strong></div>
            <div style={{ fontSize: 11, color: C.t2 }}>
              {(t.verificationStatusLabel || 'Status')}:{' '}
              <strong style={{ color: verificationModalRecord?.verified ? C.accent : C.t1 }}>
                {verificationModalRecord?.verified
                  ? (t.verificationStatusVerified || 'Verified profile')
                  : (verificationEmailStatus === 'sent'
                    ? (t.verificationStatusWaitingEmail || 'Waiting for account email confirmation')
                    : (t.verificationStatusNotStarted || 'Not started'))}
              </strong>
            </div>
          </div>

          {!verificationModalEmail ? (
            <div style={{ marginBottom: 10, fontSize: 11, color: C.danger, border: `1px solid ${C.alpha(C.danger, 0.45)}`, borderRadius: 8, padding: '7px 9px', background: C.alpha(C.danger, 0.06) }}>
              {t.verificationNeedProfileEmailStart || 'Fill in the profile email in onboarding to start verification.'}
            </div>
          ) : null}

          {verificationModalEmail && !verificationEmailMatchesAccount ? (
            <div style={{ marginBottom: 10, fontSize: 11, color: C.t2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 9px', background: C.alpha(C.t1, 0.03) }}>
              {t.verificationMismatchHint || 'Profile email is different from account email. You can continue with parallel verification and keep onboarding; to finish the badge later, align both emails.'}
            </div>
          ) : null}

          {verificationEmailMatchesAccount && !verificationAccountEmailConfirmed && verificationEmailStatus === 'sent' ? (
            <div style={{ marginBottom: 10, fontSize: 11, color: C.t2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 9px', background: C.alpha(C.t1, 0.03) }}>
              {t.verificationWaitingHint || 'Still waiting for account email confirmation. Open your inbox, confirm the email, then click Update profile status.'}
            </div>
          ) : null}

          {verificationModal.error ? (
            <div style={{ marginBottom: 10, fontSize: 11, color: C.danger, border: `1px solid ${C.alpha(C.danger, 0.45)}`, borderRadius: 8, padding: '7px 9px', background: C.alpha(C.danger, 0.06) }}>
              {verificationModal.error}
            </div>
          ) : null}

          {verificationModal.info ? (
            <div style={{ marginBottom: 10, fontSize: 11, color: C.t2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 9px', background: C.alpha(C.t1, 0.03) }}>
              {verificationModal.info}
            </div>
          ) : null}

          <div role="group" aria-label={t.verificationActionsAria || 'Profile verification actions'} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {!verificationModalRecord?.verified ? (
              <button
                type="button"
                onClick={startVerificationFlow}
                disabled={!verificationModalEmail || !verificationEmailMatchesAccount}
                style={{
                  padding: '8px 12px',
                  borderRadius: 9,
                  border: 'none',
                  background: C.accent,
                  color: '#fff',
                  fontWeight: 700,
                  cursor: (!verificationModalEmail || !verificationEmailMatchesAccount) ? 'default' : 'pointer',
                  fontSize: 12,
                  opacity: (!verificationModalEmail || !verificationEmailMatchesAccount) ? 0.55 : 1,
                }}
              >
                {verificationAccountEmailConfirmed
                  ? (t.verificationActionValidateNow || 'Validate profile with already confirmed email')
                  : (t.verificationActionSendConfirmation || 'Send confirmation to validate profile')}
              </button>
            ) : null}

            {!verificationModalRecord?.verified ? (
              <button
                type="button"
                onClick={continueWithParallelVerification}
                style={{
                  padding: '8px 12px',
                  borderRadius: 9,
                  border: `1px solid ${C.accent}`,
                  background: C.alpha(C.accent, 0.08),
                  color: C.accent,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                {t.verificationActionParallel || 'Continue with parallel verification'}
              </button>
            ) : null}

            {!verificationModalRecord?.verified && verificationEmailStatus === 'sent' ? (
              <button
                type="button"
                onClick={syncVerificationStatus}
                style={{ padding: '8px 12px', borderRadius: 9, border: `1px solid ${C.accent}`, background: 'transparent', color: C.accent, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}
              >
                {t.verificationActionRefresh || 'Update profile status'}
              </button>
            ) : null}

            <button onClick={closeVerificationFlow} style={{ padding: '8px 12px', borderRadius: 9, border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
              {t.close || 'Close'}
            </button>
          </div>
        </Modal>
      ) : null}

      {editingPropertyRecord ? (
        <Modal onClose={() => setEditingPropertyId(null)} maxWidth={1080}>
          <h3 style={{ margin: '0 0 6px', color: C.t1, fontSize: 20, fontWeight: 800 }}>{t.editProperty || 'Edit Property'}</h3>
          <p style={{ margin: '0 0 14px', color: C.t3, fontSize: 12 }}>{editingPropertyRecord.address} · {editingPropertyRecord.city}</p>
          <div style={{ display: 'grid', gridTemplateColumns: isMobileViewport ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1.5fr) minmax(0, 1.15fr) minmax(96px, 0.7fr) minmax(112px, 0.8fr)', gap: 10, marginBottom: 10 }}>
            <div style={{ position: 'relative', minWidth: 0 }}>
              <span style={portfolioFieldLabelStyle}>{t.labelAddrShort}</span>
              <input value={propertyEditDraft.address} onChange={(e) => setPropertyEditDraft(prev => ({ ...prev, address: e.target.value }))} style={portfolioFieldInputStyle()} />
            </div>
            <div style={{ position: 'relative', minWidth: 0 }}>
              <span style={portfolioFieldLabelStyle}>{t.labelCityShort}</span>
              <input value={propertyEditDraft.city} onChange={(e) => setPropertyEditDraft(prev => ({ ...prev, city: e.target.value }))} style={portfolioFieldInputStyle()} />
            </div>
            <div style={{ position: 'relative', minWidth: 0 }}>
              <span style={portfolioFieldLabelStyle}>{t.labelZipShort}</span>
              <input value={propertyEditDraft.zip} onChange={(e) => setPropertyEditDraft(prev => ({ ...prev, zip: e.target.value }))} inputMode="numeric" maxLength={5} style={portfolioFieldInputStyle()} />
            </div>
            <div style={{ position: 'relative', minWidth: 0 }}>
              <span style={portfolioFieldLabelStyle}>{t.labelCapShort}</span>
              <input value={propertyEditDraft.capRate || ''} onChange={(e) => setPropertyEditDraft(prev => ({ ...prev, capRate: formatRateInput(e.target.value) }))} inputMode="decimal" maxLength={5} style={portfolioFieldInputStyle({ textAlign: 'right' })} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobileViewport ? 'repeat(2, minmax(0, 1fr))' : 'minmax(132px, 1.1fr) minmax(132px, 1.1fr) minmax(76px, 0.65fr) minmax(76px, 0.65fr) minmax(88px, 0.8fr) minmax(110px, 0.9fr)', gap: 10, marginBottom: 10 }}>
            <div style={{ position: 'relative', minWidth: 0 }}>
              <span style={portfolioFieldLabelStyle}>{t.labelUsdPriceShort}</span>
              <input value={propertyEditDraft.price} onChange={(e) => setPropertyEditDraft(prev => ({ ...prev, price: formatCurrencyInput(e.target.value) }))} inputMode="decimal" style={portfolioFieldInputStyle({ textAlign: 'right' })} />
            </div>
            <div style={{ position: 'relative', minWidth: 0 }}>
              <span style={portfolioFieldLabelStyle}>{t.labelUsdRehabShort}</span>
              <input value={propertyEditDraft.rehab || ''} onChange={(e) => setPropertyEditDraft(prev => ({ ...prev, rehab: formatCurrencyInput(e.target.value) }))} inputMode="decimal" style={portfolioFieldInputStyle({ textAlign: 'right' })} />
            </div>
            <div style={{ position: 'relative', minWidth: 0 }}>
              <span style={portfolioFieldLabelStyle}>{t.labelBedsShort}</span>
              <input value={propertyEditDraft.beds} onChange={(e) => setPropertyEditDraft(prev => ({ ...prev, beds: e.target.value }))} inputMode="numeric" maxLength={2} style={portfolioFieldInputStyle({ textAlign: 'right' })} />
            </div>
            <div style={{ position: 'relative', minWidth: 0 }}>
              <span style={portfolioFieldLabelStyle}>{t.labelBathsShort}</span>
              <input value={propertyEditDraft.baths} onChange={(e) => setPropertyEditDraft(prev => ({ ...prev, baths: e.target.value }))} inputMode="numeric" maxLength={2} style={portfolioFieldInputStyle({ textAlign: 'right' })} />
            </div>
            <div style={{ position: 'relative', minWidth: 0 }}>
              <span style={portfolioFieldLabelStyle}>{t.labelSqftShort}</span>
              <input value={propertyEditDraft.sqft} onChange={(e) => setPropertyEditDraft(prev => ({ ...prev, sqft: e.target.value }))} inputMode="numeric" maxLength={7} style={portfolioFieldInputStyle({ textAlign: 'right' })} />
            </div>
            <div style={{ position: 'relative', minWidth: 0 }}>
              <span style={portfolioFieldLabelStyle}>{t.labelLotShort}</span>
              <input value={propertyEditDraft.lot} onChange={(e) => setPropertyEditDraft(prev => ({ ...prev, lot: e.target.value }))} style={portfolioFieldInputStyle()} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobileViewport ? '1fr' : 'minmax(140px, 1fr) minmax(140px, 1fr) minmax(160px, 1fr) minmax(220px, 1.25fr)', gap: 10, marginBottom: 10 }}>
            <div style={{ position: 'relative' }}>
              <span style={portfolioFieldLabelStyle}>{t.labelTypeShort}</span>
              <select value={propertyEditDraft.type} onChange={(e) => setPropertyEditDraft(prev => ({ ...prev, type: e.target.value }))} style={portfolioFieldSelectStyle()}>
                <option value="" >Select</option>
                <option value="SFR">SFR</option>
                <option value="Commercial">{t.optionTypeCommercial}</option>
                <option value="Multifamily">{t.optionTypeMultifamily}</option>
                <option value="Land">{t.optionTypeLand}</option>
              </select>
            </div>
            <div style={{ position: 'relative' }}>
              <span style={portfolioFieldLabelStyle}>{t.labelGoalShort}</span>
              <select value={propertyEditDraft.objective} onChange={(e) => setPropertyEditDraft(prev => ({ ...prev, objective: e.target.value }))} style={portfolioFieldSelectStyle()}>
                <option value="" >Select</option>
                <option value="Sell">{t.optionGoalSell}</option>
                <option value="Rent">{t.optionGoalRent}</option>
                <option value="Partner">{t.optionGoalPartner}</option>
                <option value="Seller Financing">Seller Financing</option>
                <option value="BRRRR">BRRRR</option>
                <option value="SUB-TO">SUB-TO</option>
                <option value="New Construction">New Construction</option>
                <option value="Develop">Develop</option>
                <option value="Commercial Point">Commercial Point</option>
              </select>
            </div>
            <PrimaryProfileSelect
              t={t}
              value={propertyEditDraft.primaryProfile}
              onChange={(nextValue) => setPropertyEditDraft(prev => ({ ...prev, primaryProfile: nextValue }))}
              labelStyle={portfolioFieldLabelStyle}
              selectStyle={portfolioFieldSelectStyle}
              selectStyleOverrides={{ paddingLeft: 124 }}
            />
            <div style={{ position: 'relative' }}>
              {renderMarketsSelector(propertyEditDraft.markets, (code) => setPropertyEditDraft((prev) => ({ ...prev, markets: toggleArrayValue(prev.markets || [], code) })), { showSummary: false, inlineLabel: 'States' })}
            </div>
          </div>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <span style={portfolioTextareaLabelStyle}>{t.labelDescShort || 'Description'}</span>
            <textarea rows={3} value={propertyEditDraft.description} onChange={(e) => setPropertyEditDraft(prev => ({ ...prev, description: e.target.value }))} style={portfolioFieldTextareaStyle({ minHeight: 40, borderRadius: 10 })} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase', marginBottom: 6 }}>{t.actionReplaceImagesUpTo10}</div>
            <input type="file" accept="image/*" multiple onChange={(e) => handleEditImages(e, editingPropertyRecord.id)} style={{ display: 'block', fontSize: 11, marginBottom: 10 }} />
            {(editingPropertyRecord.images?.length || 0) > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: isMobileViewport ? 'repeat(3, minmax(0, 1fr))' : 'repeat(5, minmax(0, 1fr))', gap: 6 }}>
                {editingPropertyRecord.images.slice(0, 10).map((imgSrc, imgIdx) => (
                  <div
                    key={`${editingPropertyRecord.id}-modal-img-${imgIdx}`}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(imgIdx)); e.dataTransfer.effectAllowed = 'move'; }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const from = Number(e.dataTransfer.getData('text/plain'));
                      if (Number.isNaN(from) || from === imgIdx) return;
                      setPropertyPortfolio(prev => prev.map(x => {
                        if (x.id !== editingPropertyRecord.id) return x;
                        const next = [...(x.images || [])];
                        if (from < 0 || from >= next.length || imgIdx >= next.length) return x;
                        const [moved] = next.splice(from, 1);
                        next.splice(imgIdx, 0, moved);
                        return { ...x, images: next };
                      }));
                    }}
                    style={{ position: 'relative', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', minHeight: 72, background: C.bg2, cursor: 'grab' }}
                  >
                    <SmartImage src={imgSrc} alt={`${t.labelImageItem} ${imgIdx + 1}`} style={{ width: '100%', height: 72, objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(17,17,17,0.72)', color: '#fff', borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '1px 5px' }}>
                      #{imgIdx + 1}
                    </div>
                    <div style={{ position: 'absolute', right: 4, bottom: 4, display: 'flex', gap: 4 }}>
                      <button type="button" onClick={() => setPropertyPortfolio(prev => prev.map(x => x.id === editingPropertyRecord.id ? { ...x, images: (x.images || []).filter((__, i) => i !== imgIdx) } : x))} style={{ background: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer', borderRadius: 5, padding: '3px 4px' }}><Icon name="trash" size={11} color={C.danger} /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div style={{ fontSize: 11, color: C.t3 }}>{t.uploadedImagesEmpty}</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setEditingPropertyId(null)} style={{ padding: '8px 12px', borderRadius: 9, border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>{t.actionCancel}</button>
            <button onClick={() => saveEditProperty(editingPropertyRecord.id)} style={{ padding: '8px 12px', borderRadius: 9, border: 'none', background: C.accent, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>{t.actionSave}</button>
          </div>
        </Modal>
      ) : null}

      {editingServiceRecord ? (
        <Modal onClose={() => setEditingServiceId(null)} maxWidth={920}>
          <h3 style={{ margin: '0 0 6px', color: C.t1, fontSize: 20, fontWeight: 800 }}>{t.actionEditService}</h3>
          <p style={{ margin: '0 0 14px', color: C.t3, fontSize: 12 }}>{editingServiceRecord.title || t.serviceFallbackName}</p>
          <div style={{ display: 'grid', gridTemplateColumns: isMobileViewport ? '1fr' : 'minmax(0, 1.5fr) minmax(0, 1.1fr)', gap: 10, marginBottom: 10 }}>
            <div style={{ position: 'relative' }}>
              <span style={portfolioFieldLabelStyle}>{t.placeholderServiceName.toUpperCase()}</span>
              <input value={serviceEditDraft.title} onChange={(e) => setServiceEditDraft((prev) => ({ ...prev, title: e.target.value }))} style={portfolioFieldInputStyle({ paddingLeft: 128, textAlign: 'right' })} />
            </div>
            <div style={{ position: 'relative' }}>
              <span style={portfolioFieldLabelStyle}>{t.placeholderCategory.toUpperCase()}</span>
              <select value={serviceEditDraft.category || ''} onChange={(e) => setServiceEditDraft((prev) => ({ ...prev, category: e.target.value }))} style={portfolioFieldSelectStyle({ paddingLeft: 128, textAlign: 'right' })}>
                <option value="">{t.placeholderCategory || 'Select category'}</option>
                {serviceEditDraft.category && !FEED_TASKBAR_CATEGORY_OPTIONS.some((opt) => opt === serviceEditDraft.category) ? (
                  <option value={serviceEditDraft.category}>{serviceEditDraft.category}</option>
                ) : null}
                {FEED_TASKBAR_CATEGORY_OPTIONS.map((opt) => (
                  <option key={`feed-taskbar-category-modal-${opt}`} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobileViewport ? '1fr' : 'minmax(132px, 0.8fr) minmax(180px, 0.95fr) minmax(220px, 1.15fr)', gap: 10, marginBottom: 10 }}>
            <div style={{ position: 'relative' }}>
              <span style={portfolioFieldLabelStyle}>{t.labelUsdPriceShort}</span>
              <input value={serviceEditDraft.price} onChange={(e) => setServiceEditDraft((prev) => ({ ...prev, price: formatCurrencyInput(e.target.value) }))} inputMode="decimal" style={portfolioFieldInputStyle({ textAlign: 'right' })} />
            </div>
            <PrimaryProfileSelect
              t={t}
              C={C}
              value={serviceEditDraft.primaryProfile || ''}
              onChange={(nextValue) => setServiceEditDraft((prev) => ({ ...prev, primaryProfile: nextValue }))}
              labelStyle={portfolioFieldLabelStyle}
              selectStyle={portfolioFieldSelectStyle}
              selectStyleOverrides={{ paddingLeft: 124 }}
              emptyLabel={t.optionSelectProfileRequired || 'Select profile *'}
              required
            />
            <div style={{ position: 'relative' }}>
              {renderMarketsSelector(serviceEditDraft.markets, (code) => setServiceEditDraft((prev) => ({ ...prev, markets: toggleArrayValue(prev.markets || [], code) })), { showSummary: false, inlineLabel: 'States' })}
            </div>
          </div>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <span style={portfolioTextareaLabelStyle}>{t.placeholderDescription.toUpperCase()}</span>
            <textarea rows={3} value={serviceEditDraft.description} onChange={(e) => setServiceEditDraft((prev) => ({ ...prev, description: e.target.value }))} style={portfolioFieldTextareaStyle({ minHeight: 40, borderRadius: 10 })} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase', marginBottom: 6 }}>{t.actionReplaceImages}</div>
            <input type="file" accept="image/*" multiple onChange={(e) => handleEditServiceImages(e, editingServiceRecord.id)} style={{ display: 'block', fontSize: 11, marginBottom: 10 }} />
            {(editingServiceRecord.media?.images?.length || 0) > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: isMobileViewport ? 'repeat(3, minmax(0, 1fr))' : 'repeat(5, minmax(0, 1fr))', gap: 6 }}>
                {editingServiceRecord.media.images.slice(0, 10).map((imgSrc, imgIdx) => (
                  <div
                    key={`${editingServiceRecord.id}-modal-img-${imgIdx}`}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(imgIdx)); e.dataTransfer.effectAllowed = 'move'; }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const from = Number(e.dataTransfer.getData('text/plain'));
                      if (Number.isNaN(from) || from === imgIdx) return;
                      setServicePortfolio(prev => prev.map(x => {
                        if (x.id !== editingServiceRecord.id) return x;
                        const next = [...(x.media?.images || [])];
                        if (from < 0 || from >= next.length || imgIdx >= next.length) return x;
                        const [moved] = next.splice(from, 1);
                        next.splice(imgIdx, 0, moved);
                        return { ...x, media: { ...(x.media || {}), images: next } };
                      }));
                    }}
                    style={{ position: 'relative', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', minHeight: 72, background: C.bg2, cursor: 'grab' }}
                  >
                    <SmartImage src={imgSrc} alt={`${t.labelImageItem} ${imgIdx + 1}`} style={{ width: '100%', height: 72, objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(17,17,17,0.72)', color: '#fff', borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '1px 5px' }}>
                      #{imgIdx + 1}
                    </div>
                    <div style={{ position: 'absolute', right: 4, bottom: 4, display: 'flex', gap: 4 }}>
                      <button type="button" onClick={() => setServicePortfolio(prev => prev.map(x => x.id === editingServiceRecord.id ? { ...x, media: { ...(x.media || {}), images: (x.media?.images || []).filter((__, i) => i !== imgIdx) } } : x))} style={{ background: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer', borderRadius: 5, padding: '3px 4px' }}><Icon name="trash" size={11} color={C.danger} /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div style={{ fontSize: 11, color: C.t3 }}>{t.uploadedImagesEmpty}</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setEditingServiceId(null)} style={{ padding: '8px 12px', borderRadius: 9, border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>{t.actionCancel}</button>
            <button onClick={() => saveEditService(editingServiceRecord.id)} style={{ padding: '8px 12px', borderRadius: 9, border: 'none', background: C.accent, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>{t.actionSave}</button>
          </div>
        </Modal>
      ) : null}

      {deleteConfirm ? (
        <Modal onClose={() => setDeleteConfirm(null)} maxWidth={460}>
          <div style={{ padding: 4, color: C.t1 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 900 }}>
              {t.deleteRecordTitle || 'Delete record?'}
            </h3>
            <p style={{ margin: '0 0 16px', color: C.t2, fontSize: 13, lineHeight: 1.45 }}>
              {(t.deleteRecordMessage || 'Are you sure you want to delete "{title}"? This action removes the record from your portfolio.')
                .replace('{title}', deleteConfirm.title || '')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.t1, fontWeight: 800, cursor: 'pointer' }}
              >
                {t.actionCancel || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={confirmDeletePortfolioRecord}
                style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: C.danger, color: '#fff', fontWeight: 900, cursor: 'pointer' }}
              >
                {t.deleteAnyway || 'Delete anyway'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

        {previewOpen ? (
        <Modal
          onClose={() => setPreviewOpen(false)}
          maxWidth={isMobileViewport ? 820 : 1480}
          overlayStyle={isMobileViewport ? {} : { zIndex: 20000 }}
          contentStyle={isMobileViewport
            ? { overflowY: 'auto', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }
            : { overflow: 'hidden', maxHeight: 'min(92dvh, 920px)' }}
        >
          <div style={{ display: 'grid', gap: 10, paddingRight: isMobileViewport ? 2 : 0 }}>
            <div style={{ display: 'flex', flexWrap: isMobileViewport ? 'wrap' : 'nowrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingRight: 30 }}>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: 0, color: C.t1, fontSize: isMobileViewport ? 20 : 18, fontWeight: 800 }}>{t.previewTitle}</h3>
                <p style={{ margin: '4px 0 0', color: C.t3, fontSize: 12 }}>
                  {t.previewSubtitle}
                </p>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
                <button onClick={() => setPreviewOpen(false)} style={{ padding: '8px 12px', borderRadius: 9, border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                  {t.previewBackToEdit}
                </button>
                <button onClick={() => { setPreviewOpen(false); publishRegistration(); }} style={{ padding: '8px 12px', borderRadius: 9, border: 'none', background: C.accent, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                  {t.previewConfirmPublish}
                </button>
              </div>
            </div>

            {renderPreviewContent()}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}


