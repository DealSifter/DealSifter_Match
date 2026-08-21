import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const assetsDir = resolve(process.cwd(), 'dist', 'assets');
const maxChunkBytes = 500 * 1024;
const chunks = readdirSync(assetsDir)
  .filter((name) => name.endsWith('.js'))
  .map((name) => ({ name, bytes: statSync(resolve(assetsDir, name)).size }))
  .sort((a, b) => b.bytes - a.bytes);
const oversized = chunks.filter(({ bytes }) => bytes > maxChunkBytes);

if (oversized.length) {
  oversized.forEach(({ name, bytes }) => {
    console.error(`[bundle-budget] ${name}=${(bytes / 1024).toFixed(1)}KiB exceeds 500KiB`);
  });
  process.exit(1);
}

const largest = chunks[0];
console.log(`[bundle-budget] chunks=${chunks.length} largest=${largest?.name || 'none'}:${((largest?.bytes || 0) / 1024).toFixed(1)}KiB limit=500KiB`);
console.log('[bundle-budget] production bundle budget passed.');
