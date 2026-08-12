import { describe, expect, it } from 'vitest';
import {
  MAP_PANEL_DEFAULT_WIDTH,
  normalizeMapPanelWidth,
} from './mapPanelWidth';

describe('normalizeMapPanelWidth', () => {
  it('does not interpret a missing saved width as a customized zero-width value', () => {
    expect(normalizeMapPanelWidth(null)).toBeNull();
    expect(normalizeMapPanelWidth('')).toBeNull();
    expect(normalizeMapPanelWidth(null) ?? MAP_PANEL_DEFAULT_WIDTH).toBe(720);
  });

  it('preserves and constrains real user-customized widths', () => {
    expect(normalizeMapPanelWidth('640')).toBe(640);
    expect(normalizeMapPanelWidth('1200')).toBe(900);
  });
});
