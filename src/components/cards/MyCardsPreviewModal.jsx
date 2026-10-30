import React, { useRef, useState } from 'react';
import { Modal } from '../ui/Modal';
import { FittedPreviewCard } from '../ui/FittedPreviewCard';
import { Icon } from '../ui/Icon';
import { SmartImage } from '../ui/SmartImage';
import { SwipeCard } from './SwipeCard';
import { PropertyCard } from './PropertyCard';
import { LocalizedNarrative } from '../ui/LocalizedNarrative';

function ServicePreview({ item, copy }) {
  const images = (item.media?.images || []).filter(Boolean);
  const [index, setIndex] = useState(0);
  const current = Math.min(index, Math.max(0, images.length - 1));
  const touchStart = useRef(null);
  const move = (amount) => setIndex((previous) => (previous + amount + images.length) % images.length);
  return (
    <article className="mycards-preview-service">
      <div>
        <h4>{item.title || 'Service'}</h4>
        {item.description ? <div className="mycards-preview-service-description"><LocalizedNarrative text={item.description} protectedNames={[item.title].filter(Boolean)} /></div> : null}
        {item.category ? <span className="mycards-preview-service-category">{item.category}</span> : null}
      </div>
      <div className="preview-service-media" aria-roledescription="carousel"
        onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }}
        onTouchEnd={(event) => {
          if (touchStart.current == null || images.length < 2) return;
          const distance = event.changedTouches[0].clientX - touchStart.current;
          if (Math.abs(distance) > 40) move(distance < 0 ? 1 : -1);
          touchStart.current = null;
        }}>
        {images.length ? <SmartImage src={images[current]} alt={`${item.title || 'Service'} · ${current + 1}`} /> : <div className="preview-service-empty">{copy.noImages || 'No images'}</div>}
        {images.length > 1 ? <>
          <button type="button" aria-label={copy.previousImage || 'Previous image'} onClick={() => move(-1)}><Icon name="back" size={18} /></button>
          <button type="button" aria-label={copy.nextImage || 'Next image'} onClick={() => move(1)}><Icon name="arrowRight" size={18} /></button>
          <span className="preview-service-image-count" aria-live="polite">{current + 1} / {images.length}</span>
        </> : null}
      </div>
    </article>
  );
}

function ShowcasePreviewPanel({ data, copy }) {
  const [index, setIndex] = useState(0);
  const items = data.showcaseItems || [];
  const current = Math.min(index, Math.max(0, items.length - 1));
  const item = items[current];
  return <>
          <div className="mycards-preview-panel-heading">
            <span>{copy.myCardsShowcaseHeading || 'Enabled Showcase Cards'}</span>
            {items.length > 1 ? <div className="mycards-preview-controls">
              <button type="button" disabled={current === 0} onClick={() => setIndex(current - 1)} aria-label={copy.previous || 'Previous'}><Icon name="back" size={20} /></button>
              <span aria-live="polite">{current + 1} / {items.length}</span>
              <button type="button" disabled={current === items.length - 1} onClick={() => setIndex(current + 1)} aria-label={copy.next || 'Next'}><Icon name="arrowRight" size={20} /></button>
            </div> : null}
          </div>
          <div className="mycards-preview-body">
            {!item ? <div className="preview-service-empty">{copy.myCardsEmpty || 'No published property or service in this profile yet.'}</div>
              : item._itemType === 'property' ? <FittedPreviewCard><PropertyCard key={item.id || current} property={item} owner={data.profileCard} previewOnly showActions={false} /></FittedPreviewCard>
                : <FittedPreviewCard><ServicePreview key={item.id || current} item={item} copy={copy} /></FittedPreviewCard>}
          </div>
  </>;
}

export function CardPreviewPanels({ data, copy = {}, profileControls = null }) {
  const [panel, setPanel] = useState('profile');
  return <>
      <div className="mycards-preview-tabs" role="tablist" aria-label="My Cards">
        <button type="button" role="tab" aria-selected={panel === 'profile'} onClick={() => setPanel('profile')}>{copy.myCardsProfileTab || 'Profile'}</button>
        <button type="button" role="tab" aria-selected={panel === 'showcase'} onClick={() => setPanel('showcase')}>{copy.myCardsShowcaseTab || 'Showcase'}</button>
      </div>
      <div className="mycards-preview-panels">
        <section className="mycards-preview-panel" data-active={panel === 'profile'} aria-label="Feed Card" data-testid="preview-profile-panel" data-profile-scope={data.scopeKey}>
          <div className="mycards-preview-panel-heading"><span>{copy.myCardsFeedHeading || 'Feed Card (Connections)'}</span>{profileControls ? <div className="feed-preview-desktop-controls">{profileControls}</div> : null}</div>
          <div className="mycards-preview-body"><FittedPreviewCard mobileHeight={520}><SwipeCard key={data.scopeKey || data.profileCard.id} card={data.profileCard} previewOnly isUnlocked showActions={false} /></FittedPreviewCard></div>
        </section>
        <section className="mycards-preview-panel" data-active={panel === 'showcase'} aria-label="Showcase Cards">
          <ShowcasePreviewPanel key={data.scopeKey || data.scopeLabel} data={data} copy={copy} />
        </section>
      </div>
  </>;
}

export function MyCardsPreviewModal({ data, onClose, copy = {} }) {
  return <Modal onClose={onClose} maxWidth={1480} scrollable={false} contentClassName="ds-preview-dialog ds-my-cards-dialog" ariaLabel={`My Card · ${data.scopeLabel}`}>
      <div className="preview-dialog-header mycards-preview-header">
        <div><h3>My Card · {data.scopeLabel}</h3><p>{copy.myCardsPreviewDescription || 'Active/published cards currently visible in feed and showcase.'}</p></div>
        <span className="mycards-preview-count">{data.services.length} services · {data.properties.length} properties</span>
      </div>
      <CardPreviewPanels data={data} copy={copy} />
    </Modal>;
}
