export const MAXXIS_COMMUNICATION_GAP = 12;
const clamp = (value, min, max) => Math.max(min, Math.min(value, Math.max(min, max)));

// Coordinates are relative to the avatar container; never to an unrelated screen corner.
export function placeMaxxisCommunication({ anchor, avatar = anchor, viewport, width = 312, height = 150, margin = 12, gap = MAXXIS_COMMUNICATION_GAP }) {
  const bounds = { left: viewport.left + margin, top: viewport.top + margin,
    right: viewport.left + viewport.width - margin, bottom: viewport.top + viewport.height - margin };
  const actualWidth = Math.min(width, Math.max(0, bounds.right - bounds.left));
  const actualHeight = Math.min(height, Math.max(0, bounds.bottom - bounds.top));
  const mobile = viewport.width < 768;
  const preferred = (avatar.left + avatar.right) / 2 > viewport.left + viewport.width / 2 ? 'left' : 'right';
  const fits = { left: avatar.left - gap - actualWidth >= bounds.left, right: avatar.right + gap + actualWidth <= bounds.right,
    above: avatar.top - gap - actualHeight >= bounds.top, below: avatar.bottom + gap + actualHeight <= bounds.bottom };
  const order = mobile ? ['above', 'below', preferred, preferred === 'left' ? 'right' : 'left']
    : [preferred, 'above', 'below', preferred === 'left' ? 'right' : 'left'];
  const side = order.find((candidate) => fits[candidate]) || 'above';
  let left = (avatar.left + avatar.right - actualWidth) / 2;
  let top = (avatar.top + avatar.bottom - actualHeight) / 2;
  if (side === 'left') left = avatar.left - gap - actualWidth;
  if (side === 'right') left = avatar.right + gap;
  if (side === 'above') top = avatar.top - gap - actualHeight;
  if (side === 'below') top = avatar.bottom + gap;
  left = clamp(left, bounds.left, bounds.right - actualWidth);
  top = clamp(top, bounds.top, bounds.bottom - actualHeight);
  const vertical = side === 'above' || side === 'below';
  const tail = vertical ? clamp((avatar.left + avatar.right) / 2 - left, 18, actualWidth - 18)
    : clamp((avatar.top + avatar.bottom) / 2 - top, 18, actualHeight - 18);
  return { side, left: left - anchor.left, top: top - anchor.top, width: actualWidth,
    maxHeight: bounds.bottom - bounds.top, tail, visible: Object.values(fits).some(Boolean) && avatar.right > bounds.left && avatar.left < bounds.right && avatar.bottom > bounds.top && avatar.top < bounds.bottom };
}

export function maxxisCommunicationCopy(message = {}) {
  const full = String(message.text || '').trim();
  if (full.length <= 220) return full;
  const sentences = full.match(/[^.!?]+[.!?](?:\s|$)/g) || [];
  const first = sentences[0]?.trim();
  if (first && first.length <= 220) return first;
  // Don't cut a fact/number in half. Details remain intact in the existing chat handoff.
  return String(message.shortText || message.ctaLabel || 'Maxxis Deal AI').slice(0, 220);
}
