import React from 'react';
import loaderMark from '../../assets/logo.png';

// Boot, navigation and blocking actions share the established animated mark.
export function AppLoadingScreen({message='Loading DealSifter...',overlay=false,module=false,label}) {
  return <div className={overlay?'ds-processing-overlay':module?'ds-module-loading-screen':'ds-app-boot-screen'}
    role="status" aria-live="polite" aria-label={label||message} data-testid={module?'module-loading':undefined}>
    <div className="ds-processing-card">
      <img src={loaderMark} alt="DealSifter" className="ds-processing-logo"/>
      <div className="ds-processing-text">{message}</div>
    </div>
  </div>;
}
