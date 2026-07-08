const THEME_KEY = 'ds_theme';
const LEGACY_THEME_KEY = 'theme';
const LEGACY_EXPLICIT_KEY = 'ds_theme_user_choice';

const LIGHT_THEME_COLOR = '#f6fbfb';
const DARK_THEME_COLOR = '#0b1514';

const LOGOS = {
  mobile: {
    light: '/logo%20tema%20branco.png',
    dark: '/logo%20tema%20preto.png',
  },
  desktop: {
    light: '/logo.png',
    dark: '/logo.png',
  },
};

const normalizeTheme = (theme) => (theme === 'dark' || theme === 'light' ? theme : null);

export function getStoredTheme() {
  if (typeof window === 'undefined') return null;
  try {
    const stored = normalizeTheme(window.localStorage.getItem(THEME_KEY));
    if (stored) return stored;

    const legacyExplicit = normalizeTheme(window.localStorage.getItem(LEGACY_EXPLICIT_KEY));
    const legacyStored = normalizeTheme(window.localStorage.getItem(LEGACY_THEME_KEY));
    return legacyExplicit || legacyStored || null;
  } catch (error) {
    void error;
    return null;
  }
}

export function applyTheme(theme) {
  const normalized = normalizeTheme(theme) || 'light';
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = normalized;
  document.documentElement.style.colorScheme = normalized;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', normalized === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
}

export function getLogoSrc(theme, viewport) {
  const normalizedTheme = normalizeTheme(theme) || 'light';
  const normalizedViewport = viewport === 'mobile' ? 'mobile' : 'desktop';
  return LOGOS[normalizedViewport][normalizedTheme];
}

export function getThemeToggleTarget(theme) {
  return (normalizeTheme(theme) || 'light') === 'dark' ? 'light' : 'dark';
}

export function persistTheme(theme) {
  const normalized = normalizeTheme(theme) || 'light';
  if (typeof window === 'undefined') return normalized;
  try {
    window.localStorage.setItem(THEME_KEY, normalized);
    window.localStorage.removeItem(LEGACY_THEME_KEY);
    window.localStorage.removeItem(LEGACY_EXPLICIT_KEY);
  } catch (error) {
    void error;
  }
  return normalized;
}

export function toggleTheme() {
  const current = typeof document !== 'undefined'
    ? normalizeTheme(document.documentElement.dataset.theme)
    : null;
  const next = (current || getStoredTheme() || 'light') === 'dark' ? 'light' : 'dark';
  persistTheme(next);
  applyTheme(next);
  return next;
}
