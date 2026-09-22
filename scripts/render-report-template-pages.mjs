import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';

// PDF.js uses DOM geometry primitives in its Node renderer.
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
const root = fileURLToPath(new URL('../', import.meta.url));
const output = `${root}qa/report-template/`;
const previews = `${root}src/assets/maxxis/report-previews/`;
const products = [
  ['property-release', 1],
  ['maxxis-analysis', 3],
  ['deal-intelligence', 6],
];
for (const [product, expectedPages] of products) {
  const bytes = new Uint8Array(await readFile(`${output}${product}.pdf`));
  const pdf = await getDocument({ data: bytes, useSystemFonts: true }).promise;
  if (pdf.numPages !== expectedPages) throw new Error(`${product}: expected ${expectedPages}, received ${pdf.numPages}`);
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport, canvas }).promise;
    const png = await canvas.encode('png');
    const name = `${product}-page-${pageNumber}.png`;
    await Promise.all([writeFile(`${output}${name}`, png), writeFile(`${previews}${name}`, png)]);
    process.stdout.write(`${name}: ${canvas.width}x${canvas.height}\n`);
  }
  pdf.cleanup();
}
