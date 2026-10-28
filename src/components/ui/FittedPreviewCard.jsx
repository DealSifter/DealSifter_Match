import React, { useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import './PreviewDialogs.css';

// Fit the complete card to the dialog's available space, including short screens.
export function FittedPreviewCard({ children }) {
  const mobile = useMediaQuery('(max-width: 767px)');
  const frameRef = useRef(null);
  const canvasRef = useRef(null);
  const [size, setSize] = useState(null);
  const width = mobile ? 340 : 654;
  const height = mobile ? 576 : 400;
  useEffect(() => {
    const measure = () => {
      const frame = frameRef.current;
      const canvas = canvasRef.current;
      if (!frame || !canvas || !frame.clientWidth || !frame.clientHeight) return;
      const naturalHeight = Math.max(height, canvas.scrollHeight);
      const scale = Math.min(frame.clientWidth / width, frame.clientHeight / naturalHeight);
      setSize((previous) => previous?.scale === scale && previous?.height === naturalHeight ? previous : { scale, height: naturalHeight });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(frameRef.current);
    observer.observe(canvasRef.current);
    measure();
    return () => observer.disconnect();
  }, [width, height, children]);
  return (
    <div ref={frameRef} className="preview-card-frame">
      <div className="preview-card-scaled" style={{ width: width * (size?.scale || 1), height: (size?.height || height) * (size?.scale || 1), opacity: size ? 1 : 0 }}>
        <div ref={canvasRef} className="preview-card-canvas" style={{ width, height: mobile ? 'auto' : height, minHeight: height, transform: `scale(${size?.scale || 1})` }}>
          {children}
        </div>
      </div>
    </div>
  );
}
