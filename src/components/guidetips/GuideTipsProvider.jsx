import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GuideTipsContext } from './GuideTipsContext';

const ENABLED_KEY = 'ds_guidetips_enabled';
const progressKey = (userId) => `ds_guidetips_progress:${String(userId || 'guest')}`;

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
    const manuallyEnabled = (() => {
      try { return localStorage.getItem(ENABLED_KEY) === '1'; } catch { return false; }
    })();
    const hasStartedFirstRun = !isOperational || (next.completedTours || []).length > 0;
    const mustRun = Boolean(canStart && (!isOperational || (!next.cycleCompleted && hasStartedFirstRun)));
    const timer = window.setTimeout(() => {
      setProgress(next);
      setEnabledState(mustRun || manuallyEnabled);
      setActiveTour(mustRun ? (isOperational ? 'feed' : 'initial') : tourForPage(pageRef.current));
      setStepIndex(0);
      if (!isOperational) {
        try { localStorage.setItem(progressKey(userId), JSON.stringify(next)); } catch { /* UI-only persistence */ }
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canStart, userId]);

  const setEnabled = useCallback((value) => {
    const next = Boolean(value);
    const mandatory = Boolean(
      canStart
      && (!onboardingComplete || (!progress.cycleCompleted && (progress.completedTours || []).length > 0))
    );
    setEnabledState(mandatory || next);
    if (next) {
      setActiveTour(tourForPage(page));
      setStepIndex(0);
    }
    try { localStorage.setItem(ENABLED_KEY, mandatory || next ? '1' : '0'); } catch { /* noop */ }
  }, [canStart, onboardingComplete, page, progress.completedTours, progress.cycleCompleted]);

  const toggle = useCallback(() => {
    const mandatory = Boolean(
      canStart
      && (!onboardingComplete || (!progress.cycleCompleted && (progress.completedTours || []).length > 0))
    );
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
      try { localStorage.setItem(ENABLED_KEY, next ? '1' : '0'); } catch { /* noop */ }
      return next;
    });
  }, [canStart, onboardingComplete, page, progress.completedTours, progress.cycleCompleted]);

  const startTour = useCallback((tourId, options = {}) => {
    const normalized = tourForPage(tourId === 'feed' ? 'dashboard' : tourId);
    setActiveTour(normalized);
    setStepIndex(Number(options.stepIndex || 0));
    setEnabledState(true);
    try { localStorage.setItem(ENABLED_KEY, '1'); } catch { /* noop */ }
  }, []);

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
      try { localStorage.setItem(ENABLED_KEY, '0'); } catch { /* noop */ }
    }
  }, [persistProgress, progress]);

  useEffect(() => {
    const onStartTour = (event) => {
      const tourId = event?.detail?.tourId || event?.detail?.page || page;
      startTour(tourId);
    };
    window.addEventListener('ds-guidetips-start', onStartTour);
    return () => window.removeEventListener('ds-guidetips-start', onStartTour);
  }, [page, startTour]);

  const mandatory = Boolean(
    canStart
    && (!onboardingComplete || (!progress.cycleCompleted && (progress.completedTours || []).length > 0))
  );
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
