import React from 'react';
import { C } from '../../theme/colors';

export function SmartImage({ src, alt = 'Image', style, fallback = null, ...imgProps }) {
  const [failed, setFailed] = React.useState(false);
  const [objectUrl, setObjectUrl] = React.useState(null);

  const isStringSource = typeof src === 'string' && src.trim().length > 0;
  const isBlobSource = (src && (typeof src === 'object') && (src instanceof Blob || src.buffer || src.size));

  React.useEffect(() => {
    setFailed(false);
  }, [src]);

  // If the source is a Blob/File, create an object URL for the <img>
  React.useEffect(() => {
    if (isBlobSource) {
      try {
        const url = URL.createObjectURL(src);
        setObjectUrl(url);
        return () => {
          try { URL.revokeObjectURL(url); } catch (e) { void e; }
          setObjectUrl(null);
        };
      } catch (e) { void e; setObjectUrl(null); }
    }
    return undefined;
  }, [src, isBlobSource]);

  const finalSrc = isStringSource ? src : (objectUrl || null);
  const hasSource = Boolean(finalSrc);

  if (!hasSource || failed) {
    if (fallback) return fallback;
    return (
      <div
        role="img"
        aria-label={`${alt} placeholder`}
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          color: C.t3,
          fontSize: 10,
          fontWeight: 700,
        }}
      >
        IMG
      </div>
    );
  }

  return (
    <img
      src={finalSrc}
      alt={alt}
      style={{ ...style, willChange: 'opacity', backfaceVisibility: 'hidden' }}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      {...imgProps}
    />
  );
}
