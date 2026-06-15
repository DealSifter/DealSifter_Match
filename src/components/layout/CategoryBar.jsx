import React, { useState, useRef, useEffect } from 'react';
import { C } from '../../theme/colors';
import { CATEGORIES } from '../../data/mockData';
import { Icon } from '../ui/Icon';
import { useLang, useT } from '../../i18n/translations';
import { catIcon } from '../../lib/catIcon';

export function CategoryBar({ activeCat, setActiveCat, categoryOrder, setCategoryOrder, editMode = false, setEditMode = () => {}, stickyTop = 58, dropdownZIndex = 300 }) {
  const t = useT('dashboard');
  const lang = useLang('dashboard').toLowerCase();
  const [openDrop, setOpenDrop] = useState(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const ref = useRef(null);
  const listRef = useRef(null);
  const buttonRefs = useRef({});

  // Order categories based on user preference
  const orderedCategories = categoryOrder
    ? categoryOrder.map(id => CATEGORIES.find(c => c.id === id)).filter(Boolean)
    : CATEGORIES;

  // Drag & Drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Semi-transparent ghost image
    e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newOrder = [...categoryOrder];
    const [draggedId] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, draggedId);
    
    setCategoryOrder(newOrder);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const placeDrop = (id) => {
    const btn = buttonRefs.current[id];
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const safeLeft = Math.max(8, Math.min(rect.left, window.innerWidth - 220));
    setDropPos({ top: rect.bottom - 40, left: safeLeft });
  };

  const toggleDrop = (id) => {
    setOpenDrop(prev => {
      const next = prev === id ? null : id;
      if (next) placeDrop(next);
      return next;
    });
  };
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpenDrop(null); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (!openDrop) return;
    const reposition = () => placeDrop(openDrop);
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    const listEl = listRef.current;
    listEl?.addEventListener("scroll", reposition);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      listEl?.removeEventListener("scroll", reposition);
    };
  }, [openDrop]);

  const isActive = cat => activeCat===cat.id || (cat.sub && cat.sub.some(s=>s.id===activeCat));
  const translatedLabel = (id, fallback) => {
    const labelsPt = {
      all: 'Todos', wholesaler: 'Atacadista', investor: 'Investidor Imobiliario', lender: 'Credor', seller: 'Proprietario',
      buyer: 'Comprador a Vista', ff: 'Fix & Flip', ff_gc: 'Empreiteiro Geral', ff_rehab: 'Equipe de Reforma',
      services: 'Servicos', svc_d4d: 'Drive4$', svc_photo: 'Fotografia', svc_drone: 'Imagem por Drone',
      svc_inspection: 'Inspecoes', svc_survey: 'Levantamento', svc_title: 'Empresa de Titulos', svc_accountant: 'Contador',
      svc_notary: 'Notario', svc_va: 'Assistente Virtual', tax: 'Tax Deed / Tax Lien', attorney: 'Advogado Imobiliario',
      auction: 'Leiloes Imobiliarios', auction_consultancy: 'Consultoria Imobiliaria', auction_advisory: 'Assessoria Imobiliaria'
    };
    const labelsEs = {
      all: 'Todos', wholesaler: 'Mayorista', investor: 'Inversor Inmobiliario', lender: 'Prestamista', seller: 'Propietario',
      buyer: 'Comprador en Efectivo', ff: 'Fix & Flip', ff_gc: 'Contratista General', ff_rehab: 'Equipo de Reforma',
      services: 'Servicios', svc_d4d: 'Drive4$', svc_photo: 'Fotografia', svc_drone: 'Imagen por Drone',
      svc_inspection: 'Inspecciones', svc_survey: 'Levantamiento', svc_title: 'Compania de Titulos', svc_accountant: 'Contador',
      svc_notary: 'Notario', svc_va: 'Asistente Virtual', tax: 'Tax Deed / Tax Lien', attorney: 'Abogado Inmobiliario',
      auction: 'Subastas Inmobiliarias', auction_consultancy: 'Consultoria Inmobiliaria', auction_advisory: 'Asesoria Inmobiliaria'
    };
    if (lang.startsWith('pt')) return labelsPt[id] || fallback;
    if (lang.startsWith('es')) return labelsEs[id] || fallback;
    return fallback;
  };
  const activeLabel = cat => {
    const catLabel = translatedLabel(cat.id, cat.label);
    if (!cat.sub) return catLabel;
    const sub = cat.sub.find(s=>s.id===activeCat);
    return sub ? `${catLabel}: ${translatedLabel(sub.id, sub.label)}` : catLabel;
  };

  const neonBox = `0 0 0 1px ${C.alpha(C.accent, 0.5)}, 0 0 14px ${C.alpha(C.accent, 0.34)}, inset 0 0 10px ${C.alpha(C.accent, 0.18)}`;

  return (
    <div ref={ref} style={{ position:"sticky", top:stickyTop, zIndex:50, background:C.card, backdropFilter:"blur(10px)", borderBottom:`1px solid ${C.border}` }}>
      <div ref={listRef} style={{ maxWidth:"100%", margin:"0 auto", padding:"8px max(4%, 14px) 8px 4%", display:"flex", alignItems:"center", overflowX:"auto", gap:4, scrollbarWidth:"none", position:"relative" }}>
        {orderedCategories.map((cat, index) => {
          const active = isActive(cat);
          const isDragging = draggedIndex === index;
          const isDragOver = dragOverIndex === index;
          return (
            <div 
              key={cat.id} 
              draggable={editMode}
              onDragStart={editMode ? (e) => handleDragStart(e, index) : undefined}
              onDragOver={editMode ? (e) => handleDragOver(e, index) : undefined}
              onDragLeave={editMode ? handleDragLeave : undefined}
              onDrop={editMode ? (e) => handleDrop(e, index) : undefined}
              onDragEnd={editMode ? handleDragEnd : undefined}
              style={{ 
                position:"relative", 
                flexShrink:0,
                opacity: isDragging ? 0.4 : 1,
                transform: isDragOver ? 'scale(1.05)' : 'scale(1)',
                transition: isDragging ? 'none' : 'all 0.2s',
                cursor: editMode ? 'grab' : 'default'
              }}
            >
              <button
                ref={(el) => { buttonRefs.current[cat.id] = el; }}
                type="button"
                onClick={() => cat.sub ? toggleDrop(cat.id) : (setActiveCat(cat.id), setOpenDrop(null))}
                onMouseDown={(e) => { if (editMode) e.currentTarget.style.cursor = 'grabbing'; }}
                onMouseUp={(e) => { if (editMode) e.currentTarget.style.cursor = 'grab'; }}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 13px", borderRadius:100, background:"transparent", border:`1px solid ${active?C.accent:C.border}`, color:active?C.accent:C.t1, fontWeight:active?600:400, fontSize:12, cursor:editMode ? "grab" : "pointer", whiteSpace:"nowrap", transition:"all .15s", userSelect:"none", boxShadow: active ? neonBox : 'none', textShadow: active ? `0 0 10px ${C.alpha(C.accent, 0.4)}` : 'none' }}>
                {editMode && <Icon name="move" size={12} color={active?C.accent:C.t1} strokeWidth={1.5} />}
                <Icon name={catIcon(cat.id)} size={13} color={active?C.accent:C.t1} strokeWidth={active?2:1.5} />
                <span>{activeLabel(cat)}</span>
                {cat.sub && (
                  <span
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); toggleDrop(cat.id); }}
                    style={{ display:"inline-flex", alignItems:"center" }}
                    aria-hidden="true"
                  >
                    <Icon name={openDrop===cat.id?"chevUp":"chevDown"} size={11} color={active?C.accent:C.t1} />
                  </span>
                )}
              </button>
            </div>
          );
        })}
        
        <div aria-hidden="true" style={{ flex:"0 0 14px" }} />
        {/* Edit button - fixed at the right edge without covering category chips */}
        <button
          onClick={() => setEditMode(!editMode)}
          style={{
            position: "sticky",
            right: 0,
            marginLeft: 12,
            width: 42, height: 34,
            padding: 0, borderRadius: 6,
            background: C.card,
            border: "none",
              color: C.t1,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all .2s",
            flexShrink: 0,
            zIndex: 3,
            boxShadow: `-14px 0 18px ${C.card}, 0 0 0 1px ${C.alpha(C.border, 0.72)}`
          }}
          onMouseEnter={(e) => {
              e.currentTarget.style.border = `1px solid ${C.t1}`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.border = "none";
          }}
          title={t.categoryBar?.editCategoryOrder || 'Edit category order'}
        >
          <Icon name={editMode ? "check" : "edit"} size={16} color={C.t2} strokeWidth={1.5} />
        </button>
      </div>
      {openDrop && CATEGORIES.find(c => c.id === openDrop)?.sub && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ position:"fixed", top:dropPos.top, left:dropPos.left, background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:6, minWidth:180, boxShadow:"0 8px 32px #00000099", zIndex:dropdownZIndex }}
        >
          {(() => {
            const cat = CATEGORIES.find(c => c.id === openDrop);
            if (!cat) return null;
            return (
              <>
                <div onClick={() => { setActiveCat(cat.id); setOpenDrop(null); }}
                  style={{ display:"flex", alignItems:"center", gap:9, padding:"8px 11px", borderRadius:8, cursor:"pointer", color:activeCat===cat.id?C.accentL:C.t1, background:activeCat===cat.id?C.alpha(C.accent, 0.1):"transparent", fontSize:12, boxShadow: activeCat===cat.id ? neonBox : 'none', textShadow: activeCat===cat.id ? `0 0 10px ${C.alpha(C.accent, 0.4)}` : 'none' }}>
                  <Icon name={catIcon(cat.id)} size={13} color={activeCat===cat.id?C.accentL:C.t1} />
                  {(t.categoryBar?.allPrefix || 'All')} {translatedLabel(cat.id, cat.label)}
                </div>
                <div style={{ height:1, background:C.border, margin:"4px 0" }} />
                {cat.sub.map(s => (
                  <div key={s.id} onClick={() => { setActiveCat(s.id); setOpenDrop(null); }}
                    style={{ display:"flex", alignItems:"center", gap:9, padding:"8px 11px", borderRadius:8, cursor:"pointer", color:activeCat===s.id?C.accentL:C.t1, background:activeCat===s.id?C.alpha(C.accent, 0.1):"transparent", fontSize:12, transition:"background .1s", boxShadow: activeCat===s.id ? neonBox : 'none', textShadow: activeCat===s.id ? `0 0 10px ${C.alpha(C.accent, 0.4)}` : 'none' }}>
                    <Icon name={catIcon(s.id)} size={13} color={activeCat===s.id?C.accentL:C.t1} />
                    {translatedLabel(s.id, s.label)}
                  </div>
                ))}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// `catIcon` moved to `src/lib/catIcon.js` to keep this file exporting only React components
