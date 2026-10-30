/** Browser-only, CORS-safe media transport for explicit report preparation. */
export const REPORT_IMAGE_TIMEOUT_MS = 12000;
export async function loadReportMediaImage(source: string): Promise<HTMLImageElement | null> {
  if (typeof Image === 'undefined') return null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const image = await new Promise<HTMLImageElement | null>(resolve => {
      const candidate = new Image();
      candidate.crossOrigin = 'anonymous';
      let finished = false;
      const finish = (loaded: boolean) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        candidate.onload = null;
        candidate.onerror = null;
        if (!loaded) candidate.src = '';
        resolve(loaded ? candidate : null);
      };
      const timer = setTimeout(() => finish(false), REPORT_IMAGE_TIMEOUT_MS);
      candidate.onload = () => finish(true);
      candidate.onerror = () => finish(false);
      try { candidate.src = source; } catch { finish(false); }
    });
    if (image) return image;
  }
  return null;
}
