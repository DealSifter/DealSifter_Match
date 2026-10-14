export function isModuleLoadError(error) {
  return /chunkloaderror|loading chunk|failed to fetch dynamically imported module|importing a module script failed|unable to preload css|error loading dynamically imported module/i.test(String(error?.message || error || ''));
}

export function isStylesheetLoadError(error) {
  return /unable to preload css|loading css chunk/i.test(String(error?.message || error || ''));
}
