export function buildMarqueeBannerItems(items, minCards = 16) {
  const source = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!source.length) return [];
  const targetLength = Math.max(Number(minCards) || 0, source.length);
  return Array.from({ length: targetLength }, (_, index) => ({
    ...source[index % source.length],
    marqueeInstanceKey: `${source[index % source.length].key || 'item'}-${index}`,
  }));
}
