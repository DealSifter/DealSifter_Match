import { compressImageDataUrl } from './localforageHelper';

// Helper: compress all images in a file input event, return array of compressed data URLs.
export async function readAndCompressFiles(files, maxDim = 1024, quality = 0.78) {
  const promises = files.map((file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    }).then((dataUrl) => compressImageDataUrl(dataUrl, maxDim, quality))
  );
  const results = await Promise.allSettled(promises);
  return results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
}
