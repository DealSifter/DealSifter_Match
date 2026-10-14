import { describe, expect, it, vi } from 'vitest';
import { guardMapLifetime } from './mapLifetime';

describe('owned Leaflet CSS animation teardown compatibility', () => {
  it('makes the queued native zoom completion inert before the pane is removed', () => {
    const map={_animatingZoom:true,on:vi.fn(),off:vi.fn()};
    const release=guardMapLifetime(map);
    expect(map._animatingZoom).toBe(true);
    map.on.mock.calls[0][1]();
    const move=vi.fn(()=>{throw new Error('deleted map pane');});
    const nativeCompletion=()=>{if(!map._animatingZoom)return;move();};
    expect(nativeCompletion).not.toThrow();expect(move).not.toHaveBeenCalled();
    release();expect(map.off).toHaveBeenCalledWith('unload',map.on.mock.calls[0][1]);
  });
  it('leaves live zoom animations and unrelated map state unchanged', () => {
    const map={_animatingZoom:true,on:vi.fn(),off:vi.fn(),options:{zoomSnap:1}};
    guardMapLifetime(map)();
    expect(map._animatingZoom).toBe(true);expect(map.options).toEqual({zoomSnap:1});
  });
});
