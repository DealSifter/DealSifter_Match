export const MAP_PANEL_MIN_WIDTH = 250;
// Previous defaults were 720px on desktop/landscape and 585px on portrait
// tablet. Keep the requested reductions explicit and mobile unchanged.
export const MAP_PANEL_DEFAULT_WIDTH = 360;
export const MAP_PANEL_TABLET_PORTRAIT_DEFAULT_WIDTH = 410;
export const MAP_PANEL_MAX_WIDTH = 900;
export const MAP_PANEL_MOBILE_MAX_WIDTH = 585;

export function normalizeMapPanelWidth(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(MAP_PANEL_MIN_WIDTH, Math.min(MAP_PANEL_MAX_WIDTH, numeric));
}
