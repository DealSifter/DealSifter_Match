# Public Parcel Intelligence — Phase 1

Production baseline: `9dbedf145bbe775248cc18e0a8801fc3209f1c71`. Architecture is national; coverage is progressive, not complete.

## Pre-implementation MapView/location audit

- Engine: Leaflet 1.9 / react-leaflet 5, retained. `src/pages/MapView.jsx` owns the map and Supercluster markers; `mapInventoryService` constructs existing people/property pins and canonical unlock relations.
- Selection: `selectedCardId`, cluster leaves, property popup actions and Maxxis screen-context callback. Parcel selection will stay local to its lazy layer, never changing analytical property facts.
- Viewport: `MapEvents` publishes center, zoom and `[west,south,east,north]` on moveend/zoomend. Session viewport and UI preferences preserve navigation. Parcel requests use these existing bounds, not a second viewport engine.
- Layers: existing OSM/Carto/Esri base maps, road overlays and FEMA WMS. Retain all, with parcel SVG polygons on a separate pane below property markers.
- Location: stored property coordinates/manual pin overrides. MapView explicitly avoids client geocoding and fake pins. Existing `geocode-address` Edge Function uses `geocode_cache` and Nominatim/Census/Photon/ArcGIS fallbacks. Reuse this endpoint without a propertyId for parcel address search; do not mutate property coordinates. No new geocoder.
- FIPS: existing provider property evidence has optional county/state FIPS, but MapView has no national county router. Add a read-only Census TIGERweb county spatial resolver, not another address geocoder. Full county GEOID is the registry key.
- API: existing authenticated Supabase function invocation and feature-flags endpoint. Reuse both; no new flag framework or persistent migration.
- Constraints: markers/cluster computation stays unchanged; parcel layer OFF mounts no parcel worker and sends zero GIS/API requests. Close-zoom debounce, bounded response size, cancellation/generation guards, TTL cache and isolated layer state protect panning/mobile.

## Safety boundary

`public_parcel_intelligence` defaults OFF in the existing feature flag system. Backend independently enforces the flag and source ACTIVE + license APPROVED/CLEAR_FOR_USE. Local discovery/diagnostics may inspect reviewed candidates but cannot promote them. URLs originate only in the typed registry; redirects and user-provided URLs are rejected. No paid provider, Maxxis, CanonicalPropertyFacts or report imports/mutations are permitted.

Phase 1 uses bounded in-process caches/coalescing/circuits (per Edge isolate) plus an existing shared rate-limit RPC for users. It does not promise cross-isolate provider coalescing. Persistent registry/cache is a future seam; no migration is required.

## Primary research references

- [ArcGIS query API](https://developers.arcgis.com/rest/services-reference/enterprise/query-feature-service-layer/): explicit input/output spatial references, bounded spatial queries; GeoJSON supported conditionally.
- [Jefferson County official GIS gateway](https://www.jccal.org/484/Enterprise-GIS) links the public parcel lookup and government open-data portal. [Its ArcGIS item](https://www.arcgis.com/home/item.html?id=02545b1e80ef45b4a39be8bc12cd43fa) is distinct from a general authorization to commercially redistribute all county data; review remains explicit.
- [Wake public dataset catalog](https://catalog.data.gov/dataset/parcels-d1495) and [official dataset](https://data.wake.gov/maps/Wake%3A%3Aparcels-1) identify the authority and CC-BY-4.0 terms. Availability and schema must still pass before ACTIVE.
- [King County terms](https://kingcounty.gov/en/legacy/services/gis/Maps/terms-of-use.aspx) permit several uses but restrict resale; commercial product/source use remains LICENSE_REVIEW_REQUIRED.
- [Utah official parcel program](https://gis.utah.gov/products/sgid/cadastre/parcels/) documents county/state coverage and basic versus land-information-record layers.

Public accessibility is not license approval. Source-specific terms and availability are preserved in the inventory; no source is automatically activated by a discovery score.
