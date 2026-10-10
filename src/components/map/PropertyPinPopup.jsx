import React, { useState } from 'react';
import { SmartImage } from '../ui/SmartImage';
import { Icon } from '../ui/Icon';
import { BedDouble, Bath, Expand } from 'lucide-react';
import { C } from '../../theme/colors';
import feedMatchIcon from '../../assets/feed-match-icon.png';
import './PropertyPinPopup.css';

const numeric = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;

export function PropertyPinPopup({ property, label, selected = false, own = false, language = 'en', onOpen, onMatch }) {
  const [pending, setPending] = useState(false);
  const t = (pt, en, es) => language.startsWith('pt') ? pt : language.startsWith('es') ? es : en;
  const locale = language.startsWith('pt') ? 'pt-BR' : language.startsWith('es') ? 'es-US' : 'en-US';
  const price = numeric(property.price);
  const reportedArv = numeric(property.arv ?? property.arvValue);
  const score = numeric(property.matchScore ?? property.profileMatchScore);
  const timestamp = property.publishedAt || property.published_at || property.createdAt || property.created_at;
  const days = timestamp && Number.isFinite(Date.parse(timestamp)) ? Math.floor((Date.now() - Date.parse(timestamp)) / 86400000) : null;
  const money = value => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  const metric = value => numeric(value) === null ? '—' : new Intl.NumberFormat(locale).format(Number(value));
  return <article className="ds-property-pin-popup" style={{ '--pin-ink': C.t1, '--pin-muted': C.t2, '--pin-paper': C.card, '--pin-border': C.border }}>
    <button type="button" className="ds-property-pin-photo" onClick={onOpen} aria-label={`${t('Abrir no feed', 'Open in feed', 'Abrir en el feed')}: ${label}`}>
      <SmartImage src={property.images?.[0] || property.image || ''} alt={label}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        fallback={<div className="ds-property-pin-photo-fallback"><Icon name="home" size={48} /></div>} />
      <span className="ds-property-pin-badges"><span>{t('À VENDA', 'FOR SALE', 'EN VENTA')}</span>{score !== null && <span className="ds-property-pin-score">{Math.round(score)}%</span>}</span>
      {days !== null && days >= 0 && <span className="ds-property-pin-age">{t(`Há ${days} dias`, `${days} days ago`, `Hace ${days} días`)}</span>}
    </button>
    <div className="ds-property-pin-details">
      <div className="ds-property-pin-price-row">
        <div><strong>{price === null ? '—' : money(price)}</strong>{reportedArv !== null && reportedArv > 0 && <small>ARV · {money(reportedArv)}</small>}</div>
        <button type="button" className={`ds-property-pin-match${selected ? ' is-selected' : ''}`} aria-pressed={selected}
          disabled={own || pending || !onMatch} title={own ? t('Este imóvel é seu', 'Your own property', 'Tu propiedad') : 'Match'}
          onClick={async event => { event.stopPropagation(); setPending(true); try { await onMatch(property); } finally { setPending(false); } }}>
          <span className="ds-property-pin-check" style={{ maskImage: `url(${feedMatchIcon})`, WebkitMaskImage: `url(${feedMatchIcon})` }} />
          <span>Match</span>
        </button>
      </div>
      <div className="ds-property-pin-address">{label}</div>
      <div className="ds-property-pin-location">{[property.city, property.state, property.zip || property.zipCode].filter(Boolean).join(', ')}</div>
      <div className="ds-property-pin-metrics">
        <span><BedDouble size={17} />{metric(property.beds)} {t('Quartos', 'Beds', 'Habitaciones')}</span>
        <span><Bath size={17} />{metric(property.baths)} {t('Banheiros', 'Baths', 'Baños')}</span>
        <span><Expand size={17} />{metric(property.sqft)} sqft</span>
      </div>
    </div>
  </article>;
}
