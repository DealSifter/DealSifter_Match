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

  alpha: (colorVar, opacity) => {
    if (colorVar && colorVar.startsWith('var(')) {
       return `color-mix(in srgb, ${colorVar}, transparent ${Math.round((1 - opacity) * 100)}%)`;
    }
    return `${colorVar}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
  }
};
