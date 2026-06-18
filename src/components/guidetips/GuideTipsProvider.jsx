import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'ds_guidetips_enabled';

const GuideTipsContext = createContext({
  enabled: false,
  setEnabled: () => {},
  toggle: () => {},
});

const readInitialEnabled = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === '1';
  } catch {
    return false;
  }
};

export function GuideTipsProvider({ children }) {
  const [enabled, setEnabledState] = useState(readInitialEnabled);

  const setEnabled = useCallback((value) => {
    const next = Boolean(value);
    setEnabledState(next);
    try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch { /* noop */ }
  }, []);

  const toggle = useCallback(() => setEnabledState((prev) => {
    const next = !prev;
    try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch { /* noop */ }
    return next;
  }), []);

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY) setEnabledState(event.newValue === '1');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo(() => ({ enabled, setEnabled, toggle }), [enabled, setEnabled, toggle]);

  return (
    <GuideTipsContext.Provider value={value}>
      {children}
    </GuideTipsContext.Provider>
  );
}

export const useGuideTips = () => useContext(GuideTipsContext);
