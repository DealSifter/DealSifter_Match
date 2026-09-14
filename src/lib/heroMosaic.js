export function buildHeroMosaicLoopItems(items) {
  const sequence = Array.isArray(items) ? items : [];
  return [...sequence, ...sequence];
}
