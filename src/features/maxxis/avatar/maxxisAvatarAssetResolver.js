import { resolveMaxxisAvatarAsset } from './maxxisAvatarAssets';

export const MAXXIS_AVATAR_RENDERERS = Object.freeze({
  PNG_CSS: 'PNG_CSS',
  LOTTIE: 'LOTTIE',
  LAYERED_SVG: 'LAYERED_SVG',
  ANIMATED_IMAGE: 'ANIMATED_IMAGE',
});

const EXPERIMENTAL_RENDERERS = new Set([
  MAXXIS_AVATAR_RENDERERS.LOTTIE,
  MAXXIS_AVATAR_RENDERERS.LAYERED_SVG,
  MAXXIS_AVATAR_RENDERERS.ANIMATED_IMAGE,
]);

export function resolveMaxxisAvatarRenderAsset({
  state,
  experimentalEnabled = false,
  experimentalAssets = null,
  reducedMotion = false,
} = {}) {
  const fallbackAsset = resolveMaxxisAvatarAsset(state);
  const experimental = experimentalEnabled && !reducedMotion
    ? experimentalAssets?.[fallbackAsset.state]
    : null;
  const experimentalUsable = Boolean(
    experimental
    && EXPERIMENTAL_RENDERERS.has(experimental.renderer)
    && typeof experimental.src === 'string'
    && experimental.src.trim(),
  );

  if (!experimentalUsable) {
    return Object.freeze({
      state: fallbackAsset.state,
      renderer: MAXXIS_AVATAR_RENDERERS.PNG_CSS,
      asset: fallbackAsset,
      fallbackAsset,
      experimental: false,
    });
  }

  return Object.freeze({
    state: fallbackAsset.state,
    renderer: experimental.renderer,
    asset: Object.freeze({ ...experimental, state: fallbackAsset.state }),
    fallbackAsset,
    experimental: true,
  });
}
