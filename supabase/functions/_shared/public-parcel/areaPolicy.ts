// Shared with the read-only evidence consensus. Preserve the original GIS rule.
export const AREA_VARIANCE_THRESHOLDS = Object.freeze({ consistent: 0.02, minor: 0.10 });
export const SQFT_PER_ACRE = 43_560;
export function relativeAreaDifference(a: number, b: number) {
  const denominator = Math.max(Math.abs(a), Math.abs(b));
  return denominator === 0 ? 0 : Math.abs(a - b) / denominator;
}
export function classifyAreaDifference(difference: number, thresholds: Readonly<{ consistent: number; minor: number }> = AREA_VARIANCE_THRESHOLDS) {
  // Only binary round-off at an exact threshold; no presentation rounding.
  const tolerance = Number.EPSILON * 8;
  return difference <= thresholds.consistent + tolerance ? 'CONSISTENT' as const
    : difference <= thresholds.minor + tolerance ? 'MINOR_VARIANCE' as const : 'MATERIAL_CONFLICT' as const;
}
