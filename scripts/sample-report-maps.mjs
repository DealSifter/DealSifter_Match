import { readFile } from 'node:fs/promises';
import { createCanvas, loadImage } from '@napi-rs/canvas';

/** Offline real OSM basemap with explicitly fictional report demonstration markers. */
export async function sampleReportMap(points) {
  const root = new URL('../qa/report-template/', import.meta.url);
  const frame = JSON.parse(await readFile(new URL('sample-location-basemap.json', root), 'utf8'));
  const basemap = await loadImage(await readFile(new URL('sample-location-basemap.png', root)));
  const canvas = createCanvas(frame.width, frame.height), context = canvas.getContext('2d');
  context.drawImage(basemap, 0, 0);
  for (const point of points) {
    const scale = 256 * 2 ** frame.zoom, sin = Math.sin(point.latitude * Math.PI / 180);
    const x = (point.longitude + 180) / 360 * scale - frame.left;
    const y = (.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale - frame.top;
    context.fillStyle = point.marker === 'S' ? '#15384f' : point.markerTone === 'for-sale' ? '#dc3545' : '#0d876f';
    context.strokeStyle = '#ffffff'; context.lineWidth = 3;
    context.beginPath(); context.arc(x, y, point.marker === 'S' ? 16 : 13, 0, 2 * Math.PI); context.fill(); context.stroke();
    context.fillStyle = '#ffffff'; context.font = 'bold 14px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(point.marker, x, y);
  }
  context.fillStyle = 'rgba(255,255,255,.92)'; context.fillRect(0, frame.height - 24, frame.width, 24);
  context.fillStyle = '#15384f'; context.font = '12px sans-serif'; context.textAlign = 'left'; context.textBaseline = 'middle';
  context.fillText('DEMONSTRATION MARKERS · © OpenStreetMap contributors', 8, frame.height - 12);
  return canvas.toDataURL('image/png');
}
