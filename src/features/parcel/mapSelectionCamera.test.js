import { describe, expect, it, vi } from 'vitest';
import { PIN_SELECTION_ZOOM, MapSelectionCamera, parcelSelectionZoom, selectionCenter, selectionLayout } from './mapSelectionCamera';

describe('single device-aware map selection camera', () => {
  it('uses Z15 for every PIN and Z17 only for phones, Z16 for other devices', () => {
    expect(PIN_SELECTION_ZOOM).toBe(15); expect(parcelSelectionZoom(true)).toBe(17); expect(parcelSelectionZoom(false)).toBe(16);
  });
  it.each([[390,786,0,96,true],[1280,842,360,0,false],[768,966,0,96,false],[844,332,0,0,true]])('keeps popup in usable map space for %s x %s', (width,height,panelLeft,bottomNav,phone) => {
    const frame = selectionLayout({width,height,panelLeft,bottomNav,phone,latitude:35.92});
    expect(frame.pinX-frame.popupWidth/2).toBeGreaterThanOrEqual(panelLeft+12);
    expect(frame.pinX+frame.popupWidth/2).toBeLessThanOrEqual(width-12);
    expect(frame.popupTop).toBeGreaterThanOrEqual(72);
    expect(frame.popupTop+frame.popupHeight).toBeLessThanOrEqual(height-Math.max(104,bottomNav+100));
  });
  it('projects the point to the same screen slot at both zoom levels', () => {
    const map = { getSize: () => ({x:390,y:786}), project: (point,z) => ({x:point.lng*2**z,y:point.lat*2**z}), unproject: ([x,y],z) => ({lng:x/2**z,lat:y/2**z}) };
    const point = {lat:35.92,lng:-78.58}; const layout = selectionLayout({width:390,height:786,phone:true,latitude:point.lat});
    for (const zoom of [15,17]) {
      const center = selectionCenter(map,point,zoom,layout);
      const delta = map.project(center,zoom); const projected = map.project(point,zoom);
      expect(projected.x-delta.x+195).toBeCloseTo(layout.pinX,7);
      expect(projected.y-delta.y+393).toBeCloseTo(layout.pinY,7);
    }
  });
  it('reserves space for the entire lens above the footer on a small phone', () => {
    const layout = selectionLayout({width:360,height:682,bottomNav:88,phone:true,latitude:35.921});
    const radiusPixels=160.9344/(156543.03392*Math.cos(35.921*Math.PI/180)/2**17);
    expect(layout.pinY+radiusPixels).toBeLessThanOrEqual(682-88-12);
    expect(layout.popupHeight).toBeLessThan(340);
  });
  it('cancels previous movements without accumulating popup/camera listeners', () => {
    const marker = { getLatLng: () => ({lat:35,lng:-78}), openPopup: vi.fn() };
    const map = { on:vi.fn(),off:vi.fn(),stop:vi.fn(),flyTo:vi.fn(),getSize:()=>({x:1280,y:842}),getContainer:()=>({style:{setProperty:vi.fn()}}),
      project:()=>({x:200,y:200}),unproject:()=>({lat:35,lng:-78}),once:vi.fn() };
    const camera = new MapSelectionCamera(map,() => marker);
    for (const zoom of [15,16,15]) camera.focus({id:'property',zoom},{phone:false});
    expect(map.stop).toHaveBeenCalledTimes(3); expect(marker.openPopup).toHaveBeenCalledTimes(3);
    expect(map.flyTo.mock.calls.map(call=>call[1])).toEqual([15,16,15]); expect(map.once).not.toHaveBeenCalled();
    camera.dispose();
    expect(map.off).toHaveBeenCalledWith('unload', expect.any(Function));
  });
  it('does not call stop/focus after the parent removes the Leaflet map', () => {
    const map={on:vi.fn(),off:vi.fn(),stop:vi.fn(()=>{throw new Error('destroyed pane');})};
    const getMarker=vi.fn(); const camera=new MapSelectionCamera(map,getMarker);
    const unload=map.on.mock.calls[0][1]; unload();
    expect(()=>{camera.cancel();camera.focus({id:'property',zoom:15},{});camera.dispose();camera.dispose();}).not.toThrow();
    expect(map.stop).not.toHaveBeenCalled(); expect(getMarker).not.toHaveBeenCalled();
    expect(map.off).toHaveBeenCalledTimes(1);
  });
  it('stops a live camera once and removes its listener on early frame cancellation', () => {
    const map={on:vi.fn(),off:vi.fn(),stop:vi.fn()};
    const camera=new MapSelectionCamera(map,vi.fn());
    camera.dispose();camera.cancel();camera.dispose();
    expect(map.stop).toHaveBeenCalledTimes(1);
    expect(map.off).toHaveBeenCalledWith('unload',map.on.mock.calls[0][1]);
  });
});
