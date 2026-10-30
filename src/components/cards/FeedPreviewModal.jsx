import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { CardPreviewPanels } from './MyCardsPreviewModal';
import { useT } from '../../i18n/translations';

export function FeedPreviewModal({ groups, profileCards, defaultScope = 'personal', onClose, onPublish, publishing = false, copy = {} }) {
  const dashboardCopy = useT('dashboard').dashboard;
  const [index, setIndex] = useState(0);
  const available = groups.length ? groups : [{ profileScope:defaultScope, properties:[], services:[] }];
  const current = Math.min(index, available.length - 1);
  const group = available[current];
  const scope = group.profileScope;
  const profileCard = { ...profileCards[scope], primaryProfile:scope };
  const data = {
    scopeKey:scope,
    scopeLabel:profileCard.badge || profileCard.type || scope,
    profileCard,
    properties:group.properties,
    services:group.services,
    showcaseItems:[...group.properties.map(item => ({...item,_itemType:'property'})), ...group.services.map(item => ({...item,_itemType:'service'}))],
  };
  const panelCopy = { ...dashboardCopy, ...copy,
    myCardsFeedHeading:scope === 'fsbo' ? copy.previewBasicCardTitle : copy.previewPersonalCardTitle,
    myCardsShowcaseHeading:copy.previewShowcaseCardTitle,
  };
  const profileControls = available.length > 1 ? <div className="mycards-preview-controls">
        <button type="button" aria-label={copy.previewPreviousProfile || 'Previous profile'} disabled={current === 0} onClick={() => setIndex(current - 1)}><Icon name="back" size={18} /></button>
        <span aria-live="polite">{current + 1} / {available.length}</span>
        <button type="button" aria-label={copy.previewNextProfile || 'Next profile'} disabled={current === available.length - 1} onClick={() => setIndex(current + 1)}><Icon name="arrowRight" size={18} /></button>
      </div> : null;
  return <Modal onClose={onClose} maxWidth={1480} scrollable={false} contentClassName="ds-preview-dialog ds-feed-preview-dialog" ariaLabel={copy.previewTitle} overlayStyle={{zIndex:20000}}>
    <header className="preview-dialog-header feed-preview-header">
      <h3>{copy.previewTitle}</h3>
      <p>{copy.previewSubtitle}</p>
    </header>
    {profileControls ? <div className="feed-preview-mobile-controls"><span>{data.scopeLabel}</span>{profileControls}</div> : null}
    <CardPreviewPanels data={data} copy={panelCopy} profileControls={profileControls} />
    <footer className="feed-preview-actions">
      <button type="button" onClick={onClose}>{copy.previewBackToEdit}</button>
      <button type="button" disabled={publishing} data-guide="onboarding-publish" onClick={onPublish}>{copy.previewConfirmPublish}</button>
    </footer>
  </Modal>;
}
