import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GuideTipsContext } from './GuideTipsContext';
import { guideTipsEnabledKey, resolveGuideTipsActivation } from './guideTipsActivation';

const LEGACY_ENABLED_KEY = 'ds_guidetips_enabled';
const progressKey = (userId) => `ds_guidetips_progress:${String(userId || 'guest')}`;
const TOUR_IDS = new Set(['initial', 'onboarding-entry', 'onboarding', 'feed', 'mapview', 'matches', 'settings']);
const GUIDE_SURFACES = new Set(['dashboard', 'matches', 'mapview', 'onboarding', 'settings']);

const readJson = (key, fallback) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const tourForPage = (page) => {
  if (page === 'dashboard') return 'feed';
  if (page === 'mapview' || page === 'matches' || page === 'onboarding') return page;
  return 'feed';
};

export function GuideTipsProvider({
  children,
  userId,
  page,
  canStart = false,
  onboardingComplete = false,
  isAuthenticated = false,
}) {
  const [enabled, setEnabledState] = useState(false);
  const [activeTour, setActiveTour] = useState('initial');
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState({ cycleCompleted: false, completedTours: [] });
  const pageRef = useRef(page);
  const onboardingCompleteRef = useRef(onboardingComplete);
  const authenticatedUserId = String(userId || '').trim();
  const guideCanStart = Boolean(canStart && isAuthenticated && authenticatedUserId && GUIDE_SURFACES.has(page));

  useEffect(() => {
    pageRef.current = page;
    onboardingCompleteRef.current = onboardingComplete;
  }, [onboardingComplete, page]);

  const persistProgress = useCallback((next) => {
    if (!authenticatedUserId) return;
    setProgress(next);
    try { localStorage.setItem(progressKey(authenticatedUserId), JSON.stringify(next)); } catch { /* UI-only persistence */ }
  }, [authenticatedUserId]);

  useEffect(() => {
    if (!guideCanStart) {
      const timer = window.setTimeout(() => {
        setEnabledState(false);
        setActiveTour(tourForPage(pageRef.current));
        setStepIndex(0);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const isOperational = onboardingCompleteRef.current;
    const saved = readJson(progressKey(authenticatedUserId), { cycleCompleted: false, completedTours: [] });
    // Operational readiness always wins over old UI progress. This also brings
    // retroactive/incomplete accounts back into the required first-access flow.
    const next = isOperational
      ? saved
      : { ...saved, cycleCompleted: false, completedTours: [] };
    const storedEnabled = (() => {
      try {
        const key = guideTipsEnabledKey(authenticatedUserId);
        const scoped = localStorage.getItem(key);
        if (scoped !== null) return scoped === '1';
        const migrated = Boolean(saved.cycleCompleted && localStorage.getItem(LEGACY_ENABLED_KEY) === '1');
        localStorage.setItem(key, migrated ? '1' : '0');
        return migrated;
      } catch { return false; }
    })();
    const activation = resolveGuideTipsActivation({
      canStart,
      isAuthenticated: true,
      isProtectedSurface: GUIDE_SURFACES.has(pageRef.current),
      hasValidProfile: isOperational,
      manuallyEnabled: storedEnabled,
      pageTour: tourForPage(pageRef.current),
    });
    const timer = window.setTimeout(() => {
      setProgress(next);
      setEnabledState(activation.enabled);
      setActiveTour(activation.activeTour);
      setStepIndex(0);
      if (!isOperational) {
        try { localStorage.setItem(progressKey(authenticatedUserId), JSON.stringify(next)); } catch { /* UI-only persistence */ }
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [authenticatedUserId, canStart, guideCanStart, onboardingComplete, page, userId]);

  const setEnabled = useCallback((value) => {
    if (!guideCanStart) {
      setEnabledState(false);
      return;
    }
    const next = Boolean(value);
    setEnabledState(next);
    if (next) {
      setActiveTour(tourForPage(page));
      setStepIndex(0);
    }
    // Mandatory activation is derived from profile validity and is never stored
    // as a manual preference. Closing suspends it only for the current session.
    try { localStorage.setItem(guideTipsEnabledKey(authenticatedUserId), next ? '1' : '0'); } catch { /* noop */ }
  }, [authenticatedUserId, guideCanStart, page]);

  const toggle = useCallback(() => {
    if (!guideCanStart) {
      setEnabledState(false);
      return;
    }
    const mandatory = Boolean(guideCanStart && !onboardingCompleteRef.current);
    if (mandatory) {
      setEnabledState(true);
      return;
    }
    setEnabledState((prev) => {
      const next = !prev;
      if (next) {
        setActiveTour(tourForPage(page));
        setStepIndex(0);
      }
      try { localStorage.setItem(guideTipsEnabledKey(authenticatedUserId), next ? '1' : '0'); } catch { /* noop */ }
      return next;
    });
  }, [authenticatedUserId, guideCanStart, page]);

  const startTour = useCallback((tourId, options = {}) => {
    if (!guideCanStart) {
      setEnabledState(false);
      return;
    }
    const requested = String(tourId || '').trim();
    const normalized = TOUR_IDS.has(requested)
      ? requested
      : tourForPage(requested === 'feed' ? 'dashboard' : requested);
    setActiveTour(normalized);
    setStepIndex(Number(options.stepIndex || 0));
    setEnabledState(true);
    try { localStorage.setItem(guideTipsEnabledKey(authenticatedUserId), '1'); } catch { /* noop */ }
  }, [authenticatedUserId, guideCanStart]);

  const completeTour = useCallback((tourId, completesCycle = false) => {
    const completedTours = Array.from(new Set([...(progress.completedTours || []), tourId]));
    const next = {
      ...progress,
      completedTours,
      cycleCompleted: Boolean(progress.cycleCompleted || completesCycle),
      completedAt: completesCycle ? new Date().toISOString() : progress.completedAt,
    };
    persistProgress(next);
    if (completesCycle) {
      setEnabledState(false);
      try { localStorage.setItem(guideTipsEnabledKey(authenticatedUserId), '0'); } catch { /* noop */ }
    }
  }, [authenticatedUserId, persistProgress, progress]);

  useEffect(() => {
    const onStartTour = (event) => {
      const tourId = event?.detail?.tourId || event?.detail?.page || page;
      startTour(tourId);
    };
    window.addEventListener('ds-guidetips-start', onStartTour);
    const onResumeTour = () => {
      if (guideCanStart) setEnabledState(true);
    };
    window.addEventListener('ds-guidetips-resume', onResumeTour);
    return () => {
      window.removeEventListener('ds-guidetips-start', onStartTour);
      window.removeEventListener('ds-guidetips-resume', onResumeTour);
    };
  }, [guideCanStart, page, startTour]);

  const mandatory = Boolean(guideCanStart && !onboardingComplete);
  const value = useMemo(() => ({
    enabled,
    setEnabled,
    toggle,
    activeTour,
    setActiveTour,
    stepIndex,
    setStepIndex,
    startTour,
    completeTour,
    mandatory,
    cycleCompleted: Boolean(progress.cycleCompleted),
    onboardingComplete,
  }), [
    activeTour,
    completeTour,
    enabled,
    mandatory,
    onboardingComplete,
    progress.cycleCompleted,
    setEnabled,
    startTour,
    stepIndex,
    toggle,
  ]);

  return (
    <GuideTipsContext.Provider value={value}>
      {children}
    </GuideTipsContext.Provider>
  );
}
