import { useCallback, useEffect, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { USER_PREFERENCES_KEY } from '../lib/appSessionSecurity';
import { normalizeUserPreferences } from '../domain/profile/userPreferences';

function readInitialPreferences() {
  if (isSupabaseConfigured) return normalizeUserPreferences(null);
  try {
    const raw = localStorage.getItem(USER_PREFERENCES_KEY);
    return normalizeUserPreferences(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeUserPreferences(null);
  }
}

export function useUserPreferences() {
  const [userPreferences, setUserPreferences] = useState(readInitialPreferences);
  const changeUserPreferences = useCallback((updater) => {
    setUserPreferences((previous) => {
      const base = normalizeUserPreferences(previous);
      const next = typeof updater === 'function' ? updater(base) : updater;
      return normalizeUserPreferences(next);
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(USER_PREFERENCES_KEY, JSON.stringify(normalizeUserPreferences(userPreferences)));
    } catch {
      // Preferences remain available in memory if browser storage is unavailable.
    }
  }, [userPreferences]);

  return { userPreferences, setUserPreferences, changeUserPreferences };
}
