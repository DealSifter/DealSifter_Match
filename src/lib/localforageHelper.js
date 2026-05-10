import localforage from 'localforage';

localforage.config({
  name: 'dealsifter',
  storeName: 'temp_uploads'
});

// ── Separate store for full portfolio data (images included) ──────────────
const portfolioStore = localforage.createInstance({
  name: 'dealsifter',
  storeName: 'portfolio_full',
});

export async function getPortfolioFull(key) {
  try { return await portfolioStore.getItem(key) ?? null; } catch { return null; }
}

export async function setPortfolioFull(key, value) {
  try { await portfolioStore.setItem(key, value); return true; } catch { return false; }
}

export async function getTempUploads() {
  try {
    const v = await localforage.getItem('tempUploads');
    return v || {};
  } catch (e) {
    void e;
    return {};
  }
}

export async function setTempUploadsPartial(partial) {
  try {
    const cur = (await localforage.getItem('tempUploads')) || {};
    const next = { ...cur, ...partial };
    await localforage.setItem('tempUploads', next);
    return next;
  } catch (e) {
    void e;
    return null;
  }
}

// ── Image compression utility ─────────────────────────────────────────────
// Compresses a data URL to max maxDim×maxDim at JPEG quality `quality`.
// Returns a Promise<string> of the compressed data URL.
export function compressImageDataUrl(dataUrl, maxDim = 1024, quality = 0.75) {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:image')) {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl); // fallback: keep original
    img.src = dataUrl;
  });
}

// ── Supabase Storage upload ───────────────────────────────────────────────
// Converts a base64 data URL to a Blob and uploads it to Supabase Storage.
// Returns the public URL on success, or re-throws on failure.
// If `dataUrl` is already an https:// URL, returns it unchanged (idempotent).
function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export async function uploadDataUrlToStorage(dataUrl, bucket, path, supabaseClient) {
  if (!dataUrl) return null;
  if (!dataUrl.startsWith('data:image')) return dataUrl; // already a URL, pass through
  const blob = dataUrlToBlob(dataUrl);
  const { error } = await supabaseClient.storage
    .from(bucket)
    .upload(path, blob, { upsert: true, contentType: blob.type });
  if (error) throw error;
  const { data } = supabaseClient.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// ── Clear all user-specific IndexedDB data (call on logout) ─────────────
export async function clearAllUserData() {
  try { await portfolioStore.clear(); } catch { /* no-op */ }
  try { await localforage.removeItem('tempUploads'); } catch { /* no-op */ }
}

export default localforage;
