// Leaflet 1.9.4 queues an untracked 250ms CSS-zoom completion callback.
// remove() cancels flyTo/pan frames but leaves _animatingZoom true, allowing
// that callback to read a deleted map pane. Keep this compatibility boundary
// scoped to the owned map; never patch Leaflet's global prototype or timers.
export function guardMapLifetime(map) {
  const onUnload = () => { map._animatingZoom = false; };
  map.on('unload', onUnload);
  return () => map.off('unload', onUnload);
}
