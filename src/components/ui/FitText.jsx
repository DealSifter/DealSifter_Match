import React, { useLayoutEffect, useRef } from 'react';

// Preserve the existing container dimensions; reduce type only when the
// translated label would overflow. Never enlarge a badge or change its text.
export function FitText({ children, maxSize = 10, minSize = 7, style, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const fit = () => {
      element.style.fontSize = `${maxSize}px`;
      if (!element.clientWidth) return;
      let size = maxSize;
      while (element.scrollWidth > element.clientWidth + 1 && size > minSize) {
        size = Math.max(minSize, size - .25);
        element.style.fontSize = `${size}px`;
      }
    };
    fit();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    if (element.parentElement) observer?.observe(element.parentElement);
    let active = true;
    document.fonts?.ready?.then(() => { if (active) fit(); });
    return () => { active = false; observer?.disconnect(); };
  }, [children, maxSize, minSize]);
  return <span {...props} ref={ref} data-fit-text="true" title={typeof children === 'string' ? children : undefined} style={{ display: 'block', minWidth: 0, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: maxSize, ...style }}>{children}</span>;
}
