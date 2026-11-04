import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Deterministic print-size derivative; never overwrite or redraw the supplied original.
const source = new URL('../src/assets/maxxis/report-official-logo.png', import.meta.url);
const output = new URL('../src/assets/maxxis/report-pdf-logo.png', import.meta.url);
const bytes = await readFile(source);
const image = await loadImage(bytes);
const width = 1200, height = Math.round(image.height * width / image.width);
const canvas = createCanvas(width, height), context = canvas.getContext('2d');
context.imageSmoothingEnabled = true;
context.imageSmoothingQuality = 'high';
context.drawImage(image, 0, 0, width, height);
const png = await canvas.encode('png');
await writeFile(output, png);
console.log(JSON.stringify({ sourceSha256: createHash('sha256').update(bytes).digest('hex'), width, height, bytes: png.length }));
