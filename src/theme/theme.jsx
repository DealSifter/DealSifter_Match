import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { C } from './colors';
import ThemeContext from './context';

const normalizeThemePreference = (value) => (value === 'dark' || value === 'light' ? value : null);

const readStoredTheme = () => {
  try {
    const saved = normalizeThemePreference(localStorage.getItem('theme'));
    const explicit = normalizeThemePreference(localStorage.getItem('ds_theme_user_choice'));
    if (explicit && saved === explicit) return explicit;
    if (saved === 'light') return 'light';
    return null;
  } catch (e) {
    void e;
    return null;
  }
};

const applyThemeToDocument = (nextTheme) => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', nextTheme);
  document.documentElement.style.colorScheme = nextTheme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', nextTheme === 'dark' ? '#0b1514' : '#f6fbfb');
};

export function ThemeProvider({ children, forcedTheme = null }) {
  const [theme, setTheme] = useState(() => {
    const stored = readStoredTheme();
    if (stored) return stored;
    const current = typeof document !== 'undefined'
      ? normalizeThemePreference(document.documentElement.getAttribute('data-theme'))
      : null;
    if (current) return current;
    // Keep the app deterministic across devices. The OS preference can change
    // between tablet/browser sessions and was causing unsolicited theme flips.
    return 'light';
  });

  const effectiveTheme = forcedTheme === 'light' || forcedTheme === 'dark' ? forcedTheme : theme;

  useLayoutEffect(() => {
    applyThemeToDocument(effectiveTheme);
  }, [effectiveTheme]);

  useEffect(() => {
    if (forcedTheme === 'light' || forcedTheme === 'dark') return;
    try {
      localStorage.setItem('theme', theme);
      localStorage.setItem('ds_theme_user_choice', theme);
    } catch (e) { void e; }
  }, [forcedTheme, theme]);

  const toggleTheme = useCallback(() => {
    const appliedTheme = typeof document !== 'undefined'
      ? (document.documentElement.getAttribute('data-theme') || effectiveTheme)
      : effectiveTheme;
    const nextTheme = appliedTheme === 'dark' ? 'light' : 'dark';
    applyThemeToDocument(nextTheme);
    try {
      localStorage.setItem('theme', nextTheme);
      localStorage.setItem('ds_theme_user_choice', nextTheme);
    } catch (e) { void e; }
    setTheme(nextTheme);
  }, [effectiveTheme]);

  const value = useMemo(() => ({ theme, effectiveTheme, toggleTheme }), [theme, effectiveTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
