import React from 'react';
import { getT } from '../../i18n/translations';
import { AppLoadingScreen } from './AppLoadingScreen';

export function ModuleLoadingState({ overlay = false }) {
  const copy = getT().errorBoundary;
  return <AppLoadingScreen module overlay={overlay} message={copy.moduleLoading}/>;
}
