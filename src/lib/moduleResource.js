import { isModuleLoadError, isStylesheetLoadError } from './moduleLoadError';

// Single-flight import cache. Only transport failures receive bounded retries;
// evaluation/render errors are never mislabeled as an obsolete deployment.
export function createModuleResource(importer, { wait = ms => new Promise(resolve => setTimeout(resolve, ms)), online = () => typeof navigator === 'undefined' || navigator.onLine !== false, report = () => {}, timeoutMs = 30_000 } = {}) {
  let loaded; let pending; let inFlightImport; let generation = 0;
  const importWithDeadline = () => {
    // Dynamic imports cannot be aborted. Reuse the physical request even after
    // an explicit retry, instead of starting competing downloads of the chunk.
    if (!inFlightImport) {
      let request;
      try { request = Promise.resolve(importer()); } catch (error) { request = Promise.reject(error); }
      inFlightImport = request.finally(() => { inFlightImport = null; });
    }
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error('MODULE_LOAD_TIMEOUT');
        error.code = 'MODULE_LOAD_TIMEOUT';
        reject(error);
      }, timeoutMs);
    });
    return Promise.race([inFlightImport, deadline]).finally(() => clearTimeout(timer));
  };
  const load = () => {
    if (loaded) return Promise.resolve(loaded);
    if (pending) return pending;
    const current = generation;
    pending = (async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          const module = await importWithDeadline();
          if (!module?.default) throw new Error('MODULE_DEFAULT_EXPORT_MISSING');
          if (current === generation) loaded = module;
          return module;
        } catch (error) {
          // Vite retains failed stylesheet-preload entries. Retrying only its
          // JS importer can resolve into unstyled UI: require explicit reload.
          if (current !== generation || error?.code === 'MODULE_LOAD_TIMEOUT' || !isModuleLoadError(error) || isStylesheetLoadError(error) || !online() || attempt >= 2) {
            if (current === generation) report(error, { attempts: attempt + 1, transport: isModuleLoadError(error) });
            throw error;
          }
          await wait(attempt === 0 ? 250 : 750);
        }
      }
    })().finally(() => { if (current === generation) pending = null; });
    return pending;
  };
  return { load, preload: () => load().catch(() => undefined), reset: () => { generation++; loaded = null; pending = null; } };
}

export function canPrefetchModule(connection = typeof navigator === 'undefined' ? null : navigator.connection) {
  return !connection?.saveData && !['slow-2g', '2g'].includes(connection?.effectiveType);
}
