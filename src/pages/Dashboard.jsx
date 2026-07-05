import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { C } from '../theme/colors';
import { useT } from '../i18n/translations';
import { CATEGORIES, CARDS as _MOCK_CARDS, PROPERTIES as _MOCK_PROPERTIES } from '../data/mockData';
import { Icon } from '../components/ui/Icon';
import { SmartImage } from '../components/ui/SmartImage';
import { CategoryBar } from '../components/layout/CategoryBar';
import { Modal } from '../components/ui/Modal';
import { PlanGateModal } from '../components/modals/PlanGateModal';
import { catIcon } from '../lib/catIcon';
import { SwipeCard } from '../components/cards/SwipeCard';
import { PropertyCard } from '../components/cards/PropertyCard';
import { CardStatusBadge, CardStatusIcon } from '../components/ui/CardStatusIndicators';
import { CARD_STATUS, pickPriorityStatus } from '../components/ui/cardStatusTokens';
import { getHiddenSet, subscribe as subscribeHidden } from '../lib/hiddenCards';
import { inferRecordProfileScope, normalizeProfileScope, resolveScopedProfile } from '../lib/profileScopeResolver';
import { formatPropertyLocation } from '../lib/formatPropertyLocation';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { consumePlanActions, getPlanGateCopy } from '../services/planUsageService';
import { trackAppEvent } from '../lib/adminEventTracking';
import { getOwnerExclusivityStatus, getPortfolioItemCount, getPortfolioUnlockCost, getPropertyExclusivityStatus } from '../lib/unlockRules';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { isUuid, mapPropertyHotMetrics } from '../lib/propertyHotMetrics';
import { isPendingDealExpired } from '../lib/pendingDeal';
import { orderDeck } from '../lib/orderFeedDeck';
import { normalizeCard } from '../lib/normalizeFeedCard';
import { checkIsUnlocked } from '../services/unlockService';
import { formatCompactUsd } from '../lib/formatMoney';
import feedMatchIcon from '../assets/feed-match-icon.png';
import spotlightIcon from '../assets/spotlight-icon.png';

const CARDS = import.meta.env.DEV ? (_MOCK_CARDS || []) : [];
const PROPERTIES = import.meta.env.DEV ? (_MOCK_PROPERTIES || []) : [];

// Utilitário para checagem de flag booleana (string, bool, number)
function isTruthyFlag(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (['true', '1', 'on', 'yes'].includes(v)) return true;
    if (['false', '0', 'off', 'no'].includes(v)) return false;
  }
  return Boolean(value);
}

function readLocalStringSet(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return new Set(Array.isArray(parsed) ? parsed.map((item) => String(item || '').trim()).filter(Boolean) : []);
  } catch (e) {
    void e;
    return new Set();
  }
}

function writeLocalStringSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify([...value].map((item) => String(item || '').trim()).filter(Boolean)));
  } catch (e) {
    void e;
  }
}

function getUserScopedStorageKey(baseKey, userId) {
  const normalizedUserId = String(userId || '').trim();
  if (isSupabaseConfigured && normalizedUserId && normalizedUserId !== 'local-user') {
    return `${baseKey}:${normalizedUserId}`;
  }
  return baseKey;
}

function readPendingFocusCard() {
  try {
    const raw = localStorage.getItem('focusCard');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.id) return null;
    return {
      ...parsed,
      type: parsed.type === 'property' ? 'property' : 'person',
    };
  } catch {
    return null;
  }
}

function trackDashboardSwipe(entityType, entityId, action) {
  try {
    trackAppEvent('swipe_given', {
      entityType,
      entityId,
      metadata: { action: String(action || '') },
    });
  } catch {
    // Telemetry must never interrupt deck interactions.
  }
}

function trackPropertySaved(propertyId, metadata = {}) {
  if (!propertyId || !isUuid(propertyId)) return;
  try {
    trackAppEvent('property_saved', {
      entityType: 'property',
      entityId: propertyId,
      metadata,
    });
  } catch {
    // Social proof telemetry must never interrupt swipes.
  }
}

function readFeedDeckSession(key, fallbackIds = []) {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(key) || '[]');
    const ids = Array.isArray(parsed) ? parsed.map((id) => String(id || '').trim()).filter(Boolean) : [];
    return ids.length ? ids : fallbackIds;
  } catch {
    return fallbackIds;
  }
}

function writeFeedDeckSession(key, ids = []) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify((ids || []).map((id) => String(id || '').trim()).filter(Boolean)));
  } catch {
    // Feed deck cache is only UI continuity; never block the feed.
  }
}

export function Dashboard({ page, nuggets, setModal, setPage, onOpenOnboardingTab, openUnlock, unlocked, matched, setMatched, interested, setInterested, purchases, setPurchases, userProfile, personalProfile, professionalProfile, propertyPortfolio, servicePortfolio, accountType, showcaseProperties, categoryOrder, setCategoryOrder, editMode, setEditMode, mobileBottomNavCollapsed = false, addToast, setSystemNotifications = null, isHydrationReady = true, isHydrationSyncing = false, subscription, propertyUnlocks = [], currentUserId = 'local-user', activeSpotlightKeys = new Set(), onOpenSpotlight = null, userPreferences = null }) {
  const isMobileViewport = useMediaQuery('(max-width: 767px)');
  const isTabletPortraitViewport = useMediaQuery('(min-width: 768px) and (max-width: 1080px) and (orientation: portrait)');
  const isTabletLandscapeViewport = useMediaQuery('(min-width: 768px) and (max-width: 1180px) and (orientation: landscape)');
  const isTabletPortraitWideViewport = useMediaQuery('(min-width: 900px) and (max-width: 1080px) and (orientation: portrait)');
  const isTouchModalViewport = useMediaQuery('(max-width: 1024px)');

  const MAX_SIDE_LIST_VISIBLE = 9; // Max visible items before scroll
  const SIDE_PANEL_HEIGHT = MAX_SIDE_LIST_VISIBLE * 54 + 44;
  const FEED_CARD_SCALE = 1;
  const FEED_CARD_BASE_WIDTH = isMobileViewport ? 360 : (isTabletPortraitViewport ? (isTabletPortraitWideViewport ? 650 : 552) : 654);
  const FEED_CARD_BASE_HEIGHT = isMobileViewport ? 576 : (isTabletPortraitViewport ? (isTabletPortraitWideViewport ? 390 : 370) : 400);
  const FEED_CARD_WIDTH = Math.round(FEED_CARD_BASE_WIDTH * FEED_CARD_SCALE);
  const FEED_CARD_HEIGHT = Math.round(FEED_CARD_BASE_HEIGHT * FEED_CARD_SCALE);
  const FEED_STACK_SHIFT_X = Math.round(20 * FEED_CARD_SCALE);
  const FEED_STACK_SHIFT_Y = Math.round(24 * FEED_CARD_SCALE);
  const feedStackBottomGap = isMobileViewport ? 72 : (isTabletPortraitViewport ? 58 : 160);
  const FEED_STACK_CONTAINER_HEIGHT = FEED_CARD_HEIGHT + feedStackBottomGap;
  const tabletFeedSideWidth = isTabletPortraitWideViewport ? 210 : 184;
  const tabletFeedGap = isTabletPortraitWideViewport ? 76 : 58;
  const tabletFeedSideOffset = tabletFeedSideWidth + tabletFeedGap + (isTabletPortraitWideViewport ? 52 : 42);
  const sidePanelHeight = isTabletPortraitViewport ? 510 : 550;
  const SWIPE_ANIM_MS = 380;
  const pendingFocusOnInit = readPendingFocusCard();
  const mobileBottomNavOffset = isMobileViewport ? (mobileBottomNavCollapsed ? 4 : 88) : 0;
  const tabletBottomNavOffset = isTabletPortraitViewport ? (mobileBottomNavCollapsed ? 6 : 88) : 0;
  const mobileDashboardBottomPadding = isMobileViewport
    ? (mobileBottomNavCollapsed ? 104 : 156)
    : (isTabletPortraitViewport ? (mobileBottomNavCollapsed ? 94 : 148) : 62);
  const mobileMiniCardsBandHeight = isMobileViewport ? 78 : 0;
  const mobileActionDockBottom = isMobileViewport
    ? (mobileBottomNavOffset + mobileMiniCardsBandHeight + 12)
    : 20;
  const PROPERTY_BLUE = '#4381bc';
  const t = useT('dashboard').dashboard;
  const navT = useT('dashboard').nav;
  const cardsT = useT('dashboard').cards;
  const matchesT = useT('dashboard').matches;

  const [activeCat, setActiveCat] = useState(() => {
    try { return localStorage.getItem('ds_activeCat') || 'all'; } catch (e) { void e; return 'all'; }
  });
  const [view, setView] = useState(() => pendingFocusOnInit?.type === 'property' ? 'properties' : 'connections');
  const [selectedStates, setSelectedStates] = useState(() => {
    try {
      const raw = localStorage.getItem('ds_selectedStates');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { void e; return []; }
  }); // empty => all
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileFeedSidebarOpen, setMobileFeedSidebarOpen] = useState(false);
  const [mobileFeedHandleOffsetY, setMobileFeedHandleOffsetY] = useState(0);
  const [isDraggingFeedHandle, setIsDraggingFeedHandle] = useState(false);
  const mobileFeedHandleDragRef = useRef({ active: false, pointerId: null, startY: 0, startOffsetY: 0 });
  const mobileFeedHandleSuppressClickRef = useRef(false);
  const mobileFeedTitleRef = useRef(null);
  const mobileFeedStackRef = useRef(null);
  const [mobileFeedHandleBaseTop, setMobileFeedHandleBaseTop] = useState(146);
  const [isMobileDockSuppressed, setIsMobileDockSuppressed] = useState(false);
  const isMobileDockSuppressedRef = useRef(false);
  const mobileDockSuppressTimerRef = useRef(null);
  const [matchCategoryDropdownOpen, setMatchCategoryDropdownOpen] = useState(false);
  const [interestStateDropdownOpen, setInterestStateDropdownOpen] = useState(false);
  const [selectedMatchCategories, setSelectedMatchCategories] = useState([]);
  const [selectedInterestStates, setSelectedInterestStates] = useState([]);
  const feedStorageKeys = useMemo(() => ({
    hiddenContacts: getUserScopedStorageKey('ds_feed_hidden_contacts', currentUserId),
    hiddenInterests: getUserScopedStorageKey('ds_feed_hidden_interests', currentUserId),
    archivedContacts: getUserScopedStorageKey('ds_matches_archived_contacts', currentUserId),
    archivedInterests: getUserScopedStorageKey('ds_matches_archived_interests', currentUserId),
    deletedContacts: getUserScopedStorageKey('ds_matches_deleted_contacts', currentUserId),
    deletedInterests: getUserScopedStorageKey('ds_matches_deleted_interests', currentUserId),
  }), [currentUserId]);
  const [feedHiddenContacts, setFeedHiddenContacts] = useState(() => readLocalStringSet(getUserScopedStorageKey('ds_feed_hidden_contacts', currentUserId)));
  const [feedHiddenInterests, setFeedHiddenInterests] = useState(() => readLocalStringSet(getUserScopedStorageKey('ds_feed_hidden_interests', currentUserId)));
  const [matchArchivedContacts, setMatchArchivedContacts] = useState(() => readLocalStringSet(getUserScopedStorageKey('ds_matches_archived_contacts', currentUserId)));
  const [matchArchivedInterests, setMatchArchivedInterests] = useState(() => readLocalStringSet(getUserScopedStorageKey('ds_matches_archived_interests', currentUserId)));
  const [matchDeletedContacts, setMatchDeletedContacts] = useState(() => readLocalStringSet(getUserScopedStorageKey('ds_matches_deleted_contacts', currentUserId)));
  const [matchDeletedInterests, setMatchDeletedInterests] = useState(() => readLocalStringSet(getUserScopedStorageKey('ds_matches_deleted_interests', currentUserId)));
  const [action, setAction] = useState(null);
  const [propAction, setPropAction] = useState(null);
  const [propStatusById, setPropStatusById] = useState({});
  const [skippedQueue, setSkippedQueue] = useState([]); // FIFO/LIFO queue for skipped cards (LIFO by default)
  const [skippedSet, setSkippedSet] = useState(new Set());
  const [skippedQueueProp, setSkippedQueueProp] = useState([]);
  const [skippedSetProp, setSkippedSetProp] = useState(new Set());
  const [hiddenSet, setHiddenSet] = useState(() => getHiddenSet());
  const [propertyHotMetrics, setPropertyHotMetrics] = useState({});

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFeedHiddenContacts(readLocalStringSet(feedStorageKeys.hiddenContacts));
      setFeedHiddenInterests(readLocalStringSet(feedStorageKeys.hiddenInterests));
      setMatchArchivedContacts(readLocalStringSet(feedStorageKeys.archivedContacts));
      setMatchArchivedInterests(readLocalStringSet(feedStorageKeys.archivedInterests));
      setMatchDeletedContacts(readLocalStringSet(feedStorageKeys.deletedContacts));
      setMatchDeletedInterests(readLocalStringSet(feedStorageKeys.deletedInterests));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [feedStorageKeys]);

  const getTrendingMilestone = (favoriteCount) => {
    const count = Number(favoriteCount || 0);
    if (count >= 100) return 100;
    if (count >= 50) return 50;
    if (count >= 25) return 25;
    if (count >= 10) return 10;
    return 0;
  };

  const propertyMetricIds = useMemo(() => (
    [...new Set((showcaseProperties || [])
      .filter((property) => isTruthyFlag(property?.publishToShowcase, true) && !property?.dealClosed && isUuid(property?.id))
      .map((property) => String(property.id)))]
      .slice(0, 150)
  ), [showcaseProperties]);

  const getEffectivePropertyExclusivityStatus = useCallback((property) => {
    const propertyStatus = getPropertyExclusivityStatus(propertyUnlocks, property?.id, currentUserId);
    if (propertyStatus?.kind === 'blocked' || propertyStatus?.kind === 'owned') return propertyStatus;

    const ownerStatus = getOwnerExclusivityStatus(propertyUnlocks, property?.ownerId, currentUserId);
    if (ownerStatus?.blocked) {
      return {
        kind: 'blocked',
        badge: ownerStatus.badge || 'Exclusive',
        unlockCount: propertyStatus?.unlockCount || 0,
        canBuyExclusivity: false,
        exclusiveCost: 0,
        expiresAt: ownerStatus.expiresAt,
        mode: ownerStatus.mode,
        ownerWide: true,
      };
    }

    return propertyStatus;
  }, [currentUserId, propertyUnlocks]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || propertyMetricIds.length === 0) {
      const timer = window.setTimeout(() => setPropertyHotMetrics({}), 0);
      return () => window.clearTimeout(timer);
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc('ds_get_property_engagement_metrics', {
          p_property_ids: propertyMetricIds,
        });
        if (error) throw error;
        if (!cancelled) setPropertyHotMetrics(mapPropertyHotMetrics(data || []));
      } catch (error) {
        if (import.meta.env.DEV) console.warn('[Dashboard] Property HOT metrics unavailable.', error);
        if (!cancelled) setPropertyHotMetrics({});
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [propertyMetricIds, propertyUnlocks.length]);

  useEffect(() => {
    if (!setSystemNotifications || !propertyHotMetrics || Object.keys(propertyHotMetrics).length === 0) return;

    const now = Date.now();
    const interestedIds = new Set((interested || []).map((item) => String(item?.id || '').trim()).filter(Boolean));
    const ownedIds = new Set((propertyPortfolio || []).map((item) => String(item?.id || '').trim()).filter(Boolean));

    const pushSystemNotification = (notification) => {
      setSystemNotifications((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        if (list.some((item) => item?.id === notification.id)) return list;
        return [notification, ...list].slice(0, 80);
      });
    };

    const claimTrendingNotification = (id) => {
      try {
        const raw = localStorage.getItem('ds_trending_notification_seen');
        const parsed = raw ? JSON.parse(raw) : [];
        const seen = new Set(Array.isArray(parsed) ? parsed.map(String) : []);
        if (seen.has(id)) return false;
        seen.add(id);
        localStorage.setItem('ds_trending_notification_seen', JSON.stringify([...seen].slice(-240)));
        return true;
      } catch {
        return true;
      }
    };

    (showcaseProperties || []).forEach((property) => {
      const propertyId = String(property?.id || '').trim();
      if (!propertyId || property?.dealClosed === true || isPendingDealExpired(property)) return;
      if (!isTruthyFlag(property?.publishToShowcase, true) || property?.isActive === false) return;

      const metrics = propertyHotMetrics[propertyId];
      const milestone = getTrendingMilestone(metrics?.favoriteCount);
      if (!milestone) return;

      const shortAddress = String(property?.address || cardsT?.property || 'Property').split(',')[0].trim();
      const unlockCount = Number(metrics?.unlockCount || 0);
      const favoriteCount = Number(metrics?.favoriteCount || 0);
      const matchCount = Number(metrics?.matchCount || 0);
      const isOwned = ownedIds.has(propertyId) || String(property?.ownerId || '') === String(currentUserId || '');
      const isFavoritedByCurrentUser = interestedIds.has(propertyId);
      const exclusivityStatus = getEffectivePropertyExclusivityStatus(property);

      if (isOwned) {
        const noticeId = `property-trending-owner-${propertyId}-${milestone}`;
        if (!claimTrendingNotification(noticeId)) return;
        const title = cardsT?.trendingOwnerNotificationTitle || 'Your property is trending';
        const messageTemplate = cardsT?.trendingOwnerNotificationMessage
          || '"{address}" reached {favoriteCount} saves, {unlockCount} unlocks and {matchCount} matches. Follow up while interest is warm.';
        pushSystemNotification({
          id: noticeId,
          title,
          message: messageTemplate
            .replace('{address}', shortAddress)
            .replace('{favoriteCount}', String(favoriteCount))
            .replace('{unlockCount}', String(unlockCount))
            .replace('{matchCount}', String(matchCount)),
          createdAt: now,
          read: false,
          type: 'property_trending_owner',
          propertyId,
        });
        addToast?.({
          type: 'success',
          title,
          message: messageTemplate
            .replace('{address}', shortAddress)
            .replace('{favoriteCount}', String(favoriteCount))
            .replace('{unlockCount}', String(unlockCount))
            .replace('{matchCount}', String(matchCount)),
          duration: 7000,
        });
      }

      if (isFavoritedByCurrentUser && !isOwned && exclusivityStatus?.kind !== 'blocked') {
        const noticeId = `property-trending-favorite-${propertyId}-${milestone}`;
        if (!claimTrendingNotification(noticeId)) return;
        const title = cardsT?.trendingFavoriteNotificationTitle || 'Saved opportunity is trending';
        const messageTemplate = cardsT?.trendingFavoriteNotificationMessage
          || '"{address}" is still available and now has {favoriteCount} saves. Review it before competition increases.';
        pushSystemNotification({
          id: noticeId,
          title,
          message: messageTemplate
            .replace('{address}', shortAddress)
            .replace('{favoriteCount}', String(favoriteCount))
            .replace('{unlockCount}', String(unlockCount))
            .replace('{matchCount}', String(matchCount)),
          createdAt: now,
          read: false,
          type: 'property_trending_favorite',
          propertyId,
        });
        addToast?.({
          type: 'info',
          title,
          message: messageTemplate
            .replace('{address}', shortAddress)
            .replace('{favoriteCount}', String(favoriteCount))
            .replace('{unlockCount}', String(unlockCount))
            .replace('{matchCount}', String(matchCount)),
          duration: 7000,
        });
      }
    });
  }, [addToast, cardsT, currentUserId, getEffectivePropertyExclusivityStatus, interested, propertyHotMetrics, propertyPortfolio, setSystemNotifications, showcaseProperties]);

  useEffect(() => {
    if (!isMobileViewport) {
      const timer = window.setTimeout(() => {
        setMobileFeedSidebarOpen(false);
        setDropdownOpen(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [isMobileViewport]);

  useEffect(() => {
    if (!isMobileViewport) return undefined;
    const onGuideStep = (event) => {
      const target = String(event?.detail?.target || '');
      if (target === '[data-guide="feed-categories"]') {
        setMobileFeedSidebarOpen(true);
        setDropdownOpen(false);
        return;
      }
      if (target) {
        setMobileFeedSidebarOpen(false);
        setDropdownOpen(false);
      }
    };
    window.addEventListener('ds-guidetip-step', onGuideStep);
    return () => window.removeEventListener('ds-guidetip-step', onGuideStep);
  }, [isMobileViewport]);

  const suppressMobileDockTemporarily = (durationMs = 1200) => {
    if (!isMobileDockSuppressedRef.current) {
      isMobileDockSuppressedRef.current = true;
      setIsMobileDockSuppressed(true);
    }
    if (mobileDockSuppressTimerRef.current) {
      window.clearTimeout(mobileDockSuppressTimerRef.current);
    }
    mobileDockSuppressTimerRef.current = window.setTimeout(() => {
      isMobileDockSuppressedRef.current = false;
      setIsMobileDockSuppressed(false);
      mobileDockSuppressTimerRef.current = null;
    }, durationMs);
  };

  useEffect(() => () => {
    if (mobileDockSuppressTimerRef.current) {
      window.clearTimeout(mobileDockSuppressTimerRef.current);
    }
    isMobileDockSuppressedRef.current = false;
  }, []);

  useEffect(() => {
    if (!isMobileViewport) return undefined;

    const updateFeedHandleBaseTop = () => {
      const stackRect = mobileFeedStackRef.current?.getBoundingClientRect?.();
      if (stackRect) {
        setMobileFeedHandleBaseTop(Math.round(stackRect.top + (FEED_CARD_HEIGHT * 0.22)));
        return;
      }
      const titleRect = mobileFeedTitleRef.current?.getBoundingClientRect?.();
      if (!titleRect) return;
      setMobileFeedHandleBaseTop(Math.round(titleRect.top + (titleRect.height / 2)));
    };

    updateFeedHandleBaseTop();
    window.addEventListener('resize', updateFeedHandleBaseTop);
    window.addEventListener('scroll', updateFeedHandleBaseTop, true);

    return () => {
      window.removeEventListener('resize', updateFeedHandleBaseTop);
      window.removeEventListener('scroll', updateFeedHandleBaseTop, true);
    };
  }, [isMobileViewport, view, activeCat, FEED_CARD_HEIGHT]);

  const clampFeedHandleOffset = (value) => Math.max(-220, Math.min(320, value));

  const handleFeedTabPointerDown = (event) => {
    if (!isMobileViewport || mobileFeedSidebarOpen) return;
    mobileFeedHandleSuppressClickRef.current = false;
    mobileFeedHandleDragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startY: event.clientY,
      startOffsetY: mobileFeedHandleOffsetY,
    };
    setIsDraggingFeedHandle(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleFeedTabPointerMove = (event) => {
    const dragState = mobileFeedHandleDragRef.current;
    if (!dragState.active) return;
    if (dragState.pointerId !== null && event.pointerId !== dragState.pointerId) return;
    const deltaY = event.clientY - dragState.startY;
    if (Math.abs(deltaY) > 4) mobileFeedHandleSuppressClickRef.current = true;
    setMobileFeedHandleOffsetY(clampFeedHandleOffset(dragState.startOffsetY + deltaY));
  };

  const handleFeedTabPointerEnd = (event) => {
    const dragState = mobileFeedHandleDragRef.current;
    if (!dragState.active) return;
    if (dragState.pointerId !== null && event.pointerId !== dragState.pointerId) return;
    mobileFeedHandleDragRef.current = { active: false, pointerId: null, startY: 0, startOffsetY: 0 };
    setIsDraggingFeedHandle(false);
  };

  const handleFeedTabClick = () => {
    if (mobileFeedHandleSuppressClickRef.current) {
      mobileFeedHandleSuppressClickRef.current = false;
      return;
    }
    setMobileFeedSidebarOpen(true);
  };

  // publishingProfileKey selects which local profile's ownerId is considered "me" for publishing
  const [publishingProfileKey, setPublishingProfileKey] = useState(() => {
    try { return localStorage.getItem('publishingProfileKey') || 'personal'; } catch (e) { void e; return 'personal'; }
  });

  // Auto-sync publishingProfileKey with accountType so feed filters match
  useEffect(() => {
    const expected = accountType === 'fsbo_owner'
      ? 'fsbo'
      : (accountType === 'professional' ? 'personal' : 'personal');
    if (publishingProfileKey !== expected) {
      const timer = window.setTimeout(() => setPublishingProfileKey(expected), 0);
      try { localStorage.setItem('publishingProfileKey', expected); } catch (e) { void e; }
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [accountType, publishingProfileKey]);

  const getOwnerIdForKey = useCallback((key) => {
    const liveUserId = String(currentUserId || '').trim();
    if (isSupabaseConfigured && liveUserId && liveUserId !== 'local-user') return liveUserId;
    try {
      const map = JSON.parse(localStorage.getItem('profileOwnerMap') || 'null');
      if (map && typeof map[key] !== 'undefined') {
        const mappedOwnerId = String(map[key] || '').trim();
        if (mappedOwnerId && mappedOwnerId !== '999999') return mappedOwnerId;
      }
    } catch (e) { void e; }
    // Production records must be tied to a real persisted owner id.
    if (key === 'personal') return personalProfile?.ownerId || personalProfile?.id || userProfile?.id || '';
    if (key === 'secondary') return professionalProfile?.ownerId || professionalProfile?.id || userProfile?.id || '';
    if (key === 'fsbo') return professionalProfile?.ownerIdC || professionalProfile?.ownerId || professionalProfile?.id || userProfile?.id || '';
    return userProfile?.id || '';
  }, [currentUserId, personalProfile, professionalProfile, userProfile]);

  const parseStateCode = useCallback((value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
    const m = raw.match(/(?:,\s*|\b)([A-Za-z]{2})(?:\s+\d{5}(?:-\d{4})?)?\s*$/);
    return m ? m[1].toUpperCase() : null;
  }, []);

  const collectRecordStates = useCallback((record) => {
    const direct = Array.isArray(record?.markets) ? record.markets : [];
    const fromDirect = direct.map((m) => parseStateCode(m)).filter(Boolean);
    if (fromDirect.length) return Array.from(new Set(fromDirect));

    const fallbacks = [record?.loc, record?.location, record?.city, record?.state]
      .map((v) => parseStateCode(v))
      .filter(Boolean);
    return Array.from(new Set(fallbacks));
  }, [parseStateCode]);

  const getRecordProfileScope = useCallback((record, fallbackScope = '') => {
    return inferRecordProfileScope(record, fallbackScope);
  }, []);

  const buildLocalProfileCard = useCallback((scopeKey = 'personal') => {
    const isSecondary = scopeKey === 'secondary';
    const isFsbo = scopeKey === 'fsbo';
    const profileScope = isSecondary ? 'professional' : (isFsbo ? 'fsbo' : 'personal');
    const scopedIdentity = resolveScopedProfile(profileScope, {
      accountType,
      userProfile,
      personalProfile,
      professionalProfile,
    });
    const scopedLoc = scopedIdentity?.loc || '';
    const ownerId = getOwnerIdForKey(scopeKey);
    const isOwnerRecord = (record) => {
      if (!record) return false;
      const recordOwnerId = String(record.ownerId || '').trim();
      const scopedOwnerId = String(ownerId || '').trim();
      const sessionOwnerId = String(currentUserId || userProfile?.id || '').trim();
      return Boolean(recordOwnerId) && (
        (scopedOwnerId && recordOwnerId === scopedOwnerId)
        || (sessionOwnerId && recordOwnerId === sessionOwnerId)
      );
    };
    const scopedProperties = (showcaseProperties || []).filter((p) => (
      isOwnerRecord(p)
      && getRecordProfileScope(p) === profileScope
      && isTruthyFlag(p.publishToShowcase, true)
    ));
    const scopedServices = (servicePortfolio || []).filter((s) => (
      isOwnerRecord(s)
      && getRecordProfileScope(s) === profileScope
      && isTruthyFlag(s.publishToConnections, true)
    ));
    const scopedMarkets = Array.from(new Set([
      ...scopedProperties.flatMap((p) => collectRecordStates(p)),
      ...scopedServices.flatMap((s) => collectRecordStates(s)),
      parseStateCode(scopedLoc),
    ].filter(Boolean)));
    const fsboStateCode = parseStateCode(scopedLoc || userProfile?.location) || scopedMarkets[0];
    const categoryId = scopedIdentity?.categoryId || '';
    const categoryLabel = CATEGORIES
      .filter((c) => c.id !== 'all')
      .flatMap((c) => (c.sub ? [{ ...c, sub: null }, ...c.sub] : [c]))
      .find((p) => p.id === categoryId)?.label;
    const hasText = (value) => String(value || '').trim().length > 0;
    const hasScopedIdentity = isSecondary
      ? [
        professionalProfile?.fullNameB,
        professionalProfile?.primaryPhoneB,
        professionalProfile?.emailB,
        professionalProfile?.photoB,
        professionalProfile?.photoBUrl,
        professionalProfile?.categoryB,
        professionalProfile?.primaryCategoryB,
        professionalProfile?.pitchB,
      ].some(hasText)
      : isFsbo
        ? [
          personalProfile?.fullName,
          personalProfile?.loc,
          personalProfile?.primaryPhone,
          personalProfile?.email,
          personalProfile?.photo,
          personalProfile?.cardPriorityC,
        ].some(hasText)
        : [
          professionalProfile?.fullNameA,
          professionalProfile?.locA,
          professionalProfile?.primaryPhoneA,
          professionalProfile?.emailA,
          professionalProfile?.photoA,
          professionalProfile?.category,
          professionalProfile?.primaryCategory,
          professionalProfile?.pitch,
        ].some(hasText);
    const typeLabel = isSecondary
      ? (categoryLabel || scopedIdentity?.categoryLabelFallback || '')
      : (isFsbo ? 'FSBO' : (categoryLabel || scopedIdentity?.categoryLabelFallback || ''));
    const profileDescription = String(scopedIdentity?.pitch || '').trim();
    const normalizedProfileDescription = profileDescription.toLowerCase();
    const normalizedTypeLabel = String(typeLabel || '').trim().toLowerCase();
    const rawRating = Number(scopedIdentity?.rating);
    const rawReviews = Number(scopedIdentity?.reviews);
    const rawDeals = Number(scopedIdentity?.deals);

    return {
      id: `local:${scopeKey}:${ownerId}`,
      ownerId,
      scopeKey,
      name: scopedIdentity?.name || '',
      type: hasScopedIdentity ? typeLabel : '',
      badge: hasScopedIdentity ? (scopedIdentity?.badge || '') : '',
      loc: isFsbo ? (fsboStateCode || '') : (scopedIdentity?.loc || ''),
      photo: scopedIdentity?.photo || '',
      // Profile cards must use profile-origin fields only (no portfolio synthesis).
      rating: Number.isFinite(rawRating) && rawRating > 0 ? rawRating : 0,
      reviews: Number.isFinite(rawReviews) && rawReviews > 0 ? Math.round(rawReviews) : 0,
      deals: Number.isFinite(rawDeals) && rawDeals > 0 ? Math.round(rawDeals) : 0,
      cat: hasScopedIdentity ? (scopedIdentity?.categoryId || scopedIdentity?.categoryLabelFallback || '') : '',
      desc: (!isFsbo && profileDescription && normalizedProfileDescription !== normalizedTypeLabel)
        ? profileDescription
        : '',
      portfolioCount: scopedProperties.length + scopedServices.length,
      primaryProfile: profileScope,
      markets: scopedMarkets,
      contactMethods: scopedIdentity?.contactMethods || [],
      primaryPhone: scopedIdentity?.primaryPhone || '',
      secondaryPhone: scopedIdentity?.secondaryPhone || '',
      tertiaryPhone: scopedIdentity?.tertiaryPhone || '',
      email: scopedIdentity?.email || '',
      verified: scopedIdentity?.verified === true,
    };
  }, [accountType, currentUserId, userProfile, personalProfile, professionalProfile, showcaseProperties, servicePortfolio, getOwnerIdForKey, collectRecordStates, parseStateCode, getRecordProfileScope]);
  const normalizeCardPriority = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized || normalized === 'select') return '';
    if (normalized === 'primary' || normalized === 'secondary' || normalized === 'tertiary') return normalized;
    return '';
  };
  const hasPublishableLocalProfileCard = (card) => {
    if (!card) return false;
    const ownerId = String(card.ownerId || '').trim();
    const name = String(card.name || '').trim();
    if (!ownerId || !name || /^new user$/i.test(name)) return false;
    if (Number(card.portfolioCount || 0) <= 0) return false;
    return Boolean(
      String(card.type || '').trim()
      || String(card.badge || '').trim()
      || String(card.photo || '').trim()
      || String(card.primaryPhone || '').trim()
      || String(card.email || '').trim()
      || String(card.desc || '').trim()
      || Number(card.portfolioCount || 0) > 0
    );
  };
  const cardPriorityAResolved = accountType === 'fsbo_owner'
    ? ''
    : (professionalProfile?.cardPriorityA || '');
  const cardPriorityCResolved = personalProfile?.cardPriorityC || '';
  const priorityByScopeForFeed = useMemo(() => ({
    personal: normalizeCardPriority(cardPriorityAResolved),
    professional: normalizeCardPriority(professionalProfile?.cardPriorityB || ''),
    fsbo: normalizeCardPriority(cardPriorityCResolved),
  }), [cardPriorityAResolved, professionalProfile?.cardPriorityB, cardPriorityCResolved]);
  const publishedProfileScopeSet = useMemo(() => new Set(
    Object.entries(priorityByScopeForFeed)
      .filter(([, priority]) => Boolean(priority))
      .map(([scope]) => normalizeProfileScope(scope))
  ), [priorityByScopeForFeed]);

  const connectionCards = useMemo(() => {
    // Inclui sempre o card pessoal (A) e, se existir, o secundário (B), desde que não estejam em 'select'.
    const cards = [];
    // Card pessoal (A)
    const personalPriority = priorityByScopeForFeed.personal;
    if (personalPriority !== '') {
      const cardA = buildLocalProfileCard('personal');
      if (hasPublishableLocalProfileCard(cardA)) {
        cards.push({
          ...cardA,
          markets: cardA.markets || [],
          _priority: personalPriority,
          _isDimmed: personalPriority === '',
        });
      }
    }
    // Card secundário (B)
    const secondaryPriority = priorityByScopeForFeed.professional;
    if (secondaryPriority !== '') {
      const cardB = buildLocalProfileCard('secondary');
      if (hasPublishableLocalProfileCard(cardB)) {
        cards.push({
          ...cardB,
          markets: cardB.markets || [],
          _priority: secondaryPriority,
          _isDimmed: secondaryPriority === '',
        });
      }
    }
    // Card FSBO (C)
    const fsboPriority = priorityByScopeForFeed.fsbo;
    if (fsboPriority !== '') {
      const cardC = buildLocalProfileCard('fsbo');
      if (hasPublishableLocalProfileCard(cardC)) {
        cards.push({
          ...cardC,
          markets: cardC.markets || [],
          _priority: fsboPriority,
          _isDimmed: fsboPriority === '',
        });
      }
    }
    // Static mock cards are useful in local development, but production feeds must
    // come from real published records to avoid showing stale/fantom profiles.
    const staticCards = import.meta.env.DEV
      ? CARDS.filter((c) => !cards.some(card => String(card.id) === String(c.id)))
      : [];
    const localOwnerIds = new Set([
      String(getOwnerIdForKey('personal')),
      String(getOwnerIdForKey('secondary')),
      String(getOwnerIdForKey('fsbo')),
      String(currentUserId || ''),
    ].filter(Boolean));
    const mockOwnerIdsForConnections = new Set((CARDS || []).map((c) => String(c.id)));
    const globalProfileKeys = Array.from(new Set([
      ...(servicePortfolio || []).map((s) => {
        const ownerId = String(s?.ownerId || '').trim();
        const scope = getRecordProfileScope(s);
        return ownerId && scope ? `${ownerId}::${scope}` : '';
      }),
      ...(showcaseProperties || []).map((p) => {
        const ownerId = String(p?.ownerId || '').trim();
        const scope = getRecordProfileScope(p);
        return ownerId && scope ? `${ownerId}::${scope}` : '';
      }),
    ].filter((key) => {
      const [ownerId] = String(key || '').split('::');
      return ownerId && !localOwnerIds.has(ownerId) && !mockOwnerIdsForConnections.has(ownerId);
    })));
    const globalCards = globalProfileKeys.map((profileKey) => {
      const [ownerId, scope = ''] = String(profileKey || '').split('::');
      const normalizedScope = normalizeProfileScope(scope);
      if (!ownerId || !normalizedScope) return null;
      const props = (showcaseProperties || []).filter((p) => (
        String(p.ownerId) === ownerId
        && getRecordProfileScope(p) === normalizedScope
      ));
      const services = (servicePortfolio || []).filter((s) => (
        String(s.ownerId) === ownerId
        && getRecordProfileScope(s) === normalizedScope
        && isTruthyFlag(s.publishToConnections, true)
      ));
      const firstService = services[0] || null;
      const firstProperty = props[0] || null;
      const ownerPreview = firstService?.ownerPreview || firstProperty?.ownerPreview || null;
      if (!ownerPreview?.name) return null;
      const serviceImages = services.flatMap(s => (s.media && s.media.images) ? s.media.images : []);
      const propertyImages = props.flatMap((p) => Array.isArray(p.images) ? p.images : []);
      const markets = Array.from(new Set([
        ...props.flatMap((p) => collectRecordStates(p)),
        ...services.flatMap((s) => collectRecordStates(s)),
      ].filter(Boolean)));
      const profileLocation = String(ownerPreview?.loc || '').trim();
      const location = profileLocation || markets[0] || [firstProperty?.city, firstProperty?.state].filter(Boolean).join(', ') || '';
      const name = String(ownerPreview?.name || '').trim();
      if (!name) return null;
      const type = String(ownerPreview?.type || firstService?.category || '').trim();
      const isFsboOwner = normalizedScope === 'fsbo';
      const desc = isFsboOwner ? '' : String(firstService?.description || '').trim();
      return normalizeCard({
        cardKind: 'person',
        id: `${ownerId}:${normalizedScope}`,
        ownerId,
        scopeKey: normalizedScope === 'professional' ? 'secondary' : normalizedScope,
        primaryProfile: normalizedScope,
        name,
        type,
        badge: ownerPreview?.badge || '',
        loc: location,
        photo: ownerPreview?.photo || '',
        images: serviceImages.length ? serviceImages : propertyImages,
        rating: 0,
        reviews: 0,
        deals: 0,
        cat: ownerPreview?.cat || firstService?.category || '',
        desc: isFsboOwner ? '' : (ownerPreview?.desc || desc),
        email: ownerPreview?.email || '',
        primaryPhone: ownerPreview?.primaryPhone || '',
        portfolioCount: props.length + services.length,
        markets,
        contactMethods: ownerPreview?.contactMethods || [],
        verified: ownerPreview?.verified === true,
        ownerPreview: { ...ownerPreview, primaryProfile: normalizedScope },
        linkedProperties: props,
        linkedServices: services,
        _priority: 'tertiary',
      }, currentUserId);
    }).filter(Boolean);
    const enriched = staticCards.map((c) => {
      try {
        const props = (showcaseProperties || []).filter((p) => String(p.ownerId) === String(c.id));
        const first = props && props.length ? props[0] : null;
        const services = (servicePortfolio || []).filter(s => String(s.ownerId) === String(c.id) && isTruthyFlag(s.publishToConnections, true));
        const serviceDescriptions = services.filter(s => s.description && String(s.description).trim().length).map(s => String(s.description).trim());
        const serviceImages = services.flatMap(s => (s.media && s.media.images) ? s.media.images : []);
        const descFromServices = serviceDescriptions.length ? serviceDescriptions.join(' • ') : null;
        return {
          ...c,
          ownerId: c.id,
          portfolioCount: props.length,
          images: (c.images && c.images.length) ? c.images : (serviceImages && serviceImages.length) ? serviceImages : (first ? first.images || [] : []),
          desc: (c.desc && String(c.desc).trim().length) ? c.desc : (descFromServices ? descFromServices : (first && first.description ? first.description : c.desc)),
          markets: Array.from(new Set([
            ...props.flatMap((p) => collectRecordStates(p)),
            ...services.flatMap((s) => collectRecordStates(s)),
            ...collectRecordStates(c),
          ])),
        };
      } catch {
        return c;
      }
    });
    // Garante pelo menos 1 card pessoal visível
    return [...cards, ...globalCards, ...enriched];
  }, [showcaseProperties, servicePortfolio, buildLocalProfileCard, collectRecordStates, getOwnerIdForKey, currentUserId, priorityByScopeForFeed.personal, priorityByScopeForFeed.professional, priorityByScopeForFeed.fsbo, getRecordProfileScope]);

  // Showcase items: only properties published to the showcase should appear here.
  // Usar propertyPortfolio como fonte para garantir sincronização visual/lógica
  const showcaseItems = useMemo(() => {
    try {
      // IDs dos perfis reais do usuário
      const personalOwnerId = getOwnerIdForKey('personal');
      const secondaryOwnerId = getOwnerIdForKey('secondary');
      const fsboOwnerId = getOwnerIdForKey('fsbo');
      // IDs dos cards mockados
      const mockOwnerIds = (CARDS || []).map(c => String(c.id));
      // Imóveis reais do usuário
      const localOwnerIds = [
        String(personalOwnerId || ''),
        String(secondaryOwnerId || ''),
        String(fsboOwnerId || ''),
        String(currentUserId || ''),
        String(userProfile?.id || ''),
      ].filter(Boolean);
      const userProperties = (showcaseProperties || [])
        .filter((p) => {
          if (!isTruthyFlag(p.publishToShowcase, true)) return false;
          if (p?.dealClosed === true || isPendingDealExpired(p)) return false;
          const propertyOwnerId = String(p?.ownerId || '').trim();
          const isLocalProperty = propertyOwnerId && localOwnerIds.includes(propertyOwnerId);
          if (isLocalProperty) {
            return publishedProfileScopeSet.has(getRecordProfileScope(p));
          }
          return true;
        });
      // Imóveis mockados (vinculados aos cards fakes)
      const mockProperties = import.meta.env.DEV
        ? (PROPERTIES || []).filter((p) => mockOwnerIds.includes(String(p.ownerId)) && isTruthyFlag(p.publishToShowcase, true))
        : [];
      // Retornar imóveis do usuário e mockados, cada um com seu ownerId original
      return [
        ...userProperties.map((p) => {
          const normalizedScope = getRecordProfileScope(p);
          if (!normalizedScope) return null;
          const scopeKey = normalizedScope === 'professional'
            ? 'secondary'
            : (normalizedScope === 'fsbo' ? 'fsbo' : 'personal');
          return normalizeCard({
            ...p,
            cardKind: 'property',
            _source: 'property',
            markets: collectRecordStates(p),
            ownerPreview: localOwnerIds.includes(String(p.ownerId || '')) ? buildLocalProfileCard(scopeKey) : (p.ownerPreview || null),
          }, currentUserId);
        }).filter(Boolean),
        ...mockProperties.map((p) => {
          // ownerId permanece do card fake
          const ownerCard = CARDS.find(c => String(c.id) === String(p.ownerId));
          return {
            ...p,
            _source: 'property',
            markets: collectRecordStates(p),
            ownerPreview: ownerCard || null,
          };
        })
      ];
    } catch {
      return [];
    }
  }, [showcaseProperties, buildLocalProfileCard, collectRecordStates, getOwnerIdForKey, currentUserId, userProfile, publishedProfileScopeSet, getRecordProfileScope]);

  const findConnectionById = useCallback((id) => {
    const needle = String(id);
    return connectionCards.find((c) => (
      String(c.id) === needle
      || String(c.ownerId) === needle
      || String(c.unlockOwnerId) === needle
      || String(c.contactId) === needle
      || String(c.unlockContactId) === needle
      || String(c.sourceCardId) === needle
    ));
  }, [connectionCards]);

  const getFocusCandidates = useCallback((focus) => {
    if (!focus) return [];
    return Array.from(new Set([
      focus.id,
      focus.ownerId,
      focus.unlockOwnerId,
      focus.sellerId,
      focus.contactId,
      focus.unlockContactId,
      focus.propertyId,
      focus.sourceCardId,
      focus.cardId,
    ].map((value) => String(value || '').trim()).filter(Boolean)));
  }, []);

  const matchesFocusTarget = useCallback((record, focus) => {
    if (!record || !focus) return false;
    const candidates = getFocusCandidates(focus);
    if (!candidates.length) return false;
    const recordIds = Array.from(new Set([
      record.id,
      record.ownerId,
      record.unlockOwnerId,
      record.sellerId,
      record.contactId,
      record.unlockContactId,
      record.propertyId,
      record.sourceCardId,
      record.cardId,
    ].map((value) => String(value || '').trim()).filter(Boolean)));
    const hasIdMatch = recordIds.some((value) => candidates.includes(value));
    if (!hasIdMatch) return false;
    const focusScope = normalizeProfileScope(focus.primaryProfile || focus.scope || '');
    const recordScope = normalizeProfileScope(record.primaryProfile || record.scope || record.profileScope || '');
    return !focusScope || !recordScope || focusScope === recordScope;
  }, [getFocusCandidates]);

  const resolvePropertyOwnerCard = useCallback((property) => {
    if (!property) return null;
    const ownerScope = getRecordProfileScope(property, '');
    const ownerScopeKey = ownerScope === 'professional' ? 'secondary' : (ownerScope === 'fsbo' ? 'fsbo' : (ownerScope ? 'personal' : ''));
    const propertyOwnerId = String(property.ownerId || '').trim();
    const ownerByScope = ownerScopeKey
      ? connectionCards.find((c) => c.scopeKey === ownerScopeKey && String(c.ownerId || c.id || '') === propertyOwnerId)
      : null;
    const ownerById = findConnectionById(propertyOwnerId);
    const ownerPreview = property.ownerPreview && (property.ownerPreview.id || property.ownerPreview.ownerId)
      ? { ...property.ownerPreview, ownerId: property.ownerPreview.ownerId || property.ownerPreview.id }
      : null;
    const mockOwnerCard = import.meta.env.DEV ? (CARDS || []).find((c) => String(c.id) === String(property.ownerId)) : null;

    return ownerPreview
      || ownerByScope
      || ownerById
      || (mockOwnerCard ? { ...mockOwnerCard, ownerId: mockOwnerCard.ownerId || mockOwnerCard.id } : null);
  }, [connectionCards, findConnectionById, getRecordProfileScope]);

  const getUnlockKeys = useCallback((itemOrId) => {
    if (itemOrId == null) return [];
    if (typeof itemOrId === 'string' || typeof itemOrId === 'number') {
      const key = String(itemOrId).trim();
      return key ? [key] : [];
    }
    return Array.from(new Set([
      itemOrId.ownerId,
      itemOrId.unlockOwnerId,
      itemOrId.sellerId,
      itemOrId.contactId,
      itemOrId.unlockContactId,
      itemOrId.id,
      itemOrId.sourceCardId,
    ].map((value) => String(value || '').trim()).filter(Boolean)));
  }, []);

  const unlockedIdSet = useMemo(() => new Set(
    (Array.isArray(unlocked) ? unlocked : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  ), [unlocked]);

  const isContactUnlocked = useCallback((itemOrId) => (
    getUnlockKeys(itemOrId).some((key) => unlockedIdSet.has(key))
  ), [getUnlockKeys, unlockedIdSet]);

  const getFeedDisplayCard = useCallback((card, unlockedForCurrentUser = false) => {
    if (unlockedForCurrentUser) return card;
    const ownerPreview = card?.ownerPreview && typeof card.ownerPreview === 'object'
      ? {
        ...card.ownerPreview,
        email: '',
        primaryPhone: '',
        phone: '',
      }
      : card?.ownerPreview;
    return {
      ...card,
      email: '',
      phone: '',
      primaryPhone: '',
      secondaryPhone: '',
      tertiaryPhone: '',
      whatsapp: '',
      ownerPreview,
    };
  }, []);

  // Circular deck: skip → rotate to back; match → remove permanently
  const feedDeckSessionPrefix = `ds_feed_deck_v1:${String(currentUserId || 'local-user')}`;
  const connDeckSessionKey = `${feedDeckSessionPrefix}:connections`;
  const propDeckSessionKey = `${feedDeckSessionPrefix}:showcase`;
  const [connDeck, setConnDeck] = useState(() => readFeedDeckSession(connDeckSessionKey, connectionCards.map(c => c.id).filter(id => !getHiddenSet().has(String(id)))));
  const [propDeck, setPropDeck] = useState(() => readFeedDeckSession(propDeckSessionKey, (showcaseItems || []).map(p => p.id).filter(id => !getHiddenSet().has(String(id)))));
  const [lastConnOp, setLastConnOp] = useState(null); // {type, card, snap}
  const [lastPropOp, setLastPropOp] = useState(null);
  const [injectedProps, setInjectedProps] = useState({});
  const [focusCard, setFocusCard] = useState(() => pendingFocusOnInit && pendingFocusOnInit.id ? pendingFocusOnInit : null);
  const [myCardModal, setMyCardModal] = useState({ open: false, scope: 'personal' });
  const [myCardShowcaseIdx, setMyCardShowcaseIdx] = useState(0);
  const myCardShowcaseScrollRef = useRef(null);
  const myCardShowcaseScrollEndTimerRef = useRef(null);
  const myCardShowcaseTouchStartIdxRef = useRef(null);
  const myCardShowcaseTouchActiveRef = useRef(false);
  const connDeckOrderSignatureRef = useRef('');
  const propDeckOrderSignatureRef = useRef('');
  const [ratingTooltipScope, setRatingTooltipScope] = useState(null);
  const [isSwipingConn, setIsSwipingConn] = useState(false);
  const [isSwipingProp, setIsSwipingProp] = useState(false);

  useEffect(() => {
    writeFeedDeckSession(connDeckSessionKey, connDeck);
  }, [connDeckSessionKey, connDeck]);

  useEffect(() => {
    writeFeedDeckSession(propDeckSessionKey, propDeck);
  }, [propDeckSessionKey, propDeck]);

  // Keep feeds buyer-specific: a contact should leave the general feed only
  // for the user who already unlocked it. A purchase must not hide the card
  // globally while the owner still has the record published.
  useEffect(() => {
    if (isSwipingConn || isSwipingProp) return;
    const blockedContactIds = new Set([...(unlocked || [])].map((id) => String(id)));
    if (blockedContactIds.size === 0) return;
    const timer = window.setTimeout(() => {
      // Always remove blocked contacts from the connections deck.
      setConnDeck(prevDeck => prevDeck.filter(id => !blockedContactIds.has(String(id))));

      // Only remove properties owned by blocked contacts from the properties *discover* when
      // the view is showing connections. When the user switches to the Showcase view,
      // keep showcase properties visible so owners' portfolios remain accessible.
      if (view === 'connections') {
        // Never block the current user's own properties from the discover feed.
        const selfOwnerId = getOwnerIdForKey(publishingProfileKey);
        setPropDeck(prevDeck =>
          prevDeck.filter(id => {
            const prop = (showcaseItems || []).find(p => p.id === id);
            if (!prop) return true;
            if (prop.ownerId === selfOwnerId) return true;
            return !blockedContactIds.has(String(prop.ownerId));
          })
        );
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [unlocked, showcaseProperties, showcaseItems, view, publishingProfileKey, isSwipingConn, isSwipingProp, getOwnerIdForKey]);

  const matchesCat = useCallback((catVal, cat) => {
    if (cat === "all") return true;
    const parent = CATEGORIES.find(x => x.sub && x.sub.some(s => s.id === cat));
    return parent ? catVal === parent.id : catVal === cat;
  }, []);

  useEffect(() => {
    if (isSwipingConn || isSwipingProp) return;
    // Update connections and properties decks based on matches, interests, blocked contacts and hidden set
    const updateDecks = () => {
      const matchedIds = new Set((matched || []).map(m => m.id));
      const interestedIds = new Set((interested || []).map(p => p.id));
      const blockedContactIds = new Set([...(unlocked || [])].map((id) => String(id)));
      const selectedStateSet = new Set((selectedStates || []).filter((s) => s && s !== 'all'));
      const stateFilterActive = selectedStateSet.size > 0;
      const categoryFilterActive = activeCat !== 'all';

      const ownerCategoryByOwnerId = new Map();
      (connectionCards || []).forEach((card) => {
        const category = String(card?.cat || '').trim();
        if (!category) return;
        ownerCategoryByOwnerId.set(String(card.id), category);
        ownerCategoryByOwnerId.set(String(card.ownerId), category);
      });
      const selfOwnerIds = new Set([
        String(currentUserId || ''),
        String(getOwnerIdForKey('personal')),
        String(getOwnerIdForKey('secondary')),
        String(getOwnerIdForKey('fsbo')),
      ].filter(Boolean));
      const rawSortOrder = String(userPreferences?.feedMatches?.sortOrder || 'random').trim();
      const paidPlanId = String(subscription?.planId || subscription?.id || 'free').trim().toLowerCase();
      const hasPaidFeedOrdering = paidPlanId !== 'free' && paidPlanId !== 'basic';
      const sortPreferenceByLegacyOrder = {
        random: 'default',
        recent: 'newest',
        newest: 'newest',
        hot: 'hot',
        trending: 'trending',
        my_cards_first: 'my_cards_first',
      };
      const effectiveSortOrder = rawSortOrder === 'my_cards_first'
        ? (hasPaidFeedOrdering ? 'my_cards_first' : 'default')
        : (sortPreferenceByLegacyOrder[rawSortOrder] || 'default');
      const feedSortSeed = `${String(currentUserId || 'anon')}:${String(activeCat || 'all')}:${(selectedStates || []).join(',') || 'all'}`;
      const deckContext = {
        currentUserId,
        activeFilters: {},
        sessionSeed: feedSortSeed,
        sortPreference: effectiveSortOrder,
      };
      const isAllowedByState = (record) => {
        if (!stateFilterActive) return true;
        const recordStates = collectRecordStates(record);
        return recordStates.some((code) => selectedStateSet.has(code));
      };

      const isAllowedByCategory = (card) => {
        if (!categoryFilterActive) return true;
        return matchesCat(card?.cat, activeCat);
      };

      const isPropertyAllowedByCategory = (prop) => {
        if (!categoryFilterActive) return true;
        const ownerCategory = ownerCategoryByOwnerId.get(String(prop?.ownerId ?? ''));
        if (!ownerCategory) return false;
        return matchesCat(ownerCategory, activeCat);
      };

      const preferredStateSet = new Set([
        ...collectRecordStates(userProfile || {}),
        ...collectRecordStates(personalProfile || {}),
        ...collectRecordStates(professionalProfile || {}),
      ].filter(Boolean));

      const scoreByFreshness = (record) => {
        const time = Date.parse(record?.createdAt || record?.updatedAt || record?.created_at || record?.updated_at || '');
        if (!Number.isFinite(time)) return 0;
        const ageDays = Math.max(0, (Date.now() - time) / 86400000);
        return Math.max(0, 12 - Math.min(12, ageDays));
      };

      const scoreByStateAffinity = (record) => {
        const states = collectRecordStates(record);
        if (!states.length || preferredStateSet.size === 0) return 0;
        return states.some((state) => preferredStateSet.has(state)) ? 24 : 0;
      };

      const getConnectionRank = (card) => {
        if (!card) return -9999;
        const ownerId = String(card.ownerId || card.id || '');
        const ownPenalty = selfOwnerIds.has(ownerId) || selfOwnerIds.has(String(card.id || '')) ? -1000 : 0;
        const categoryScore = activeCat !== 'all' && matchesCat(card?.cat, activeCat) ? 26 : 0;
        const priorityScore = card._priority === 'primary' ? 12 : (card._priority === 'secondary' ? 8 : (card._priority === 'tertiary' ? 4 : 0));
        const portfolioScore = Math.min(18, Number(card.portfolioCount || 0) * 3);
        const verifiedScore = card.verified ? 8 : 0;
        return ownPenalty + categoryScore + priorityScore + portfolioScore + verifiedScore + scoreByStateAffinity(card) + scoreByFreshness(card);
      };

      const getPropertyRank = (prop) => {
        if (!prop) return -9999;
        const ownerId = String(prop.ownerId || '');
        const ownPenalty = selfOwnerIds.has(ownerId) ? -1000 : 0;
        const metrics = propertyHotMetrics?.[String(prop.id)] || {};
        const hotScore = Math.min(30, Number(metrics.unlockCount || 0) * 10 + Number(metrics.favoriteCount || 0));
        const pendingPenalty = prop.pendingDeal ? -24 : 0;
        const priceScore = Number(prop.price || 0) > 0 ? 4 : 0;
        return ownPenalty + hotScore + pendingPenalty + priceScore + scoreByStateAffinity(prop) + scoreByFreshness(prop);
      };

      // Build new connection deck respecting filters.
      // Start from the current connDeck (preserve rotations) and fall back to canonical order.
      const canonicalConn = orderDeck((connectionCards || []).map((card) => ({
        ...card,
        isOwnCard: card?.isOwnCard === true
          || selfOwnerIds.has(String(card?.ownerId || ''))
          || selfOwnerIds.has(String(card?.id || '')),
        hotScore: getConnectionRank(card),
      })), {
        ...deckContext,
        sessionSeed: `connections:${feedSortSeed}`,
      }).map(c => c.id);
      const baseConn = (connDeck && connDeck.length) ? connDeck : canonicalConn;
      let newConn = baseConn.filter(id => {
        if (focusCard && focusCard.type === 'person' && matchesFocusTarget({ id }, focusCard)) return true;
        const card = connectionCards.find((c) => String(c.id) === String(id));
        if (!card || !isAllowedByState(card) || !isAllowedByCategory(card)) return false;
        if (matchedIds.has(id)) return false;
        if (interestedIds.has(id)) return false;
        if (blockedContactIds.has(String(id))) return false;
        if (hiddenSet && hiddenSet.has && hiddenSet.has(String(id))) return false;
        return true;
      });
      // Append any canonical items that pass filters but aren't in baseConn (new items)
      for (const id of canonicalConn) {
        if (!newConn.find(x => String(x) === String(id))) {
          if (focusCard && focusCard.type === 'person' && matchesFocusTarget({ id }, focusCard)) {
            newConn.push(id);
            continue;
          }
          const card = connectionCards.find((c) => String(c.id) === String(id));
          if (!card || !isAllowedByState(card) || !isAllowedByCategory(card)) continue;
          if (matchedIds.has(id)) continue;
          if (interestedIds.has(id)) continue;
          if (blockedContactIds.has(String(id))) continue;
          if (hiddenSet && hiddenSet.has && hiddenSet.has(String(id))) continue;
          newConn.push(id);
        }
      }

      // If there's a focusCard for a person, move it to the front
      if (focusCard && focusCard.type === 'person' && focusCard.id) {
        const focusCandidates = getFocusCandidates(focusCard);
        // Try to find the existing id in the newConn (preserve original type)
        const match = newConn.find(x => focusCandidates.includes(String(x)));
        if (typeof match !== 'undefined') {
          newConn = [match, ...newConn.filter(x => String(x) !== String(match))];
        } else {
          // If not found, try to resolve from connectionCards (preserve type), otherwise insert raw
          const fromCards = connectionCards.find(c => matchesFocusTarget(c, focusCard));
          const idToInsert = fromCards ? fromCards.id : focusCard.id;
          // remove existing occurrence then insert at front
          newConn = [idToInsert, ...newConn.filter(x => String(x) !== String(idToInsert))];
        }
      }
      const connOrderSignature = JSON.stringify({
        sort: effectiveSortOrder,
        seed: `connections:${feedSortSeed}`,
        ids: canonicalConn.map((id) => String(id)),
      });
      const shouldReorderConn = !focusCard && (
        !connDeckOrderSignatureRef.current
        || connDeckOrderSignatureRef.current !== connOrderSignature
        || !(connDeck && connDeck.length)
      );
      if (shouldReorderConn) {
        const orderedIds = orderDeck(newConn
          .map((id) => connectionCards.find((c) => String(c.id) === String(id)))
          .filter(Boolean)
          .map((card) => ({
            ...card,
            isOwnCard: card?.isOwnCard === true
              || selfOwnerIds.has(String(card?.ownerId || ''))
              || selfOwnerIds.has(String(card?.id || '')),
            hotScore: getConnectionRank(card),
          })), {
          ...deckContext,
          sessionSeed: `connections:${feedSortSeed}`,
        }).map((card) => card.id);
        if (orderedIds.length === newConn.length) newConn = orderedIds;
        connDeckOrderSignatureRef.current = connOrderSignature;
      }

      // Only update state if the deck actually changed (avoid triggering re-renders)
      const arraysEqual = (a, b) => {
        if (!Array.isArray(a) || !Array.isArray(b)) return false;
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) if (String(a[i]) !== String(b[i])) return false;
        return true;
      };

      if (!arraysEqual(newConn, connDeck)) setConnDeck(newConn);

      const selfOwnerId = getOwnerIdForKey(publishingProfileKey);
      // Preserve propDeck rotations similarly
      const canonicalProp = orderDeck((showcaseItems || []).map((prop) => ({
        ...prop,
        isOwnCard: prop?.isOwnCard === true || selfOwnerIds.has(String(prop?.ownerId || '')),
        hotScore: getPropertyRank(prop),
      })), {
        ...deckContext,
        sessionSeed: `showcase:${feedSortSeed}`,
      }).map(p => p.id);
      const baseProp = (propDeck && propDeck.length) ? propDeck : canonicalProp;
      const shouldKeepPropertyVisible = (prop) => {
        if (!prop) return false;
        if (!isPropertyAllowedByCategory(prop)) return false;
        if (!isAllowedByState(prop)) return false;
        if (interestedIds.has(prop.id)) return false;
        if (String(prop.ownerId) === String(selfOwnerId)) return true;
        if (view !== 'connections') return true;
        return !blockedContactIds.has(String(prop.ownerId));
      };

      let newProp = baseProp.filter(id => {
        if (focusCard && focusCard.type === 'property' && matchesFocusTarget({ id }, focusCard)) return true;
        const prop = (showcaseItems || []).find(p => p.id === id);
        return shouldKeepPropertyVisible(prop);
      });

      for (const id of canonicalProp) {
        if (!newProp.find(x => String(x) === String(id))) {
          const prop = (showcaseItems || []).find(p => p.id === id);
          if (!prop) {
            newProp.push(id);
            continue;
          }
          if (focusCard && focusCard.type === 'property' && matchesFocusTarget({ id }, focusCard)) {
            newProp.push(id);
            continue;
          }
          if (shouldKeepPropertyVisible(prop)) newProp.push(id);
        }
      }

      // If focusCard targets a property, move it to front (inject if needed)
      if (focusCard && focusCard.type === 'property' && focusCard.id) {
        const focusCandidates = getFocusCandidates(focusCard);
        // preserve original id types when moving
        const match = newProp.find(x => focusCandidates.includes(String(x)));
        if (typeof match !== 'undefined') {
          newProp = [match, ...newProp.filter(x => String(x) !== String(match))];
        } else {
          // Dev-only: try to inject mock properties for local sandbox focus tests.
          const found = import.meta.env.DEV ? PROPERTIES.find(p => matchesFocusTarget(p, focusCard)) : null;
          if (found) {
            setInjectedProps(prev => (prev && prev[found.id] ? prev : ({ ...prev, [found.id]: found })));
            newProp = [found.id, ...newProp];
          } else {
            newProp = [focusCard.id, ...newProp];
          }
        }
      }
      const propOrderSignature = JSON.stringify({
        sort: effectiveSortOrder,
        seed: `showcase:${feedSortSeed}`,
        ids: canonicalProp.map((id) => String(id)),
      });
      const shouldReorderProp = !focusCard && (
        !propDeckOrderSignatureRef.current
        || propDeckOrderSignatureRef.current !== propOrderSignature
        || !(propDeck && propDeck.length)
      );
      if (shouldReorderProp) {
        const orderedIds = orderDeck(newProp
          .map((id) => (showcaseItems || []).find((p) => String(p.id) === String(id)))
          .filter(Boolean)
          .map((prop) => ({
            ...prop,
            isOwnCard: prop?.isOwnCard === true || selfOwnerIds.has(String(prop?.ownerId || '')),
            hotScore: getPropertyRank(prop),
          })), {
          ...deckContext,
          sessionSeed: `showcase:${feedSortSeed}`,
        }).map((prop) => prop.id);
        if (orderedIds.length === newProp.length) newProp = orderedIds;
        propDeckOrderSignatureRef.current = propOrderSignature;
      }

      if (!arraysEqual(newProp, propDeck)) setPropDeck(newProp);

      // Keep focus request active until the user performs an action in the feed.
    };

    updateDecks();

    // Subscribe to hidden set updates so decks respond to hide/unhide actions
    const unsub = subscribeHidden((next) => {
      setHiddenSet(next);
    });

    return () => { if (typeof unsub === 'function') unsub(); };
  }, [connectionCards, showcaseItems, matched, interested, unlocked, view, publishingProfileKey, hiddenSet, focusCard, selectedStates, activeCat, isSwipingConn, isSwipingProp, collectRecordStates, connDeck, propDeck, getOwnerIdForKey, matchesCat, currentUserId, userProfile, personalProfile, professionalProfile, propertyHotMetrics, userPreferences, subscription, getFocusCandidates, matchesFocusTarget]);

  const [planGate, setPlanGate] = useState(null);

  const openPlanGate = useCallback((feature) => {
    const copy = getPlanGateCopy(feature);
    trackAppEvent('plan_gate_shown', {
      entityType: 'feature',
      entityId: feature,
      metadata: { feature: String(feature || '') },
    });
    addToast?.({ type: 'warning', title: copy.title, message: copy.message, duration: 6500 });
    setPlanGate({ ...copy, feature });
  }, [addToast]);

  const goToPricingFromGate = useCallback(() => {
    if (planGate?.feature) {
      trackAppEvent('plan_gate_upgrade_clicked', {
        entityType: 'feature',
        entityId: planGate.feature,
        metadata: { feature: String(planGate.feature || '') },
      });
    }
    setPlanGate(null);
    setPage?.('pricing');
  }, [planGate, setPage]);

  const categoryLabelById = useMemo(() => {
    const labels = new Map();
    CATEGORIES.forEach((c) => {
      labels.set(c.id, c.label);
      (c.sub || []).forEach((s) => labels.set(s.id, s.label));
    });
    return labels;
  }, []);

  const categoryLookup = useMemo(() => {
    const labelByKey = new Map();
    const aliasToKeys = new Map();
    const addAlias = (alias, ...keys) => {
      const normalizedAlias = String(alias || '').trim().toLowerCase();
      if (!normalizedAlias) return;
      const current = aliasToKeys.get(normalizedAlias) || new Set();
      keys.filter(Boolean).forEach((key) => current.add(String(key).trim().toLowerCase()));
      aliasToKeys.set(normalizedAlias, current);
    };

    CATEGORIES.forEach((category) => {
      const categoryId = String(category.id || '').trim().toLowerCase();
      if (!categoryId || categoryId === 'all') return;
      labelByKey.set(categoryId, category.label);
      addAlias(category.id, categoryId);
      addAlias(category.label, categoryId);
      (category.sub || []).forEach((subCategory) => {
        const subId = String(subCategory.id || '').trim().toLowerCase();
        if (!subId) return;
        labelByKey.set(subId, subCategory.label);
        addAlias(subCategory.id, subId, categoryId);
        addAlias(subCategory.label, subId, categoryId);
      });
    });

    return { labelByKey, aliasToKeys };
  }, []);

  const getContactCategoryKeys = useCallback((contact) => {
    const keys = new Set();
    [
      contact?.cat,
      contact?.category,
      contact?.type,
      contact?.role,
      contact?.sub,
      contact?.badge,
      contact?.primaryCategory,
      contact?.primary_category,
    ].forEach((value) => {
      const raw = String(value || '').trim();
      if (!raw) return;
      const normalized = raw.toLowerCase();
      keys.add(normalized);
      const mapped = categoryLookup.aliasToKeys.get(normalized);
      if (mapped) mapped.forEach((key) => keys.add(key));
    });
    return keys;
  }, [categoryLookup]);

  const getFeedContactKeys = useCallback((contact) => (
    [contact?.unlockOwnerId, contact?.ownerId, contact?.contactId, contact?.id]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  ), []);

  const getFeedInterestKey = useCallback((interest) => (
    String(interest?.id || interest?.propertyId || interest?.property_id || '').trim()
  ), []);

  const hideContactFromFeed = useCallback((contact) => {
    const keys = getFeedContactKeys(contact);
    if (!keys.length) return;
    setFeedHiddenContacts((prev) => {
      const next = new Set(prev);
      keys.forEach((key) => next.add(key));
      writeLocalStringSet(feedStorageKeys.hiddenContacts, next);
      return next;
    });
  }, [feedStorageKeys.hiddenContacts, getFeedContactKeys]);

  const hideInterestFromFeed = useCallback((interest) => {
    const key = getFeedInterestKey(interest);
    if (!key) return;
    setFeedHiddenInterests((prev) => {
      const next = new Set(prev);
      next.add(key);
      writeLocalStringSet(feedStorageKeys.hiddenInterests, next);
      return next;
    });
  }, [feedStorageKeys.hiddenInterests, getFeedInterestKey]);

  const dedupedMatched = useMemo(
    () => matched.filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i),
    [matched],
  );

  const consumeLimitedFeedActions = useCallback(async (actions = []) => {
    if (!actions.length) return true;
    if (!isSupabaseConfigured || !supabase || !currentUserId || currentUserId === 'local-user') {
      openPlanGate(actions[0]);
      return false;
    }
    try {
      const result = await consumePlanActions(supabase, actions);
      if (!result?.allowed) {
        openPlanGate(result.failedAction || result.feature || result.action || actions[0]);
        return false;
      }
      return true;
    } catch {
      addToast?.({
        type: 'warning',
        title: 'Plan usage unavailable',
        message: 'Could not confirm your plan limits right now. Please try again.',
      });
      return false;
    }
  }, [addToast, currentUserId, openPlanGate]);

  const matchCategoryOptions = useMemo(() => {
    const seen = new Set();
    const out = [];
    dedupedMatched.forEach((m) => {
      getContactCategoryKeys(m).forEach((id) => {
        if (!id || id === 'all' || seen.has(id)) return;
        seen.add(id);
        out.push({ id, label: categoryLookup.labelByKey.get(id) || categoryLabelById.get(id) || id });
      });
    });
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [dedupedMatched, categoryLabelById, categoryLookup, getContactCategoryKeys]);

  const filteredMatched = useMemo(() => {
    const chosen = new Set(selectedMatchCategories.map((cat) => String(cat || '').trim().toLowerCase()).filter(Boolean));
    return dedupedMatched.filter((m) => {
      const contactKeys = getFeedContactKeys(m);
      if (contactKeys.some((key) => feedHiddenContacts.has(key) || matchArchivedContacts.has(key) || matchDeletedContacts.has(key))) return false;
      if (!chosen.size) return true;
      const categoryKeys = getContactCategoryKeys(m);
      return [...chosen].some((cat) => categoryKeys.has(cat));
    });
  }, [dedupedMatched, selectedMatchCategories, getContactCategoryKeys, getFeedContactKeys, feedHiddenContacts, matchArchivedContacts, matchDeletedContacts]);

  const interestStateOptions = useMemo(() => {
    const states = Array.from(new Set(
      interested.flatMap((item) => collectRecordStates(item)).filter(Boolean)
    ));
    states.sort();
    return states;
  }, [interested, collectRecordStates]);

  const filteredInterested = useMemo(() => {
    const chosen = new Set(selectedInterestStates);
    return interested.filter((item) =>
      !feedHiddenInterests.has(getFeedInterestKey(item))
      && !matchArchivedInterests.has(getFeedInterestKey(item))
      && !matchDeletedInterests.has(getFeedInterestKey(item))
      && !getFeedContactKeys({ ownerId: item?.ownerId }).some((key) => matchArchivedContacts.has(key))
      && !getFeedContactKeys({ ownerId: item?.ownerId }).some((key) => matchDeletedContacts.has(key))
      && (!chosen.size ||
      collectRecordStates(item).some((code) => chosen.has(code))
      )
    );
  }, [interested, selectedInterestStates, collectRecordStates, feedHiddenInterests, matchArchivedInterests, matchDeletedInterests, getFeedInterestKey, getFeedContactKeys, matchArchivedContacts, matchDeletedContacts]);
  const getExplicitRecordProfileScope = (record) => {
    return getRecordProfileScope(record);
  };
  const activeUnlockedMatchesCount = useMemo(() => {
    const matchedIds = new Set((matched || []).map((m) => String(m?.id || '').trim()).filter(Boolean));
    const unlockedIds = new Set((unlocked || []).map((id) => String(id || '').trim()).filter(Boolean));
    let total = 0;
    unlockedIds.forEach((id) => {
      if (matchedIds.has(id)) total += 1;
    });
    return total;
  }, [matched, unlocked]);
  const normalizePriorityValue = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'select') return '';
    if (normalized === 'primary' || normalized === 'secondary' || normalized === 'tertiary') return normalized;
    return '';
  };
  const profilePriorityA = cardPriorityAResolved;
  const profilePriorityB = professionalProfile?.cardPriorityB || '';
  const profilePriorityC = cardPriorityCResolved;

  const profileKeyToScope = (profileKey) => {
    if (!profileKey) return '';
    if (profileKey === 'secondary') return 'professional';
    if (profileKey === 'fsbo') return 'fsbo';
    return 'personal';
  };

  const scopeToProfileKey = (scope) => (scope ? (scope === 'professional' ? 'secondary' : (scope === 'fsbo' ? 'fsbo' : 'personal')) : '');
  const scopeToModalKey = (scope) => (scope ? (scope === 'professional' ? 'secondary' : (scope === 'fsbo' ? 'fsbo' : 'personal')) : '');

  const priorityByProfileKey = {
    personal: normalizePriorityValue(profilePriorityA),
    secondary: normalizePriorityValue(profilePriorityB),
    fsbo: normalizePriorityValue(profilePriorityC),
  };
  const profileKeyByPriority = Object.entries(priorityByProfileKey).reduce((acc, [profileKey, priority]) => {
    if (priority && !acc[priority]) acc[priority] = profileKey;
    return acc;
  }, {});

  const primaryProfileKey = profileKeyByPriority.primary || null;
  const secondaryProfileKey = primaryProfileKey && profileKeyByPriority.secondary && profileKeyByPriority.secondary !== primaryProfileKey
    ? profileKeyByPriority.secondary
    : null;
  const primaryVisibleScope = profileKeyToScope(primaryProfileKey);
  const secondaryVisibleScope = secondaryProfileKey ? profileKeyToScope(secondaryProfileKey) : null;

  const secondaryModalKey = secondaryVisibleScope ? scopeToModalKey(secondaryVisibleScope) : null;
  const primaryCardData = primaryProfileKey ? buildLocalProfileCard(primaryProfileKey) : null;
  const secondaryCardData = secondaryProfileKey ? buildLocalProfileCard(secondaryProfileKey) : null;
  const hasRegisteredLocalProfileCard = (card) => {
    if (!card) return false;
    return Boolean(
      String(card.name || '').trim()
      || String(card.photo || '').trim()
      || String(card.primaryPhone || '').trim()
      || String(card.email || '').trim()
      || String(card.type || '').trim()
      || String(card.cat || '').trim()
      || String(card.desc || '').trim()
    );
  };
  const fallbackRegisteredProfileKey = useMemo(() => {
    const keys = ['personal', 'secondary', 'fsbo'];
    return keys.find((key) => hasRegisteredLocalProfileCard(buildLocalProfileCard(key))) || null;
  }, [buildLocalProfileCard]);
  const visiblePrimaryProfileKey = primaryProfileKey || fallbackRegisteredProfileKey;
  const visiblePrimaryScope = profileKeyToScope(visiblePrimaryProfileKey);
  const visiblePrimaryModalKey = scopeToModalKey(visiblePrimaryScope);
  const visiblePrimaryCardData = primaryCardData || (fallbackRegisteredProfileKey ? buildLocalProfileCard(fallbackRegisteredProfileKey) : null);
  const countByScope = (scope) => {
    const key = scopeToProfileKey(scope);
    const ownerId = getOwnerIdForKey(key);
    const profileScope = scope === 'professional' ? 'professional' : (scope === 'fsbo' ? 'fsbo' : 'personal');
    const isOwnerRecord = (record) => {
      if (!record) return false;
      const recordOwnerId = String(record.ownerId || '').trim();
      const scopedOwnerId = String(ownerId || '').trim();
      const sessionOwnerId = String(currentUserId || userProfile?.id || '').trim();
      return Boolean(recordOwnerId) && (
        (scopedOwnerId && recordOwnerId === scopedOwnerId)
        || (sessionOwnerId && recordOwnerId === sessionOwnerId)
      );
    };
    const propertiesCount = (propertyPortfolio || []).filter((p) => (
      isOwnerRecord(p)
      && getRecordProfileScope(p) === profileScope
      && isTruthyFlag(p.publishToShowcase, true)
      && p.isActive !== false
      && p.dealClosed !== true
    )).length;
    const servicesCount = (servicePortfolio || []).filter((s) => (
      isOwnerRecord(s)
      && getRecordProfileScope(s) === profileScope
      && isTruthyFlag(s.publishToConnections, true)
      && s.dealClosed !== true
    )).length;
    return { propertiesCount, servicesCount };
  };
  const _primaryScopeCounts = primaryVisibleScope
    ? countByScope(primaryVisibleScope)
    : { propertiesCount: 0, servicesCount: 0 };
  const _secondaryScopeCounts = secondaryVisibleScope ? countByScope(secondaryVisibleScope) : { propertiesCount: 0, servicesCount: 0 };
  void _primaryScopeCounts;
  void _secondaryScopeCounts;
  const getScopedPublishedRecords = (scopeKey) => {
    const profileScope = scopeKey === 'secondary' ? 'professional' : (scopeKey === 'fsbo' ? 'fsbo' : 'personal');
    const localOwnerIds = new Set([
      String(getOwnerIdForKey('personal')),
      String(getOwnerIdForKey('secondary')),
      String(getOwnerIdForKey('fsbo')),
      String(currentUserId || userProfile?.id || ''),
    ]);

    const isOwnerRecord = (record) => {
      if (!record) return false;
      const recordOwnerId = String(record.ownerId || '').trim();
      return recordOwnerId !== '' && localOwnerIds.has(recordOwnerId);
    };

    const properties = (showcaseProperties || []).filter((p) => {
      if (!isOwnerRecord(p)) return false;
      if (!isTruthyFlag(p.publishToShowcase, true)) return false;
      if (p.isActive === false) return false;
      if (p.dealClosed === true) return false;
      return getRecordProfileScope(p) === profileScope;
    });

    const services = (servicePortfolio || []).filter((s) => {
      if (!isOwnerRecord(s)) return false;
      if (!isTruthyFlag(s.publishToConnections, true)) return false;
      if (s.dealClosed === true) return false;
      return getRecordProfileScope(s) === profileScope;
    });

    return { profileScope, properties, services };
  };

  const countLinkedCardsForModalScope = (scopeKey) => {
    const scoped = getScopedPublishedRecords(scopeKey);
    return Math.max(0, scoped.properties.length + scoped.services.length);
  };

  // My Card should mirror the "show in" toggles directly for the current scope.
  const getMyCardScopedRecords = useCallback((scopeKey) => {
    const profileScope = scopeKey === 'secondary' ? 'professional' : (scopeKey === 'fsbo' ? 'fsbo' : 'personal');
    const ownerId = String(getOwnerIdForKey(scopeKey) || '').trim();
    const isScopedOwnerRecord = (record) => {
      const recordOwnerId = String(record?.ownerId || '').trim();
      const sessionOwnerId = String(currentUserId || userProfile?.id || '').trim();
      return Boolean(recordOwnerId) && (
        (Boolean(ownerId) && recordOwnerId === ownerId)
        || (Boolean(sessionOwnerId) && recordOwnerId === sessionOwnerId)
      );
    };
    // Use propertyPortfolio for real-time state (not showcaseProperties)
    // Filter by show in = ON and matching profile scope.
    const properties = (propertyPortfolio || []).filter((p) => {
      return isScopedOwnerRecord(p)
        && isTruthyFlag(p.publishToShowcase, true)
        && p?.dealClosed !== true
        && !isPendingDealExpired(p)
        && getRecordProfileScope(p) === profileScope;
    });
    const services = (servicePortfolio || []).filter((s) => {
      return isScopedOwnerRecord(s)
        && isTruthyFlag(s.publishToConnections, true)
        && s?.dealClosed !== true
        && getRecordProfileScope(s) === profileScope;
    });
    return { properties, services };
  }, [getOwnerIdForKey, propertyPortfolio, servicePortfolio, currentUserId, userProfile, getRecordProfileScope]);

  const countMyCardLinkedCardsForScope = (scopeKey) => {
    const scoped = getMyCardScopedRecords(scopeKey);
    return Math.max(0, scoped.properties.length + scoped.services.length);
  };

  const primaryLinkedCardsCount = visiblePrimaryModalKey
    ? countMyCardLinkedCardsForScope(visiblePrimaryModalKey)
    : 0;
  const secondaryScopedRecords = secondaryModalKey
    ? getScopedPublishedRecords(secondaryModalKey)
    : { properties: [], services: [] };
  const secondaryPublishedProperties = secondaryScopedRecords.properties;
  const secondaryPublishedServices = secondaryScopedRecords.services;
  const isInitialDashboardHydrating = isSupabaseConfigured && !isHydrationReady;
  const hasSecondaryProfile = Boolean(
    !isInitialDashboardHydrating
    &&
    secondaryVisibleScope
    && secondaryModalKey
    && hasPublishableLocalProfileCard(secondaryCardData)
  );
  const secondaryLinkedCardsCount = hasSecondaryProfile
    ? countMyCardLinkedCardsForScope(secondaryModalKey)
    : 0;

  const displayPrimaryLinkedCardsCount = isInitialDashboardHydrating ? 0 : primaryLinkedCardsCount;
  const profileName = isInitialDashboardHydrating ? 'Syncing profile...' : (visiblePrimaryCardData?.name || 'New User');
  const profileLocation = isInitialDashboardHydrating
    ? (isHydrationSyncing ? 'Syncing saved data' : 'Loading saved data')
    : (visiblePrimaryCardData?.loc || 'Location not set');
  const primaryProfileBadgeLabel = !visiblePrimaryScope
    ? 'Profile'
    : visiblePrimaryScope === 'professional'
    ? 'Business'
    : (visiblePrimaryScope === 'fsbo' ? 'FSBO' : 'Personal');
  const secondaryProfileBadgeLabel = secondaryVisibleScope === 'professional'
    ? 'Business'
    : (secondaryVisibleScope === 'fsbo' ? 'FSBO' : 'Personal');
  const _activePrimaryCategoryId = primaryVisibleScope === 'professional'
    ? (professionalProfile?.primaryCategoryB || professionalProfile?.categoryB || '')
    : (professionalProfile?.primaryCategory || professionalProfile?.category || '');
  void _activePrimaryCategoryId;
  const activePrimaryCategoryLabel = isInitialDashboardHydrating ? 'Syncing...' : (String(visiblePrimaryCardData?.type || '').trim() || 'Not set');
  const countClosedDealsForScope = (scope) => {
    const normalizedScope = normalizeProfileScope(scope);
    return (propertyPortfolio || []).filter((p) => (
      Boolean(p?.dealClosed)
      && getExplicitRecordProfileScope(p) === normalizedScope
    )).length;
  };

  const computeProfileReliabilityScore = (scope) => {
    const identity = resolveScopedProfile(scope, {
      accountType,
      userProfile,
      personalProfile,
      professionalProfile,
    });
    const checks = [
      String(identity?.name || '').trim().length > 0,
      String(identity?.loc || '').trim().length > 0,
      String(identity?.email || '').trim().length > 0 || String(identity?.primaryPhone || '').trim().length > 0,
      Array.isArray(identity?.contactMethods) && identity.contactMethods.length > 0,
    ];
    const passed = checks.filter(Boolean).length;
    return (passed / checks.length) * 15;
  };

  const computePublishedReliabilityScore = (scopeKey) => {
    const scoped = getScopedPublishedRecords(scopeKey);
    const total = scoped.properties.length + scoped.services.length;
    if (!total) return 0;

    let qualitySum = 0;
    scoped.properties.forEach((p) => {
      const checks = [
        String(p?.address || '').trim().length > 0,
        String(p?.city || '').trim().length > 0,
        Number(p?.price) > 0,
        (Array.isArray(p?.images) && p.images.length > 0) || Boolean(p?.image),
      ];
      qualitySum += checks.filter(Boolean).length / checks.length;
    });
    scoped.services.forEach((s) => {
      const checks = [
        String(s?.title || '').trim().length > 0,
        String(s?.category || '').trim().length > 0,
        Array.isArray(s?.media?.images) && s.media.images.length > 0,
      ];
      qualitySum += checks.filter(Boolean).length / checks.length;
    });

    return (qualitySum / total) * 15;
  };

  const computeScopeRatingDetails = (scopeKey) => {
    const scope = scopeKey === 'secondary' ? 'professional' : (scopeKey === 'fsbo' ? 'fsbo' : 'personal');
    const publishedCardsCount = countLinkedCardsForModalScope(scopeKey);
    const closedDealsCount = countClosedDealsForScope(scope);

    const interactionScore = Math.min(
      40,
      Math.min(activeUnlockedMatchesCount, 12) * 2.2
      + Math.min((interested || []).length, 20) * 0.8
      + Math.min((purchases || []).length, 10) * 0.8
    );
    const publishedScore = Math.min(30, publishedCardsCount * 3);
    const reliabilityScore = Math.min(30, computeProfileReliabilityScore(scope) + computePublishedReliabilityScore(scopeKey));
    const closedDealsBonus = Math.min(10, closedDealsCount * 2);
    const total = Math.min(100, interactionScore + publishedScore + reliabilityScore + closedDealsBonus);

    const label = (publishedCardsCount === 0 && activeUnlockedMatchesCount === 0 && closedDealsCount === 0)
      ? '-'
      : Math.max(1, total / 20).toFixed(1);

    return {
      label,
      interactionScore,
      publishedScore,
      reliabilityScore,
      closedDealsBonus,
      total,
    };
  };

  const emptyRatingDetails = { label: '-', interactionScore: 0, publishedScore: 0, reliabilityScore: 0, closedDealsBonus: 0, total: 0 };
  const primaryRatingDetails = visiblePrimaryModalKey ? computeScopeRatingDetails(visiblePrimaryModalKey) : emptyRatingDetails;
  const secondaryRatingDetails = hasSecondaryProfile ? computeScopeRatingDetails(secondaryModalKey) : emptyRatingDetails;

  const matchedCount = activeUnlockedMatchesCount;
  const dealsCount = visiblePrimaryScope ? countClosedDealsForScope(visiblePrimaryScope) : 0;
  const ratingLabel = primaryRatingDetails.label;

  // Secondary (profile B) derived display values — keep in parity with primary profile
  const secondaryAnchor = secondaryPublishedProperties[0] || secondaryPublishedServices[0] || null;
  const profileNameB = secondaryCardData?.name || 'Not set';
  const profileLocationB = secondaryCardData?.loc || (([secondaryAnchor?.city, secondaryAnchor?.state].filter(Boolean).join(', ')) || 'Not set');
  const profileThumbB = secondaryCardData?.photo || '';
  const operationsPrimaryCategoryId = hasSecondaryProfile
    ? (secondaryVisibleScope === 'professional' ? (professionalProfile?.primaryCategoryB || professionalProfile?.categoryB || '') : '')
    : '';
  const profileRoleLineB = (() => {
    if (secondaryVisibleScope === 'fsbo') return 'FSBO';
    if (secondaryVisibleScope === 'personal') return 'Personal';
    const flatCategories = CATEGORIES
      .filter((c) => c.id !== 'all')
      .flatMap((c) => (c.sub ? [{ ...c, sub: null }, ...c.sub] : [c]));
    const found = flatCategories.find((c) => c.id === operationsPrimaryCategoryId);
    if (found?.label) return found.label;
    return String(operationsPrimaryCategoryId || '').trim() || 'Not set';
  })();
  const matchedCountB = activeUnlockedMatchesCount;
  const dealsCountB = hasSecondaryProfile ? countClosedDealsForScope(secondaryVisibleScope) : 0;
  const ratingLabelB = secondaryRatingDetails.label;

  const renderRatingTooltip = (details) => (
    <div style={{
      position: 'absolute',
      bottom: 'calc(100% + 6px)',
      right: 0,
      minWidth: 196,
      borderRadius: 8,
      border: `1px solid ${C.border}`,
      background: C.card,
      boxShadow: `0 8px 20px ${C.alpha('#000', 0.22)}`,
      padding: '8px 9px',
      zIndex: 35,
      textAlign: 'left',
    }}>
      <div style={{ fontSize: 9, color: C.t3, textTransform: 'uppercase', marginBottom: 5 }}>Rating score</div>
      <div style={{ display: 'grid', gap: 2, fontSize: 10, color: C.t2, lineHeight: 1.3 }}>
        <div>Interação: {details.interactionScore.toFixed(1)} / 40</div>
        <div>Publicações: {details.publishedScore.toFixed(1)} / 30</div>
        <div>Confiabilidade: {details.reliabilityScore.toFixed(1)} / 30</div>
        <div>Deals fechados: +{details.closedDealsBonus.toFixed(1)} / 10</div>
      </div>
      <div style={{ marginTop: 6, paddingTop: 5, borderTop: `1px solid ${C.border}`, fontSize: 10, fontWeight: 700, color: C.t1 }}>
        Total: {details.total.toFixed(1)} / 100
      </div>
    </div>
  );

  const myCardPreviewData = useMemo(() => {
    const scopeKey = myCardModal.scope === 'secondary' ? 'secondary' : (myCardModal.scope === 'fsbo' ? 'fsbo' : 'personal');
    const ownerId = getOwnerIdForKey(scopeKey);
    const profileCard = buildLocalProfileCard(scopeKey);
    const scopedPublished = getMyCardScopedRecords(scopeKey);
    const dedupeRecords = (records, fallbackPrefix) => {
      const seen = new Set();
      return (records || []).filter((record, index) => {
        const key = String(record?.id || `${fallbackPrefix}:${record?.title || record?.address || index}`).trim();
        const ownerKey = String(record?.ownerId || ownerId || '').trim();
        const contentKey = [
          fallbackPrefix,
          ownerKey,
          getRecordProfileScope(record),
          String(record?.address || record?.title || '').trim().toLowerCase(),
          String(record?.city || '').trim().toLowerCase(),
          String(record?.state || record?.loc || '').trim().toLowerCase(),
          String(record?.price || '').trim(),
        ].join('|');
        if (!key || seen.has(key)) return false;
        if (seen.has(contentKey)) return false;
        seen.add(key);
        seen.add(contentKey);
        return true;
      });
    };
    const publishedPropertiesScoped = dedupeRecords(scopedPublished.properties, 'property');
    const publishedServicesScoped = dedupeRecords(scopedPublished.services, 'service');

    const showcaseItems = [
      ...publishedPropertiesScoped.map((p) => ({ ...p, _itemType: 'property' })),
      ...publishedServicesScoped.map((s) => ({ ...s, _itemType: 'service' })),
    ];

    return {
      profileCard,
      properties: publishedPropertiesScoped,
      services: publishedServicesScoped,
      showcaseItems,
      ownerId,
      scopeKey,
      scopeLabel: scopeKey === 'secondary' ? 'Operations' : (scopeKey === 'fsbo' ? 'FSBO' : 'Personal'),
    };
  }, [myCardModal.scope, buildLocalProfileCard, getMyCardScopedRecords, getOwnerIdForKey, getRecordProfileScope]);

  const toggleMyCardModal = (scope) => {
    setMyCardModal((prev) => {
      if (prev.open && prev.scope === scope) return { open: false, scope };
      return { open: true, scope };
    });
    setMyCardShowcaseIdx(0);
    // Em mobile, fecha a sidebar para não sobrepor o modal MyCard
    if (isMobileViewport) setMobileFeedSidebarOpen(false);
  };

  const handlePrimaryMyCardClick = (event) => {
    event?.stopPropagation?.();
    if (visiblePrimaryModalKey) {
      toggleMyCardModal(visiblePrimaryModalKey);
      return;
    }
    openOnboardingForScope('personal');
  };

  const settleMyCardShowcaseIndex = useCallback((container) => {
    if (!container) return;
    const width = container.clientWidth || 0;
    const totalItems = myCardPreviewData.showcaseItems.length;
    if (!width || totalItems <= 0) return;

    let nextIdx = Math.round(container.scrollLeft / width);
    nextIdx = Math.max(0, Math.min(totalItems - 1, nextIdx));

    if (myCardShowcaseTouchActiveRef.current && Number.isFinite(myCardShowcaseTouchStartIdxRef.current)) {
      const startIdx = Number(myCardShowcaseTouchStartIdxRef.current);
      const minIdx = Math.max(0, startIdx - 1);
      const maxIdx = Math.min(totalItems - 1, startIdx + 1);
      nextIdx = Math.max(minIdx, Math.min(maxIdx, nextIdx));

      const targetLeft = width * nextIdx;
      if (Math.abs(container.scrollLeft - targetLeft) > 1) {
        container.scrollTo({ left: targetLeft, behavior: 'smooth' });
      }
    }

    setMyCardShowcaseIdx((prev) => (prev === nextIdx ? prev : nextIdx));
    myCardShowcaseTouchActiveRef.current = false;
    myCardShowcaseTouchStartIdxRef.current = null;
  }, [myCardPreviewData.showcaseItems.length]);

  const queueMyCardShowcaseSettle = useCallback((container, delay = 90) => {
    if (myCardShowcaseScrollEndTimerRef.current) {
      window.clearTimeout(myCardShowcaseScrollEndTimerRef.current);
    }
    myCardShowcaseScrollEndTimerRef.current = window.setTimeout(() => {
      settleMyCardShowcaseIndex(container);
      myCardShowcaseScrollEndTimerRef.current = null;
    }, delay);
  }, [settleMyCardShowcaseIndex]);

  const handleMyCardShowcaseScroll = (event) => {
    if (myCardShowcaseTouchActiveRef.current) return;
    const container = event.currentTarget;
    queueMyCardShowcaseSettle(container, 90);
  };

  const handleMyCardShowcaseTouchStart = () => {
    myCardShowcaseTouchActiveRef.current = true;
    myCardShowcaseTouchStartIdxRef.current = myCardShowcaseIdx;
  };

  const handleMyCardShowcaseTouchEnd = (event) => {
    const container = event.currentTarget;
    queueMyCardShowcaseSettle(container, 80);
  };

  const openOnboardingForScope = (scope) => {
    if (isMobileViewport) {
      addToast?.({ type: 'info', title: t.desktopOnlyTitle || 'Use desktop', message: t.desktopOnlyProfileEdit || 'Profile and portfolio editing is available on the desktop version of the app.' });
      return;
    }
    const normalizedScope = String(scope || '').trim().toLowerCase();
    const onboardingTab = (
      normalizedScope === 'professional'
      || normalizedScope === 'secondary'
      || normalizedScope === 'business'
      || normalizedScope === 'operation'
      || normalizedScope === 'operations'
    )
      ? 'professional'
      : (normalizedScope === 'fsbo' || normalizedScope === 'fsbo_owner' ? 'fsbo' : 'personal');

    if (typeof onOpenOnboardingTab === 'function') {
      onOpenOnboardingTab(onboardingTab);
      return;
    }
    setPage('onboarding');
  };

  // Registration status is based on any saved profile identity, not on card
  // priority or published portfolio. Existing users must not be prompted as
  // first-access users just because they have no primary deck card yet.
  const quickRegistered = isInitialDashboardHydrating
    ? true
    : hasRegisteredLocalProfileCard(visiblePrimaryCardData);
  const showRegistrationNeeded = !isInitialDashboardHydrating && !quickRegistered;

  // Persist active category and selected states across navigation/login
  useEffect(() => {
    try { localStorage.setItem('ds_activeCat', activeCat); } catch (e) { void e; }
  }, [activeCat]);

  useEffect(() => {
    try { localStorage.setItem('ds_selectedStates', JSON.stringify(selectedStates || [])); } catch (e) { void e; }
  }, [selectedStates]);

  // When the app navigates to the dashboard (page prop), check for a pending
  // focusCard set by other views (e.g., MapView) and apply it. This covers the
  // case where Dashboard is already mounted but was hidden when the focus was
  // requested.
  React.useEffect(() => {
    if (page !== 'dashboard') return;
    try {
      const raw = localStorage.getItem('focusCard');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.id) return;
      window.setTimeout(() => {
        setFocusCard(parsed);
        if (parsed.type === 'person') setView('connections');
        else setView('properties');
      }, 0);
      localStorage.removeItem('focusCard');
    } catch (e) { void e; }
  }, [page]);

  useEffect(() => {
    if (isSupabaseConfigured) {
      try { localStorage.removeItem('ds_matched'); } catch { /* no-op */ }
      return;
    }
    try { localStorage.setItem('ds_matched', JSON.stringify(matched || [])); } catch (e) { void e; }
  }, [matched]);

  useEffect(() => {
    if (isSupabaseConfigured) {
      try { localStorage.removeItem('ds_interested'); } catch { /* no-op */ }
      return;
    }
    try { localStorage.setItem('ds_interested', JSON.stringify(interested || [])); } catch (e) { void e; }
  }, [interested]);

  const addMatchedCapped = (card) => {
    setMatched(prev => {
      if (!card || prev.find(x => x.id === card.id)) return prev;
      return [...prev, card];
    });
  };

  const stateOptions = useMemo(() => {
    try {
      const fromCards = connectionCards.flatMap((c) => collectRecordStates(c)).filter(Boolean);
      const fromItems = (showcaseItems || []).flatMap((p) => collectRecordStates(p)).filter(Boolean);
      const opts = Array.from(new Set([...fromCards, ...fromItems]));
      opts.sort();
      return ['all', ...opts];
    } catch { return ['all']; }
  }, [connectionCards, showcaseItems, collectRecordStates]);

  const activeStates = useMemo(
    () => (selectedStates || []).filter((s) => s && s !== 'all'),
    [selectedStates]
  );
  const hasActiveStates = activeStates.length > 0;
  const stateSummaryLabel = hasActiveStates ? `${activeStates.length} states` : 'All States';

  // Visible stack: apply focus prioritization synchronously to avoid first-frame flicker.
  const connDisplay = useMemo(() => {
    const base = connDeck
      .map((id) => findConnectionById(id))
      .filter(Boolean);

    if (!focusCard || focusCard.type !== 'person' || !focusCard.id) return base;

    const index = base.findIndex((card) => matchesFocusTarget(card, focusCard));
    if (index === 0) return base;
    if (index > 0) return [base[index], ...base.slice(0, index), ...base.slice(index + 1)];

    const injected = connectionCards.find((card) => matchesFocusTarget(card, focusCard));
    return injected ? [injected, ...base] : base;
  }, [connDeck, connectionCards, focusCard, findConnectionById, matchesFocusTarget]);

  const propDisplay = useMemo(() => {
    const base = propDeck
      .map((id) => {
        const fromShowcase = (showcaseItems || []).find((p) => p.id === id);
        if (fromShowcase) return fromShowcase;
        return injectedProps[id] || null;
      })
      .filter(Boolean);

    if (!focusCard || focusCard.type !== 'property' || !focusCard.id) return base;

    const index = base.findIndex((prop) => matchesFocusTarget(prop, focusCard));
    if (index === 0) return base;
    if (index > 0) return [base[index], ...base.slice(0, index), ...base.slice(index + 1)];

    const fromShowcase = (showcaseItems || []).find((p) => matchesFocusTarget(p, focusCard));
    if (fromShowcase) return [fromShowcase, ...base];

    const fromMock = import.meta.env.DEV ? PROPERTIES.find((p) => matchesFocusTarget(p, focusCard)) : null;
    if (fromMock) return [fromMock, ...base];

    // Fallback: look in the full property portfolio (real user property not in showcaseItems)
    const fromPortfolio = (propertyPortfolio || []).find((p) => matchesFocusTarget(p, focusCard));
    if (fromPortfolio) return [fromPortfolio, ...base];

    const fromShowcaseProps = (showcaseProperties || []).find((p) => matchesFocusTarget(p, focusCard));
    return fromShowcaseProps ? [fromShowcaseProps, ...base] : base;
  }, [propDeck, showcaseItems, injectedProps, focusCard, propertyPortfolio, showcaseProperties, matchesFocusTarget]);

  // Listen for external focus requests (from MapView popups). When received,
  // bring the requested card to the front of the appropriate deck and switch
  // the view so the user sees the focused card in the feed.
  useEffect(() => {
    // focus requests are queued via `setFocusCard` and applied when decks are rebuilt.
    let initialFocusTimer = null;

    const handler = (ev) => {
      try {
        const d = ev?.detail;
        if (d && d.id) {
          setFocusCard(d);
          if (d.type === 'property') setView('properties');
          else setView('connections');
          localStorage.removeItem('focusCard');
        }
      } catch (e) { void e; }
    };

    window.addEventListener('dealsifter.focusCard', handler);

    // If MapView wrote a focusCard to localStorage before navigation, handle it now.
    try {
      const raw = localStorage.getItem('focusCard');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.id) {
          initialFocusTimer = window.setTimeout(() => {
            setFocusCard(parsed);
            if (parsed.type === 'person') setView('connections');
            else setView('properties');
          }, 0);
          localStorage.removeItem('focusCard');
        }
        localStorage.removeItem('focusCard');
      }
    } catch (e) { void e; }

    return () => {
      if (initialFocusTimer) window.clearTimeout(initialFocusTimer);
      window.removeEventListener('dealsifter.focusCard', handler);
    };
  }, []);

  // ── Connections actions ──────────────────────────────────────────────────
  const act = async type => {
    if (connDisplay.length === 0) return;
    if (focusCard) setFocusCard(null);
    const topCard = connDisplay[0];
    if (isOwnConnectionCard(topCard) && (type === 'match' || type === 'unlock')) {
      addToast?.({ type: 'info', message: t.ownCardNotSelectable || 'Own card, not selectionable' });
      return;
    }
    if (type === 'unlock') {
      openUnlockFromConnectionCard(topCard);
      return;
    }
    const limitedActions = type === 'match' ? ['match', 'swipe', 'like'] : ['swipe'];
    if (!await consumeLimitedFeedActions(limitedActions)) return;
    const snap = [...connDeck];
    const propSnap = [...propDeck];
    setIsSwipingConn(true);
    setAction(type);
    setTimeout(() => {
      requestAnimationFrame(() => {
        if (type === "match") {
          const topOwnerId = String(topCard?.ownerId ?? topCard?.id ?? '');
          // Permanently remove from deck
          addMatchedCapped(topCard);
          trackDashboardSwipe('connection', topCard?.id, type);
          setConnDeck(d => d.filter(id => id !== topCard.id));
          // Record purchase: remove properties of bought contact from propDeck
          setPurchases(prev =>
              prev.some(p => String(p.sellerId) === topOwnerId) 
              ? prev
                : [...prev, { sellerId: topOwnerId }]
          );
          // Remove properties of this bought contact from showcase
          setPropDeck(d => d.filter(id => {
            const prop = (showcaseItems || []).find(p => p.id === id);
              return String(prop?.ownerId) !== topOwnerId;
          }));
        } else if (type === "next") {
          // Next: rotate top card to the end of the deck (ship).
        trackDashboardSwipe('connection', topCard?.id, type);
        // Do not bring skipped cards to the front automatically.
        setConnDeck(d => {
          const next = d.length > 1 ? [...d.slice(1), d[0]] : d;
          return next;
        });
      } else {
        // Pass: rotate top card to the end of the deck and mark it as skipped
        trackDashboardSwipe('connection', topCard?.id, type);
        setConnDeck(d => {
          const next = d.length > 1 ? [...d.slice(1), d[0]] : d;
          return next;
        });
        // mark as skipped (for red border / seen indicator)
        setSkippedSet(s => { const n = new Set(s); n.add(topCard.id); return n; });
        setSkippedQueue(q => {
          if (!q) return [topCard.id];
          if (q.includes(topCard.id)) return q;
          return [...q, topCard.id];
        });
      }
        setLastConnOp({ type, card: topCard, snap, propSnap });
        setAction(null);
        setIsSwipingConn(false);
      });
    }, SWIPE_ANIM_MS);
  };

  // If deck empties and there are skipped items, reintroduce them for a second pass
  useEffect(() => {
    let timer = null;
    if ((connDeck || []).length === 0 && (skippedQueue || []).length > 0) {
      timer = window.setTimeout(() => {
        setConnDeck(skippedQueue);
        setSkippedQueue([]);
      }, 0);
      // keep skippedSet so visual 'skipped' markers persist across the reintroduction
    }
    if ((propDeck || []).length === 0 && (skippedQueueProp || []).length > 0) {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setPropDeck(skippedQueueProp);
        setSkippedQueueProp([]);
      }, 0);
      // keep skippedSetProp so visual 'skipped' markers persist across the reintroduction
    }
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [connDeck, skippedQueue, propDeck, skippedQueueProp]);

  const undo = () => {
    if (!lastConnOp) {
      // No last op: if there are skipped items, bring back the most recently skipped
      if (skippedQueue && skippedQueue.length > 0) {
        const nextQueue = [...skippedQueue];
        const returnId = nextQueue.pop();
        setSkippedQueue(nextQueue);
        setSkippedSet(s => { const n = new Set(s); n.delete(returnId); return n; });
        setConnDeck(d => [returnId, ...d]);
      }
      return;
    }
    if (lastConnOp.type === "match") {
      setMatched(m => m.filter(x => x.id !== lastConnOp.card.id));
      // Undo purchase record
      setPurchases(prev => prev.filter(p => String(p.sellerId) !== String(lastConnOp.card.ownerId ?? lastConnOp.card.id)));
      // Restore propDeck
      if (lastConnOp.propSnap) {
        setPropDeck(lastConnOp.propSnap);
      }
    } else {
      // Remove from skipped if undoing a pass and restore deck
      setSkippedQueue(prev => prev.filter(id => id !== lastConnOp.card.id));
      setSkippedSet(prev => { const n = new Set(prev); n.delete(lastConnOp.card.id); return n; });
    }
    setConnDeck(lastConnOp.snap);
    setLastConnOp(null);
  };

  // ── Properties actions ───────────────────────────────────────────────────
  const actProperty = async type => {
    if (propDisplay.length === 0) return;
    if (focusCard) setFocusCard(null);
    const topProp = propDisplay[0];
    if (isOwnPropertyCard(topProp) && type === "interest") {
      addToast?.({ type: 'info', message: t.ownCardNotSelectable || 'Own card, not selectionable' });
      return;
    }
    const limitedActions = type === 'interest' ? ['match', 'swipe', 'like'] : ['swipe'];
    if (!await consumeLimitedFeedActions(limitedActions)) return;
    setIsSwipingProp(true);
    setPropAction(type);
    setPropStatusById(prev => ({ ...prev, [topProp.id]: type }));
    const topOwner = resolvePropertyOwnerCard(topProp);
    const snap = [...propDeck];
    const connSnap = [...connDeck];
    setTimeout(() => {
      requestAnimationFrame(() => {
        if (type === "interest") {
          setInterested(p => p.find(x => x.id === topProp.id) ? p : [...p, topProp]);
          trackDashboardSwipe('property', topProp?.id, type);
          trackPropertySaved(topProp?.id, { ownerId: topOwner?.id || topProp?.ownerId || null, source: 'feed_interest' });
          if (topOwner) {
            addMatchedCapped(topOwner);
            setConnDeck(d => d.filter(id => id !== topOwner.id));
          }
          setPropDeck(d => d.filter(id => id !== topProp.id));
        } else if (type === "next") {
          setPropDeck(d => d.length > 1 ? [...d.slice(1), d[0]] : d);
        } else {
          trackDashboardSwipe('property', topProp?.id, type);
          setPropDeck(d => d.length > 1 ? [...d.slice(1), d[0]] : d);
          setPropStatusById(s => ({ ...s, [topProp.id]: { ...(s[topProp.id]||{}), seen: true, skipped: true } }));
          setSkippedSetProp(s => { const n = new Set(s); n.add(topProp.id); return n; });
          setSkippedQueueProp(q => {
            if (!q) return [topProp.id];
            if (q.includes(topProp.id)) return q;
            return [...q, topProp.id];
          });
        }
        setLastPropOp({ type, prop: topProp, snap, connSnap });
        setPropAction(null);
        setIsSwipingProp(false);
      });
    }, SWIPE_ANIM_MS);
  };

  const undoProperty = () => {
    if (!lastPropOp) return;
    if (lastPropOp.type === "interest") {
      setInterested(p => p.filter(x => x.id !== lastPropOp.prop.id));
    }
    setPropStatusById(prev => {
      const next = { ...prev };
      delete next[lastPropOp.prop.id];
      return next;
    });
    setPropDeck(lastPropOp.snap);
    if (lastPropOp.connSnap) {
      setConnDeck(lastPropOp.connSnap);
    }
    if (lastPropOp.type === 'skip') {
      setSkippedQueueProp(prev => (prev || []).filter(id => id !== lastPropOp.prop.id));
      setSkippedSetProp(s => { const n = new Set(s); n.delete(lastPropOp.prop.id); return n; });
    }
    setLastPropOp(null);
  };

  // Category change → rebuild decks excluding already-acted items
  const handleCatChange = cat => {
    setActiveCat(cat);
    // Decks are recomputed by the unified filtering effect.
    setLastConnOp(null);
    setLastPropOp(null);
  };
  const mobileCategoryRows = useMemo(() => (
    CATEGORIES.flatMap((cat) => {
      const parent = {
        id: cat.id,
        label: cat.label,
        icon: catIcon(cat.id),
        isSub: false,
      };
      const sub = (cat.sub || []).map((item) => ({
        id: item.id,
        label: `${cat.label}: ${item.label}`,
        icon: catIcon(item.id),
        isSub: true,
      }));
      return [parent, ...sub];
    })
  ), []);

  const fmtPrice = formatCompactUsd;
  const isTruthyVerified = (value) => {
    if (value === true || value === 1) return true;
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'verified';
  };

  const getUnlockCost = (personId) => {
    const devMockProperties = import.meta.env.DEV ? (PROPERTIES || []) : [];
    return getPortfolioUnlockCost(personId, [...(propertyPortfolio || []), ...(showcaseItems || []), ...devMockProperties], servicePortfolio || []);
  };

  const getPortfolioCount = (personId) => {
    const devMockProperties = import.meta.env.DEV ? (PROPERTIES || []) : [];
    return getPortfolioItemCount(personId, [...(propertyPortfolio || []), ...(showcaseItems || []), ...devMockProperties], servicePortfolio || []);
  };

  const ownOwnerIds = useMemo(() => {
    const ids = [];
    ['personal', 'secondary', 'fsbo'].forEach((key) => {
      const id = getOwnerIdForKey(key);
      const normalizedId = String(id ?? '').trim();
      if (normalizedId && !ids.includes(normalizedId)) ids.push(normalizedId);
    });
    return ids;
  }, [getOwnerIdForKey]);
  const ownOwnerIdsKey = useMemo(() => ownOwnerIds.join('|'), [ownOwnerIds]);

  const isOwnConnectionCard = useCallback((card) => {
    if (!card) return false;
    if (String(card?.id || '').startsWith('local:')) return true;
    const ownerId = String(card?.ownerId ?? card?.id ?? '').trim();
    return ownerId !== '' && ownOwnerIds.includes(ownerId);
  }, [ownOwnerIds]);

  const isOwnPropertyCard = useCallback((property) => {
    if (!property) return false;
    const ownerId = String(property?.ownerId || '').trim();
    return ownerId !== '' && ownOwnerIds.includes(ownerId);
  }, [ownOwnerIds]);

  const openUnlockFromTopProperty = () => {
    if (propDisplay.length === 0) return;
    const topProp = propDisplay[0];
    if (isOwnPropertyCard(topProp)) {
      addToast?.({ type: 'info', message: t.ownCardNotSelectable || 'Own card, not selectionable' });
      return;
    }
    const ownerCard = resolvePropertyOwnerCard(topProp);

    if (!ownerCard?.id && !ownerCard?.ownerId) {
      addToast?.({ type: 'warning', message: t.contactOwnerNotFound || 'Contact owner for this card was not found.' });
      return;
    }

    if (isContactUnlocked(ownerCard)) {
      actProperty('interest');
      return;
    }

    if (typeof openUnlock === 'function') {
      openUnlock(ownerCard, {
        unlockScope: 'property',
        property: topProp,
        propertyId: topProp.id,
        propertyAddress: topProp.address,
      });
    }
  };

  const openUnlockFromConnectionCard = useCallback(async (rawCard) => {
    const targetCard = rawCard
      ? (findConnectionById(rawCard.id) || findConnectionById(rawCard.ownerId) || rawCard)
      : null;
    if (!targetCard) {
      addToast?.({ type: 'warning', message: 'No contact card available to unlock.' });
      return false;
    }
    const ownIds = ownOwnerIdsKey ? ownOwnerIdsKey.split('|').filter(Boolean) : [];
    const targetOwnerId = String(targetCard?.ownerId ?? targetCard?.id ?? '').trim();
    if (String(targetCard?.id || '').startsWith('local:') || (targetOwnerId && ownIds.includes(targetOwnerId))) {
      addToast?.({ type: 'info', message: t.ownCardNotSelectable || 'Own card, not selectionable' });
      return false;
    }
    const contactId = String(targetCard?.id || '').trim();
    const ownerId = String(targetCard?.unlockOwnerId || targetCard?.ownerId || targetCard?.id || '').trim();
    if (!contactId && !ownerId) {
      addToast?.({ type: 'warning', message: 'Contact owner could not be resolved for unlock.' });
      return false;
    }
    const alreadyUnlocked = unlocked.some((id) => {
      const value = String(id);
      return (contactId && value === contactId) || (ownerId && value === ownerId);
    });
    if (alreadyUnlocked) return false;
    if (ownerId && currentUserId && ownerId !== currentUserId) {
      try {
        const remoteState = await checkIsUnlocked(ownerId, currentUserId);
        if (remoteState?.isUnlocked) return false;
      } catch {
        // Local state remains the fallback; unlock modal will validate again server-side.
      }
    }
    if (typeof openUnlock === 'function') {
      openUnlock({
        ...targetCard,
        id: contactId || ownerId,
        ownerId: ownerId || contactId,
        unlockOwnerId: ownerId || contactId,
        unlockScope: 'contact',
      });
      return true;
    }
    return false;
  }, [addToast, currentUserId, findConnectionById, openUnlock, ownOwnerIdsKey, unlocked]);

  const handleMobileUnlockAction = () => {
    if (view === 'connections') {
      openUnlockFromConnectionCard(topConnectionCard || connDisplay[0] || null);
      return;
    }

    openUnlockFromTopProperty();
  };

  const _connDeckSet = useMemo(() => new Set(connDeck), [connDeck]);
  const _propDeckSet = useMemo(() => new Set(propDeck), [propDeck]);
  void _connDeckSet;
  void _propDeckSet;
  const verifiedOwnerIds = useMemo(
    () => {
      const ids = new Set();
      (CARDS || []).forEach((c) => {
        if (isTruthyVerified(c?.verified)) ids.add(String(c.id));
      });
      (connectionCards || []).forEach((c) => {
        if (isTruthyVerified(c?.verified)) ids.add(String(c.id));
      });
      return ids;
    },
    [connectionCards]
  );

  // Banner: incluir todos os cards/p imóveis ativos (não só o deck corrente).
  const hasSpotlightKey = useCallback((key) => {
    if (!key) return false;
    if (activeSpotlightKeys instanceof Set) return activeSpotlightKeys.has(key);
    if (Array.isArray(activeSpotlightKeys)) return activeSpotlightKeys.includes(key);
    return false;
  }, [activeSpotlightKeys]);

  const isConnectionSpotlight = useCallback((card) => {
    if (!card) return false;
    const ownerId = String(card.ownerId || card.id || '').trim();
    const scope = normalizeProfileScope(card.primaryProfile || card.scopeKey);
    if (!scope) return false;
    const ownerCandidates = Array.from(new Set([
      ownerId,
    ].filter(Boolean)));
    return ownerCandidates.some((candidate) => (
      hasSpotlightKey(`profile:${scope}:${candidate}`)
      || hasSpotlightKey(`profile:personal:${candidate}`)
    ))
      || (servicePortfolio || []).some((service) => (
        ownerCandidates.includes(String(service?.ownerId || ''))
        && hasSpotlightKey(`service:${service.id}`)
      ));
  }, [hasSpotlightKey, servicePortfolio]);

  const isPropertySpotlight = useCallback((property) => (
    Boolean(property?.id) && hasSpotlightKey(`property:${property.id}`)
  ), [hasSpotlightKey]);
  const bannerConnItems = useMemo(() => (
    connectionCards
      .filter(c => !hiddenSet.has(String(c.id)) && isConnectionSpotlight(c))
      .map(c => {
        const ownerKey = String(c.ownerId ?? c.id);
        const ownerProps = (showcaseProperties || []).filter(
          (p) => String(p.ownerId) === ownerKey && !p?.dealClosed
        );
        const hotPressure = ownerProps.reduce(
          (max, p) => Math.max(max, Number(propertyHotMetrics[String(p.id)]?.hotScore || 0)),
          0
        );
        // Fallback seguro para thumbs/avatars
        let safeThumb = c.photo;
        if (!safeThumb || typeof safeThumb !== 'string' || safeThumb.length < 8 || safeThumb.startsWith('data:') && safeThumb.length < 32) {
          safeThumb = undefined;
        }
        if (!safeThumb && import.meta.env.DEV) {
          console.warn('[Dashboard] Thumb/avatar inválido para conexão:', c.id);
        }
        return {
          key: `c-${c.id}`,
          source: 'connections',
          id: c.id,
          title: c.name,
          subtitle: `${c.type} · ${c.loc}`,
          meta: `${c.deals} deals · ${c.rating}★`,
          tone: C.accent,
          icon: catIcon(c.cat),
          thumb: safeThumb,
          thumbRound: true,
          isHot: hotPressure > 0,
          hotPressure,
          isVerified: isTruthyVerified(c?.verified) || verifiedOwnerIds.has(String(c.ownerId ?? c.id)),
        };
      })
  ), [connectionCards, showcaseProperties, verifiedOwnerIds, hiddenSet, propertyHotMetrics, isConnectionSpotlight]);

  const bannerPropItems = useMemo(() => (
  (showcaseProperties || [])
    .filter((p) => isTruthyFlag(p.publishToShowcase, true) && !p?.dealClosed && isPropertySpotlight(p))
    .map(p => {
      const hotPressure = p?.dealClosed ? 0 : Number(propertyHotMetrics[String(p.id)]?.hotScore || 0);
      const exclusivityStatus = getEffectivePropertyExclusivityStatus(p);
      const ownerVerified = isTruthyVerified(p?.verified) || verifiedOwnerIds.has(String(p.ownerId));
      let safeThumb = p.images?.[0] || p.image;
      if (!safeThumb || typeof safeThumb !== 'string' || (safeThumb.length < 8) || (safeThumb.startsWith('data:') && safeThumb.length < 32)) {
        safeThumb = undefined;
      }
      if (!safeThumb && import.meta.env.DEV) {
        console.warn('[Dashboard] Thumb invalido para propriedade:', p.id);
      }
      return {
        key: `p-${p.id}`,
        source: 'properties',
        id: p.id,
        title: p.address,
        subtitle: `${p.type} · ${formatPropertyLocation(p)}`,
        meta: `${fmtPrice(p.price)} · ${p.capRate ? `${p.capRate}% Cap` : 'Cap N/A'}`,
        tone: C.gold,
        icon: 'home',
        thumb: safeThumb,
        thumbRound: false,
        isHot: hotPressure > 0,
        hotPressure,
        isVerified: ownerVerified,
        exclusiveExpiresAt: exclusivityStatus?.expiresAt || null,
      };
    })
), [showcaseProperties, verifiedOwnerIds, propertyHotMetrics, isPropertySpotlight, getEffectivePropertyExclusivityStatus]);

  const hashStringToSeed = (value) => {
    const input = String(value || '');
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  };

  const createSeededRandom = (seed) => {
    let t = seed >>> 0;
    return () => {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), t | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  };

  const prioritizedBannerItems = useMemo(() => {
    const merged = [...bannerConnItems, ...bannerPropItems];
    if (!merged.length) return [];

    // Randomização estável: muda apenas quando o conjunto de itens muda.
    const signature = merged.map((item) => item.key).sort().join('|');
    const seededRand = createSeededRandom(hashStringToSeed(signature));
    return [...merged]
      .map((item) => ({ item, rank: seededRand() }))
      .sort((a, b) => (a.rank - b.rank) || String(a.item.key).localeCompare(String(b.item.key)))
      .map(({ item }) => item);
  }, [bannerConnItems, bannerPropItems]);

  const marqueeBannerItems = useMemo(() => {
    if (!prioritizedBannerItems.length) return [];
    const minCards = 16;
    const out = [...prioritizedBannerItems];
    while (out.length < minCards) out.push(...prioritizedBannerItems);
    return out.slice(0, Math.max(minCards, prioritizedBannerItems.length));
  }, [prioritizedBannerItems]);

  const bannerDurationSec = useMemo(
    () => Math.max(64, marqueeBannerItems.length * 5),
    [marqueeBannerItems.length]
  );

// ---
  const openBannerItem = (item) => {
    if (!item) return;
    if (item.source === 'properties') {
      setView('properties');
      setPropDeck(d => d.includes(item.id) ? [item.id, ...d.filter(id => id !== item.id)] : d);
      return;
    }
    setView('connections');
    setConnDeck(d => d.includes(item.id) ? [item.id, ...d.filter(id => id !== item.id)] : d);
  };

  const topConnectionCard = connDisplay[0] || null;
  const topPropertyCard = propDisplay[0] || null;
  const mobileCanAct = view === 'connections' ? Boolean(topConnectionCard) : Boolean(topPropertyCard);
  const mobileCanUndo = view === 'connections'
    ? Boolean(lastConnOp || (skippedQueue && skippedQueue.length > 0))
    : Boolean(lastPropOp);
  const myCardShowcaseCount = myCardPreviewData.showcaseItems.length;
  const myCardPreviewCardWidth = FEED_CARD_WIDTH;
  const myCardPreviewCardHeight = FEED_CARD_HEIGHT;
  const myCardPreviewDeckHeight = myCardPreviewCardHeight + 24;

  useEffect(() => {
    return () => {
      if (myCardShowcaseScrollEndTimerRef.current) {
        window.clearTimeout(myCardShowcaseScrollEndTimerRef.current);
        myCardShowcaseScrollEndTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let timer = null;
    if (myCardShowcaseCount <= 0) {
      if (myCardShowcaseIdx !== 0) timer = window.setTimeout(() => setMyCardShowcaseIdx(0), 0);
    } else if (myCardShowcaseIdx > myCardShowcaseCount - 1) {
      timer = window.setTimeout(() => setMyCardShowcaseIdx(myCardShowcaseCount - 1), 0);
    }
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [myCardShowcaseCount, myCardShowcaseIdx]);

  useEffect(() => {
    if (!myCardModal.open) return;
    const container = myCardShowcaseScrollRef.current;
    if (!container) return;
    const width = container.clientWidth || 0;
    if (!width) return;
    container.scrollTo({ left: width * myCardShowcaseIdx, behavior: isTouchModalViewport ? 'auto' : 'smooth' });
  }, [myCardShowcaseIdx, myCardModal.open, myCardShowcaseCount, isTouchModalViewport]);

  return (
    <div style={{ paddingTop:58, paddingBottom:mobileDashboardBottomPadding, height:'calc(var(--app-vh, 1vh) * 100)', overflow:'hidden', boxSizing:'border-box' }}>
      <style>{`
        @keyframes carouselRotateMatch {
          0%   { transform: translate3d(0, 0, 0) scale(1) rotate(0deg); opacity: 1; }
          35%  { transform: translate3d(28%, -2%, 0) scale(1.02) rotate(4deg); opacity: 0.98; }
          70%  { transform: translate3d(120%, -6%, 0) scale(0.97) rotate(11deg); opacity: 0.58; }
          100% { transform: translate3d(220%, -10%, 0) scale(0.93) rotate(16deg); opacity: 0; }
        }
        @keyframes carouselRotatePass {
          0%   { transform: translate3d(0, 0, 0) scale(1) rotate(0deg); opacity: 1; }
          35%  { transform: translate3d(-28%, -2%, 0) scale(1.02) rotate(-4deg); opacity: 0.98; }
          70%  { transform: translate3d(-120%, -6%, 0) scale(0.97) rotate(-11deg); opacity: 0.58; }
          100% { transform: translate3d(-220%, -10%, 0) scale(0.93) rotate(-16deg); opacity: 0; }
        }
        @keyframes bannerScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .opportunity-banner:hover .opportunity-track {
          animation-play-state: paused;
        }
        .ds-mycard-showcase-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          scroll-behavior: auto;
          contain: layout paint;
        }
        .ds-mycard-showcase-scroll::-webkit-scrollbar {
          display: none;
        }
        .ds-dashboard-opportunity-banner {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
        }
        @media (max-width: 767px) {
          .ds-dashboard-opportunity-banner {
            bottom: calc(${mobileBottomNavOffset}px + env(safe-area-inset-bottom, 0px));
          }
        }
        @media (min-width: 768px) and (max-width: 1080px) and (orientation: portrait) {
          .ds-dashboard-opportunity-banner {
            bottom: calc(${tabletBottomNavOffset}px + env(safe-area-inset-bottom, 0px));
          }
        }
        @keyframes blink {
          0% { opacity: 1; }
          50% { opacity: 0.08; }
          100% { opacity: 1; }
        }
        .blink {
          animation: blink 1s linear infinite;
        }
        @keyframes dsSpotlightButtonPulse {
          0%, 100% {
            border-color: ${C.alpha(C.gold, 0.52)};
            box-shadow: 0 0 0 0 rgba(245, 169, 30, 0), 0 0 10px ${C.alpha(C.gold, 0.14)};
            background: ${C.alpha(C.gold, 0.82)};
          }
          50% {
            border-color: ${C.alpha(C.gold, 0.92)};
            box-shadow: 0 0 0 5px ${C.alpha(C.gold, 0.12)}, 0 0 20px ${C.alpha(C.gold, 0.38)};
            background: ${C.gold};
          }
        }
        @keyframes dsSpotlightButtonPulseLight {
          0%, 100% {
            border-color: ${C.alpha(C.gold, 0.58)};
            box-shadow: 0 0 0 0 rgba(245, 169, 30, 0), 0 0 10px ${C.alpha(C.gold, 0.16)};
            background: #ffffff;
          }
          50% {
            border-color: ${C.alpha(C.gold, 0.96)};
            box-shadow: 0 0 0 5px ${C.alpha(C.gold, 0.18)}, 0 0 24px ${C.alpha(C.gold, 0.46)};
            background: ${C.gold};
          }
        }
        .ds-spotlight-trigger {
          animation: dsSpotlightButtonPulse 2.6s ease-in-out infinite;
        }
        [data-theme="light"] .ds-spotlight-trigger {
          animation-name: dsSpotlightButtonPulseLight;
          animation-duration: 2.9s;
        }
        .ds-feed-view-btn {
          width: clamp(126px, 16vw, 172px);
          min-height: 34px;
          justify-content: center;
          white-space: normal;
          overflow: visible;
          text-overflow: clip;
        }
        .ds-feed-view-btn > span {
          min-width: 0;
          max-width: 100%;
          overflow: visible;
          text-overflow: clip;
          white-space: normal;
          text-align: center;
          line-height: 1.05;
        }
        @media (max-width: 767px) {
          .ds-feed-view-btn {
            width: 108px;
            min-height: 35px;
            font-size: 9.5px !important;
            padding-left: 6px !important;
            padding-right: 6px !important;
          }
        }
        @media (min-width: 768px) and (max-width: 1180px) {
          .ds-feed-view-btn {
            width: 156px;
          }
        }
        .ds-spotlight-icon-img {
          display: block;
          flex-shrink: 0;
          object-fit: contain;
          pointer-events: none;
          filter: brightness(0) saturate(1) opacity(0.78);
        }
        .ds-property-spotlight-halo {
          box-shadow: 0 0 0 2px ${C.alpha('#4381bc', 0.9)}, 0 0 24px ${C.alpha('#4381bc', 0.62)};
        }
        [data-theme="light"] .ds-property-spotlight-halo {
          box-shadow: 0 0 0 3px ${C.alpha('#4381bc', 0.96)}, 0 0 31px ${C.alpha('#4381bc', 0.8)}, 0 0 52px ${C.alpha('#4381bc', 0.18)};
        }
        .ds-mobile-feed-overlay {
          position: fixed;
          inset: 58px 0 0 0;
          border: none;
          background: rgba(15, 23, 42, 0.34);
          z-index: 10011;
        }
        .ds-mobile-feed-sidebar {
          position: fixed;
          top: 58px;
          left: 0;
          bottom: 0;
          width: min(94vw, 356px);
          background: ${C.card};
          border-right: 1px solid ${C.border};
          box-shadow: 12px 0 28px rgba(15, 23, 42, 0.16);
          z-index: 10012;
          display: grid;
          grid-template-rows: auto 1fr;
          overflow: hidden;
        }
        .ds-mobile-feed-handle {
          position: fixed;
          left: 0;
          top: 0;
          z-index: 12060;
          width: 24px;
          height: 62px;
          min-width: 24px;
          padding: 0;
          border: 1px solid ${C.border};
          border-left: none;
          border-radius: 0 10px 10px 0;
          background: ${C.alpha(C.card, 0.98)};
          color: ${C.t1};
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.24);
          cursor: grab;
          user-select: none;
          touch-action: none;
        }
        .ds-mobile-feed-handle.is-dragging {
          transition: none;
          cursor: grabbing;
        }
        .ds-mobile-feed-side-scroll {
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          will-change: scroll-position;
          padding: 12px;
          display: grid;
          gap: 12px;
          align-content: start;
          min-width: 0;
          overflow-x: hidden;
        }
        .ds-mobile-feed-section {
          display: grid;
          gap: 8px;
          min-width: 0;
        }
        .ds-mobile-feed-section-title {
          font-size: 11px;
          font-weight: 700;
          color: ${C.t3};
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }
        .ds-mobile-category-list {
          display: grid;
          gap: 6px;
          max-height: 220px;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          will-change: scroll-position;
          padding-right: 2px;
        }
        .ds-mobile-category-btn {
          width: 100%;
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 8px 10px;
          border-radius: 10px;
          border: 1px solid ${C.border};
          background: transparent;
          color: ${C.t2};
          cursor: pointer;
          font-size: 11px;
          font-weight: 600;
          text-align: left;
          overflow: hidden;
        }
        .ds-mobile-category-btn.is-active {
          border-color: ${C.accent};
          background: ${C.alpha(C.accent, 0.12)};
          color: ${C.accent};
          box-shadow: 0 0 0 1px ${C.alpha(C.accent, 0.24)};
        }
        .ds-mobile-category-btn.is-sub {
          margin-left: 12px;
          width: calc(100% - 12px);
        }
        .ds-mobile-category-label {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ds-mobile-action-dock {
          position: fixed;
          left: 50%;
          transform: translateX(-50%);
          bottom: ${mobileActionDockBottom}px;
          z-index: 42;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 999px;
          border: 1px solid ${C.border};
          background: ${C.alpha(C.card, 0.98)};
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.2);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          pointer-events: auto;
          transition: opacity .18s ease, transform .18s ease;
        }
        .ds-mobile-action-dock.is-suppressed {
          opacity: 0;
          pointer-events: none;
          transform: translate(-50%, 10px);
        }
        .ds-mobile-action-btn {
          width: 38px;
          height: 38px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .ds-mobile-action-btn:disabled {
          opacity: 0.42;
          cursor: not-allowed;
        }
        .ds-feed-stack-card {
          border-radius: 18px;
          transition: box-shadow .24s ease, filter .24s ease;
        }
        .ds-feed-stack-card.is-top-connection {
          box-shadow:
            0 0 0 1px ${C.alpha(C.accent, 0.2)},
            0 14px 28px ${C.alpha(C.t1, 0.22)},
            0 0 22px ${C.alpha(C.accent, 0.26)};
          filter: saturate(1.05);
        }
        .ds-feed-stack-card.is-top-showcase {
          box-shadow:
            0 0 0 1px ${C.alpha('#4381bc', 0.28)},
            0 14px 28px ${C.alpha(C.t1, 0.22)},
            0 0 22px ${C.alpha('#4381bc', 0.26)};
          filter: saturate(1.05);
        }
        .ds-feed-stack-card.is-swipe-animating {
          box-shadow: none !important;
          filter: none !important;
        }
        @media (max-width: 767px) {
          .ds-mobile-action-dock {
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
          }
        }
      `}</style>
      {!isMobileViewport && (
        <div data-guide="feed-categories">
          <CategoryBar activeCat={activeCat} setActiveCat={handleCatChange} categoryOrder={categoryOrder} setCategoryOrder={setCategoryOrder} editMode={editMode} setEditMode={setEditMode} stickyTop={0} />
        </div>
      )}
      {isMobileViewport && mobileFeedSidebarOpen && (
        <>
          <button
            type="button"
            className="ds-mobile-feed-overlay"
            onClick={() => { setMobileFeedSidebarOpen(false); setDropdownOpen(false); }}
            aria-label="Close feed filters"
          />
          <aside className="ds-mobile-feed-sidebar" role="dialog" aria-label="Feed filters">
            <div style={{ padding: '12px 12px 10px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.t1 }}>Feed filters</div>
              <button
                type="button"
                onClick={() => { setMobileFeedSidebarOpen(false); setDropdownOpen(false); }}
                style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, width: 28, height: 28, borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Close"
              >
                <Icon name="close" size={13} color={C.t2} />
              </button>
            </div>
            <div className="ds-mobile-feed-side-scroll">
              <div className="ds-mobile-feed-section">
                <div className="ds-mobile-feed-section-title">Feed filters</div>
                <div className="ds-mobile-category-list" data-guide="feed-categories">
                  {mobileCategoryRows.map((row) => {
                    const active = activeCat === row.id;
                    const isFeedAllRow = row.id === 'all';
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => {
                          handleCatChange(row.id);
                          setMobileFeedSidebarOpen(false);
                        }}
                        className={`ds-mobile-category-btn ${active ? 'is-active' : ''} ${row.isSub ? 'is-sub' : ''}`}
                        title={row.label}
                      >
                        {isFeedAllRow ? (
                          <span
                            aria-hidden="true"
                            style={{
                              width: 12,
                              height: 12,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              position: 'relative',
                              filter: active
                                ? 'drop-shadow(0 0 5px rgba(53,202,201,0.92)) drop-shadow(0 0 9px rgba(53,202,201,0.7))'
                                : 'none',
                            }}
                          >
                            <span
                              style={{
                                position: 'absolute',
                                inset: 0,
                                backgroundColor: active ? C.accent : C.t2,
                                WebkitMaskImage: `url(${feedMatchIcon})`,
                                WebkitMaskRepeat: 'no-repeat',
                                WebkitMaskSize: 'contain',
                                WebkitMaskPosition: 'center',
                                maskImage: `url(${feedMatchIcon})`,
                                maskRepeat: 'no-repeat',
                                maskSize: 'contain',
                                maskPosition: 'center',
                              }}
                            />
                            <span
                              style={{
                                position: 'absolute',
                                inset: 0,
                                transform: 'translate(0.35px, 0)',
                                backgroundColor: active ? C.accent : C.t2,
                                opacity: 0.9,
                                WebkitMaskImage: `url(${feedMatchIcon})`,
                                WebkitMaskRepeat: 'no-repeat',
                                WebkitMaskSize: 'contain',
                                WebkitMaskPosition: 'center',
                                maskImage: `url(${feedMatchIcon})`,
                                maskRepeat: 'no-repeat',
                                maskSize: 'contain',
                                maskPosition: 'center',
                              }}
                            />
                          </span>
                        ) : (
                          <Icon name={row.icon} size={12} color={active ? C.accent : C.t2} strokeWidth={active ? 2 : 1.6} />
                        )}
                        <span className="ds-mobile-category-label">{row.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="ds-mobile-feed-section">
                <div className="ds-mobile-feed-section-title">My cards</div>
                <div style={{ display: 'grid', gridTemplateColumns: hasSecondaryProfile ? '1fr 1fr' : '1fr', gap: 8 }}>
                  <button
                    type="button"
                    onClick={handlePrimaryMyCardClick}
                    aria-pressed={myCardModal.open && myCardModal.scope === visiblePrimaryModalKey}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      minHeight: 36,
                      padding: '7px 9px', borderRadius: 999,
                      border: `1px solid ${(myCardModal.open && myCardModal.scope === visiblePrimaryModalKey) ? C.accent : C.border}`,
                      background: (myCardModal.open && myCardModal.scope === visiblePrimaryModalKey) ? C.alpha(C.accent, 0.12) : 'transparent',
                      color: (myCardModal.open && myCardModal.scope === visiblePrimaryModalKey) ? C.accent : C.t2,
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: (myCardModal.open && myCardModal.scope === visiblePrimaryModalKey) ? C.accent : C.t3 }} />
                    My Card
                    {displayPrimaryLinkedCardsCount > 0 ? (
                      <span style={{ background: C.danger, color: '#fff', fontSize: 9, fontWeight: 900, borderRadius: 99, padding: '1px 5px', lineHeight: 1.4 }}>
                        {displayPrimaryLinkedCardsCount}
                      </span>
                    ) : null}
                  </button>
                  {hasSecondaryProfile ? (
                    <button
                      type="button"
                      onClick={() => toggleMyCardModal(secondaryModalKey)}
                      aria-pressed={myCardModal.open && myCardModal.scope === secondaryModalKey}
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        minHeight: 36,
                        padding: '7px 9px', borderRadius: 999,
                        border: `1px solid ${(myCardModal.open && myCardModal.scope === secondaryModalKey) ? C.accent : C.border}`,
                        background: (myCardModal.open && myCardModal.scope === secondaryModalKey) ? C.alpha(C.accent, 0.12) : 'transparent',
                        color: (myCardModal.open && myCardModal.scope === secondaryModalKey) ? C.accent : C.t2,
                        fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: (myCardModal.open && myCardModal.scope === secondaryModalKey) ? C.accent : C.t3 }} />
                      My Card B
                      {secondaryLinkedCardsCount > 0 ? (
                        <span style={{ background: C.danger, color: '#fff', fontSize: 9, fontWeight: 900, borderRadius: 99, padding: '1px 5px', lineHeight: 1.4 }}>
                          {secondaryLinkedCardsCount}
                        </span>
                      ) : null}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="ds-mobile-feed-section">
                <div className="ds-mobile-feed-section-title">Feed</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 999, border: `1px solid ${view === 'connections' ? C.accent : C.border}`, color: view === 'connections' ? C.accent : C.t2, fontSize: 10, fontWeight: 700 }}>
                    {view === 'connections' ? 'Connections' : 'Showcase'}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 999, border: `1px solid ${hasActiveStates ? C.accent : C.border}`, color: hasActiveStates ? C.accent : C.t2, fontSize: 10, fontWeight: 700 }}>
                    {stateSummaryLabel}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button onClick={() => { setView('connections'); setMobileFeedSidebarOpen(false); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 38, padding: '8px 10px', borderRadius: 10, background: 'transparent', border: `1px solid ${view==='connections' ? C.accent : C.border}`, color: view==='connections' ? C.accent : C.t2, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    <Icon name="search" size={12} color={view==='connections' ? C.accent : C.t2} strokeWidth={view==='connections' ? 2 : 1.5} />
                    Connections
                  </button>
                  <button onClick={() => { setView('properties'); setMobileFeedSidebarOpen(false); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 38, padding: '8px 10px', borderRadius: 10, background: 'transparent', border: `1px solid ${view==='properties' ? '#4381bc' : C.border}`, color: view==='properties' ? '#4381bc' : C.t2, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    <Icon name="briefcase" size={12} color={view==='properties' ? '#4381bc' : C.t2} strokeWidth={view==='properties' ? 2 : 1.5} />
                    Showcase
                  </button>
                </div>
              </div>

              <div className="ds-mobile-feed-section">
                <div className="ds-mobile-feed-section-title">State</div>
                <details className="onb-multiselect" open={dropdownOpen} onToggle={(e) => setDropdownOpen(Boolean(e.target.open))} style={{ position: 'relative' }}>
                  <summary style={{ listStyle: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%', padding: '9px 12px', borderRadius: 10, border: `1px solid ${hasActiveStates ? C.accent : C.border}`, background: 'transparent', color: hasActiveStates ? C.accent : C.t1, cursor: 'pointer', fontSize: 12, lineHeight: '16px', minHeight: 38, fontWeight: hasActiveStates ? 700 : 500 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Icon name="mapPin" size={12} color={hasActiveStates ? C.accent : C.t1} strokeWidth={hasActiveStates ? 2 : 1.6} />
                      <span>{stateSummaryLabel}</span>
                    </span>
                    <Icon name={dropdownOpen ? 'chevUp' : 'chevDown'} size={11} color={hasActiveStates ? C.accent : C.t1} />
                  </summary>
                  <div style={{ marginTop: 8, width: '100%', maxHeight: 270, overflowY: 'auto', background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 8, boxShadow: `0 12px 30px ${C.alpha(C.shadow, 0.08)}` }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {stateOptions.filter(s => s !== 'all').map(s => (
                        <label key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '8px 9px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${selectedStates.includes(s) ? C.accent : C.border}`, background: selectedStates.includes(s) ? C.alpha(C.accent, 0.1) : 'transparent', color: selectedStates.includes(s) ? C.accent : C.t1, fontSize: 11, fontWeight: selectedStates.includes(s) ? 700 : 500, lineHeight: 1 }}>
                          <input type="checkbox" style={{ display: 'none' }} checked={selectedStates.includes(s)} onChange={() => {
                            setSelectedStates(prev => {
                              if (!prev) prev = [];
                              if (prev.includes(s)) return prev.filter(x => x !== s);
                              return [...prev.filter(x => x !== 'all'), s];
                            });
                          }} />
                          <span style={{ fontSize: 10 }}>🇺🇸</span>
                          <span style={{ flex: 1 }}>{s}</span>
                          {selectedStates.includes(s) ? <Icon name="check" size={11} color={C.accent} strokeWidth={2.2} /> : null}
                        </label>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                      <button type="button" onClick={() => setSelectedStates([])} style={{ padding: '8px 8px', borderRadius: 999, background: 'transparent', border: `1px solid ${C.border}`, color: C.t2, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Clear</button>
                      <button type="button" onClick={() => setSelectedStates(['all'])} style={{ padding: '8px 8px', borderRadius: 999, background: 'transparent', border: `1px solid ${C.border}`, color: C.t2, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>All</button>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </aside>
        </>
      )}
      {/* Quick registration detection: consider completed when personalProfile.fullName exists in localStorage */}
      {/* Note: accessing localStorage synchronously here is acceptable in this SPA context */}
      {null}
      <div style={{ maxWidth:"100%", margin:"0 auto", padding: isTabletPortraitViewport ? "8px 14px 0 14px" : "12px 12px 0 12px", display:"grid", alignItems:"stretch", height:"100%", boxSizing:'border-box' }} className="dashboard-grid">

        {/* Left sidebar */}
        <div className="desktop-only dashboard-sidebar">
          <div
            style={{
              background: C.card,
              border: `${showRegistrationNeeded ? '2px' : '1px'} solid ${showRegistrationNeeded ? C.danger : C.border}`,
              borderRadius: 14,
              padding: 10,
              marginBottom: 6,
              boxShadow: showRegistrationNeeded ? `0 0 0 4px ${C.alpha(C.danger, 0.06)}` : 'none',
              cursor: 'default'
            }}
          >
            <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:8 }}>
              <div style={{ width:36, height:36, borderRadius:"50%", position:'relative', flexShrink:0 }}>
                {/* Avatar com click para onboarding */}
                <SmartImage
                  src={quickRegistered && typeof visiblePrimaryCardData?.photo === 'string' && visiblePrimaryCardData.photo.length > 8 ? visiblePrimaryCardData.photo : undefined}
                  alt={userProfile?.name ? `${userProfile.name} profile` : 'profile'}
                  fallback={(
                    <div
                      aria-label={userProfile?.name ? `${userProfile.name} profile` : 'profile'}
                      style={{
                        position: 'absolute', inset: 0, width: '100%', height: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: '50%', background: C.alpha(C.accent, 0.08), zIndex: 0,
                        cursor: quickRegistered ? 'pointer' : undefined
                      }}
                      role={quickRegistered ? 'button' : undefined}
                      tabIndex={quickRegistered ? 0 : undefined}
                      onClick={quickRegistered ? (e) => { e.stopPropagation(); openOnboardingForScope(visiblePrimaryScope); } : undefined}
                      onKeyDown={quickRegistered ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openOnboardingForScope(visiblePrimaryScope); } } : undefined}
                    >
                      <Icon name="user" size={17} color={C.accent} strokeWidth={1.4} />
                    </div>
                  )}
                  style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%', zIndex: 1, cursor: quickRegistered ? 'pointer' : undefined }}
                  role={quickRegistered ? 'button' : undefined}
                  tabIndex={quickRegistered ? 0 : undefined}
                  onClick={quickRegistered ? (e) => { e.stopPropagation(); openOnboardingForScope(visiblePrimaryScope); } : undefined}
                  onKeyDown={quickRegistered ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openOnboardingForScope(visiblePrimaryScope); } } : undefined}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontWeight:700, color:C.t1, fontSize:13, lineHeight:1.2 }}>{profileName}</div>
                <div style={{ display:'inline-flex', alignItems:'center', gap:4, minWidth:0, color:C.t2, fontSize:11, fontWeight:400 }}>
                  <Icon name="mapPin" size={11} color={C.t3} />
                  <span style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:130 }}>{profileLocation}</span>
                </div>
                <div style={{ display:'grid', gap:2, color:C.accent, fontSize:11, fontWeight:400, lineHeight:1.2, maxWidth:130 }}>
                  <div style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{activePrimaryCategoryLabel}</div>
                </div>
                {/* Registro button removed from here; will be shown below the stats block as full-width */}
              </div>
            </div>
            {/* Registro CTA will appear below the stats block */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 11, color: C.t2, marginBottom: 10 }}>
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'2px 8px', border:`1px solid ${C.border}`, borderRadius:999, width:'fit-content', background:C.card, color:C.t2, fontSize:10, lineHeight:'12px', fontWeight:700 }}>
                {primaryProfileBadgeLabel}
              </div>
              <button
                type="button"
                onClick={handlePrimaryMyCardClick}
                aria-pressed={myCardModal.open && myCardModal.scope === visiblePrimaryModalKey}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '2px 8px', borderRadius: 999,
                  border: `1px solid ${(myCardModal.open && myCardModal.scope === visiblePrimaryModalKey) ? C.accent : C.border}`,
                  background: (myCardModal.open && myCardModal.scope === visiblePrimaryModalKey) ? C.alpha(C.accent, 0.12) : 'transparent',
                  color: (myCardModal.open && myCardModal.scope === visiblePrimaryModalKey) ? C.accent : C.t2,
                  fontSize: 10, fontWeight: 700, cursor: 'pointer', flexShrink: 0
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 999, background: (myCardModal.open && myCardModal.scope === visiblePrimaryModalKey) ? C.accent : C.t3, boxShadow: (myCardModal.open && myCardModal.scope === visiblePrimaryModalKey) ? `0 0 8px ${C.alpha(C.accent, 0.75)}` : 'none' }} />
                My Card
                {/* Mostra a contagem sempre que houver cards publicados */}
                {displayPrimaryLinkedCardsCount > 0 && (
                  <span style={{
                    background: C.danger, color: '#fff',
                    fontSize: 8, fontWeight: 900, borderRadius: 99,
                    padding: '1px 4px', lineHeight: 1.4, minWidth: 13, textAlign: 'center',
                  }}>{displayPrimaryLinkedCardsCount}</span>
                )}
              </button>
            </div>
            <div style={{ paddingTop:8, borderTop:`1px solid ${C.border}`, display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:4, textAlign:"center" }}>
              <div>
                <div style={{ fontWeight:700, color:C.t1, fontSize:12 }}>{String(matchedCount ?? '-')}</div>
                <div style={{ fontSize:9, color:C.t3 }}>{t.allMatches}</div>
              </div>
              <div>
                <div style={{ fontWeight:700, color:C.t1, fontSize:12 }}>{String(dealsCount ?? '-')}</div>
                <div style={{ fontSize:9, color:C.t3 }}>{t.deals}</div>
              </div>
              <div
                onMouseEnter={() => setRatingTooltipScope('primary')}
                onMouseLeave={() => setRatingTooltipScope((prev) => (prev === 'primary' ? null : prev))}
                style={{ position: 'relative' }}
              >
                <div style={{ fontWeight:700, color:C.t1, fontSize:12 }}>{ratingLabel ?? '-'}</div>
                <div style={{ fontSize:9, color:C.t3 }}>{t.rating}</div>
                {ratingTooltipScope === 'primary' && renderRatingTooltip(primaryRatingDetails)}
              </div>
            </div>
            {/* Full-width Registro button below stats */}
            {showRegistrationNeeded && (
              <div style={{ marginTop: 10 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setPage('onboarding'); }}
                  className="blink"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    height: 36,
                    borderRadius: 8,
                    background: C.danger,
                    border: `1px solid ${C.danger}`,
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 4px 10px ${C.alpha(C.danger, 0.12)}`
                  }}
                  title={t.quickRegistrationTitle || 'Quick Registration'}
                >
                  {t.quickRegistrationButton || 'Register'}
                </button>
              </div>
            )}
            {/* Registration actions removed from sidebar — moved to property/service records */}
          </div>
          {/* Secondary profile card (compact) - only when profile B was registered */}
          {hasSecondaryProfile && (
          <div
            style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 10, marginBottom: 6, cursor: 'default' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
              <div style={{ width:36, height:36, borderRadius:'50%', overflow:'hidden', background:C.alpha(C.accent,0.08), display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {typeof profileThumbB === 'string' && profileThumbB.length > 8 ? (
                  <SmartImage
                    src={profileThumbB}
                    alt={profileNameB}
                    style={{ width:'100%', height:'100%', objectFit:'cover', cursor:'pointer' }}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); openOnboardingForScope(secondaryVisibleScope); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openOnboardingForScope(secondaryVisibleScope); } }}
                  />
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}
                    onClick={(e) => { e.stopPropagation(); openOnboardingForScope(secondaryVisibleScope); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openOnboardingForScope(secondaryVisibleScope); } }}
                  >
                    <Icon name="user" size={17} color={C.accent} strokeWidth={1.4} />
                  </div>
                )}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap: 4 }}>
                <div style={{ fontWeight:700, color:C.t1, fontSize:13, lineHeight:1.2 }}>{profileNameB}</div>
                <div style={{ display:'inline-flex', alignItems:'center', gap:4, minWidth:0, color:C.t2, fontSize:11, fontWeight:400 }}>
                  <Icon name="mapPin" size={11} color={C.t3} />
                  <span style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:130 }}>{profileLocationB}</span>
                </div>
                <div style={{ color:C.accent, fontSize:11, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:130 }}>{profileRoleLineB}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, color: C.t2, fontSize: 11, marginBottom: 8 }}>
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'2px 8px', border:`1px solid ${C.border}`, borderRadius:999, width:'fit-content', background:C.card, color:C.t2, fontSize:10, lineHeight:'12px', fontWeight:700 }}>
                {secondaryProfileBadgeLabel}
              </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleMyCardModal(secondaryModalKey); }}
                  aria-pressed={myCardModal.open && myCardModal.scope === secondaryModalKey}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '2px 8px', borderRadius: 999,
                    border: `1px solid ${(myCardModal.open && myCardModal.scope === secondaryModalKey) ? C.accent : C.border}`,
                    background: (myCardModal.open && myCardModal.scope === secondaryModalKey) ? C.alpha(C.accent, 0.12) : 'transparent',
                    color: (myCardModal.open && myCardModal.scope === secondaryModalKey) ? C.accent : C.t2,
                    fontSize: 10, fontWeight: 700, cursor: 'pointer', flexShrink: 0
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: (myCardModal.open && myCardModal.scope === secondaryModalKey) ? C.accent : C.t3, boxShadow: (myCardModal.open && myCardModal.scope === secondaryModalKey) ? `0 0 8px ${C.alpha(C.accent, 0.75)}` : 'none' }} />
                  My Card
                  {secondaryLinkedCardsCount > 0 && (
                    <span style={{
                      background: C.danger, color: '#fff',
                      fontSize: 8, fontWeight: 900, borderRadius: 99,
                      padding: '1px 5px', lineHeight: 1.4, minWidth: 13, textAlign: 'center',
                    }}>{secondaryLinkedCardsCount}</span>
                  )}
                </button>
            </div>
            <div style={{ paddingTop:8, borderTop:`1px solid ${C.border}`, display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:4, textAlign:"center" }}>
              <div>

                <div style={{ fontWeight:700, color:C.t1, fontSize:12 }}>{String(matchedCountB ?? '-')}</div>
                <div style={{ fontSize:9, color:C.t3 }}>Matches</div>
              </div>
              <div>
                <div style={{ fontWeight:700, color:C.t1, fontSize:12 }}>{String(dealsCountB ?? '-')}</div>
                <div style={{ fontSize:9, color:C.t3 }}>Deals</div>
              </div>
              <div
                onMouseEnter={() => setRatingTooltipScope('secondary')}
                onMouseLeave={() => setRatingTooltipScope((prev) => (prev === 'secondary' ? null : prev))}
                style={{ position: 'relative' }}
              >
                <div style={{ fontWeight:700, color:C.t1, fontSize:12 }}>{ratingLabelB ?? '-'}</div>
                <div style={{ fontSize:9, color:C.t3 }}>Rating</div>
                {ratingTooltipScope === 'secondary' && renderRatingTooltip(secondaryRatingDetails)}
              </div>
            </div>
          </div>
          )}
          <div style={{ background:C.alpha(C.gold, 0.05), border:`1px solid ${C.alpha(C.gold, 0.2)}`, borderRadius:12, padding:'8px 8px', marginBottom:6, height:88, boxSizing:'border-box', display:'grid', gridTemplateRows:'auto auto auto', alignContent:'start', gap:6 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}><Icon name="nugget" size={11} color={C.gold} /><span style={{ fontWeight:700, color:C.gold, fontSize:10, lineHeight:1 }}>{t.nuggetsLabel}</span></div>
              <span style={{ fontWeight:800, color:C.gold, fontSize:14, lineHeight:1 }}>{nuggets}</span>
            </div>
            <div style={{ fontSize:10, color:C.t3, lineHeight:1.2, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{t.nuggets1}</div>
            <button onClick={() => setModal("store")} style={{ width:"100%", height:24, padding:'0 6px', borderRadius:7, background:"transparent", border:`1px solid ${C.gold}`, color:C.gold, fontWeight:700, fontSize:10, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
              <Icon name="plus" size={10} color={C.gold} /> {t.buyMore}
            </button>
          </div>
          <div style={{ background:C.alpha(C.accent, 0.07), border:`1px solid ${C.alpha(C.accent, 0.15)}`, borderRadius:12, padding:'8px 8px', height:98, boxSizing:'border-box', display:'grid', gridTemplateRows:'auto auto auto', alignContent:'start', gap:6 }}>
            <div style={{ display:"flex", alignItems:"center", gap:4 }}><Icon name="zap" size={10} color={C.accentL} /><span style={{ fontSize:10, fontWeight:700, color:C.accentL, lineHeight:1 }}>{t.upgradeTitle}</span></div>
            <div style={{ fontSize:10, color:C.t2, lineHeight:1.2, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{t.upgradeDesc}</div>
            <button type="button" onClick={() => setPage('pricing')} style={{ width:"100%", height:24, padding:'0 6px', borderRadius:7, background:"transparent", border:`1px solid ${C.accent}`, color:C.accent, fontWeight:700, fontSize:10, cursor:"pointer" }}>{t.startTrial}</button>
          </div>
        </div>

        {/* My Card preview modal — top-level so it works regardless of which profile triggered it */}
        {myCardModal.open && (
          <Modal
            onClose={() => setMyCardModal((prev) => ({ ...prev, open: false }))}
            maxWidth={isTouchModalViewport ? 820 : 1480}
            contentStyle={isTouchModalViewport ? { maxHeight: 'calc((var(--app-vh, 1vh) * 100) - 28px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' } : {}}
          >
            <div style={{ display: 'grid', gap: 10, paddingRight: isTouchModalViewport ? 2 : 0 }}>
              <div style={{ display: 'flex', flexWrap: isTouchModalViewport ? 'wrap' : 'nowrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingRight: 30 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, color: C.t1, fontWeight: 800 }}>My Card · {myCardPreviewData.scopeLabel}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: C.t3 }}>
                    Active/published cards currently visible in feed and showcase.
                  </p>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.t2 }}>
                  <span>{myCardPreviewData.services.length} services</span>
                  <span>•</span>
                  <span>{myCardPreviewData.properties.length} properties</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isTouchModalViewport ? '1fr' : `minmax(${myCardPreviewCardWidth}px, 1fr) minmax(${myCardPreviewCardWidth}px, 1fr)`, gap: isTouchModalViewport ? 14 : 18, alignItems: 'stretch' }}>
                <section style={{ border: `1px solid ${C.border}`, borderRadius: 14, background: C.card, overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
                  <div style={{ minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 10px', borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.t3, textTransform: 'uppercase', fontWeight: 700 }}>Feed Card (Connections)</div>
              <div data-guide="feed-view-switch" style={{
                    padding: 12,
                    minHeight: myCardPreviewDeckHeight,
                    height: myCardPreviewDeckHeight,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    boxSizing: 'border-box',
                  }}>
                    <div style={{
                      width: `min(${myCardPreviewCardWidth}px, 100%)`,
                      height: myCardPreviewCardHeight,
                      margin: '0 auto',
                      boxSizing: 'border-box',
                    }}>
                      <SwipeCard
                        card={myCardPreviewData.profileCard}
                        previewOnly
                        isUnlocked
                      />
                    </div>
                  </div>
                </section>

                <section style={{ border: `1px solid ${C.border}`, borderRadius: 14, background: C.card, overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
                  <div style={{ minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.t3, textTransform: 'uppercase', fontWeight: 700 }}>
                    <span>Enabled Showcase Cards</span>
                    {myCardShowcaseCount > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          style={{ border: 'none', background: 'transparent', cursor: myCardShowcaseIdx === 0 ? 'not-allowed' : 'pointer', padding: 4, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          disabled={myCardShowcaseIdx === 0}
                          onClick={() => setMyCardShowcaseIdx(i => Math.max(0, i - 1))}
                          aria-label={t.previous || 'Previous'}
                        >
                          <Icon name="chevronLeft" size={22} color={myCardShowcaseIdx === 0 ? C.t3 : C.t1} />
                        </button>
                        <span style={{ fontSize: 11, color: C.t2, minWidth: 48, textAlign: 'center', display: 'inline-block' }}>{myCardShowcaseIdx + 1} / {myCardShowcaseCount}</span>
                        <button
                          style={{ border: 'none', background: 'transparent', cursor: myCardShowcaseIdx === myCardShowcaseCount - 1 ? 'not-allowed' : 'pointer', padding: 4, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          disabled={myCardShowcaseIdx === myCardShowcaseCount - 1}
                          onClick={() => setMyCardShowcaseIdx(i => Math.min(myCardShowcaseCount - 1, i + 1))}
                          aria-label={t.next || 'Next'}
                        >
                          <Icon name="chevronRight" size={22} color={myCardShowcaseIdx === myCardShowcaseCount - 1 ? C.t3 : C.t1} />
                        </button>
                      </div>
                    )}
                  </div>
                  {myCardShowcaseCount > 0 ? (
                    <div
                      ref={myCardShowcaseScrollRef}
                      className="ds-mycard-showcase-scroll"
                      onScroll={handleMyCardShowcaseScroll}
                      onTouchStart={handleMyCardShowcaseTouchStart}
                      onTouchEnd={handleMyCardShowcaseTouchEnd}
                      onTouchCancel={handleMyCardShowcaseTouchEnd}
                      style={{
                        display: 'flex',
                        overflowX: 'auto',
                        overflowY: 'visible',
                        scrollSnapType: 'x mandatory',
                        WebkitOverflowScrolling: 'touch',
                        touchAction: 'pan-x',
                        minHeight: myCardPreviewDeckHeight,
                      }}
                    >
                      {myCardPreviewData.showcaseItems.map((item, idx) => {
                        if (item._itemType === 'property') {
                          return (
                            <div key={`${item.id || 'property'}-${idx}`} style={{ flex: '0 0 100%', width: '100%', scrollSnapAlign: 'start', scrollSnapStop: 'always' }}>
                            <div style={{ padding: 12, minHeight: myCardPreviewDeckHeight, boxSizing: 'border-box' }}>
                                <div style={{ width: `min(${myCardPreviewCardWidth}px, 100%)`, height: myCardPreviewCardHeight, margin: '0 auto', boxSizing: 'border-box' }}>
                                  <PropertyCard
                                    property={item}
                                    owner={myCardPreviewData.profileCard}
                                    previewOnly
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        }

                        const svcImages = (item.media?.images || []).filter(Boolean);
                        return (
                          <div key={`${item.id || item.title || 'service'}-${idx}`} style={{ flex: '0 0 100%', width: '100%', scrollSnapAlign: 'start', scrollSnapStop: 'always' }}>
                            <div style={{ padding: 12, minHeight: myCardPreviewDeckHeight, boxSizing: 'border-box' }}>
                              <div style={{ width: `min(${myCardPreviewCardWidth}px, 100%)`, height: myCardPreviewCardHeight, overflowY: 'auto', padding: 12, margin: '0 auto', border: `1px solid ${C.border}`, borderRadius: 16, boxSizing: 'border-box', WebkitOverflowScrolling: 'touch' }}>
                                <div style={{ marginBottom: 8 }}>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{item.title || 'Service'}</div>
                                  {item.description && <div style={{ fontSize: 12, color: C.t2, marginTop: 2 }}>{item.description}</div>}
                                  {item.category && <div style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 12, background: C.alpha(C.accent, 0.08), border: `1px solid ${C.alpha(C.accent, 0.15)}`, fontSize: 10, color: C.accent, fontWeight: 700 }}>{item.category}</div>}
                                </div>
                                {svcImages.length > 0 ? (
                                  <div style={{ display: 'grid', gridTemplateColumns: svcImages.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                                    {svcImages.map((src, imageIdx) => (
                                      <div key={`svc-img-${idx}-${imageIdx}`} style={{ position: 'relative', aspectRatio: svcImages.length === 1 ? '16/9' : '1', borderRadius: 8, overflow: 'hidden', background: C.alpha(C.t1, 0.06), border: `1px solid ${C.border}` }}>
                                        <SmartImage src={src} alt={item.title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div style={{ height: 200, border: `1px dashed ${C.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.t3, fontSize: 12 }}>No images</div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ margin: 12, height: isTouchModalViewport ? 260 : 380, border: `1px dashed ${C.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.t3, fontSize: 12 }}>
                      No published property or service in this profile yet.
                    </div>
                  )}
                  {myCardShowcaseCount > 1 ? (
                    <div style={{ padding: '0 12px 12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
                      {myCardPreviewData.showcaseItems.map((entry, idx) => {
                        const isActive = idx === myCardShowcaseIdx;
                        return (
                          <button
                            key={`${entry.id || entry.title || 'showcase'}-${idx}`}
                            type="button"
                            onClick={() => setMyCardShowcaseIdx(idx)}
                            aria-label={`Ir para card ${idx + 1}`}
                            style={{
                              width: isActive ? 16 : 8,
                              height: 8,
                              borderRadius: 999,
                              border: 'none',
                              background: isActive ? C.accent : C.alpha(C.t1, 0.2),
                              cursor: 'pointer',
                              transition: 'all .15s ease',
                            }}
                          />
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              </div>
            </div>
          </Modal>
        )}

        {/* Card stack */}
        <div
          className="dashboard-stack"
          style={{
            display: isTabletPortraitViewport ? 'grid' : 'flex',
            gridTemplateColumns: isTabletPortraitViewport
              ? `${tabletFeedSideWidth}px minmax(0, min(${FEED_CARD_WIDTH}px, calc(100vw - ${tabletFeedSideOffset}px)))`
              : undefined,
            columnGap: isTabletPortraitViewport ? tabletFeedGap : undefined,
            alignItems: isTabletPortraitViewport || isTabletLandscapeViewport ? 'flex-start' : 'center',
            justifyContent: isTabletPortraitViewport ? 'center' : undefined,
            overflow:"visible",
            width:"100%"
          }}
        >

          {isTabletPortraitViewport && (
            <aside
              aria-label="Profile summary"
              style={{
                gridColumn: 1,
                gridRow: 1,
                width: tabletFeedSideWidth,
                display: 'grid',
                gap: isTabletPortraitWideViewport ? 11 : 9,
                alignContent: 'start',
              }}
            >
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: isTabletPortraitWideViewport ? 12 : 10, boxShadow: `0 12px 28px ${C.alpha(C.shadow, 0.07)}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 8 }}>
                  <div style={{ width: isTabletPortraitWideViewport ? 42 : 38, height: isTabletPortraitWideViewport ? 42 : 38, borderRadius: '50%', position: 'relative', flexShrink: 0, background: C.alpha(C.accent, 0.08), overflow: 'hidden' }}>
                    <SmartImage
                      src={quickRegistered && typeof visiblePrimaryCardData?.photo === 'string' && visiblePrimaryCardData.photo.length > 8 ? visiblePrimaryCardData.photo : undefined}
                      alt={profileName}
                      fallback={<Icon name="user" size={16} color={C.accent} strokeWidth={1.5} />}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                    />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: isTabletPortraitWideViewport ? 13 : 12, fontWeight: 800, color: C.t1, lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profileName}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: C.t3, fontSize: isTabletPortraitWideViewport ? 10 : 9, marginTop: 2 }}>
                      <Icon name="mapPin" size={9} color={C.t3} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profileLocation}</span>
                    </div>
                    <div style={{ color: C.accent, fontSize: isTabletPortraitWideViewport ? 10 : 9, fontWeight: 700, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activePrimaryCategoryLabel}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center', marginBottom: 7 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 7px', border: `1px solid ${C.border}`, borderRadius: 999, color: C.t2, fontSize: 9, fontWeight: 800, maxWidth: isTabletPortraitWideViewport ? 96 : 86, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{primaryProfileBadgeLabel}</span>
                  <button
                    type="button"
                    onClick={handlePrimaryMyCardClick}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${(myCardModal.open && myCardModal.scope === visiblePrimaryModalKey) ? C.accent : C.border}`, background: (myCardModal.open && myCardModal.scope === visiblePrimaryModalKey) ? C.alpha(C.accent, 0.12) : 'transparent', color: C.t2, borderRadius: 999, padding: '3px 7px', fontSize: 9, fontWeight: 900, cursor: 'pointer' }}
                  >
                    <span>My Card</span>
                    {displayPrimaryLinkedCardsCount > 0 && <span style={{ background: C.danger, color: '#fff', borderRadius: 99, padding: '0 4px', fontSize: 7 }}>{displayPrimaryLinkedCardsCount}</span>}
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4, paddingTop: 7, borderTop: `1px solid ${C.border}`, textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: isTabletPortraitWideViewport ? 14 : 13, fontWeight: 900, color: C.t1 }}>{String(matchedCount ?? '-')}</div>
                    <div style={{ fontSize: 8, color: C.t3 }}>{t.allMatches}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: isTabletPortraitWideViewport ? 14 : 13, fontWeight: 900, color: C.t1 }}>{String(dealsCount ?? '-')}</div>
                    <div style={{ fontSize: 8, color: C.t3 }}>{t.deals}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: isTabletPortraitWideViewport ? 14 : 13, fontWeight: 900, color: C.t1 }}>{ratingLabel ?? '-'}</div>
                    <div style={{ fontSize: 8, color: C.t3 }}>{t.rating}</div>
                  </div>
                </div>
              </div>

              {hasSecondaryProfile && (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: isTabletPortraitWideViewport ? 12 : 10, boxShadow: `0 12px 28px ${C.alpha(C.shadow, 0.06)}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 8 }}>
                    <div style={{ width: isTabletPortraitWideViewport ? 42 : 38, height: isTabletPortraitWideViewport ? 42 : 38, borderRadius: '50%', position: 'relative', flexShrink: 0, background: C.alpha(C.accent, 0.08), overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {typeof profileThumbB === 'string' && profileThumbB.length > 8 ? (
                        <SmartImage
                          src={profileThumbB}
                          alt={profileNameB}
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); openOnboardingForScope(secondaryVisibleScope); }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openOnboardingForScope(secondaryVisibleScope); } }}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', cursor: 'pointer' }}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openOnboardingForScope(secondaryVisibleScope); }}
                          style={{ width: '100%', height: '100%', border: 0, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                          aria-label="Edit secondary profile"
                        >
                          <Icon name="user" size={16} color={C.accent} strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: isTabletPortraitWideViewport ? 13 : 12, fontWeight: 800, color: C.t1, lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profileNameB}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: C.t3, fontSize: isTabletPortraitWideViewport ? 10 : 9, marginTop: 2 }}>
                        <Icon name="mapPin" size={9} color={C.t3} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profileLocationB}</span>
                      </div>
                      <div style={{ color: C.accent, fontSize: isTabletPortraitWideViewport ? 10 : 9, fontWeight: 700, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profileRoleLineB}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center', marginBottom: 7 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 7px', border: `1px solid ${C.border}`, borderRadius: 999, color: C.t2, fontSize: 9, fontWeight: 800, maxWidth: isTabletPortraitWideViewport ? 96 : 86, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{secondaryProfileBadgeLabel}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleMyCardModal(secondaryModalKey); }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${(myCardModal.open && myCardModal.scope === secondaryModalKey) ? C.accent : C.border}`, background: (myCardModal.open && myCardModal.scope === secondaryModalKey) ? C.alpha(C.accent, 0.12) : 'transparent', color: C.t2, borderRadius: 999, padding: '3px 7px', fontSize: 9, fontWeight: 900, cursor: 'pointer' }}
                    >
                      <span>My Card</span>
                      {secondaryLinkedCardsCount > 0 && <span style={{ background: C.danger, color: '#fff', borderRadius: 99, padding: '0 4px', fontSize: 7 }}>{secondaryLinkedCardsCount}</span>}
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4, paddingTop: 7, borderTop: `1px solid ${C.border}`, textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: isTabletPortraitWideViewport ? 14 : 13, fontWeight: 900, color: C.t1 }}>{String(matchedCountB ?? '-')}</div>
                      <div style={{ fontSize: 8, color: C.t3 }}>{t.allMatches}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: isTabletPortraitWideViewport ? 14 : 13, fontWeight: 900, color: C.t1 }}>{String(dealsCountB ?? '-')}</div>
                      <div style={{ fontSize: 8, color: C.t3 }}>{t.deals}</div>
                    </div>
                    <div
                      onMouseEnter={() => setRatingTooltipScope('secondary')}
                      onMouseLeave={() => setRatingTooltipScope((prev) => (prev === 'secondary' ? null : prev))}
                      style={{ position: 'relative' }}
                    >
                      <div style={{ fontSize: isTabletPortraitWideViewport ? 14 : 13, fontWeight: 900, color: C.t1 }}>{ratingLabelB ?? '-'}</div>
                      <div style={{ fontSize: 8, color: C.t3 }}>{t.rating}</div>
                      {ratingTooltipScope === 'secondary' && renderRatingTooltip(secondaryRatingDetails)}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ background: C.alpha(C.gold, 0.08), border: `1px solid ${C.alpha(C.gold, 0.34)}`, borderRadius: 14, padding: isTabletPortraitWideViewport ? 10 : 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, color: C.gold, fontWeight: 900, fontSize: isTabletPortraitWideViewport ? 12 : 11 }}>
                  <span>Gold Nuggets</span>
                  <span>{String(nuggets ?? 0)}</span>
                </div>
                <button type="button" onClick={() => setPage('pricing')} style={{ marginTop: 8, width: '100%', minHeight: isTabletPortraitWideViewport ? 28 : 26, borderRadius: 9, border: `1px solid ${C.gold}`, background: 'transparent', color: C.gold, fontSize: 9, fontWeight: 900, cursor: 'pointer' }}>
                  + {navT.buyNuggets || 'Buy Nuggets'}
                </button>
              </div>

              <div style={{ background: C.alpha(C.accent, 0.08), border: `1px solid ${C.alpha(C.accent, 0.32)}`, borderRadius: 14, padding: isTabletPortraitWideViewport ? 10 : 9, color: C.t2, fontSize: isTabletPortraitWideViewport ? 10 : 9, lineHeight: 1.35 }}>
                <div style={{ color: C.accent, fontWeight: 900, marginBottom: 3 }}>Upgrade para Pro</div>
                <div>Deslizes ilimitados e mais visibilidade para seus cards.</div>
                <button type="button" onClick={() => setPage('pricing')} style={{ marginTop: 7, width: '100%', minHeight: 24, borderRadius: 8, border: `1px solid ${C.accent}`, background: C.alpha(C.accent, 0.12), color: C.accent, fontSize: 9, fontWeight: 900, cursor: 'pointer' }}>
                  Iniciar periodo de teste
                </button>
              </div>
            </aside>
          )}

          <div
            style={{
              gridColumn: isTabletPortraitViewport ? 2 : undefined,
              minWidth: 0,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              transform: isTabletLandscapeViewport ? 'translateY(-72px)' : undefined,
            }}
          >

          {/* View Tabs + State Filter (inline) */}
          {!isMobileViewport && !isTabletPortraitViewport && (
            <div style={{ display:"flex", marginBottom: isTabletPortraitViewport ? 4 : 8, justifyContent:"flex-end", alignItems: 'center', width: '100%', maxWidth: isTabletPortraitViewport ? FEED_CARD_WIDTH : 700 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                <label style={{ marginRight: 4, fontSize: 13, color: C.t3 }}>State</label>
                <details className="onb-multiselect" open={dropdownOpen} onToggle={(e) => setDropdownOpen(Boolean(e.target.open))} style={{ position: 'relative' }}>
                  <summary style={{ listStyle: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, border: `1px solid ${hasActiveStates ? C.accent : C.border}`, background: 'transparent', color: hasActiveStates ? C.accent : C.t1, cursor: 'pointer', fontSize: 12, lineHeight: '16px', minHeight: 30, fontWeight: hasActiveStates ? 600 : 400, whiteSpace: 'nowrap' }}>
                    <Icon name="mapPin" size={12} color={hasActiveStates ? C.accent : C.t1} strokeWidth={hasActiveStates ? 2 : 1.6} />
                    <span>{stateSummaryLabel}</span>
                    <Icon name={dropdownOpen ? 'chevUp' : 'chevDown'} size={11} color={hasActiveStates ? C.accent : C.t1} />
                  </summary>
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 118, maxHeight: 280, overflowY: 'auto', background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 8, boxShadow: `0 12px 30px ${C.alpha(C.shadow, 0.08)}`, zIndex: 1200 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {stateOptions.filter(s => s !== 'all').map(s => (
                        <label key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '7px 9px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${selectedStates.includes(s) ? C.accent : C.border}`, background: selectedStates.includes(s) ? C.alpha(C.accent, 0.1) : 'transparent', color: selectedStates.includes(s) ? C.accent : C.t1, fontSize: 11, fontWeight: selectedStates.includes(s) ? 600 : 400, lineHeight: 1 }}>
                          <input type="checkbox" style={{ display: 'none' }} checked={selectedStates.includes(s)} onChange={() => {
                            setSelectedStates(prev => {
                              if (!prev) prev = [];
                              if (prev.includes(s)) return prev.filter(x => x !== s);
                              return [...prev.filter(x => x !== 'all'), s];
                            });
                          }} />
                          <span style={{ fontSize: 10 }}>🇺🇸</span>
                          <span style={{ flex: 1 }}>{s}</span>
                          {selectedStates.includes(s) ? <Icon name="check" size={11} color={C.accent} strokeWidth={2.2} /> : null}
                        </label>
                      ))}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                      <button type="button" onClick={() => setSelectedStates([])} style={{ padding: '7px 8px', borderRadius: 999, background: 'transparent', border: `1px solid ${C.border}`, color: C.t2, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Clear</button>
                      <button type="button" onClick={() => setSelectedStates(['all'])} style={{ padding: '7px 8px', borderRadius: 999, background: 'transparent', border: `1px solid ${C.border}`, color: C.t2, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>All</button>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          )}

          <div ref={mobileFeedTitleRef} style={{
            marginBottom: isTabletPortraitViewport ? 24 : 8,
            width: '100%',
            maxWidth: `min(${FEED_CARD_WIDTH}px, 100%)`,
            display: isTabletPortraitViewport ? 'grid' : 'flex',
            gridTemplateColumns: isTabletPortraitViewport ? '1fr auto 1fr' : undefined,
            alignItems: isTabletPortraitViewport ? 'start' : 'center',
            justifyContent: isTabletPortraitViewport ? undefined : 'center',
            gap: isTabletPortraitViewport ? 12 : 8,
            position: 'relative',
            minHeight: isTabletPortraitViewport ? 82 : 38
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: 4,
              borderRadius: 999,
              border: `1px solid ${C.border}`,
              background: C.alpha(C.t1, 0.03),
              gridColumn: isTabletPortraitViewport ? 2 : undefined,
              justifySelf: isTabletPortraitViewport ? 'center' : undefined,
              transform: isTabletPortraitViewport ? 'translateY(32px)' : undefined,
            }}>
              <button
                type="button"
                className="ds-feed-view-btn"
                onClick={() => setView('connections')}
                style={{
                  border: 'none',
                  borderRadius: 999,
                  background: view === 'connections' ? C.accent : 'transparent',
                  color: view === 'connections' ? '#fff' : C.t2,
                  fontWeight: 700,
                  fontSize: 12,
                  padding: '7px 14px',
                  cursor: 'pointer',
                  transition: 'all .2s ease',
                }}
              >
                <span>{t.feedConnectionsButton || 'Connections'}</span>
              </button>
              <button
                type="button"
                className="ds-spotlight-trigger ds-feed-view-btn"
                data-guide="feed-spotlight"
                onClick={() => onOpenSpotlight?.()}
                aria-label={t.spotlightPaidCards || 'Spotlight paid cards'}
                title={t.spotlightPaidCards || 'Spotlight paid cards'}
                style={{
                  border: `1px solid ${C.alpha(C.gold, 0.58)}`,
                  borderRadius: 999,
                  background: C.gold,
                  color: '#3f3a42',
                  fontWeight: 900,
                  fontSize: 12,
                  padding: isMobileViewport ? '6px 10px' : '6px 13px',
                  minHeight: 31,
                  cursor: 'pointer',
                  transition: 'all .2s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: isMobileViewport ? 5 : 7,
                  marginInline: isMobileViewport ? 6 : 8,
                  lineHeight: 1,
                }}
              >
                <img
                  src={spotlightIcon}
                  alt=""
                  aria-hidden="true"
                  className="ds-spotlight-icon-img"
                  style={{ width: isMobileViewport ? 18 : 18, height: isMobileViewport ? 18 : 18 }}
                />
                <span>{t.feedSpotlightButton || 'Spotlight'}</span>
              </button>
              <button
                type="button"
                className="ds-feed-view-btn"
                onClick={() => setView('properties')}
                style={{
                  border: 'none',
                  borderRadius: 999,
                  background: view === 'properties' ? PROPERTY_BLUE : 'transparent',
                  color: view === 'properties' ? '#fff' : C.t2,
                  fontWeight: 700,
                  fontSize: 12,
                  padding: '7px 14px',
                  cursor: 'pointer',
                  transition: 'all .2s ease',
                }}
              >
                <span>{t.feedShowcaseButton || 'Showcase'}</span>
              </button>
            </div>
            {isTabletPortraitViewport && (
              <div style={{ gridColumn: 3, justifySelf: 'end', alignSelf:'start', display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                <label style={{ fontSize: 12, color: C.t3, whiteSpace: 'nowrap' }}>State</label>
                <details className="onb-multiselect" open={dropdownOpen} onToggle={(e) => setDropdownOpen(Boolean(e.target.open))} style={{ position: 'relative' }}>
                  <summary style={{ listStyle: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 999, border: `1px solid ${hasActiveStates ? C.accent : C.border}`, background: C.card, color: hasActiveStates ? C.accent : C.t1, cursor: 'pointer', fontSize: 12, lineHeight: '16px', minHeight: 32, minWidth: 112, justifyContent: 'center', fontWeight: hasActiveStates ? 700 : 600, whiteSpace: 'nowrap', boxShadow: `0 8px 18px ${C.alpha(C.shadow, 0.04)}` }}>
                    <Icon name="mapPin" size={12} color={hasActiveStates ? C.accent : C.t1} strokeWidth={hasActiveStates ? 2 : 1.6} />
                    <span>{stateSummaryLabel}</span>
                    <Icon name={dropdownOpen ? 'chevUp' : 'chevDown'} size={11} color={hasActiveStates ? C.accent : C.t1} />
                  </summary>
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 132, maxHeight: 280, overflowY: 'auto', background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 8, boxShadow: `0 12px 30px ${C.alpha(C.shadow, 0.08)}`, zIndex: 1200 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {stateOptions.filter(s => s !== 'all').map(s => (
                        <label key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '7px 9px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${selectedStates.includes(s) ? C.accent : C.border}`, background: selectedStates.includes(s) ? C.alpha(C.accent, 0.1) : 'transparent', color: selectedStates.includes(s) ? C.accent : C.t1, fontSize: 11, fontWeight: selectedStates.includes(s) ? 700 : 500, lineHeight: 1 }}>
                          <input type="checkbox" style={{ display: 'none' }} checked={selectedStates.includes(s)} onChange={() => {
                            setSelectedStates(prev => {
                              if (!prev) prev = [];
                              if (prev.includes(s)) return prev.filter(x => x !== s);
                              return [...prev.filter(x => x !== 'all'), s];
                            });
                          }} />
                          <span style={{ fontSize: 10 }}>US</span>
                          <span style={{ flex: 1 }}>{s}</span>
                          {selectedStates.includes(s) ? <Icon name="check" size={11} color={C.accent} strokeWidth={2.2} /> : null}
                        </label>
                      ))}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                      <button type="button" onClick={() => setSelectedStates([])} style={{ padding: '7px 8px', borderRadius: 999, background: 'transparent', border: `1px solid ${C.border}`, color: C.t2, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Clear</button>
                      <button type="button" onClick={() => setSelectedStates(['all'])} style={{ padding: '7px 8px', borderRadius: 999, background: 'transparent', border: `1px solid ${C.border}`, color: C.t2, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>All</button>
                    </div>
                  </div>
                </details>
              </div>
            )}
            {isMobileViewport && !mobileFeedSidebarOpen && (
              <button
                type="button"
                className={`ds-mobile-feed-handle ${isDraggingFeedHandle ? 'is-dragging' : ''}`}
                onClick={handleFeedTabClick}
                onPointerDown={handleFeedTabPointerDown}
                onPointerMove={handleFeedTabPointerMove}
                onPointerUp={handleFeedTabPointerEnd}
                onPointerCancel={handleFeedTabPointerEnd}
                aria-label="Open feed filters"
                style={{ top: `${mobileFeedHandleBaseTop}px`, transform: `translateY(calc(-50% + ${mobileFeedHandleOffsetY}px))` }}
              >
                <Icon name="filter" size={14} color={C.t2} strokeWidth={1.9} />
              </button>
            )}
          </div>

          <div ref={mobileFeedStackRef} data-guide="feed-stack" style={{ position:"relative", width:"100%", minHeight:FEED_STACK_CONTAINER_HEIGHT, overflow:"visible", display:"flex", justifyContent:"center", alignItems:"flex-start", boxSizing:"border-box" }}>
            <div style={{ position:"relative", width:`min(${FEED_CARD_WIDTH}px, 100%)`, height:FEED_STACK_CONTAINER_HEIGHT, boxShadow: 'none', borderRadius: 0, overflow: 'visible' }}>
              {view==="connections" && (
                connDisplay.length > 0
                  ? connDisplay.slice(0, 5).reverse().map((c, i) => {
                      const reverseI = Math.min(connDisplay.length, 5) - 1 - i;
                      const isTop    = reverseI === 0;
                      const shiftLeft    = reverseI * FEED_STACK_SHIFT_X;
                      const shiftDown    = reverseI * FEED_STACK_SHIFT_Y;
                      const stackScale   = 1 - reverseI * 0.035;
                      const stackOpacity = isTop ? 1 : 0.9 - reverseI * 0.1;
                      const isSponsored = isConnectionSpotlight(c);
                      return (
                        <div key={c.id} className={`ds-feed-stack-card ${isTop ? 'is-top is-top-connection' : ''} ${isTop && action ? 'is-swipe-animating' : ''}`} style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: `${FEED_CARD_HEIGHT}px`,
                          transformOrigin: "top left",
                          transform: isTop && action
                            ? "translateZ(0)"
                            : `translate3d(${shiftLeft}px, ${shiftDown}px, 0) scale(${stackScale})`,
                          zIndex: 10 - reverseI,
                          opacity: stackOpacity,
                          animation: isTop && action ? (action === "match" ? `carouselRotateMatch ${SWIPE_ANIM_MS}ms cubic-bezier(0.23, 1, 0.32, 1) forwards` : `carouselRotatePass ${SWIPE_ANIM_MS}ms cubic-bezier(0.23, 1, 0.32, 1) forwards`) : "none"
                        }}>
                          <div style={{
                            position: 'relative',
                            width: '100%',
                            height: '100%',
                            borderRadius: 22,
                            boxShadow: isSponsored ? `0 0 0 2px ${C.alpha(C.accent, 0.85)}, 0 0 22px ${C.alpha(C.accent, 0.62)}` : 'none',
                          }}>
                            <SwipeCard card={{
                              ...getFeedDisplayCard(c, isContactUnlocked(c)),
                              portfolioCount: getPortfolioCount(c.ownerId ?? c.id),
                              isVerified: isTruthyVerified(c?.verified) || verifiedOwnerIds.has(String(c.ownerId ?? c.id)),
                            }} action={isTop ? action : null} isUnlocked={isContactUnlocked(c)} isSkipped={skippedSet.has(c.id)} onSwipe={act} onUndo={lastConnOp && isTop ? undo : null} onUnlock={openUnlockFromConnectionCard} showActions={!isMobileViewport} />
                          </div>
                        </div>
                      );
                    })
                  : (
                    <div style={{
                      width: '100%',
                      height: `${FEED_CARD_HEIGHT}px`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'transparent',
                      textAlign: 'center',
                      position: 'relative',
                    }}>
                      <div style={{ display:"flex", justifyContent:"center", marginBottom:14 }}><Icon name="check" size={44} color={C.accent} strokeWidth={1.2} /></div>
                      <div style={{ fontSize:16, fontWeight:700, color:C.t1 }}>{t.seen}</div>
                      <div style={{ color:C.t2, marginTop:6, fontSize:13 }}>{t.seenSub}</div>
                    </div>
                  )
              )}
              {view==="properties" && (
                propDisplay.length > 0
                  ? propDisplay.slice(0, 5).reverse().map((p, i) => {
                      const reverseI = Math.min(propDisplay.length, 5) - 1 - i;
                      const isTop    = reverseI === 0;
                      const pOwner = resolvePropertyOwnerCard(p);
                      const hotMetrics = propertyHotMetrics[String(p.id)] || null;
                      const ownerWideExclusivityStatus = getEffectivePropertyExclusivityStatus(p);
                      const exclusivityStatus = ownerWideExclusivityStatus?.kind === 'blocked'
                        ? ownerWideExclusivityStatus
                        : (hotMetrics?.exclusivityStatus || ownerWideExclusivityStatus);
                      const shiftLeft    = reverseI * FEED_STACK_SHIFT_X;
                      const shiftDown    = reverseI * FEED_STACK_SHIFT_Y;
                      const stackScale   = 1 - reverseI * 0.035;
                      const stackOpacity = isTop ? 1 : 0.9 - reverseI * 0.1;
                      const isSponsored = isPropertySpotlight(p);
                      return (
                        <div
                          key={p.id}
                          className={`ds-feed-stack-card ${isTop ? 'is-top is-top-showcase' : ''} ${isTop && propAction ? 'is-swipe-animating' : ''}`}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: `${FEED_CARD_HEIGHT}px`,
                            transformOrigin: "top left",
                            zIndex: 10 - reverseI,
                            opacity: stackOpacity,
                            animation: (
                              isTop && propAction
                                ? propAction === "interest"
                                  ? `carouselRotateMatch ${SWIPE_ANIM_MS}ms cubic-bezier(0.23, 1, 0.32, 1) forwards`
                                  : `carouselRotatePass ${SWIPE_ANIM_MS}ms cubic-bezier(0.23, 1, 0.32, 1) forwards`
                                : "none"
                            ),
                            transform: (
                              isTop && propAction
                                ? "translateZ(0)"
                                : `translate3d(${shiftLeft}px, ${shiftDown}px, 0) scale(${stackScale})`
                            )
                          }}
                        >
                          <div className={isSponsored ? 'ds-property-spotlight-halo' : undefined} style={{
                            position: 'relative',
                            width: '100%',
                            height: '100%',
                            borderRadius: 22,
                          }}>
                            <PropertyCard
                              property={p}
                              action={isTop ? propAction : null}
                              statusAction={propStatusById[p.id] || null}
                              onInterest={actProperty}
                              owner={pOwner}
                              isSkipped={skippedSetProp.has(p.id)}
                              onUndo={lastPropOp && isTop ? undoProperty : null}
                              hotMetrics={hotMetrics}
                              exclusivityStatus={exclusivityStatus}
                              showActions={!isMobileViewport}
                              onUnlock={() => openUnlock(pOwner || p, {
                                unlockScope: 'property',
                                property: p,
                                propertyId: p.id,
                                propertyAddress: p.address,
                              })}
                            />
                          </div>
                        </div>
                      );
                    })
                  : (
                    <div
                      style={{
                        width: '100%',
                        height: `${FEED_CARD_HEIGHT}px`,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 0 1px ' + C.border,
                        borderRadius: 18,
                        background: 'transparent',
                        textAlign: 'center',
                        position: 'relative',
                      }}
                    >
                      <div style={{ display:"flex", justifyContent:"center", marginBottom:14 }}><Icon name="home" size={44} color={C.gold} strokeWidth={1.2} /></div>
                      <div style={{ fontSize:16, fontWeight:700, color:C.t1 }}>{t.noOpp}</div>
                      <div style={{ color:C.t2, marginTop:6, fontSize:13 }}>{t.noOppSub}</div>
                    </div>
                  )
              )}
            </div>
            {isMobileViewport && !mobileFeedSidebarOpen ? (
              <div className={`ds-mobile-action-dock ${isMobileDockSuppressed ? 'is-suppressed' : ''}`} role="group" aria-label="Swipe actions">
                <button
                  type="button"
                  className="ds-mobile-action-btn"
                  onClick={() => {
                    if (view === 'connections') undo();
                    else undoProperty();
                  }}
                  disabled={!mobileCanUndo}
                  title="Undo"
                  style={{ border: `1px solid ${C.border}`, background: 'transparent' }}
                >
                  <Icon name="rotateCcw" size={16} color={C.t2} strokeWidth={2} />
                </button>

                <button
                  type="button"
                  className="ds-mobile-action-btn"
                  onClick={() => {
                    if (view === 'connections') act('pass');
                    else actProperty('pass');
                  }}
                  disabled={!mobileCanAct}
                  title="Pass"
                  style={{ border: `1.5px solid ${C.danger}`, background: C.alpha(C.danger, 0.08) }}
                >
                  <Icon name="close" size={16} color={C.danger} strokeWidth={2.2} />
                </button>

                <button
                  type="button"
                  className="ds-mobile-action-btn"
                  onPointerDown={(e) => { try { e.preventDefault(); e.stopPropagation(); } catch { /* noop */ } handleMobileUnlockAction(); }}
                  onClick={(e) => { e.stopPropagation(); handleMobileUnlockAction(); }}
                  disabled={!mobileCanAct}
                  title={view === 'connections' ? 'Unlock' : 'Interest'}
                  style={{ border: `1.5px solid ${C.gold}`, background: C.alpha(C.gold, 0.08) }}
                >
                  <Icon name="star" size={16} color={C.gold} strokeWidth={2} />
                </button>

                <button
                  type="button"
                  className="ds-mobile-action-btn"
                  onClick={() => {
                    if (view === 'connections') act('match');
                    else actProperty('interest');
                  }}
                  disabled={!mobileCanAct}
                  title={view === 'connections' ? 'Match' : 'Match'}
                  style={{ border: `1.5px solid ${C.success}`, background: C.alpha(C.success, 0.08) }}
                >
                  <Icon name="check" size={16} color={C.success} strokeWidth={2.2} />
                </button>

                <button
                  type="button"
                  className="ds-mobile-action-btn"
                  onClick={() => {
                    if (view === 'connections') act('next');
                    else actProperty('next');
                  }}
                  disabled={!mobileCanAct}
                  title="Next"
                  style={{ border: `1px solid ${C.border}`, background: 'transparent' }}
                >
                  <Icon name="rotateCw" size={16} color={C.t2} strokeWidth={2} />
                </button>
              </div>
            ) : null}
          </div>
        </div>
        {/* Matches List — col 3 of grid (desktop-only) */}
        </div>
        <div className="desktop-only merge-next-col dashboard-matches" style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:0, padding:10, height:sidePanelHeight, display:"flex", flexDirection:"column", boxSizing:"border-box", marginLeft: isTabletPortraitViewport ? 0 : 12, marginTop: isTabletPortraitViewport ? 0 : -12 }}>
          <div style={{ fontWeight:700, color:C.t1, marginBottom:8, display:"flex", justifyContent:"space-between", fontSize:10, textTransform:"uppercase", letterSpacing:"0.5px" }}>
            <span>{t.matches}</span>
            <span style={{ color:C.accent }}>{filteredMatched.length}</span>
          </div>
          <div style={{ position:'relative', marginBottom:8 }}>
            <button
              onClick={() => setMatchCategoryDropdownOpen((v) => !v)}
              style={{
                width:'100%',
                display:'flex',
                alignItems:'center',
                justifyContent:'space-between',
                padding:'6px 8px',
                borderRadius:8,
                border:`1px solid ${C.border}`,
                background:C.alpha(C.bg, 0.45),
                color:C.t2,
                fontSize:10,
                fontWeight:700,
                cursor:'pointer'
              }}
            >
              <span>{selectedMatchCategories.length ? `${selectedMatchCategories.length} ${t.selected || 'selected'}` : (matchesT.categoryFilter || 'All categories')}</span>
              <Icon name={matchCategoryDropdownOpen ? 'chevUp' : 'chevDown'} size={12} color={C.t3} />
            </button>
            {matchCategoryDropdownOpen ? (
              <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0, maxHeight:170, overflowY:'auto', zIndex:20, background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:6, boxShadow:'0 12px 24px rgba(0,0,0,0.16)' }}>
                <button
                  onClick={() => setSelectedMatchCategories([])}
                  style={{ width:'100%', textAlign:'left', padding:'6px 8px', border:'none', background:'transparent', color:C.t2, fontSize:10, cursor:'pointer' }}
                >
                  {matchesT.categoryFilterAll || 'All categories'}
                </button>
                {matchCategoryOptions.map((opt) => {
                  const checked = selectedMatchCategories.includes(opt.id);
                  return (
                    <label key={opt.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:6, cursor:'pointer', color:C.t2, fontSize:10 }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setSelectedMatchCategories((prev) => checked ? prev.filter((v) => v !== opt.id) : [...prev, opt.id])}
                      />
                      <span>{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>
          {filteredMatched.length === 0 && <div style={{ textAlign:"center", padding:16, color:C.t3, fontSize:10 }}>{t.swipeToMatch}</div>}
          <div style={{ flex:1, minHeight:0, overflowY:"auto", paddingRight:2, paddingBottom:8 }} className="custom-scroll">
            {filteredMatched.map((m, i, filteredArr) => (
              (() => {
                const isUnlockedMatch = isContactUnlocked(m);
                const unlockCost = getUnlockCost(m.id);
                const portfolioCount = getPortfolioCount(m.id);
                return (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 0", borderBottom:i < filteredArr.length-1 ? `1px solid ${C.border}` : "none" }}>
                  <SmartImage
                    src={typeof m.photo === 'string' && m.photo.length > 8 ? m.photo : undefined}
                    alt={m.name}
                    style={{ width:34, height:34, borderRadius:"50%", border:`1px solid ${C.alpha(C.accent,0.15)}`, objectFit:"cover", flexShrink:0, zIndex: 1 }}
                    fallback={<Icon name="user" size={17} color={C.accent} strokeWidth={1.4} />}
                  />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ 
                    fontWeight:700, 
                    color:C.t1, 
                    fontSize:12, 
                    whiteSpace:"nowrap",
                    overflow:"hidden",
                    textOverflow:"ellipsis"
                  }}>
                    <span style={{ color:isUnlockedMatch?C.success:C.gold, fontWeight:600, fontSize:10, marginRight:4 }}>
                      {isUnlockedMatch ? cardsT.unlocked : `${cardsT.locked} · ${unlockCost}★`}
                    </span>
                    {m.name}
                  </div>
                  {portfolioCount > 0 && (
                    <div style={{ fontSize:9, color:C.t3, marginTop:1 }}>
                      {matchesT.portfolioCountLabel
                        .replace('{count}', String(portfolioCount))
                        .replace('{item}', portfolioCount === 1 ? matchesT.portfolioItemOne : matchesT.portfolioItemOther)}
                    </div>
                  )}
                </div>
                <button type="button" onPointerDown={(e) => { try { e.preventDefault(); e.stopPropagation(); } catch { /* noop */ } hideContactFromFeed(m); }} onClick={(e) => { e.stopPropagation(); hideContactFromFeed(m); }}
                  style={{
                    width: 16,
                    height: 16,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 0,
                    padding: 0,
                    cursor: "pointer",
                    opacity: 0.8,
                    flexShrink: 0,
                    transition: 'all .15s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.opacity = '1';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.opacity = '0.8';
                  }}>
                  <Icon name="close" size={10} color={C.t1} />
                </button>
              </div>
                );
              })()
            ))}
          </div>
        </div>
        {/* Interested Properties — col 4 of grid (desktop-only) */}
        <div className="desktop-only dashboard-interested" style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:0, padding:10, height:sidePanelHeight, display:"flex", flexDirection:"column", boxSizing:"border-box", marginTop: isTabletPortraitViewport ? 0 : -12 }}>
          <div style={{ fontWeight:700, color:C.t1, marginBottom:8, display:"flex", justifyContent:"space-between", fontSize:10, textTransform:"uppercase", letterSpacing:"0.5px" }}>
            <span>{t.interested}</span>
            <span style={{ color:C.gold }}>{filteredInterested.length}</span>
          </div>
          <div style={{ position:'relative', marginBottom:8 }}>
            <button
              onClick={() => setInterestStateDropdownOpen((v) => !v)}
              style={{
                width:'100%',
                display:'flex',
                alignItems:'center',
                justifyContent:'space-between',
                padding:'6px 8px',
                borderRadius:8,
                border:`1px solid ${C.border}`,
                background:C.alpha(C.bg, 0.45),
                color:C.t2,
                fontSize:10,
                fontWeight:700,
                cursor:'pointer'
              }}
            >
              <span>{selectedInterestStates.length ? `${selectedInterestStates.length} ${t.selected || 'selected'}` : (matchesT.stateFilterAll || 'All states')}</span>
              <Icon name={interestStateDropdownOpen ? 'chevUp' : 'chevDown'} size={12} color={C.t3} />
            </button>
            {interestStateDropdownOpen ? (
              <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0, maxHeight:170, overflowY:'auto', zIndex:20, background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:6, boxShadow:'0 12px 24px rgba(0,0,0,0.16)' }}>
                <button
                  onClick={() => setSelectedInterestStates([])}
                  style={{ width:'100%', textAlign:'left', padding:'6px 8px', border:'none', background:'transparent', color:C.t2, fontSize:10, cursor:'pointer' }}
                >
                  {matchesT.stateFilterAll || 'All states'}
                </button>
                {interestStateOptions.map((state) => {
                  const checked = selectedInterestStates.includes(state);
                  return (
                    <label key={state} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:6, cursor:'pointer', color:C.t2, fontSize:10 }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setSelectedInterestStates((prev) => checked ? prev.filter((v) => v !== state) : [...prev, state])}
                      />
                      <span>{state}</span>
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>
          {filteredInterested.length === 0 && <div style={{ textAlign:"center", padding:16, color:C.t3, fontSize:10 }}>{t.markToTrack}</div>}
          <div style={{ flex:1, minHeight:0, overflowY:"auto", paddingRight:2, paddingBottom:8 }} className="custom-scroll">
            {filteredInterested.map((m, i) => {
              const propOwner = resolvePropertyOwnerCard(m);
              const isOwnerUnlocked = propOwner && isContactUnlocked(propOwner);
              const ownerUnlockCost = propOwner ? getUnlockCost(propOwner.id) : 1;
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 0", borderBottom:i < interested.length-1 ? `1px solid ${C.border}` : "none" }}>
                  <SmartImage
                    src={typeof (m.images?.[0] || m.image) === 'string' && (m.images?.[0] || m.image)?.length > 8 ? (m.images?.[0] || m.image) : undefined}
                    alt={m.address}
                    style={{ width:38, height:38, borderRadius:7, objectFit:"cover", flexShrink:0 }}
                    fallback={<Icon name="home" size={16} color={C.t3} />}
                  />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, color:C.t1, fontSize:11, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{m.address}</div>
                    <div style={{ fontWeight:600, color:C.gold, fontSize:11 }}>{formatCompactUsd(m.price || 0)}</div>
                    <div style={{ 
                      fontSize:10, 
                      color:C.t3, 
                      whiteSpace:"nowrap",
                      overflow:"hidden",
                      textOverflow:"ellipsis"
                    }}>
                      {propOwner && (
                        <span style={{ color:isOwnerUnlocked ? C.success : C.gold, fontWeight:700, marginRight:4 }}>
                          {isOwnerUnlocked ? cardsT.unlocked : `${cardsT.locked} · ${ownerUnlockCost}★`}
                        </span>
                      )}
                      {matchesT.by} {propOwner?.name || "..."}
                    </div>
                  </div>
                  <button type="button" onPointerDown={(e) => { try { e.preventDefault(); e.stopPropagation(); } catch { /* noop */ } hideInterestFromFeed(m); }} onClick={(e) => { e.stopPropagation(); hideInterestFromFeed(m); }}
                    style={{
                      width: 16,
                      height: 16,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 0,
                      padding: 0,
                      cursor: "pointer",
                      opacity: 0.8,
                      flexShrink: 0,
                      transition: 'all .15s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.opacity = '1';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.opacity = '0.8';
                    }}>
                    <Icon name="close" size={10} color={C.t1} />
                  </button>
                </div>
              );
            })}
            </div>
          </div>

      </div>

      {page !== 'onboarding' ? (
        <div data-guide="feed-minicards" className="ds-dashboard-opportunity-banner" style={{ background:C.card, zIndex:10, boxSizing:"border-box" }}>
        {marqueeBannerItems.length > 0 ? (
          <div
            className="opportunity-banner"
            style={{ overflow:"hidden", padding:"10px 0" }}
            onWheel={() => suppressMobileDockTemporarily(1200)}
            onPointerDown={() => suppressMobileDockTemporarily(1200)}
            onTouchStart={() => suppressMobileDockTemporarily(1200)}
            onTouchMove={() => suppressMobileDockTemporarily(1200)}
          >
            <div
              className="opportunity-track"
              style={{
                display:"flex",
                width:"max-content",
                gap:10,
                padding:"0 10px",
                animation:`bannerScroll ${bannerDurationSec}s linear infinite`,
                transform:"translateZ(0)",
                willChange:"transform",
              }}
            >
              {[0, 1].map(loop => (
                marqueeBannerItems.map((item) => (
                  (() => {
                    const isNeonVerified = item.isHot && item.isVerified;
                    const miniStatuses = [
                      item.exclusiveExpiresAt ? CARD_STATUS.exclusive : null,
                      item.isVerified ? CARD_STATUS.verified : null,
                      item.isHot ? CARD_STATUS.hot : null,
                    ].filter(Boolean);
                    const miniBadgeStatus = pickPriorityStatus(miniStatuses.filter((status) => status !== CARD_STATUS.verified));
                    const miniBadgeLabel = miniBadgeStatus === CARD_STATUS.exclusive
                      ? (cardsT.exclusiveBadge || 'EXCLUSIVE')
                      : (miniBadgeStatus === CARD_STATUS.hot ? (cardsT.hotBadge || 'HOT') : null);
                    return (
                  <button
                    key={`${item.key}-${loop}`}
                    onClick={() => openBannerItem(item)}
                    style={{
                      position: 'relative',
                      minWidth:260,
                      maxWidth:260,
                      padding:"8px 10px",
                      paddingLeft: 10,
                      paddingRight: miniStatuses.length ? Math.max(38, 14 + miniStatuses.length * 23) : 10,
                      borderRadius:10,
                      border: isNeonVerified
                        ? `1px solid ${C.alpha(C.accent, 0.88)}`
                        : `1px solid ${C.border}`,
                      background:C.bg,
                      boxShadow: isNeonVerified
                        ? `0 0 0 1px ${C.alpha(C.accent, 0.48)}, 0 0 14px ${C.alpha(C.accent, 0.62)}`
                        : 'none',
                      cursor:"pointer",
                      textAlign:"left",
                      display:"flex",
                      alignItems:"center",
                      gap:8,
                    }}
                  >
                    {miniStatuses.length ? (
                      <div style={{ position: 'absolute', top: 6, right: 6, display: 'inline-flex', alignItems: 'center', gap: 4, pointerEvents: 'none' }}>
                        {miniStatuses.map((status) => (
                          <CardStatusIcon key={status} type={status} size={18} iconSize={11} />
                        ))}
                      </div>
                    ) : null}
                    {miniBadgeStatus ? (
                      <CardStatusBadge
                        type={miniBadgeStatus}
                        compact
                        pulse={miniBadgeStatus === CARD_STATUS.hot || miniBadgeStatus === CARD_STATUS.exclusive}
                        style={{ position: 'absolute', right: 6, bottom: 8 }}
                      >
                        {miniBadgeLabel}
                      </CardStatusBadge>
                    ) : null}
                    {/* Thumb/avatar seguro, sempre contido. Nunca renderiza imagem se inválida. */}
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:item.thumbRound ? 34 : 38, height:item.thumbRound ? 34 : 38, borderRadius:item.thumbRound ? '50%' : 7, background:C.alpha(item.tone, 0.14), border:`1px solid ${C.alpha(item.tone, 0.3)}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, overflow:'hidden' }}>
                        {item.thumb && typeof item.thumb === 'string' && item.thumb.length > 8 && !item.thumb.startsWith('data:image/svg') ? (
                          <SmartImage src={item.thumb} alt={item.title} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                        ) : (
                          <Icon name={item.thumbRound ? 'user' : 'home'} size={item.thumbRound ? 17 : 16} color={C.t3} />
                        )}
                      </div>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:11, fontWeight:800, color:C.t1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.title}</div>
                        <div style={{ fontSize:10, color:C.t2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.subtitle}</div>
                        <div style={{ fontSize:10, color:item.tone, fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.meta}</div>
                      </div>
                    </div>
                  </button>
                    );
                  })()
                ))
              ))}
            </div>
          </div>
        ) : (
          <div style={{ padding:"10px 14px", color:C.t3, fontSize:11, textAlign:"center" }}>{t.noOpportunitiesNow}</div>
        )}
      </div>
    ) : null}
      <PlanGateModal
        gate={planGate}
        onClose={() => setPlanGate(null)}
        onUpgrade={goToPricingFromGate}
      />
    </div>
  );
}







