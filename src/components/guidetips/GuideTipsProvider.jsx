import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GuideTipsContext } from './GuideTipsContext';
import { guideTipsEnabledKey, resolveGuideTipsActivation } from './guideTipsActivation';

const LEGACY_ENABLED_KEY = 'ds_guidetips_enabled';
const progressKey = (userId) => `ds_guidetips_progress:${String(userId || 'guest')}`;
const TOUR_IDS = new Set(['initial', 'onboarding-entry', 'onboarding', 'feed', 'mapview', 'matches', 'settings']);

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
}) {
  const [enabled, setEnabledState] = useState(false);
  const [activeTour, setActiveTour] = useState('initial');
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState({ cycleCompleted: false, completedTours: [] });
  const pageRef = useRef(page);
  const onboardingCompleteRef = useRef(onboardingComplete);

  useEffect(() => {
    pageRef.current = page;
    onboardingCompleteRef.current = onboardingComplete;
  }, [onboardingComplete, page]);

  const persistProgress = useCallback((next) => {
    setProgress(next);
    try { localStorage.setItem(progressKey(userId), JSON.stringify(next)); } catch { /* UI-only persistence */ }
  }, [userId]);

  useEffect(() => {
    const isOperational = onboardingCompleteRef.current;
    const saved = readJson(progressKey(userId), { cycleCompleted: false, completedTours: [] });
    // Operational readiness always wins over old UI progress. This also brings
    // retroactive/incomplete accounts back into the required first-access flow.
    const next = isOperational
      ? saved
      : { ...saved, cycleCompleted: false, completedTours: [] };
    const storedEnabled = (() => {
      try {
        const key = guideTipsEnabledKey(userId);
        const scoped = localStorage.getItem(key);
        if (scoped !== null) return scoped === '1';
        const migrated = Boolean(saved.cycleCompleted && localStorage.getItem(LEGACY_ENABLED_KEY) === '1');
        localStorage.setItem(key, migrated ? '1' : '0');
        return migrated;
      } catch { return false; }
    })();
    const activation = resolveGuideTipsActivation({
      canStart,
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
        try { localStorage.setItem(progressKey(userId), JSON.stringify(next)); } catch { /* UI-only persistence */ }
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canStart, onboardingComplete, userId]);

  const setEnabled = useCallback((value) => {
    const next = Boolean(value);
    setEnabledState(next);
    if (next) {
      setActiveTour(tourForPage(page));
      setStepIndex(0);
    }
    // Mandatory activation is derived from profile validity and is never stored
    // as a manual preference. Closing suspends it only for the current session.
    try { localStorage.setItem(guideTipsEnabledKey(userId), next ? '1' : '0'); } catch { /* noop */ }
  }, [page, userId]);

  const toggle = useCallback(() => {
    const mandatory = Boolean(canStart && !onboardingCompleteRef.current);
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
      try { localStorage.setItem(guideTipsEnabledKey(userId), next ? '1' : '0'); } catch { /* noop */ }
      return next;
    });
  }, [canStart, page, userId]);

  const startTour = useCallback((tourId, options = {}) => {
    const requested = String(tourId || '').trim();
    const normalized = TOUR_IDS.has(requested)
      ? requested
      : tourForPage(requested === 'feed' ? 'dashboard' : requested);
    setActiveTour(normalized);
    setStepIndex(Number(options.stepIndex || 0));
    setEnabledState(true);
    try { localStorage.setItem(guideTipsEnabledKey(userId), '1'); } catch { /* noop */ }
  }, [userId]);

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
      try { localStorage.setItem(guideTipsEnabledKey(userId), '0'); } catch { /* noop */ }
    }
  }, [persistProgress, progress, userId]);

  useEffect(() => {
    const onStartTour = (event) => {
      const tourId = event?.detail?.tourId || event?.detail?.page || page;
      startTour(tourId);
    };
    window.addEventListener('ds-guidetips-start', onStartTour);
    const onResumeTour = () => setEnabledState(true);
    window.addEventListener('ds-guidetips-resume', onResumeTour);
    return () => {
      window.removeEventListener('ds-guidetips-start', onStartTour);
      window.removeEventListener('ds-guidetips-resume', onResumeTour);
    };
  }, [page, startTour]);

  const mandatory = Boolean(canStart && !onboardingComplete);
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
