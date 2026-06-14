import React, { useEffect, useMemo, useState } from 'react';
import { C } from './colors';
import ThemeContext from './context';

export function ThemeProvider({ children, forcedTheme = null }) {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) { void e; }
    // Keep the app deterministic across devices. The OS preference can change
    // between tablet/browser sessions and was causing unsolicited theme flips.
    return 'dark';
  });

  const effectiveTheme = forcedTheme === 'light' || forcedTheme === 'dark' ? forcedTheme : theme;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme);
  }, [effectiveTheme]);

  useEffect(() => {
    try { localStorage.setItem('theme', theme); } catch (e) { void e; }
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  const value = useMemo(() => ({ theme, effectiveTheme, toggleTheme }), [theme, effectiveTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
