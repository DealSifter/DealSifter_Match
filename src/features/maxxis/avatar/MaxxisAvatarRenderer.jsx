import React, { useEffect, useState } from 'react';
import {
  MAXXIS_AVATAR_ASSET_LIST,
} from './maxxisAvatarAssets';
import { resolveMaxxisAvatarRenderAsset } from './maxxisAvatarAssetResolver';
import { resolveMaxxisAvatarPresentation } from './maxxisAvatarAnimations';
import { resolveEffectiveMaxxisAvatarSize } from './maxxisAvatarSizing';
import './MaxxisAvatar.css';

let avatarPreloadScheduled = false;

function scheduleAvatarPreload() {
  if (avatarPreloadScheduled || typeof window === 'undefined' || typeof window.Image !== 'function') return undefined;
  avatarPreloadScheduled = true;

  const preload = () => {
    MAXXIS_AVATAR_ASSET_LIST.forEach((asset) => {
      const image = new window.Image();
      image.decoding = 'async';
      image.src = asset.src;
    });
  };

  if (typeof window.requestIdleCallback === 'function') {
    const idleId = window.requestIdleCallback(preload, { timeout: 1_500 });
    return () => window.cancelIdleCallback?.(idleId);
  }

  const timeoutId = window.setTimeout(preload, 250);
  return () => window.clearTimeout(timeoutId);
}

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() => (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  return reducedMotion;
}

export function MaxxisAvatarRenderer({ avatarState, avatarSize = 1, className = '', testId = 'maxxis-avatar-renderer' }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const renderAsset = resolveMaxxisAvatarRenderAsset({
    state: avatarState?.state,
    reducedMotion: prefersReducedMotion,
  });
  const targetAsset = renderAsset.fallbackAsset;
  const avatarSizing = resolveEffectiveMaxxisAvatarSize(avatarSize);
  const presentation = resolveMaxxisAvatarPresentation({
    state: targetAsset.state,
    intensity: avatarState?.intensity,
    visualStateMode: avatarState?.visualStateMode,
    prefersReducedMotion,
  });
  const [layers, setLayers] = useState(() => ({ active: targetAsset, outgoing: null }));

  useEffect(() => {
    scheduleAvatarPreload();
  }, []);

  if (layers.active.src !== targetAsset.src) {
    setLayers({
      active: targetAsset,
      outgoing: presentation.transitionMs > 0 ? layers.active : null,
    });
  }

  useEffect(() => {
    if (!layers.outgoing || presentation.transitionMs <= 0) return undefined;
    const activeSrc = layers.active.src;
    const timeoutId = window.setTimeout(() => {
      setLayers((current) => (
        current.active.src === activeSrc
          ? { ...current, outgoing: null }
          : current
      ));
    }, presentation.transitionMs);
    return () => window.clearTimeout(timeoutId);
  }, [layers.active.src, layers.outgoing, presentation.transitionMs]);

  const motionKey = `${presentation.state}:${avatarState?.transition?.at || 0}`;
  const rootClassName = ['maxxis-avatar-renderer', className].filter(Boolean).join(' ');

  return (
    <span
      className={rootClassName}
      data-testid={testId}
      data-avatar-state={presentation.state}
      data-avatar-asset={layers.active.key}
      data-avatar-renderer={renderAsset.renderer.toLowerCase().replaceAll('_', '-')}
      data-avatar-size={avatarSizing.stored.toFixed(2)}
      data-avatar-effective-size={avatarSizing.effective.toFixed(2)}
      data-animation-token={presentation.animationToken}
      data-animation-intensity={presentation.intensity}
      data-reduced-motion={presentation.reducedMotion ? 'true' : 'false'}
      data-transitioning={layers.outgoing ? 'true' : 'false'}
      style={{
        '--maxxis-avatar-user-scale': avatarSizing.effective,
      }}
      aria-hidden="true"
    >
      <span key={motionKey} className={`maxxis-avatar-motion ${presentation.className}`}>
        <span className="maxxis-avatar-art">
          {layers.outgoing ? (
            <img
              className="maxxis-avatar-layer maxxis-avatar-layer--outgoing"
              src={layers.outgoing.src}
              alt=""
              draggable="false"
              aria-hidden="true"
            />
          ) : null}
          <img
            className="maxxis-avatar-layer maxxis-avatar-layer--active"
            src={layers.active.src}
            alt=""
            draggable="false"
            aria-hidden="true"
          />
        </span>
      </span>
    </span>
  );
}

export default MaxxisAvatarRenderer;
