import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const root = fileURLToPath(new URL('../', import.meta.url));
const references = `${root}docs/report-design-reference/`;
const actualRoot = `${root}qa/report-template/`;
const outputRoot = `${root}qa/report-visual-diffs/`;
const pages = [
  ['property-release-page-1.png', 'basic/page-1'],
  ['maxxis-analysis-page-1.png', 'pro/page-1'],
  ['maxxis-analysis-page-2.png', 'pro/page-2'],
  ['maxxis-analysis-page-3.png', 'pro/page-3'],
  ['deal-intelligence-page-1.png', 'enterprise/page-1'],
  ['deal-intelligence-page-2.png', 'enterprise/page-2'],
  ['deal-intelligence-page-3.png', 'enterprise/page-3'],
  ['deal-intelligence-page-4.png', 'enterprise/page-4'],
  ['deal-intelligence-page-5.png', 'enterprise/page-5'],
  ['deal-intelligence-page-6.png', 'enterprise/page-6'],
];

const threshold = 0.82;
const results = [];
for (const [file, destination] of pages) {
  const expectedSource = `${references}${file}`;
  const actualSource = `${actualRoot}${file}`;
  const [expectedImage, actualImage] = await Promise.all([loadImage(expectedSource), loadImage(actualSource)]);
  const width = actualImage.width;
  const height = actualImage.height;
  const expectedCanvas = createCanvas(width, height);
  const expectedContext = expectedCanvas.getContext('2d');
  expectedContext.fillStyle = '#fff';
  expectedContext.fillRect(0, 0, width, height);
  expectedContext.drawImage(expectedImage, 0, 0, width, height);
  const actualCanvas = createCanvas(width, height);
  const actualContext = actualCanvas.getContext('2d');
  actualContext.drawImage(actualImage, 0, 0, width, height);
  const expectedPixels = expectedContext.getImageData(0, 0, width, height);
  const actualPixels = actualContext.getImageData(0, 0, width, height);
  const diffCanvas = createCanvas(width, height);
  const diffContext = diffCanvas.getContext('2d');
  const diffPixels = diffContext.createImageData(width, height);
  let totalDifference = 0;
  let materialPixels = 0;
  for (let index = 0; index < expectedPixels.data.length; index += 4) {
    const dr = Math.abs(expectedPixels.data[index] - actualPixels.data[index]);
    const dg = Math.abs(expectedPixels.data[index + 1] - actualPixels.data[index + 1]);
    const db = Math.abs(expectedPixels.data[index + 2] - actualPixels.data[index + 2]);
    const delta = (dr + dg + db) / 3;
    totalDifference += delta;
    if (delta >= 24) materialPixels += 1;
    diffPixels.data[index] = Math.min(255, delta * 3);
    diffPixels.data[index + 1] = delta < 24 ? actualPixels.data[index + 1] * 0.18 : 20;
    diffPixels.data[index + 2] = delta < 24 ? actualPixels.data[index + 2] * 0.18 : 20;
    diffPixels.data[index + 3] = 255;
  }
  diffContext.putImageData(diffPixels, 0, 0);
  const pixelCount = width * height;
  const similarity = 1 - (totalDifference / pixelCount / 255);
  const materialDifferenceRatio = materialPixels / pixelCount;
  const target = `${outputRoot}${destination}/`;
  await mkdir(target, { recursive: true });
  await Promise.all([
    writeFile(`${target}expected.png`, await expectedCanvas.encode('png')),
    cp(actualSource, `${target}actual.png`),
    writeFile(`${target}diff.png`, await diffCanvas.encode('png')),
    writeFile(`${target}metrics.json`, `${JSON.stringify({ file, similarity, materialDifferenceRatio, threshold, pass: similarity >= threshold }, null, 2)}\n`),
  ]);
  results.push({ file, similarity, materialDifferenceRatio, pass: similarity >= threshold });
  process.stdout.write(`${file}: similarity=${(similarity * 100).toFixed(2)}% material-diff=${(materialDifferenceRatio * 100).toFixed(2)}% ${similarity >= threshold ? 'PASS' : 'FAIL'}\n`);
}
await writeFile(`${outputRoot}summary.json`, `${JSON.stringify({ threshold, pages: results, pass: results.every((entry) => entry.pass) }, null, 2)}\n`);
if (!results.every((entry) => entry.pass)) process.exitCode = 1;
