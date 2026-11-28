import { afterEach, describe, expect, it, vi } from 'vitest';
import { clampPosition, focusBounds, intersectBounds, isTargetExposed } from './guideGeometry';

const viewport = { left: 0, top: 0, right: 390, bottom: 844, width: 390, height: 844 };
afterEach(() => vi.unstubAllGlobals());

describe('GuideTips visible geometry', () => {
  it('keeps the entire outline inside a mobile screen for oversized targets', () => {
    const visible = intersectBounds({ left: -80, top: -100, right: 900, bottom: 1200 }, viewport);
    expect(focusBounds(visible, viewport)).toEqual({ left: 3, top: 3, right: 387, bottom: 841, width: 384, height: 838 });
  });

  it('does not point at a duplicate entirely outside the viewport', () => {
    expect(intersectBounds({ left: -500, right: -100, top: 90, bottom: 180 }, viewport)).toBeNull();
    expect(intersectBounds({ left: 20, right: 200, top: 90, bottom: 180 }, viewport)?.width).toBe(180);
  });

  it('clips both axes to the visible portion of an inner scroll panel', () => {
    const target = { left: -20, top: 60, right: 420, bottom: 700 };
    const panel = { left: 20, top: 100, right: 200, bottom: 250 };
    expect(intersectBounds(intersectBounds(target, viewport), panel)).toEqual({ ...panel, width: 180, height: 150 });
  });

  it('keeps padding on all four sides of a small visible target', () => {
    expect(focusBounds({ left: 24, top: 100, right: 234, bottom: 150 }, viewport))
      .toEqual({ left: 17, top: 93, right: 241, bottom: 157, width: 224, height: 64 });
  });

  it('respects a visual viewport with an offset, such as mobile zoom or keyboard', () => {
    const view = { left: 100, top: 200, right: 300, bottom: 500 };
    expect(focusBounds({ left: 90, top: 190, right: 310, bottom: 510 }, view))
      .toEqual({ left: 103, top: 203, right: 297, bottom: 497, width: 194, height: 294 });
  });

  it('bounds popup dragging and resizing without losing the close controls', () => {
    expect(clampPosition(-100, 12, 58)).toBe(12);
    expect(clampPosition(1000, 12, 58)).toBe(58);
    expect(clampPosition(30, 12, 58)).toBe(30);
    expect(clampPosition(100, 12, -20)).toBe(12);
  });

  it('ignores the guide itself when checking which application item is exposed', () => {
    const target = { closest: () => null, contains: (node) => node === target };
    const dimmer = { closest: () => ({}) };
    vi.stubGlobal('document', { elementsFromPoint: () => [dimmer, target] });
    expect(isTargetExposed(target, viewport)).toBe(true);
  });

  it('rejects an export copy covered by the foreground property sheet', () => {
    const backgroundExport = { closest: () => null, contains: () => false };
    const sheet = { closest: () => null };
    const foregroundExport = { closest: () => null, contains: () => false };
    vi.stubGlobal('document', { elementsFromPoint: () => [foregroundExport, sheet, backgroundExport] });
    expect(isTargetExposed(backgroundExport, viewport)).toBe(false);
    expect(isTargetExposed(foregroundExport, viewport)).toBe(true);
  });

  it('can locate the exposed part of a large panel whose center is covered', () => {
    const panel = { closest: () => null, contains: () => false };
    const cover = { closest: () => null };
    vi.stubGlobal('document', { elementsFromPoint: (x) => x < 100 ? [panel] : [cover, panel] });
    expect(isTargetExposed(panel, viewport)).toBe(true);
  });
});
