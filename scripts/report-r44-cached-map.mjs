import {readFile} from 'node:fs/promises';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import { comparableMapMarkers } from '../.tmp-codex/report-r44/runtime.mjs';
// No transport. Crop the stored real OSM raster to the production map viewport.
export async function cachedR44Map(points,viewportFor) {
  const root=new URL('../qa/report-template/',import.meta.url);
  const frame=JSON.parse(await readFile(new URL('sample-location-basemap.json',root),'utf8'));
  const base=await loadImage(await readFile(new URL('sample-location-basemap.png',root)));
  const view=viewportFor(points,900,330,65),scale=2**(view.zoom-frame.zoom);
  const sx=view.left/scale-frame.left,sy=view.top/scale-frame.top,sw=900/scale,sh=330/scale;
  if(sx<0||sy<0||sx+sw>frame.width||sy+sh>frame.height)throw Error('R42_CACHED_BASE_EXTENT_INSUFFICIENT');
  const canvas=createCanvas(900,330),ctx=canvas.getContext('2d');ctx.drawImage(base,sx,sy,sw,sh,0,0,900,330);
  for(const p of comparableMapMarkers(view)){const x=p.x,y=p.y;ctx.strokeStyle='#15384f';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.anchorX,p.anchorY);ctx.lineTo(x,y);ctx.stroke();ctx.fillStyle=p.item.marker==='S'?'#15384f':p.item.markerTone==='for-sale'?'#dc3545':p.item.markerTone==='sold'?'#e6a416':p.item.markerTone==='complementary'?'#8b5cf6':'#0d876f';ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,p.item.marker==='S'?18:15,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 16px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(p.item.marker,x,y);}
  ctx.fillStyle='rgba(255,255,255,.92)';ctx.fillRect(0,306,900,24);ctx.fillStyle='#15384f';ctx.font='12px sans-serif';ctx.textAlign='left';ctx.fillText('Fictional report markers / \u00a9 OpenStreetMap contributors',8,318);
  return canvas.toDataURL('image/png');
}
