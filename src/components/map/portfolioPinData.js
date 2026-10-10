import { normalizeProfileScope } from '../../lib/profileScopeResolver';

export function linkedPortfolioSlides(owner) {
  const ownerId = String(owner.ownerId || owner.unlockOwnerId || owner.id || '');
  const scope = normalizeProfileScope(owner.primaryProfile || owner.scope);
  const items = [...(Array.isArray(owner.linkedProperties) ? owner.linkedProperties : []).map(item => ({ ...item, kind: 'property' })),
    ...(Array.isArray(owner.linkedServices) ? owner.linkedServices : []).map(item => ({ ...item, kind: 'service' }))];
  const seen = new Set();
  return items.filter(item => String(item.ownerId || item.owner_id || '') === ownerId
    && (!scope || !item.primaryProfile || normalizeProfileScope(item.primaryProfile) === scope)
    && item.dealClosed !== true && item.isActive !== false
    && (item.kind === 'property' ? (item.publishToShowcase ?? item.publish_to_showcase) !== false
      : (item.publishToConnections ?? item.publish_to_connections) !== false)).flatMap(item => {
    const images = [item.image, ...(Array.isArray(item.images) ? item.images : []),
      ...(Array.isArray(item.media?.images) ? item.media.images : []), ...(Array.isArray(item.media_images) ? item.media_images : [])];
    return images.filter(src => typeof src === 'string' && src.trim()).flatMap(src => {
      const key = `${item.kind}:${item.id}:${src}`;
      if (seen.has(key)) return []; seen.add(key);
      return [{ key, src, item, kind: item.kind }];
    });
  });
}
