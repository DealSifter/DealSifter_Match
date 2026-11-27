export const viewportBounds = () => {
  const view = window.visualViewport;
  const left = view?.offsetLeft || 0;
  const top = view?.offsetTop || 0;
  const width = view?.width || window.innerWidth;
  const height = view?.height || window.innerHeight;
  return { left, top, width, height, right: left + width, bottom: top + height };
};

export const intersectBounds = (rect, clip) => {
  const left = Math.max(rect.left, clip.left);
  const top = Math.max(rect.top, clip.top);
  const right = Math.min(rect.right, clip.right);
  const bottom = Math.min(rect.bottom, clip.bottom);
  return right > left && bottom > top
    ? { left, top, right, bottom, width: right - left, height: bottom - top }
    : null;
};

// Highlight only the portion actually visible inside the viewport and scroll panels.
export const visibleTargetBounds = (element, viewport) => {
  let rect = intersectBounds(element.getBoundingClientRect(), viewport);
  for (let parent = element.parentElement; parent && rect; parent = parent.parentElement) {
    const style = window.getComputedStyle(parent);
    if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return null;
    const clipsX = /auto|scroll|hidden|clip/.test(style.overflowX);
    const clipsY = /auto|scroll|hidden|clip/.test(style.overflowY);
    if (!clipsX && !clipsY) continue;
    const bounds = parent.getBoundingClientRect();
    const left = bounds.left + parent.clientLeft;
    const top = bounds.top + parent.clientTop;
    rect = intersectBounds(rect, {
      left: clipsX ? left : rect.left,
      right: clipsX ? left + parent.clientWidth : rect.right,
      top: clipsY ? top : rect.top,
      bottom: clipsY ? top + parent.clientHeight : rect.bottom,
    });
  }
  return rect;
};

export const focusBounds = (rect, viewport) => rect && intersectBounds({
  left: rect.left - 7, top: rect.top - 7, right: rect.right + 7, bottom: rect.bottom + 7,
}, {
  left: viewport.left + 3, top: viewport.top + 3,
  right: viewport.right - 3, bottom: viewport.bottom - 3,
});

export const clampPosition = (value, min, max) => Math.max(min, Math.min(value, Math.max(min, max)));
