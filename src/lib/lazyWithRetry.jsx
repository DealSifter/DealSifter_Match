import React, { lazy, Suspense, useState } from 'react';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import { ModuleLoadingState } from '../components/ui/ModuleLoadingState';
import { createModuleResource } from './moduleResource';
import { captureAppException } from './observability';

export function lazyWithRetry(importer, key, { overlay = false } = {}) {
  const resource = createModuleResource(importer, { report:(error, info) => captureAppException(error, { area:'module_loading', module:key, ...info }) });
  let currentType = lazy(() => resource.load());
  function RecoverableModule(props) {
    const [{ Imported, revision }, setGeneration] = useState(() => ({ Imported:currentType, revision:0 }));
    const retry = () => {
      resource.reset();
      currentType = lazy(() => resource.load());
      setGeneration(previous => ({ Imported:currentType, revision:previous.revision + 1 }));
    };
    return <ErrorBoundary scope={key} compact overlay={overlay} resetKey={revision} onRetry={retry}>
      <Suspense fallback={<ModuleLoadingState overlay={overlay} />}><Imported {...props} /></Suspense>
    </ErrorBoundary>;
  }
  RecoverableModule.displayName = `Module(${key})`;
  RecoverableModule.preload = resource.preload;
  return RecoverableModule;
}
