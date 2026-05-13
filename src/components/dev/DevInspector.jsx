import React, { useState, useEffect, useRef, useCallback } from 'react';
import { genId } from '../../lib/id';

// Reduce default z-index so dev overlays don't occlude main UI (onb-shell uses 10010)
let Z = 10005;
const HIGH_Z = 10020; // z-index used when inspector is visible/expanded
const PANEL_W = 360;
const FLOAT_SIZE = 52;

function getSelector(el) {
  if (!el || el === document.body) return 'body';
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls = Array.from(el.classList)
    .filter(c => !c.startsWith('__') && c.length < 40)
    .slice(0, 3)
    .map(c => `.${c}`)
    .join('');
  return `${tag}${id}${cls}`;
}

function getPath(el) {
  const parts = [];
  let cur = el;
  let depth = 0;
  while (cur && cur !== document.body && depth < 5) {
    parts.unshift(getSelector(cur));
    cur = cur.parentElement;
    depth++;
  }
  return parts.join(' > ');
}

function describeEl(el) {
  const rect = el.getBoundingClientRect();
  const cs = window.getComputedStyle(el);
  const text = (el.innerText || el.textContent || '').trim().slice(0, 120);
  const role = el.getAttribute('role') || '';
  const ariaLabel = el.getAttribute('aria-label') || '';
  const dataKey = Object.keys(el.dataset || {}).join(', ');

  return {
    tag: el.tagName.toLowerCase(),
    path: getPath(el),
    text: text || '(sem texto)',
    size: `${Math.round(rect.width)}x${Math.round(rect.height)}px`,
    position: `top:${Math.round(rect.top)} left:${Math.round(rect.left)}`,
    bg: cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : '(transparente)',
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    role: role || ariaLabel || dataKey || '-',
  };
}

function buildChatMessage(el) {
  const d = describeEl(el);
  return [
    `Elemento inspecionado:`,
    `- Tag: ${d.tag}`,
    `- Caminho: ${d.path}`,
    `- Texto: "${d.text}"`,
    `- Tamanho: ${d.size} @ ${d.position}`,
    `- Fundo: ${d.bg} | Font: ${d.fontSize} / peso ${d.fontWeight}`,
    `- Role/Label: ${d.role}`,
    '',
    `O que precisa corrigir neste elemento?`,
  ].join('\n');
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    return true;
  }
}

async function copyImageBlob(blob) {
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ]);
    return true;
  } catch {
    return false;
  }
}

async function requestDisplayStream() {
  const preferred = {
    video: {
      cursor: 'always',
      displaySurface: 'browser',
    },
    audio: false,
    // Chromium hints: improve chance of showing/choosing current localhost tab.
    preferCurrentTab: true,
    selfBrowserSurface: 'include',
    surfaceSwitching: 'include',
    systemAudio: 'exclude',
  };

  try {
    return await navigator.mediaDevices.getDisplayMedia(preferred);
  } catch {
    return navigator.mediaDevices.getDisplayMedia({
      video: { cursor: 'always' },
      audio: false,
    });
  }
}

function Tooltip({ text, x, y }) {
  return (
    <div style={{
      position: 'fixed', left: x + 14, top: y + 14, zIndex: Z + 10,
      background: 'rgba(15,15,20,0.93)', color: '#e2e8f0',
      padding: '6px 10px', borderRadius: 8,
      fontSize: 11, fontFamily: 'monospace', lineHeight: 1.5,
      maxWidth: 320, pointerEvents: 'none',
      border: '1px solid rgba(255,255,255,0.12)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      whiteSpace: 'pre-wrap', wordBreak: 'break-all',
    }}>
      {text}
    </div>
  );
}

function Highlight({ rect, mode }) {
  if (!rect) return null;
  const color = mode === 'inspect' ? '#3b82f6' : '#f59e0b';
  return (
    <>
      <div style={{
        position: 'fixed',
        top: rect.top, left: rect.left,
        width: rect.width, height: rect.height,
        outline: `2px solid ${color}`,
        background: `${color}18`,
        zIndex: Z + 5, pointerEvents: 'none',
        transition: 'all 0.07s ease',
      }} />
      <div style={{
        position: 'fixed',
        top: rect.top - 22, left: rect.left,
        background: color, color: '#fff',
        padding: '2px 7px', borderRadius: 4,
        fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
        zIndex: Z + 6, pointerEvents: 'none',
      }}>
        {Math.round(rect.width)}x{Math.round(rect.height)}
      </div>
    </>
  );
}

function Toast({ msg }) {
  return (
    <div style={{
      position: 'fixed', bottom: 70, left: '50%',
      transform: 'translateX(-50%) translateY(0)',
      background: '#10b981', color: '#fff',
      padding: '10px 20px', borderRadius: 30,
      fontSize: 13, fontWeight: 700,
      boxShadow: '0 8px 24px rgba(16,185,129,0.4)',
      zIndex: Z + 20, pointerEvents: 'none',
      animation: 'devToastIn 0.3s ease',
    }}>
      {msg}
    </div>
  );
}

function drawArrow(ctx, x1, y1, x2, y2, color, width) {
  const head = 12;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const angle = Math.atan2(dy, dx);

  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 7), y2 - head * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 7), y2 - head * Math.sin(angle + Math.PI / 7));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function distancePointToSegment(px, py, x1, y1, x2, y2) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let t = -1;
  if (lenSq !== 0) t = dot / lenSq;
  let xx;
  let yy;
  if (t < 0) {
    xx = x1;
    yy = y1;
  } else if (t > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + t * C;
    yy = y1 + t * D;
  }
  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

function ScreenshotEditor({ imageUrl, onClose, onCopyDone }) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [tool, setTool] = useState('select');
  const [shapes, setShapes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const opRef = useRef(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const render = useCallback((nextShapes = shapes, activeId = selectedId) => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    nextShapes.forEach((s) => {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.lineWidth;

      if (s.type === 'rect') {
        ctx.strokeRect(s.x, s.y, s.w, s.h);
      } else if (s.type === 'circle') {
        ctx.beginPath();
        ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2, Math.abs(s.w / 2), Math.abs(s.h / 2), 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + s.w, s.y + s.h);
        ctx.stroke();
      } else if (s.type === 'arrow') {
        drawArrow(ctx, s.x, s.y, s.x + s.w, s.y + s.h, s.color, s.lineWidth);
      }

      if (activeId === s.id) {
        const hx = s.x + s.w;
        const hy = s.y + s.h;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.rect(hx - 5, hy - 5, 10, 10);
        ctx.fill();
        ctx.stroke();
      }
    });
  }, [shapes, selectedId]);

  useEffect(() => {
    render();
  }, [shapes, selectedId, render]);

  const getPoint = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  };

  const hitShape = (x, y) => {
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i];
      const ex = s.x + s.w;
      const ey = s.y + s.h;
      const onHandle = Math.abs(x - ex) < 10 && Math.abs(y - ey) < 10;
      if (onHandle) return { id: s.id, mode: 'resize' };

      if (s.type === 'line' || s.type === 'arrow') {
        const dist = distancePointToSegment(x, y, s.x, s.y, ex, ey);
        if (dist <= 8) return { id: s.id, mode: 'move' };
      } else {
        const x1 = Math.min(s.x, ex);
        const x2 = Math.max(s.x, ex);
        const y1 = Math.min(s.y, ey);
        const y2 = Math.max(s.y, ey);
        if (x >= x1 && x <= x2 && y >= y1 && y <= y2) return { id: s.id, mode: 'move' };
      }
    }
    return null;
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    const p = getPoint(e);

    if (tool === 'select') {
      const hit = hitShape(p.x, p.y);
      if (!hit) {
        setSelectedId(null);
        return;
      }
      setSelectedId(hit.id);
      const current = shapes.find(s => s.id === hit.id);
      opRef.current = {
        op: hit.mode,
        id: hit.id,
        sx: p.x,
        sy: p.y,
        ox: current.x,
        oy: current.y,
        ow: current.w,
        oh: current.h,
      };
      return;
    }

    const shape = {
      id: genId(),
      type: tool,
      x: p.x,
      y: p.y,
      w: 1,
      h: 1,
      color: '#ef4444',
      lineWidth: 3,
    };
    setShapes(prev => [...prev, shape]);
    setSelectedId(shape.id);
    opRef.current = { op: 'draw', id: shape.id, sx: p.x, sy: p.y };
  };

  const onPointerMove = (e) => {
    if (!opRef.current) return;
    const p = getPoint(e);
    const op = opRef.current;

    setShapes(prev => prev.map((s) => {
      if (s.id !== op.id) return s;
      if (op.op === 'draw') {
        return { ...s, w: p.x - op.sx, h: p.y - op.sy };
      }
      if (op.op === 'move') {
        return { ...s, x: op.ox + (p.x - op.sx), y: op.oy + (p.y - op.sy) };
      }
      if (op.op === 'resize') {
        return { ...s, w: op.ow + (p.x - op.sx), h: op.oh + (p.y - op.sy) };
      }
      return s;
    }));
  };

  const onPointerUp = () => {
    if (!opRef.current) return;
    const currentOp = opRef.current;
    opRef.current = null;

    if (currentOp.op === 'draw') {
      setShapes(prev => prev.filter(s => {
        if (s.id !== currentOp.id) return true;
        return Math.abs(s.w) > 3 || Math.abs(s.h) > 3;
      }));
    }
  };

  const onDeleteSelected = () => {
    if (!selectedId) return;
    setShapes(prev => prev.filter(s => s.id !== selectedId));
    setSelectedId(null);
  };

  const onCopy = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    render();
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const ok = await copyImageBlob(blob);
      onCopyDone(ok);
    }, 'image/png');
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: Z + 40,
      background: 'rgba(2,6,23,0.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        width: 'min(1100px, 96vw)', height: 'min(92vh, 900px)',
        background: '#0b1020', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.09)',
          display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
        }}>
          {['select', 'line', 'rect', 'circle', 'arrow'].map((t) => (
            <button
              key={t}
              onClick={() => setTool(t)}
              style={{
                border: 'none', borderRadius: 8, cursor: 'pointer',
                padding: '6px 10px', fontSize: 12, fontWeight: 700,
                background: tool === t ? '#2563eb' : 'rgba(255,255,255,0.08)',
                color: tool === t ? '#fff' : '#cbd5e1',
              }}
            >
              {t.toUpperCase()}
            </button>
          ))}

          <button
            onClick={onDeleteSelected}
            style={{
              marginLeft: 'auto',
              border: '1px solid rgba(239,68,68,0.6)', borderRadius: 8,
              background: 'transparent', color: '#ef4444', cursor: 'pointer',
              padding: '6px 10px', fontSize: 12, fontWeight: 700,
            }}
          >
            Delete Shape
          </button>

          <button
            onClick={onCopy}
            style={{
              border: 'none', borderRadius: 8, background: '#10b981', color: '#fff',
              cursor: 'pointer', padding: '6px 12px', fontSize: 12, fontWeight: 700,
            }}
          >
            Copy Image
          </button>

          <button
            onClick={onClose}
            style={{
              border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
              background: 'transparent', color: '#cbd5e1', cursor: 'pointer',
              padding: '6px 12px', fontSize: 12, fontWeight: 700,
            }}
          >
            Close
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            style={{
              maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto',
              borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
              background: '#111827',
              cursor: tool === 'select' ? 'default' : 'crosshair',
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function DevInspector() {
  const isDevEnv = import.meta.env.DEV;

  const [active, setActive] = useState(false);
  // Start minimized to avoid showing large floating panel by default
  const [minimized, setMinimized] = useState(true);

  // Ensure z-index updates so the minimized button is clickable and
  // the expanded panel renders above the app when opened.
  useEffect(() => {
    if (!isDevEnv) return undefined;
    try {
      Z = (!minimized || active) ? HIGH_Z : 10005;
    } catch { /* noop */ }
    return () => { Z = 10005; };
  }, [isDevEnv, minimized, active]);
  const [mode, setMode] = useState('inspect');
  const [hovRect, setHovRect] = useState(null);
  const [tooltip, setTooltip] = useState({ text: '', x: 0, y: 0 });
  const [toast, setToast] = useState('');
  const [lastMsg, setLastMsg] = useState('');

  const [panelPos, setPanelPos] = useState({ x: 12, y: 90 });
  const isDragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  const [captureSelecting, setCaptureSelecting] = useState(false);
  const [captureRect, setCaptureRect] = useState(null);
  const captureStart = useRef(null);
  const frameRef = useRef(null);

  const [editorImage, setEditorImage] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2400);
  };

  const clampPanel = (x, y) => {
    const maxX = Math.max(0, window.innerWidth - PANEL_W - 8);
    const maxY = Math.max(0, window.innerHeight - 120);
    return {
      x: Math.max(0, Math.min(maxX, x)),
      y: Math.max(0, Math.min(maxY, y)),
    };
  };

  const startDrag = (e, isFloat) => {
    const target = e.target;
    if (!isFloat && !target.dataset.drag) return;

    isDragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, px: panelPos.x, py: panelPos.y };

    const onMove = (ev) => {
      if (!isDragging.current) return;
      const next = clampPanel(
        dragStart.current.px + (ev.clientX - dragStart.current.mx),
        dragStart.current.py + (ev.clientY - dragStart.current.my),
      );
      setPanelPos(next);
    };

    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const onMouseMove = useCallback((e) => {
    if (!active || captureSelecting || editorImage) return;
    if (e.target.closest('[data-dev-inspector]')) return;

    const el = e.target;
    const rect = el.getBoundingClientRect();
    setHovRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });

    if (mode === 'inspect') {
      const d = describeEl(el);
      setTooltip({ text: `${d.tag} | ${d.size}\n${d.path}`, x: e.clientX, y: e.clientY });
    } else {
      setTooltip({ text: `${Math.round(rect.width)} x ${Math.round(rect.height)} px`, x: e.clientX, y: e.clientY });
    }
  }, [active, mode, captureSelecting, editorImage]);

  const onClick = useCallback(async (e) => {
    if (!active || mode !== 'inspect' || captureSelecting || editorImage) return;
    if (e.target.closest('[data-dev-inspector]')) return;
    e.preventDefault();
    e.stopPropagation();
    const msg = buildChatMessage(e.target);
    setLastMsg(msg);
    await copyText(msg);
    showToast('Elemento copiado para o chat');
  }, [active, mode, captureSelecting, editorImage]);

  useEffect(() => {
    if (!isDevEnv) return undefined;
    if (!active) {
      const timer = window.setTimeout(() => {
        setHovRect(null);
        setTooltip({ text: '', x: 0, y: 0 });
      }, 0);
      return () => window.clearTimeout(timer);
    }
    window.addEventListener('mousemove', onMouseMove, true);
    window.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('mousemove', onMouseMove, true);
      window.removeEventListener('click', onClick, true);
    };
  }, [isDevEnv, active, onMouseMove, onClick]);

  useEffect(() => {
    if (!isDevEnv) return undefined;
    const handler = (e) => {
      if (e.altKey && e.key.toLowerCase() === 'i') {
        setActive(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isDevEnv]);

  const captureDisplayFrame = async () => {
    const stream = await requestDisplayStream();

    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();

    await new Promise((resolve) => {
      if (video.readyState >= 2) resolve();
      else video.onloadedmetadata = () => resolve();
    });

    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = video.videoWidth;
    frameCanvas.height = video.videoHeight;
    const ctx = frameCanvas.getContext('2d');
    ctx.drawImage(video, 0, 0, frameCanvas.width, frameCanvas.height);

    stream.getTracks().forEach(t => t.stop());
    video.srcObject = null;

    return frameCanvas;
  };

  const startScreenshot = async () => {
    try {
      const frameCanvas = await captureDisplayFrame();
      frameRef.current = frameCanvas;
      setCaptureRect(null);
      setCaptureSelecting(true);
      showToast('Arraste para selecionar a area do screenshot');
    } catch {
      showToast('Falha ao capturar tela. Abra no navegador e escolha a aba localhost.');
    }
  };

  const onCaptureDown = (e) => {
    captureStart.current = { x: e.clientX, y: e.clientY };
    setCaptureRect({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
  };

  const onCaptureMove = (e) => {
    if (!captureStart.current) return;
    const sx = captureStart.current.x;
    const sy = captureStart.current.y;
    setCaptureRect({ x: sx, y: sy, w: e.clientX - sx, h: e.clientY - sy });
  };

  const finishSelection = () => {
    if (!captureRect || !frameRef.current) {
      setCaptureSelecting(false);
      captureStart.current = null;
      return;
    }

    const x = Math.min(captureRect.x, captureRect.x + captureRect.w);
    const y = Math.min(captureRect.y, captureRect.y + captureRect.h);
    const w = Math.abs(captureRect.w);
    const h = Math.abs(captureRect.h);

    captureStart.current = null;

    if (w < 10 || h < 10) {
      setCaptureSelecting(false);
      setCaptureRect(null);
      showToast('Area muito pequena. Tente novamente.');
      return;
    }

    const frame = frameRef.current;
    const scaleX = frame.width / window.innerWidth;
    const scaleY = frame.height / window.innerHeight;

    const crop = document.createElement('canvas');
    crop.width = Math.round(w * scaleX);
    crop.height = Math.round(h * scaleY);

    const ctx = crop.getContext('2d');
    ctx.drawImage(
      frame,
      Math.round(x * scaleX),
      Math.round(y * scaleY),
      Math.round(w * scaleX),
      Math.round(h * scaleY),
      0,
      0,
      crop.width,
      crop.height,
    );

    setCaptureSelecting(false);
    setCaptureRect(null);
    setEditorImage(crop.toDataURL('image/png'));
  };

  const onCaptureUp = () => {
    finishSelection();
  };

  const onEditorCopyDone = (ok) => {
    if (ok) {
      showToast('Imagem anotada copiada para o clipboard');
    } else {
      showToast('Nao foi possivel copiar imagem automaticamente');
    }
  };

  const btnStyle = (isOn) => ({
    padding: '5px 11px', borderRadius: 6, border: 'none', cursor: 'pointer',
    fontWeight: 700, fontSize: 11,
    background: isOn ? '#3b82f6' : 'rgba(255,255,255,0.08)',
    color: isOn ? '#fff' : '#94a3b8',
    transition: 'all 0.15s',
  });

  if (!isDevEnv) return null;

  return (
    <>
      <style>{`
        @keyframes devToastIn {
          from { opacity:0; transform:translateX(-50%) translateY(12px); }
          to   { opacity:1; transform:translateX(-50%) translateY(0); }
        }
        [data-dev-inspector] * { user-select: none; }
      `}</style>

      {active && hovRect && !captureSelecting && !editorImage && <Highlight rect={hovRect} mode={mode} />}
      {active && tooltip.text && !captureSelecting && !editorImage && <Tooltip text={tooltip.text} x={tooltip.x} y={tooltip.y} />}
      {toast && <Toast msg={toast} />}

      {captureSelecting && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: Z + 30, cursor: 'crosshair', background: 'rgba(2,6,23,0.2)' }}
          onMouseDown={onCaptureDown}
          onMouseMove={onCaptureMove}
          onMouseUp={onCaptureUp}
        >
          {captureRect && (
            <div style={{
              position: 'fixed',
              left: Math.min(captureRect.x, captureRect.x + captureRect.w),
              top: Math.min(captureRect.y, captureRect.y + captureRect.h),
              width: Math.abs(captureRect.w),
              height: Math.abs(captureRect.h),
              border: '2px solid #22d3ee',
              background: 'rgba(34,211,238,0.14)',
              pointerEvents: 'none',
            }} />
          )}
        </div>
      )}

      {editorImage && (
        <ScreenshotEditor
          imageUrl={editorImage}
          onClose={() => setEditorImage(null)}
          onCopyDone={onEditorCopyDone}
        />
      )}

      {minimized ? (
        <button
          data-dev-inspector="true"
          onMouseDown={(e) => startDrag(e, true)}
          onDoubleClick={() => setMinimized(false)}
          onClick={() => setMinimized(false)}
          style={{
            position: 'fixed', left: panelPos.x, top: panelPos.y,
            width: FLOAT_SIZE, height: FLOAT_SIZE, borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.14)',
            background: 'rgba(15,23,42,0.92)', color: '#e2e8f0',
            cursor: 'grab', zIndex: HIGH_Z,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
            fontSize: 18, fontWeight: 800,
          }}
          title="DevInspector"
        >
          I
          <span style={{
            position: 'absolute', right: 6, top: 6, width: 8, height: 8,
            borderRadius: 99, background: active ? '#10b981' : '#64748b',
          }} />
        </button>
      ) : (
        <div
          data-dev-inspector="true"
          onMouseDown={(e) => startDrag(e, false)}
          style={{
            position: 'fixed', left: panelPos.x, top: panelPos.y,
            width: PANEL_W, zIndex: HIGH_Z,
            background: 'rgba(10,12,20,0.96)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14,
            boxShadow: '0 16px 48px rgba(0,0,0,0.6)', overflow: 'hidden',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div
            data-drag="true"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 12px', background: 'rgba(255,255,255,0.04)',
              borderBottom: '1px solid rgba(255,255,255,0.07)', cursor: 'grab',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, pointerEvents: 'none' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', letterSpacing: 0.3 }}>
                DevInspector
              </span>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4,
                background: '#3b82f620', color: '#60a5fa', border: '1px solid #3b82f640',
              }}>
                Alt+I
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: active ? '#10b981' : '#64748b', fontWeight: 700 }}>
                {active ? 'ON' : 'OFF'}
              </span>
              <button
                onClick={() => setMinimized(true)}
                style={{ width: 22, height: 22, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                title="Minimize"
              >
                _
              </button>
            </div>
          </div>

          <div style={{ padding: '10px 12px', display: 'flex', gap: 5, flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <button style={btnStyle(active && mode === 'inspect')} onClick={() => { setMode('inspect'); setActive(true); }}>
              Inspect
            </button>
            <button style={btnStyle(active && mode === 'measure')} onClick={() => { setMode('measure'); setActive(true); }}>
              Measure
            </button>
            <button style={{ ...btnStyle(false), background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }} onClick={startScreenshot}>
              Screenshot
            </button>
            <button style={{ ...btnStyle(active), marginLeft: 'auto' }} onClick={() => setActive(v => !v)}>
              {active ? 'Deactivate' : 'Activate'}
            </button>
          </div>

          <div style={{ padding: '8px 12px', fontSize: 10, color: '#64748b', lineHeight: 1.5 }}>
            {captureSelecting
              ? 'Selecione uma area com o mouse para recortar a captura.'
              : mode === 'inspect'
              ? 'Clique em um elemento para copiar descricao para o chat.'
              : 'Passe o mouse sobre elementos para medir dimensoes.'}
          </div>

          {lastMsg && (
            <div style={{ margin: '0 10px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ padding: '5px 10px', background: 'rgba(16,185,129,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: '#10b981', fontWeight: 700 }}>Last copied</span>
                <button
                  onClick={() => { copyText(lastMsg); showToast('Texto copiado novamente'); }}
                  style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, border: 'none', background: '#10b98122', color: '#10b981', cursor: 'pointer', fontWeight: 700 }}
                >
                  Copy
                </button>
              </div>
              <pre style={{
                margin: 0, padding: '8px 10px',
                fontSize: 9, color: '#94a3b8', lineHeight: 1.6,
                whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                maxHeight: 120, overflowY: 'auto',
                fontFamily: 'monospace',
              }}>
                {lastMsg}
              </pre>
            </div>
          )}

          <div style={{ padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: 9, color: '#334155' }}>DealSifter DevTools</span>
            <span style={{ fontSize: 9, color: '#334155' }}>
              {window.innerWidth}x{window.innerHeight}px
            </span>
          </div>
        </div>
      )}
    </>
  );
}
