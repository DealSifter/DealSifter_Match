import React from 'react';
import { PortfolioContactPanel } from './PortfolioContactPanel';

export function MatchPortfolioPanel({
  activeOwner = null,
  ownerContact = null,
  isUnlocked = false,
  variant = 'desktop',
  onUnlockRequest,
  onChatClick,
  children,
}) {
  return (
    <>
      <PortfolioContactPanel
        canonicalContact={ownerContact}
        isUnlocked={isUnlocked}
        variant={variant}
        onUnlockRequest={onUnlockRequest}
        onChatClick={onChatClick}
      />
      {typeof children === 'function' ? children(activeOwner) : children}
    </>
  );
}

export default MatchPortfolioPanel;
