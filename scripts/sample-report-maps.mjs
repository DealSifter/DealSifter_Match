import { readFile } from 'node:fs/promises';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { drawReportMapPin } from '../src/features/maxxis/export/reportMapPin.js';

/** Offline real OSM basemap with explicitly fictional report demonstration markers. */
export async function sampleReportMap(points, geometry) {
  const root = new URL('../qa/report-template/', import.meta.url);
  const frame = JSON.parse(await readFile(new URL('sample-location-basemap.json', root), 'utf8'));
  const basemap = await loadImage(await readFile(new URL('sample-location-basemap.png', root)));
  const view = geometry.comparableMapViewport(points, 900, 330, 65), ratio = 2 ** (view.zoom-frame.zoom);
  const canvas = createCanvas(900, 330), context = canvas.getContext('2d');
  context.drawImage(basemap,view.left/ratio-frame.left,view.top/ratio-frame.top,900/ratio,330/ratio,0,0,900,330);
  for (const {x,y,anchorX,anchorY,item:point} of geometry.comparableMapMarkers(view)) {
    context.strokeStyle='#15384f';context.lineWidth=2;context.beginPath();context.moveTo(anchorX,anchorY);context.lineTo(x,y);context.stroke();
    const color = point.marker === 'S' ? '#15384f' : point.markerTone === 'for-sale' ? '#dc3545' : point.markerTone === 'sold' ? '#e6a416' : point.markerTone === 'complementary' ? '#8b5cf6' : '#0d876f';
    drawReportMapPin(context, { x, y, marker: point.marker, color });
  }
  context.fillStyle = 'rgba(255,255,255,.92)'; context.fillRect(0, 330 - 24, 900, 24);
  context.fillStyle = '#15384f'; context.font = '12px sans-serif'; context.textAlign = 'left'; context.textBaseline = 'middle';
  context.fillText('DEMONSTRATION MARKERS · © OpenStreetMap contributors', 8, 330 - 12);
  return canvas.toDataURL('image/png');
}
