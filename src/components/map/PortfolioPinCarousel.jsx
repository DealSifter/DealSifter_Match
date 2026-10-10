import React, { useRef, useState } from 'react';
import { SmartImage } from '../ui/SmartImage';
import { Icon } from '../ui/Icon';
import { linkedPortfolioSlides } from './portfolioPinData';
import './PortfolioPinCarousel.css';

export function PortfolioPinCarousel({ owner, language = 'en', onOpen, labelForItem = item => item.title || item.type || '' }) {
  const slides = linkedPortfolioSlides(owner);
  const [index, setIndex] = useState(0);
  const swipeStart = useRef(null);
  const moved = useRef(false);
  const t = (pt, en, es) => language.startsWith('pt') ? pt : language.startsWith('es') ? es : en;
  if (!slides.length) return <div className="ds-pin-portfolio-empty">{t('Portfólio sem imagens', 'Portfolio has no images', 'Portafolio sin imágenes')}</div>;
  const current = Math.min(index, slides.length - 1);
  const slide = slides[current];
  const move = step => setIndex((current + step + slides.length) % slides.length);
  return <section className="ds-pin-portfolio" aria-label={t('Imagens do portfólio vinculado', 'Linked portfolio images', 'Imágenes del portafolio vinculado')}
    onPointerDown={event => { event.stopPropagation(); swipeStart.current = event.clientX; moved.current = false; }}
    onPointerUp={event => { const delta = swipeStart.current === null ? 0 : event.clientX - swipeStart.current;
      if (Math.abs(delta) > 35 && slides.length > 1) { move(delta < 0 ? 1 : -1); moved.current = true; } swipeStart.current = null; }}>
    <button className="ds-pin-portfolio-photo" type="button" onClick={event => {
      if (moved.current && event.detail !== 0) { moved.current = false; return; }
      moved.current = false; onOpen?.(slide.item, slide.kind);
    }}
      aria-label={`${t('Abrir item do portfólio', 'Open portfolio item', 'Abrir elemento del portafolio')}: ${labelForItem(slide.item)}`}>
      <SmartImage src={slide.src} alt={labelForItem(slide.item)} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </button>
    {slides.length > 1 && <>
      <button type="button" className="ds-pin-portfolio-prev" onClick={() => move(-1)} aria-label={t('Imagem anterior', 'Previous image', 'Imagen anterior')}><Icon name="back" size={17} /></button>
      <button type="button" className="ds-pin-portfolio-next" onClick={() => move(1)} aria-label={t('Próxima imagem', 'Next image', 'Imagen siguiente')}><Icon name="back" size={17} /></button>
      <span className="ds-pin-portfolio-count" aria-live="polite">{current + 1}/{slides.length}</span>
    </>}
  </section>;
}
