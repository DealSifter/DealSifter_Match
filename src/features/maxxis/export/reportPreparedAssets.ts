/** Authorized media preparation is separate from projection/drawing. No evidence provider is called. */
type MediaSchema = { sections?: { propertySummary?: { available?: boolean; data?: { images?: unknown } } } };
const resolved = new WeakMap<object, readonly string[]>();
const pending = new WeakMap<object, Promise<readonly string[]>>();
const revisions = new WeakMap<object, number>();
const imageCache = new Map<string, Promise<string | null>>();
let revision = 0;
const rasterData = (value: string) => /^data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=\r\n]+$/i.test(value) && value.length <= 16_000_000;
const mediaSources = (schema: MediaSchema): string[] => {
  const property = schema?.sections?.propertySummary;
  const images = property?.available ? property.data?.images : null;
  return [...new Set((Array.isArray(images) ? images : []).filter((value): value is string => typeof value === 'string' && value.trim() !== ''))].slice(0, 5);
};

function publicHttpsImage(source: string): boolean {
  try {
    const url = new URL(source);
    if (url.protocol !== 'https:' || url.username || url.password || url.port && url.port !== '443') return false;
    const host = url.hostname.toLowerCase();
    return host.includes('.') && !/^(?:localhost|0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|\[)/.test(host)
      && !/\.(?:localhost|local|internal|test|invalid)$/.test(host);
  } catch { return false; }
}

function prepareImage(source: string): Promise<string | null> {
  if (rasterData(source)) return Promise.resolve(source);
  if (!publicHttpsImage(source) || typeof Image === 'undefined' || typeof document === 'undefined') return Promise.resolve(null);
  const cached = imageCache.get(source);
  if (cached) return cached;
  const result = new Promise<string | null>(resolve => {
    let image: HTMLImageElement;
    try { image = new Image(); } catch { resolve(null); return; }
    image.crossOrigin = 'anonymous';
    let complete = false;
    const finish = (value: string | null) => {
      if (complete) return;
      complete = true;
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      if (!value) { try { image.src = ''; } catch { /* The preparation transport may already be closed. */ } }
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), 2500);
    image.onload = () => {
      try {
        if (!image.naturalWidth || !image.naturalHeight) return finish(null);
        const ratio = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
        const context = canvas.getContext('2d');
        if (!context) return finish(null);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL('image/jpeg', .85));
      } catch { finish(null); }
    };
    image.onerror = () => finish(null);
    try { image.src = source; } catch { finish(null); }
  });
  imageCache.set(source, result);
  if (imageCache.size > 100) imageCache.delete(imageCache.keys().next().value!);
  return result;
}

/** Call only in the explicit preview/export preparation workflow, never from the renderer. */
export function prepareReportAssets(schema: MediaSchema): Promise<readonly string[]> {
  if (!schema || typeof schema !== 'object') return Promise.resolve([]);
  if (resolved.has(schema)) return Promise.resolve(resolved.get(schema)!);
  const inFlight = pending.get(schema);
  if (inFlight) return inFlight;
  const promise = Promise.all(mediaSources(schema).map(prepareImage)).then(images => {
    const photos = Object.freeze(images.filter((image): image is string => image !== null));
    resolved.set(schema, photos);
    revisions.set(schema, ++revision);
    pending.delete(schema);
    return photos;
  });
  pending.set(schema, promise);
  return promise;
}

/** Pure cache read; safe projection/render cannot start media requests. */
export function getPreparedReportPhotos(schema: MediaSchema): string[] {
  if (!schema || typeof schema !== 'object') return [];
  return [...(resolved.get(schema) || mediaSources(schema).filter(rasterData))];
}
export function preparedReportAssetsCacheKey(schema: MediaSchema): string {
  return schema && typeof schema === 'object' ? `${revisions.get(schema) || 0}` : '0';
}
