import { useCallback, useEffect, useRef, useState } from 'react';
import { USER_PREFERENCES_KEY } from '../lib/appSessionSecurity';
import { normalizeUserPreferences } from '../domain/profile/userPreferences';
import { captureAppException } from '../lib/observability';

function readInitialPreferences() {
  try {
    const raw = localStorage.getItem(USER_PREFERENCES_KEY);
    return normalizeUserPreferences(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeUserPreferences(null);
  }
}

export function useUserPreferences({ accountKey = '', persistPreferences = null } = {}) {
  const [userPreferences, setUserPreferences] = useState(readInitialPreferences);
  const [persistenceStatus, setPersistenceStatus] = useState('idle');
  const latestPreferencesRef = useRef(userPreferences);
  const previousAccountKeyRef = useRef(String(accountKey || ''));
  const persistPreferencesRef = useRef(persistPreferences);
  const persistenceTimerRef = useRef(null);
  persistPreferencesRef.current = persistPreferences;

  useEffect(() => {
    latestPreferencesRef.current = userPreferences;
  }, [userPreferences]);

  const changeUserPreferences = useCallback((updater) => {
    const base = normalizeUserPreferences(latestPreferencesRef.current);
    const next = typeof updater === 'function' ? updater(base) : updater;
    const normalized = normalizeUserPreferences(next);
    latestPreferencesRef.current = normalized;
    setUserPreferences(normalized);
    setPersistenceStatus('saving');
    if (persistenceTimerRef.current) window.clearTimeout(persistenceTimerRef.current);
    persistenceTimerRef.current = window.setTimeout(async () => {
      try {
        if (typeof persistPreferencesRef.current === 'function') {
          await persistPreferencesRef.current(normalized);
        }
        setPersistenceStatus('saved');
      } catch (error) {
        captureAppException(error, {
          area: 'maxxis_preferences',
          operation: 'persist_user_preferences',
          preference_status: 'failed',
        });
        setPersistenceStatus('error');
      } finally {
        persistenceTimerRef.current = null;
      }
    }, 400);
  }, []);

  useEffect(() => {
    const nextAccountKey = String(accountKey || '');
    if (previousAccountKeyRef.current === nextAccountKey) return;
    previousAccountKeyRef.current = nextAccountKey;
    const defaults = readInitialPreferences();
    latestPreferencesRef.current = defaults;
    if (persistenceTimerRef.current) {
      window.clearTimeout(persistenceTimerRef.current);
      persistenceTimerRef.current = null;
    }
    const resetId = window.setTimeout(() => {
      setUserPreferences(defaults);
      setPersistenceStatus('idle');
    }, 0);
    return () => window.clearTimeout(resetId);
  }, [accountKey]);

  useEffect(() => {
    try {
      localStorage.setItem(USER_PREFERENCES_KEY, JSON.stringify(normalizeUserPreferences(userPreferences)));
    } catch {
      // Preferences remain available in memory if browser storage is unavailable.
    }
  }, [userPreferences]);

  useEffect(() => () => {
    if (persistenceTimerRef.current) window.clearTimeout(persistenceTimerRef.current);
  }, []);

  return {
    userPreferences,
    setUserPreferences,
    changeUserPreferences,
    persistenceStatus,
  };
}
