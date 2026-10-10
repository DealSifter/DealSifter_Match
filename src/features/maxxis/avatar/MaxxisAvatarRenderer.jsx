import React, { useEffect, useRef, useState } from 'react';
import {
  MAXXIS_AVATAR_ASSET_LIST,
} from './maxxisAvatarAssets';
import { resolveMaxxisAvatarRenderAsset } from './maxxisAvatarAssetResolver';
import { resolveMaxxisAvatarPresentation } from './maxxisAvatarAnimations';
import { resolveEffectiveMaxxisAvatarSize } from './maxxisAvatarSizing';
import './MaxxisAvatar.css';

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
  const [activeAsset, setActiveAsset] = useState(targetAsset);
  const imageRefs = useRef(new Map());

  useEffect(() => {
    let cancelled = false;
    const img = imageRefs.current.get(targetAsset.key);
    // Keep the previous artwork visible until the next pose can be painted.
    const show = () => { if (!cancelled) setActiveAsset(targetAsset); };
    if (img?.decode) img.decode().then(show).catch(() => { if (img.naturalWidth > 0) show(); });
    else if (img?.complete && img.naturalWidth > 0) show();
    else img?.addEventListener('load', show, { once: true });
    return () => { cancelled = true; img?.removeEventListener('load', show); };
  }, [targetAsset]);

  const rootClassName = ['maxxis-avatar-renderer', className].filter(Boolean).join(' ');

  return (
    <span
      className={rootClassName}
      data-testid={testId}
      data-avatar-state={presentation.state}
      data-conversational-state={avatarState?.conversationalState || presentation.state}
      data-avatar-asset={activeAsset.key}
      data-avatar-renderer={renderAsset.renderer.toLowerCase().replaceAll('_', '-')}
      data-avatar-size={avatarSizing.stored.toFixed(2)}
      data-avatar-effective-size={avatarSizing.effective.toFixed(2)}
      data-animation-token={presentation.animationToken}
      data-animation-intensity={presentation.intensity}
      data-reduced-motion={presentation.reducedMotion ? 'true' : 'false'}
      data-transitioning={activeAsset.key !== targetAsset.key ? 'true' : 'false'}
      style={{
        '--maxxis-avatar-user-scale': avatarSizing.effective,
        '--maxxis-avatar-crossfade-ms': `${presentation.transitionMs}ms`,
      }}
      aria-hidden="true"
    >
      <span className={`maxxis-avatar-motion ${presentation.className}`}>
        <span className="maxxis-avatar-art">
          {MAXXIS_AVATAR_ASSET_LIST.map((asset) => <img
            key={asset.key}
            ref={(node) => { if (node) imageRefs.current.set(asset.key, node); else imageRefs.current.delete(asset.key); }}
            className={`maxxis-avatar-layer${asset.key === activeAsset.key ? ' maxxis-avatar-layer--active' : ''}`}
            data-avatar-layer-state={asset.state}
            src={asset.src}
            alt=""
            draggable="false"
            aria-hidden="true"
          />)}
        </span>
      </span>
    </span>
  );
}

export default MaxxisAvatarRenderer;
