import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { C } from './colors';
import ThemeContext from './context';

export function ThemeProvider({ children, forcedTheme = null }) {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('theme');
      const hasExplicitThemeChoice = localStorage.getItem('ds_theme_user_choice') === '1';
      if (saved === 'light') return saved;
      if (saved === 'dark') return hasExplicitThemeChoice ? saved : 'light';
      const current = document.documentElement.getAttribute('data-theme');
      if (current === 'light' || current === 'dark') return current;
    } catch (e) { void e; }
    // Keep the app deterministic across devices. The OS preference can change
    // between tablet/browser sessions and was causing unsolicited theme flips.
    return 'light';
  });

  const effectiveTheme = forcedTheme === 'light' || forcedTheme === 'dark' ? forcedTheme : theme;

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    document.documentElement.style.colorScheme = effectiveTheme;
  }, [effectiveTheme]);

  useEffect(() => {
    if (forcedTheme === 'light' || forcedTheme === 'dark') return;
    try { localStorage.setItem('theme', theme); } catch (e) { void e; }
  }, [forcedTheme, theme]);

  const toggleTheme = useCallback(() => {
    try { localStorage.setItem('ds_theme_user_choice', '1'); } catch (e) { void e; }
    const appliedTheme = typeof document !== 'undefined'
      ? (document.documentElement.getAttribute('data-theme') || effectiveTheme)
      : effectiveTheme;
    setTheme(appliedTheme === 'dark' ? 'light' : 'dark');
  }, [effectiveTheme]);

  const value = useMemo(() => ({ theme, effectiveTheme, toggleTheme }), [theme, effectiveTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
