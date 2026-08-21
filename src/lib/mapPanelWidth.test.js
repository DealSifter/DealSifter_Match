import { describe, expect, it } from 'vitest';
import {
  MAP_PANEL_DEFAULT_WIDTH,
  MAP_PANEL_MOBILE_MAX_WIDTH,
  MAP_PANEL_TABLET_PORTRAIT_DEFAULT_WIDTH,
  normalizeMapPanelWidth,
} from './mapPanelWidth';

describe('normalizeMapPanelWidth', () => {
  it('does not interpret a missing saved width as a customized zero-width value', () => {
    expect(normalizeMapPanelWidth(null)).toBeNull();
    expect(normalizeMapPanelWidth('')).toBeNull();
    expect(normalizeMapPanelWidth(null) ?? MAP_PANEL_DEFAULT_WIDTH).toBe(360);
  });

  it('uses the requested responsive defaults without changing mobile sizing', () => {
    expect(MAP_PANEL_DEFAULT_WIDTH).toBe(720 * 0.5);
    expect(MAP_PANEL_TABLET_PORTRAIT_DEFAULT_WIDTH).toBe(Math.round(585 * 0.7));
    expect(MAP_PANEL_MOBILE_MAX_WIDTH).toBe(585);
  });

  it('preserves and constrains real user-customized widths', () => {
    expect(normalizeMapPanelWidth('640')).toBe(640);
    expect(normalizeMapPanelWidth('1200')).toBe(900);
  });
});
