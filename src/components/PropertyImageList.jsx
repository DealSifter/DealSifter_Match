import React from 'react';
import { Icon } from './ui/Icon';
import { C } from '../theme/colors';
import { SmartImage } from './ui/SmartImage';

function resolveImageSrc(image) {
  if (!image) return '';
  if (typeof image === 'string') return image;
  if (typeof image === 'object') return image.preview || image.url || image.src || '';
  return '';
}

export function PropertyImageList({ images, onRemove, onReorder, maxImages = 10 }) {
  // Drag-and-drop reorder logic
  const handleDragStart = (e, idx) => {
    e.dataTransfer.setData('imgIdx', idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e, toIdx) => {
    const fromIdx = Number(e.dataTransfer.getData('imgIdx'));
    if (fromIdx === toIdx) return;
    onReorder(fromIdx, toIdx);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
      {images.slice(0, maxImages).map((img, idx) => (
        <div
          key={idx}
          draggable
          onDragStart={e => handleDragStart(e, idx)}
          onDragOver={e => e.preventDefault()}
          onDrop={e => handleDrop(e, idx)}
          style={{ position: 'relative', border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', cursor: 'grab', background: C.bg2, minHeight: 120 }}
        >
          <SmartImage
            src={resolveImageSrc(img)}
            alt={`Imagem ${idx + 1}`}
            style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
          />
          <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(17,17,17,0.72)', color: '#fff', borderRadius: 6, fontSize: 10, fontWeight: 700, padding: '3px 6px' }}>
            #{idx + 1}
          </div>
          <div style={{ position: 'absolute', right: 6, bottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => { if (idx <= 0) return; onReorder(idx, idx - 1); }} title="Mover para cima" style={{ background: 'rgba(0,0,0,0.55)', border: 'none', cursor: idx <= 0 ? 'default' : 'pointer', borderRadius: 6, padding: '5px 6px', flexShrink: 0 }}>
              <Icon name="chevUp" size={12} color={idx <= 0 ? C.border : C.t3} />
            </button>
            <button onClick={() => { if (idx >= images.length - 1) return; onReorder(idx, idx + 1); }} title="Mover para baixo" style={{ background: 'rgba(0,0,0,0.55)', border: 'none', cursor: idx >= images.length - 1 ? 'default' : 'pointer', borderRadius: 6, padding: '5px 6px', flexShrink: 0 }}>
              <Icon name="chevDown" size={12} color={idx >= images.length - 1 ? C.border : C.t3} />
            </button>
            <button onClick={() => onRemove(idx)} title="Excluir" style={{ background: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer', borderRadius: 6, padding: '5px 6px', flexShrink: 0 }}>
              <Icon name="trash" size={12} color={C.danger} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
