import { buildLandReportView } from './maxxisLandReportView';
import { comparableMapViewport } from './comparableMapGeometry';

// UI-only preparation, outside the PDF renderer. The geometry is shared by ARV and rentals.
const array = value => Array.isArray(value) ? value : [];
const section = (schema,key) => schema?.sections?.[key]?.available ? schema.sections[key].data : null;
const MAP_TILE_SIZE = 256;
async function loadMapTile(url) {
  if (typeof Image === 'undefined') return null;
  const image = new Image();
  image.crossOrigin = 'anonymous';
  let timer;
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('MAP_TILE_LOAD_FAILED'));
      timer = setTimeout(() => reject(new Error('MAP_TILE_TIMEOUT')), 3500);
      image.src = url;
    });
    return image;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveComparableMap(schema,options={}) {
  const property = section(schema, 'propertySummary') || {};
  const comparables = section(schema, 'comparableEvidence') || {};
  const landView = buildLandReportView(schema);
  if (!options.points&&landView && !landView.mapsEligible.length) return null;
  const all = options.points??[
    { ...property, marker: 'S', markerTone: '#15384f' },
    ...array(landView ? landView.mapsEligible : comparables.used).map((item, index) => ({ ...item, marker: String(index + 1), markerTone: '#0d876f' })),
    ...array(landView ? [] : comparables.supporting).map((item, index) => ({ ...item, marker: String(array(comparables.used).length + index + 1), markerTone: '#e6a416' })),
    ...array(landView ? [] : comparables.excluded).map((item, index) => ({ ...item, marker: String(array(comparables.used).length + array(comparables.supporting).length + index + 1), markerTone: '#7b8995' })),
  ].filter((item) => item.latitude != null && item.longitude != null
    && Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)));
  if (all.length < 2 || typeof document === 'undefined') return null;
  try {
    const width = 900; const height = 330; const padding = 65;
    const {zoom,world,left,top}=comparableMapViewport(all,width,height,padding);
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d'); if (!context) return null;
    context.fillStyle = '#eef4f6'; context.fillRect(0, 0, width, height);
    const firstTileX = Math.floor(left / MAP_TILE_SIZE); const lastTileX = Math.floor((left + width) / MAP_TILE_SIZE);
    const firstTileY = Math.floor(top / MAP_TILE_SIZE); const lastTileY = Math.floor((top + height) / MAP_TILE_SIZE);
    const tileCount = 2 ** zoom; const tiles = [];
    for (let tileX = firstTileX; tileX <= lastTileX; tileX += 1) {
      for (let tileY = firstTileY; tileY <= lastTileY; tileY += 1) {
        if (tileY < 0 || tileY >= tileCount) continue;
        const sourceX = ((tileX % tileCount) + tileCount) % tileCount;
        tiles.push(loadMapTile(`https://tile.openstreetmap.org/${zoom}/${sourceX}/${tileY}.png`)
          .then((image) => ({ image, x: tileX * MAP_TILE_SIZE - left, y: tileY * MAP_TILE_SIZE - top })));
      }
    }
    const loaded = await Promise.all(tiles); if (!loaded.some((tile) => tile.image)) return null;
    loaded.forEach((tile) => { if (tile.image) context.drawImage(tile.image, tile.x, tile.y, MAP_TILE_SIZE, MAP_TILE_SIZE); });
    world.forEach(({ x, y, item }) => {
      const px = x - left; const py = y - top;
      context.save(); context.shadowColor = 'rgba(15,32,49,.35)'; context.shadowBlur = 6; context.shadowOffsetY = 2;
      context.fillStyle = item.markerTone; context.strokeStyle = '#fff'; context.lineWidth = 4;
      context.beginPath(); context.arc(px, py, item.marker === 'S' ? 18 : 15, 0, Math.PI * 2); context.fill(); context.stroke();
      context.restore(); context.fillStyle = '#fff'; context.font = '700 16px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
      context.fillText(item.marker, px, py + 1);
    });
    return canvas.toDataURL('image/png');
  } catch { return null; }
}


