import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import ThemeContext from './context';
import { applyTheme, getStoredTheme, persistTheme, toggleTheme as toggleThemeDocument } from '../services/themeService';

export function ThemeProvider({ children, forcedTheme = null }) {
  const [theme, setTheme] = useState(() => {
    const stored = getStoredTheme();
    if (stored) return stored;
    const current = typeof document !== 'undefined'
      ? (document.documentElement.dataset.theme === 'dark' || document.documentElement.dataset.theme === 'light'
        ? document.documentElement.dataset.theme
        : null)
      : null;
    return current || 'light';
  });

  const effectiveTheme = forcedTheme === 'light' || forcedTheme === 'dark' ? forcedTheme : theme;

  useLayoutEffect(() => {
    applyTheme(effectiveTheme);
    if (forcedTheme !== 'light' && forcedTheme !== 'dark') {
      persistTheme(effectiveTheme);
    }
  }, [effectiveTheme, forcedTheme]);

  const toggleTheme = useCallback(() => {
    if (forcedTheme === 'light' || forcedTheme === 'dark') {
      applyTheme(forcedTheme);
      setTheme(forcedTheme);
      return forcedTheme;
    }
    const nextTheme = toggleThemeDocument();
    setTheme(nextTheme);
    return nextTheme;
  }, [forcedTheme]);

  const setThemePreference = useCallback((nextTheme) => {
    const normalized = nextTheme === 'dark' ? 'dark' : 'light';
    persistTheme(normalized);
    applyTheme(normalized);
    setTheme(normalized);
  }, []);

  const value = useMemo(() => ({ theme, effectiveTheme, toggleTheme, setTheme: setThemePreference }), [theme, effectiveTheme, toggleTheme, setThemePreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
