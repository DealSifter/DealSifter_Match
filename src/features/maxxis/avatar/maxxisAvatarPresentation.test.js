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
    ['OBSERVING', 'observing-once'],
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
});

