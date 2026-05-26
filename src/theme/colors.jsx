const clamp01 = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
};

const cssVarCache = new Map();

const resolveCssVarColor = (token) => {
  if (typeof window === 'undefined' || !token?.startsWith('var(')) return null;
  const match = token.match(/var\((--[^),\s]+)/);
  if (!match?.[1]) return null;
  const varName = match[1];
  const cacheKey = `${varName}|${document.documentElement.getAttribute('data-theme') || 'light'}`;
  if (cssVarCache.has(cacheKey)) return cssVarCache.get(cacheKey);
  const resolved = getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || null;
  if (resolved) cssVarCache.set(cacheKey, resolved);
  return resolved;
};

const toRgba = (color, opacity) => {
  const alpha = clamp01(opacity);
  const raw = String(color || '').trim();
  if (!raw) return `rgba(0,0,0,${alpha})`;

  if (raw.startsWith('#')) {
    const hex = raw.slice(1);
    const normalized = hex.length === 3
      ? hex.split('').map((ch) => ch + ch).join('')
      : hex.length === 6
        ? hex
        : null;
    if (normalized) {
      const r = Number.parseInt(normalized.slice(0, 2), 16);
      const g = Number.parseInt(normalized.slice(2, 4), 16);
      const b = Number.parseInt(normalized.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }

  const rgbMatch = raw.match(/rgba?\(([^)]+)\)/i);
  if (rgbMatch?.[1]) {
    const parts = rgbMatch[1].split(',').map((p) => Number.parseFloat(p.trim()));
    if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }
  }

  return raw;
};

export const C = {
  bg:      "var(--bg)",
  card:    "var(--card)",
  border:  "var(--border)",
  accent:  "var(--accent-hex)",
  accentL: "var(--accent-l)",
  accentD: "var(--accent-d)",
  gold:    "var(--gold-hex)",
  goldL:   "var(--gold-l)",
  goldD:   "var(--gold-d)",
  success: "var(--success-hex)",
  danger:  "var(--danger-hex)",
  t1:      "var(--t1)",
  t2:      "var(--t2)",
  t3:      "var(--t3)",
  shadow:  "var(--shadow)",

  // Alias para manter consistência semântica com sistemas de design
  error:   "var(--danger-hex)",
  warning: "var(--warning-hex)",

  alpha: (colorVar, opacity) => {
    const alpha = clamp01(opacity);
    const resolved = resolveCssVarColor(colorVar) || colorVar;
    return toRgba(resolved, alpha);
  }
};
