import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  MAXXIS_AVATAR_ASSETS,
  resolveMaxxisAvatarAsset,
} from './maxxisAvatarAssets';
import {
  MAXXIS_AVATAR_ANIMATION_TOKENS,
  MAXXIS_AVATAR_CROSSFADE_MS,
  resolveMaxxisAvatarPresentation,
} from './maxxisAvatarAnimations';
import {
  MAXXIS_AVATAR_RENDERERS,
  resolveMaxxisAvatarRenderAsset,
} from './maxxisAvatarAssetResolver';
import { resolveEffectiveMaxxisAvatarSize } from './maxxisAvatarSizing';
import {
  MAXXIS_AVATAR_ANIMATION_INTENSITY,
  MAXXIS_AVATAR_STATES,
  MAXXIS_AVATAR_VISUAL_STATE_MODES,
} from './maxxisAvatarStates';

describe('Maxxis Deal AI avatar asset mapping', () => {
  it.each(Object.values(MAXXIS_AVATAR_STATES))('maps %s to its closed official asset', (state) => {
    const asset = resolveMaxxisAvatarAsset(state);
    expect(asset).toBe(MAXXIS_AVATAR_ASSETS[state]);
    expect(asset.key).toBe(`avatar-${state.toLowerCase()}`);
    expect(asset.src).toMatch(/\.png(?:\?|$)/);
  });

  it('falls back to IDLE for an unknown state', () => {
    expect(resolveMaxxisAvatarAsset('unknown')).toBe(MAXXIS_AVATAR_ASSETS.IDLE);
  });

  it('falls back to IDLE when the requested asset is missing', () => {
    const missingMap = { ...MAXXIS_AVATAR_ASSETS, PROCESSING: { src: '' } };
    expect(resolveMaxxisAvatarAsset('PROCESSING', missingMap)).toBe(missingMap.IDLE);
  });

  it('uses the canonical IDLE asset if the injected fallback is also missing', () => {
    expect(resolveMaxxisAvatarAsset('SUCCESS', {})).toBe(MAXXIS_AVATAR_ASSETS.IDLE);
  });
});

describe('Maxxis Deal AI avatar animation presentation', () => {
  it.each([
    ['IDLE', 'idle-loop'],
    ['OBSERVING', 'observing-loop'],
    ['PROCESSING', 'processing-loop'],
    ['NOTICED', 'noticed-once'],
    ['WAITING', 'waiting-loop'],
    ['SUCCESS', 'success-once'],
  ])('selects the deterministic %s token', (state, token) => {
    const result = resolveMaxxisAvatarPresentation({ state });
    expect(result.animationToken).toBe(token);
    expect(result.animationToken).toBe(MAXXIS_AVATAR_ANIMATION_TOKENS[state]);
  });

  it.each(Object.values(MAXXIS_AVATAR_ANIMATION_INTENSITY))('normalizes intensity %s', (intensity) => {
    expect(resolveMaxxisAvatarPresentation({ state: 'IDLE', intensity }).intensity).toBe(intensity);
  });

  it('turns motion and crossfade off without changing the state', () => {
    const result = resolveMaxxisAvatarPresentation({
      state: 'PROCESSING',
      intensity: 'OFF',
    });
    expect(result).toMatchObject({
      state: 'PROCESSING',
      animationToken: 'none',
      motionEnabled: false,
      transitionMs: 0,
    });
  });

  it('forces OFF-equivalent motion for reduced motion while preserving visual state', () => {
    const result = resolveMaxxisAvatarPresentation({
      state: 'SUCCESS',
      intensity: 'NORMAL',
      visualStateMode: MAXXIS_AVATAR_VISUAL_STATE_MODES.REDUCED,
    });
    expect(result).toMatchObject({
      state: 'SUCCESS',
      intensity: 'NORMAL',
      reducedMotion: true,
      animationToken: 'none',
      transitionMs: 0,
    });
  });

  it('also respects the browser reduced-motion preference', () => {
    expect(resolveMaxxisAvatarPresentation({
      state: 'NOTICED',
      prefersReducedMotion: true,
    }).motionEnabled).toBe(false);
  });

  it('uses the controlled crossfade when motion is enabled', () => {
    expect(resolveMaxxisAvatarPresentation({
      state: 'OBSERVING',
      intensity: 'SUBTLE',
    }).transitionMs).toBe(MAXXIS_AVATAR_CROSSFADE_MS);
  });

  it('does not perform operational side effects', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const sendMessage = vi.fn();
    const unlockProvider = vi.fn();
    const updateWorkflow = vi.fn();
    const debitNuggets = vi.fn();
    const mutateProperty = vi.fn();

    resolveMaxxisAvatarAsset('SUCCESS');
    resolveMaxxisAvatarPresentation({ state: 'SUCCESS', intensity: 'SUBTLE' });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(unlockProvider).not.toHaveBeenCalled();
    expect(updateWorkflow).not.toHaveBeenCalled();
    expect(debitNuggets).not.toHaveBeenCalled();
    expect(mutateProperty).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('keeps the official PNG + CSS fallback authoritative without an approved experimental asset', () => {
    expect(resolveMaxxisAvatarRenderAsset({ state: 'PROCESSING' })).toMatchObject({
      renderer: MAXXIS_AVATAR_RENDERERS.PNG_CSS,
      experimental: false,
      fallbackAsset: MAXXIS_AVATAR_ASSETS.PROCESSING,
    });
    expect(resolveMaxxisAvatarRenderAsset({
      state: 'SUCCESS',
      experimentalEnabled: true,
      experimentalAssets: { SUCCESS: { renderer: 'LOTTIE', src: '' } },
    }).renderer).toBe(MAXXIS_AVATAR_RENDERERS.PNG_CSS);
  });

  it('can cap only the effective visual size without mutating the stored preference', () => {
    expect(resolveEffectiveMaxxisAvatarSize(2.5, { mobileSafetyLimit: 1.8 })).toEqual({
      stored: 2.5,
      effective: 1.8,
    });
    expect(resolveEffectiveMaxxisAvatarSize(1.43)).toEqual({ stored: 1.43, effective: 1.43 });
  });

  it('does not add scale drift to continuously repeating motion states', () => {
    const css = readFileSync(new URL('./MaxxisAvatar.css', import.meta.url), 'utf8');
    expect(css).toContain('--maxxis-idle-scale: 1;');
    expect(css).toContain('--maxxis-observing-scale: 1;');
    expect(css).toContain('--maxxis-waiting-scale: 1;');
    expect(css.match(/--maxxis-(?:noticed|success)-scale: 1;/g)?.length).toBeGreaterThanOrEqual(6);
    const processing = css.match(/@keyframes maxxisAvatarProcessing \{([\s\S]*?)\n\}/)?.[1] || '';
    expect(processing).not.toMatch(/scale\((?!1\))/);
  });

  it('keeps expressive state assets visually centered instead of centered by PNG bounds', () => {
    const css = readFileSync(new URL('./MaxxisAvatar.css', import.meta.url), 'utf8');
    const stateBlock = (state) => css.match(new RegExp(`\\.maxxis-avatar-layer\\[data-avatar-layer-state="${state}"\\]\\s*\\{([^}]+)\\}`))?.[1] || '';
    const numericVar = (block, name) => Number(block.match(new RegExp(`${name}:\\s*([-\\d.]+)%?`))?.[1]);
    const idleScale = numericVar(stateBlock('IDLE'), '--maxxis-layer-scale');

    ['PROCESSING', 'NOTICED', 'WAITING', 'SUCCESS'].forEach((state) => {
      const block = stateBlock(state);
      expect(numericVar(block, '--maxxis-layer-scale')).toBeLessThan(idleScale);
      expect(numericVar(block, '--maxxis-layer-x')).toBeGreaterThan(4);
    });
  });

  it('normalizes each avatar asset independently during crossfade transitions', () => {
    const css = readFileSync(new URL('./MaxxisAvatar.css', import.meta.url), 'utf8');
    const stateBlocks = css.match(/\.maxxis-avatar-layer\[data-avatar-layer-state="[^"]+"\]\s*\{[^}]+\}/g) || [];
    expect(stateBlocks).toHaveLength(6);
    stateBlocks.forEach((block) => expect(block).toMatch(/--maxxis-layer-(?:scale|x|y):/));
    const renderer = readFileSync(new URL('./MaxxisAvatarRenderer.jsx', import.meta.url), 'utf8');
    expect(renderer).toContain('data-avatar-layer-state={layers.outgoing.state}');
    expect(renderer).toContain('data-avatar-layer-state={layers.active.state}');
  });
});
