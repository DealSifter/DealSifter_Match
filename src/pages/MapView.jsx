import React, { useCallback, useMemo, useState } from 'react';
import { genId } from '../lib/id';
import { GeoJSON, MapContainer, Marker, Popup, Rectangle, TileLayer, WMSTileLayer, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import Supercluster from 'supercluster';
import { C } from '../theme/colors';
import { CARDS as _MOCK_CARDS, PROPERTIES as _MOCK_PROPERTIES } from '../data/mockData';
import { useT } from '../i18n/translations';
import { SmartImage } from '../components/ui/SmartImage';
import { Icon } from '../components/ui/Icon';
import { CardStatusBadge, CardStatusIcon } from '../components/ui/CardStatusIndicators';
import { CARD_STATUS, pickPriorityStatus } from '../components/ui/cardStatusTokens';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { getPortfolioUnlockCost, getPropertyExclusivityStatus } from '../lib/unlockRules';
import { inferRecordProfileScope, normalizeProfileScope, resolveScopedProfile } from '../lib/profileScopeResolver';
import { normalizeCard } from '../lib/normalizeFeedCard';
import { orderDeck } from '../lib/orderFeedDeck';

const DEFAULT_CENTER = [39.5, -98.35];
const DEFAULT_ZOOM = 4;
const CLUSTER_CITY_LEVEL_MAX_ZOOM = 11;
// From city-level zoom onward, render only individual pins (no clusters).
const CLUSTER_BREAKOUT_ZOOM = CLUSTER_CITY_LEVEL_MAX_ZOOM;
const DEFAULT_USA_BOUNDS = [
  [24.396308, -124.848974],
  [49.384358, -66.885444],
];
const GRAPHITE_DARK = '#2f3438';
const UNLOCKED_PERSON_PIN = '#75ba75';
const MY_PINS_COLOR = C.gold;
const FEMA_WMS_URL = 'https://hazards.fema.gov/arcgis/rest/services/public/NFHLWMS/MapServer/WMSServer';
const FEMA_TILE_ERROR_STREAK_LIMIT = 3;
const CARDS = import.meta.env.DEV ? (_MOCK_CARDS || []) : [];
const PROPERTIES = import.meta.env.DEV ? (_MOCK_PROPERTIES || []) : [];

const isTruthyFlag = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'sim', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'nao', 'não', 'off'].includes(normalized)) return false;
  return fallback;
};

const BASE_TILE_FALLBACK_CHAIN = [
  {
    id: 'osm-main',
    label: 'OSM',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  {
    id: 'carto-light',
    label: 'Carto Light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
  {
    id: 'esri-street',
    label: 'Esri Streets',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
];

const MAP_STYLE_OPTIONS = {
  simple: {
    label: 'Simples',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite_streets: {
    label: 'Imagem + Ruas',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    overlays: [
      {
        url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Road overlay &copy; Esri',
      },
      {
        url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Labels overlay &copy; Esri',
      },
    ],
  },
  topo: {
    label: 'Relevo',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
  },
  flood: {
    label: 'Risco + Ruas',
    // Satellite base gives the same look as the reference flood-risk image
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri | Zonas de Inundação &copy; <a href="https://msc.fema.gov">FEMA NFHL</a>',
    overlays: [
      {
        // FEMA National Flood Hazard Layer via WMS – transparent PNG so only flood zone polygons
        // are drawn on top of the satellite base (no white background covering the imagery).
        // Layer 28 = Flood Hazard Zone (AE/A = azul, X = bege, etc.) — matches the FEMA viewer.
        // Rendered FIRST (below labels) so street names remain legible.
        type: 'wms',
        url: FEMA_WMS_URL,
        layers: '28',
        format: 'image/png',
        transparent: true,
        version: '1.3.0',
        styles: '',
        attribution: 'Flood Zones &copy; <a href="https://msc.fema.gov">FEMA NFHL</a>',
        opacity: 0.65,
        minZoom: 9,
        isFemaFlood: true, // sentinel for opacity control
      },
      {
        // Street labels + place names on top of flood zones so they stay legible
        url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Labels &copy; Esri',
        opacity: 0.85,
      },
    ],
  },
};

const PUBLIC_MAP_STYLE_KEYS = ['simple', 'satellite_streets', 'topo'];

function normalizeVisibleMapStyle(value) {
  const raw = String(value || '').trim();
  if (PUBLIC_MAP_STYLE_KEYS.includes(raw)) return raw;
  if (raw === 'flood') return 'satellite_streets';
  return 'simple';
}

function normalizePreferredInitialZoom(value, fallback = DEFAULT_ZOOM) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return clamp(numeric, 3, 13);
}

function sanitizeLatLngPair(value) {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lat = Number(value[0]);
  const lng = Number(value[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [clamp(lat, -85, 85), clamp(lng, -180, 180)];
}

function sanitizeLeafletBounds(value) {
  if (!value) return null;

  if (Array.isArray(value) && value.length === 2 && Array.isArray(value[0]) && Array.isArray(value[1])) {
    const p1 = sanitizeLatLngPair(value[0]);
    const p2 = sanitizeLatLngPair(value[1]);
    if (!p1 || !p2) return null;
    const south = Math.min(p1[0], p2[0]);
    const north = Math.max(p1[0], p2[0]);
    const west = Math.min(p1[1], p2[1]);
    const east = Math.max(p1[1], p2[1]);
    return [[south, west], [north, east]];
  }

  if (Array.isArray(value) && value.length === 4) {
    const west = Number(value[0]);
    const south = Number(value[1]);
    const east = Number(value[2]);
    const north = Number(value[3]);
    if (![west, south, east, north].every(Number.isFinite)) return null;
    return [
      [clamp(Math.min(south, north), -85, 85), clamp(Math.min(west, east), -180, 180)],
      [clamp(Math.max(south, north), -85, 85), clamp(Math.max(west, east), -180, 180)],
    ];
  }

  return null;
}

function sanitizeViewport(value, fallbackZoom = DEFAULT_ZOOM) {
  if (!value || typeof value !== 'object') return null;

  const center = sanitizeLatLngPair(value.center);
  if (!center) return null;

  const zoomRaw = Number(value.zoom);
  const zoom = Number.isFinite(zoomRaw) ? clamp(zoomRaw, 2, 19) : fallbackZoom;

  const bounds = sanitizeLeafletBounds(value.bounds)
    || [
      [center[0] - 1.2, center[1] - 1.2],
      [center[0] + 1.2, center[1] + 1.2],
    ];
  const [[south, west], [north, east]] = bounds;

  return {
    center,
    zoom,
    bounds: [west, south, east, north],
  };
}

const STATE_NAME_BY_CODE = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',
};

function parseCityState(value) {
  if (!value || typeof value !== 'string') {
    return { city: '', state: '' };
  }
  const [city = '', state = ''] = value.split(',').map((part) => part.trim());
  return { city, state };
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeZip(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length >= 5) return digits.slice(0, 5);
  return digits;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function spreadCoincidentFeatures(features, offsetDegrees = 0.00045) {
  const list = Array.isArray(features) ? features : [];
  if (!list.length) return [];

  const byCoord = new Map();
  list.forEach((feature) => {
    const [lng, lat] = feature?.geometry?.coordinates || [];
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    const key = `${lng.toFixed(6)}|${lat.toFixed(6)}`;
    const bucket = byCoord.get(key) || [];
    bucket.push(feature);
    byCoord.set(key, bucket);
  });

  const expanded = [];
  byCoord.forEach((bucket) => {
    if (bucket.length <= 1) {
      expanded.push(bucket[0]);
      return;
    }

    const total = bucket.length;
    bucket.forEach((feature, index) => {
      const ring = Math.floor(index / 8);
      const posInRing = index % 8;
      const perRing = Math.min(8, total);
      const angle = (Math.PI * 2 * posInRing) / perRing;
      const radius = offsetDegrees * (1 + ring * 0.9);
      const [lng, lat] = feature.geometry.coordinates;
      expanded.push({
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates: [
            lng + (Math.cos(angle) * radius),
            lat + (Math.sin(angle) * radius),
          ],
        },
      });
    });
  });

  return expanded;
}

function normalizeStreetText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(street|st)\b/g, 'st')
    .replace(/\b(avenue|ave)\b/g, 'ave')
    .replace(/\b(road|rd)\b/g, 'rd')
    .replace(/\b(boulevard|blvd)\b/g, 'blvd')
    .replace(/\b(drive|dr)\b/g, 'dr')
    .replace(/\b(lane|ln)\b/g, 'ln')
    .replace(/\b(court|ct)\b/g, 'ct')
    .replace(/\b(circle|cir)\b/g, 'cir')
    .replace(/\b(terrace|ter)\b/g, 'ter')
    .replace(/\b(place|pl)\b/g, 'pl')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractStreetName(address) {
  return normalizeStreetText(String(address || '').replace(/^\s*\d+[a-zA-Z]?\s+/, ''));
}

function tokenIntersectionCount(a, b) {
  const aa = new Set(normalizeStreetText(a).split(' ').filter((tok) => tok.length > 2));
  const bb = new Set(normalizeStreetText(b).split(' ').filter((tok) => tok.length > 2));
  let count = 0;
  aa.forEach((tok) => {
    if (bb.has(tok)) count += 1;
  });
  return count;
}

function getStateVariants(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  const codeMatch = raw.match(/\b([A-Z]{2})\b/);
  const code = codeMatch ? codeMatch[1] : raw.slice(0, 2).toUpperCase();
  const fullName = STATE_NAME_BY_CODE[code];
  return [raw, code, fullName].filter(Boolean).map(normalizeText);
}

function matchesLocationQuery(meta, mode, query) {
  if (!query) return true;
  if (mode === 'zip') return normalizeZip(meta.zip).includes(normalizeZip(query));
  if (mode === 'state') return getStateVariants(meta.state).some((candidate) => candidate.includes(query));
  return normalizeText(meta[mode]).includes(query);
}

function buildBoundsFromPoints(points, mode) {
  if (!points?.length) return null;

  const coords = points.map((feature) => feature.geometry.coordinates);
  const lats = coords.map((coord) => coord[1]);
  const lngs = coords.map((coord) => coord[0]);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const singlePoint = coords.length === 1;
  const modePad = mode === 'state' ? 0.7 : mode === 'city' ? 0.18 : 0.035;

  if (singlePoint) {
    const lat = lats[0];
    const lng = lngs[0];
    return [
      [lat - modePad, lng - modePad],
      [lat + modePad, lng + modePad],
    ];
  }

  const padLat = Math.max((maxLat - minLat) * 0.22, modePad * 0.35);
  const padLng = Math.max((maxLng - minLng) * 0.22, modePad * 0.35);
  return [
    [minLat - padLat, minLng - padLng],
    [maxLat + padLat, maxLng + padLng],
  ];
}

function bboxToLeafletBounds(bbox) {
  if (!Array.isArray(bbox) || bbox.length !== 4) return null;
  const [south, north, west, east] = bbox.map((part) => Number(part));
  if (![south, north, west, east].every(Number.isFinite)) return null;
  return [[south, west], [north, east]];
}

const NOMINATIM_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'DealSifter/1.0 (https://dealsifter.com)',
};
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const PHOTON_SEARCH_URL = 'https://photon.komoot.io/api/';
const ARCGIS_GEOCODE_URL = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';
const CENSUS_GEOCODE_URL = 'https://geocoding.geo.census.gov/geocoder/locations/address';
const ENABLE_CLIENT_GEOCODING = import.meta.env.DEV
  && String(import.meta.env.VITE_ENABLE_CLIENT_GEOCODING || '').toLowerCase() === 'true';

async function fetchRealBoundary({ mode, query }) {
  const cleaned = String(query || '').trim();
  if (!cleaned) return null;

  const attemptParams = [];

  if (mode === 'zip') {
    const zip = normalizeZip(cleaned);
    if (!zip) return null;

    // ZIP works better with structured `postalcode` queries than generic free text.
    attemptParams.push(
      new URLSearchParams({
        format: 'jsonv2',
        limit: '1',
        polygon_geojson: '1',
        addressdetails: '1',
        countrycodes: 'us',
        postalcode: zip,
        country: 'United States',
      }),
    );

    // Fallback text queries if structured search returns no geometry.
    attemptParams.push(
      new URLSearchParams({
        format: 'jsonv2',
        limit: '1',
        polygon_geojson: '1',
        addressdetails: '1',
        countrycodes: 'us',
        q: `${zip}, USA`,
      }),
    );

    attemptParams.push(
      new URLSearchParams({
        format: 'jsonv2',
        limit: '1',
        polygon_geojson: '1',
        addressdetails: '1',
        countrycodes: 'us',
        q: `postal code ${zip}, USA`,
      }),
    );
  } else {
    const params = new URLSearchParams({
      format: 'jsonv2',
      limit: '1',
      polygon_geojson: '1',
      addressdetails: '1',
      countrycodes: 'us',
      q: cleaned,
    });

    if (mode === 'state') params.set('featuretype', 'state');
    if (mode === 'city') params.set('featuretype', 'city');
    attemptParams.push(params);
  }

  for (const params of attemptParams) {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        headers: NOMINATIM_HEADERS,
      });

      if (!response.ok) continue;
      const data = await response.json();
      if (!Array.isArray(data) || !data.length) continue;

      const best = data[0];
      const bounds = bboxToLeafletBounds(best.boundingbox);
      if (!bounds) continue;

      return {
        bounds,
        geojson: best.geojson || null,
      };
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[MapView] Boundary lookup failed:', err.message);
    }
  }

  return null;
}

// SVG para pin de pessoa, formato mais compacto
const getPersonPinSVG = (fillColor) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 46" width="36" height="46" aria-hidden="true">
  <defs>
    <filter id="shadow-person" x="-30%" y="-20%" width="160%" height="180%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-opacity="0.28"/>
    </filter>
  </defs>
  <path d="M18 1C10.1 1 4 7 4 14.8c0 8.6 10.3 24.2 14 29.2 3.7-5 14-20.6 14-29.2C32 7 25.9 1 18 1z"
        fill="${fillColor}" stroke="#ffffff" stroke-width="2" filter="url(#shadow-person)"/>
  <circle cx="18" cy="10" r="3.8" fill="#ffffff"/>
  <path d="M12 19.5c0-2.9 2.7-5 6-5s6 2.1 6 5v1.5h-12z" fill="#ffffff"/>
</svg>`;

// SVG para pin de imovel, mesma base com miolo diferente
const getPropertyPinSVG = (fillColor) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 46" width="36" height="46" aria-hidden="true">
  <defs>
    <filter id="shadow-property" x="-30%" y="-20%" width="160%" height="180%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-opacity="0.28"/>
    </filter>
  </defs>
  <path d="M18 1C10.1 1 4 7 4 14.8c0 8.6 10.3 24.2 14 29.2 3.7-5 14-20.6 14-29.2C32 7 25.9 1 18 1z"
        fill="${fillColor}" stroke="#ffffff" stroke-width="2" filter="url(#shadow-property)"/>
  <path d="M11 14.5 18 9l7 5.5v8.5h-14z" fill="#ffffff"/>
  <rect x="16.3" y="18" width="3.4" height="5" rx="0.5" fill="${fillColor}"/>
  <rect x="12.8" y="16.2" width="2" height="2" rx="0.3" fill="${fillColor}"/>
  <rect x="21.2" y="16.2" width="2" height="2" rx="0.3" fill="${fillColor}"/>
</svg>`;

const personIcon = L.divIcon({
  className: 'map-pin-wrapper',
  html: getPersonPinSVG('#20CFC8'),
  iconSize: [36, 46],
  iconAnchor: [18, 46],
  popupAnchor: [0, -42],
});

const unlockedPersonIcon = L.divIcon({
  className: 'map-pin-wrapper',
  html: getPersonPinSVG(UNLOCKED_PERSON_PIN),
  iconSize: [36, 46],
  iconAnchor: [18, 46],
  popupAnchor: [0, -42],
});

const propertyIcon = L.divIcon({
  className: 'map-pin-wrapper',
  html: getPropertyPinSVG('#4381bc'),
  iconSize: [36, 46],
  iconAnchor: [18, 46],
  popupAnchor: [0, -42],
});

const unlockedPropertyIcon = L.divIcon({
  className: 'map-pin-wrapper',
  html: getPropertyPinSVG(UNLOCKED_PERSON_PIN),
  iconSize: [36, 46],
  iconAnchor: [18, 46],
  popupAnchor: [0, -42],
});

const myPropertyIcon = L.divIcon({
  className: 'map-pin-wrapper',
  html: getPropertyPinSVG(MY_PINS_COLOR),
  iconSize: [36, 46],
  iconAnchor: [18, 46],
  popupAnchor: [0, -42],
});

function getClusterIcon(total, peopleCount, propertiesCount, useUnlockedPropertyStyle = false) {
  const size = total > 50 ? 68 : total > 30 ? 58 : total > 12 ? 50 : 44;
  const clusterClass = useUnlockedPropertyStyle ? 'map-cluster map-cluster-unlocked' : 'map-cluster';
  const totalFontSize = size >= 68 ? 18 : size >= 58 ? 16 : size >= 50 ? 14 : 13;
  const breakdownFontSize = size >= 68 ? 10 : size >= 58 ? 9 : size >= 50 ? 8 : 7;
  return L.divIcon({
    className: 'map-cluster-wrapper',
    html: `
      <div class="${clusterClass}" style="width:${size}px;height:${size}px;--cluster-total-size:${totalFontSize}px;--cluster-breakdown-size:${breakdownFontSize}px;">
        <span class="map-cluster-total">${total}</span>
        <span class="map-cluster-breakdown">P:${peopleCount} B:${propertiesCount}</span>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function MapEvents({ onViewportChange }) {
  useMapEvents({
    moveend(event) {
      try {
        const map = event.target;
        const bounds = map.getBounds();
        const zoom = map.getZoom();
        const center = map.getCenter();
        onViewportChange({
          zoom,
          center: [center.lat, center.lng],
          bounds: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
        });
      } catch {
        // Leaflet can emit a final event while React Activity is hiding the map.
      }
    },
    zoomend(event) {
      try {
        const map = event.target;
        const bounds = map.getBounds();
        const zoom = map.getZoom();
        const center = map.getCenter();
        onViewportChange({
          zoom,
          center: [center.lat, center.lng],
          bounds: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
        });
      } catch {
        // Leaflet can emit a final event while React Activity is hiding the map.
      }
    },
  });
  return null;
}

function MapVisibilityController({ active }) {
  const map = useMap();

  React.useEffect(() => {
    if (!active) {
      try { map.stop(); } catch { /* noop */ }
      return undefined;
    }
    const timers = [0, 80, 240].map((delay) => window.setTimeout(() => {
      try { map.invalidateSize({ animate: false, pan: false }); } catch { /* noop */ }
    }, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [active, map]);

  return null;
}

function ManualPinPlacementController({ active, onPlace }) {
  const map = useMapEvents({
    click(event) {
      if (!active) return;
      const { latlng } = event;
      if (!latlng || !Number.isFinite(latlng.lat) || !Number.isFinite(latlng.lng)) return;
      onPlace({ lat: latlng.lat, lng: latlng.lng });
    },
  });

  React.useEffect(() => {
    const container = map.getContainer();
    if (!container) return;
    container.style.cursor = active ? 'crosshair' : '';
    return () => {
      container.style.cursor = '';
    };
  }, [active, map]);

  return null;
}

// "Google Earth" feel — used for cluster opens, filter fits, initial load
const FLY_OPTIONS = {
  animate: true,
  duration: 1.5,
  easeLinearity: 0.12, // near-0 = very curved / ease-in-out, 1 = linear
};

// Snappy feel — used for card-to-card navigation (short hop, no pile-up)
const FLY_OPTIONS_SNAP = {
  animate: true,
  duration: 0.65,
  easeLinearity: 0.30, // more linear → motion is perceptible from start to end
  noMoveStart: true,   // skip the movestart event on the old position (perf)
};

function MapController({ mapRef, fitToBounds }) {
  const map = useMap();

  // Expose the Leaflet map instance to the parent via ref so parent can call
  // map.flyTo() directly without going through React state (no re-renders).
  React.useEffect(() => {
    if (mapRef) mapRef.current = map;
  }, [map, mapRef]);

  React.useEffect(() => {
    if (!fitToBounds?.bounds) return;
    map.flyToBounds(fitToBounds.bounds, {
      padding: [36, 36],
      maxZoom: fitToBounds.maxZoom,
      ...FLY_OPTIONS,
    });
  }, [fitToBounds, map]);

  return null;
}

// ---------------------------------------------------------------------------
// Geocoding helpers for user properties
// ---------------------------------------------------------------------------

// Read/write a localStorage-backed geocode cache: { "address|city|state|zip": { lat, lng } }
const GEOCODE_CACHE_KEY = 'ds_geocode_cache';
function _loadGeocodeCache() {
  try { return JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY) || '{}'); } catch { return {}; }
}
function _saveGeocodeCache(cache) {
  try { localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache)); } catch { /* noop */ }
}

const PIN_OVERRIDES_KEY = 'ds_pin_overrides';
const PIN_OVERRIDES_STORAGE_KEY = 'ds_pin_overrides_by_user';
const MAP_UI_STATE_KEY = 'ds_mapview_ui_state_v1';

function _pinOverridesUserKey(userProfile) {
  const candidates = [
    userProfile?.id,
    userProfile?.userId,
    userProfile?.email,
    userProfile?.phone,
  ];
  const token = candidates
    .map((value) => String(value || '').trim().toLowerCase())
    .find(Boolean);
  return token ? `user:${token}` : 'user:anonymous';
}

function _loadPinOverrides(userProfile) {
  const scopeKey = _pinOverridesUserKey(userProfile);

  try {
    const raw = localStorage.getItem(PIN_OVERRIDES_STORAGE_KEY);
    const allOverrides = JSON.parse(raw || '{}');
    const scoped = allOverrides?.[scopeKey];
    if (scoped && typeof scoped === 'object' && !Array.isArray(scoped)) {
      return scoped;
    }
  } catch {
    // fallback to legacy below
  }

  // Legacy fallback: keep existing persisted positions from pre-scoped storage.
  try {
    const legacy = JSON.parse(localStorage.getItem(PIN_OVERRIDES_KEY) || '{}');
    if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
      return legacy;
    }
  } catch {
    // noop
  }

  return {};
}

function _savePinOverrides(overrides, userProfile) {
  try {
    const scopeKey = _pinOverridesUserKey(userProfile);
    let allOverrides = {};
    try {
      allOverrides = JSON.parse(localStorage.getItem(PIN_OVERRIDES_STORAGE_KEY) || '{}') || {};
    } catch {
      allOverrides = {};
    }

    allOverrides[scopeKey] = overrides;
    localStorage.setItem(PIN_OVERRIDES_STORAGE_KEY, JSON.stringify(allOverrides));
    // Compatibility snapshot for previous versions.
    localStorage.setItem(PIN_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
    // noop
  }
}

function _loadMapUiState() {
  try {
    const raw = localStorage.getItem(MAP_UI_STATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function _saveMapUiState(state) {
  try { localStorage.setItem(MAP_UI_STATE_KEY, JSON.stringify(state || {})); } catch { /* noop */ }
}

// Module-level signal: set by the viewport useState initializer when a nav-return viewport is
// consumed, then read by hasAutoFitRealPinsRef to prevent the auto-fit from overriding it.
let _navReturnViewportConsumed = false;

function _normalizePropertyLocation(property) {
  const address = String(property?.address || '').trim();
  const rawCity = String(property?.city || '').trim();

  // Supports values like "Miami, FL 33131" in the city field.
  const cityStateZipMatch = rawCity.match(/^([^,]+)\s*,\s*([A-Za-z]{2})(?:\s+(\d{5}(?:-\d{4})?))?$/);
  const city = cityStateZipMatch ? String(cityStateZipMatch[1] || '').trim() : rawCity;
  const stateFromCity = cityStateZipMatch ? String(cityStateZipMatch[2] || '').trim().toUpperCase() : '';
  const zipFromCity = cityStateZipMatch ? String(cityStateZipMatch[3] || '').trim() : '';

  const stateRaw = String(property?.state || '').trim();
  const stateCodeFromRaw = /^[A-Za-z]{2}$/.test(stateRaw) ? stateRaw.toUpperCase() : '';
  const stateFromMarkets = Array.isArray(property?.markets)
    ? String(property.markets.find((value) => /^[A-Za-z]{2}$/.test(String(value || '').trim())) || '').trim().toUpperCase()
    : '';
  const stateCode = stateCodeFromRaw || stateFromCity || stateFromMarkets;

  const stateFull = stateCode
    ? (STATE_FULL_NAME[stateCode] || stateCode)
    : (stateRaw || '');

  const zipRaw = String(property?.zip || '').trim();
  const zipMatch = zipRaw.match(/\d{5}(?:-\d{4})?/);
  const zip = String(zipMatch?.[0] || zipFromCity || '').trim();

  return { address, city, stateCode, stateFull, zip };
}

function _hasGeocodeableLocation(property) {
  const parts = _normalizePropertyLocation(property);
  return Boolean(parts.address || parts.city || parts.stateCode || parts.stateFull || parts.zip);
}

function _geocodeCacheKey(property) {
  const parts = _normalizePropertyLocation(property);
  const stateKey = parts.stateCode || String(parts.stateFull || '').trim().toUpperCase();
  return [parts.address, parts.city, stateKey, parts.zip].map((v) => String(v || '').trim()).join('|');
}

function shouldTrustExplicitCoords(property) {
  const source = String(property?.geocodeSource || '').trim().toLowerCase();
  if (source === 'manual') return true;
  // Accept any stored coords as interim display while async geocoding runs.
  // The geocode cache will override these when a more accurate result is found.
  const lat = Number(property?.lat);
  const lng = Number(property?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
}

function hasValidCoords(coords) {
  const lat = Number(coords?.lat);
  const lng = Number(coords?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

// Synchronous: resolve from manual override, geocode cache, or explicit property coords.
// Strict mode: no approximate fallbacks (no fake city/state centers).
function resolvePropertyCoords(property, geocodeCache, pinOverrides) {
  // 1) Manual pin repositioning takes highest priority
  const propId = String(property?.id ?? '');
  if (propId && pinOverrides?.[propId]) return pinOverrides[propId];
  // 2) Geocode cache (ArcGIS/Photon async result)
  const cacheKey = _geocodeCacheKey(property);
  if (geocodeCache?.[cacheKey]) return geocodeCache[cacheKey];
  // 3) Explicit lat/lng on the property record
  const explicitLat = Number(property?.lat);
  const explicitLng = Number(property?.lng);
  if (
    Number.isFinite(explicitLat)
    && Number.isFinite(explicitLng)
    && shouldTrustExplicitCoords(property)
  ) {
    return { lat: explicitLat, lng: explicitLng };
  }
  // No real coordinates — pin will not be rendered until geocoding resolves
  return null;
}

// US state abbreviation → full state name (Nominatim structured works better with full names)
const STATE_FULL_NAME = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',
  CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',
  IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',
  ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',
  MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',
  NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',
  OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',
  TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',
  WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'District of Columbia',
};

const STATE_CENTER_COORDS = {
  AL:{ lat:32.8067,lng:-86.7911 }, AK:{ lat:64.2008,lng:-149.4937 }, AZ:{ lat:34.0489,lng:-111.0937 }, AR:{ lat:35.2010,lng:-91.8318 },
  CA:{ lat:36.7783,lng:-119.4179 }, CO:{ lat:39.5501,lng:-105.7821 }, CT:{ lat:41.6032,lng:-73.0877 }, DE:{ lat:38.9108,lng:-75.5277 },
  FL:{ lat:27.6648,lng:-81.5158 }, GA:{ lat:32.1656,lng:-82.9001 }, HI:{ lat:19.8968,lng:-155.5828 }, ID:{ lat:44.0682,lng:-114.7420 },
  IL:{ lat:40.6331,lng:-89.3985 }, IN:{ lat:40.2672,lng:-86.1349 }, IA:{ lat:41.8780,lng:-93.0977 }, KS:{ lat:39.0119,lng:-98.4842 },
  KY:{ lat:37.8393,lng:-84.2700 }, LA:{ lat:30.9843,lng:-91.9623 }, ME:{ lat:45.2538,lng:-69.4455 }, MD:{ lat:39.0458,lng:-76.6413 },
  MA:{ lat:42.4072,lng:-71.3824 }, MI:{ lat:44.3148,lng:-85.6024 }, MN:{ lat:46.7296,lng:-94.6859 }, MS:{ lat:32.3547,lng:-89.3985 },
  MO:{ lat:37.9643,lng:-91.8318 }, MT:{ lat:46.8797,lng:-110.3626 }, NE:{ lat:41.4925,lng:-99.9018 }, NV:{ lat:38.8026,lng:-116.4194 },
  NH:{ lat:43.1939,lng:-71.5724 }, NJ:{ lat:40.0583,lng:-74.4057 }, NM:{ lat:34.5199,lng:-105.8701 }, NY:{ lat:43.2994,lng:-74.2179 },
  NC:{ lat:35.7596,lng:-79.0193 }, ND:{ lat:47.5515,lng:-101.0020 }, OH:{ lat:40.4173,lng:-82.9071 }, OK:{ lat:35.0078,lng:-97.0929 },
  OR:{ lat:43.8041,lng:-120.5542 }, PA:{ lat:41.2033,lng:-77.1945 }, RI:{ lat:41.5801,lng:-71.4774 }, SC:{ lat:33.8361,lng:-81.1637 },
  SD:{ lat:43.9695,lng:-99.9018 }, TN:{ lat:35.5175,lng:-86.5804 }, TX:{ lat:31.9686,lng:-99.9018 }, UT:{ lat:39.3210,lng:-111.0937 },
  VT:{ lat:44.5588,lng:-72.5778 }, VA:{ lat:37.4316,lng:-78.6569 }, WA:{ lat:47.7511,lng:-120.7401 }, WV:{ lat:38.5976,lng:-80.4549 },
  WI:{ lat:43.7844,lng:-88.7879 }, WY:{ lat:43.0760,lng:-107.2903 }, DC:{ lat:38.9072,lng:-77.0369 },
};

function resolvePropertyDisplayCoords(property, geocodeCache, pinOverrides) {
  const resolved = resolvePropertyCoords(property, geocodeCache, pinOverrides);
  if (resolved) return { ...resolved, isApproximate: false };

  const parts = _normalizePropertyLocation(property);
  const stateCode = String(parts?.stateCode || '').trim().toUpperCase();
  const approx = stateCode ? STATE_CENTER_COORDS[stateCode] : null;
  if (!approx) return null;

  return { ...approx, isApproximate: true, geocodeStatus: 'pending' };
}

function getStateCodeFromMarket(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const direct = raw.toUpperCase();
  if (STATE_FULL_NAME[direct]) return direct;
  const matched = Object.entries(STATE_FULL_NAME).find(([, name]) => name.toLowerCase() === raw.toLowerCase());
  return matched ? matched[0] : '';
}

function _pickBestPhotonFeature(features, context) {
  if (!Array.isArray(features) || !features.length) return null;

  const zip = String(context?.zip || '').trim();
  const stateCode = String(context?.stateCode || '').trim().toUpperCase();
  const city = normalizeText(context?.city || '');
  const houseMatch = String(context?.address || '').match(/\b\d+[A-Za-z]?\b/);
  const houseNumber = houseMatch ? String(houseMatch[0]).toUpperCase() : '';
  const expectedStreet = extractStreetName(context?.address || '');

  let best = null;
  let bestScore = -1;

  for (const feature of features) {
    const coords = feature?.geometry?.coordinates;
    const props = feature?.properties || {};
    if (!Array.isArray(coords) || coords.length < 2) continue;

    const [lng, lat] = coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    let score = 0;
    const featureType = normalizeText(props?.type || '');
    const featureCity = normalizeText(props?.city || props?.district || '');
    const featureState = String(props?.state || '').trim().toUpperCase();
    const featurePostCode = String(props?.postcode || '').trim();
    const featureHouseNumber = String(props?.housenumber || '').trim().toUpperCase();
    const featureStreet = normalizeStreetText(props?.street || props?.name || '');
    const streetOverlap = tokenIntersectionCount(expectedStreet, featureStreet);
    const zipMatched = Boolean(zip && featurePostCode && featurePostCode.startsWith(zip.slice(0, 5)));
    const houseNumberMatched = Boolean(houseNumber && featureHouseNumber && houseNumber === featureHouseNumber);

    if (featureType === 'house') score += 12;
    if (houseNumberMatched) score += 25;
    if (zipMatched) score += 20;
    if (stateCode && featureState && featureState === stateCode) score += 14;
    if (city && featureCity && featureCity.includes(city)) score += 10;
    if (expectedStreet && featureStreet) {
      if (featureStreet.includes(expectedStreet) || expectedStreet.includes(featureStreet)) score += 26;
      else if (streetOverlap >= 2) score += 15;
      else if (houseNumber && streetOverlap === 0) score -= 22;
    }

    if (score > bestScore) {
      bestScore = score;
      const normalized = score / 81;
      best = {
        lat,
        lng,
        geocodeSource: 'photon',
        geocodeConfidence: Number(clamp(normalized, 0.28, 0.94).toFixed(2)),
        streetOverlap,
        zipMatched,
        houseNumberMatched,
      };
    }
  }

  return best;
}

function _pickBestArcGisCandidate(candidates, context) {
  if (!Array.isArray(candidates) || !candidates.length) return null;

  const zip = String(context?.zip || '').trim();
  const stateCode = String(context?.stateCode || '').trim().toUpperCase();
  const city = normalizeText(context?.city || '');
  const houseMatch = String(context?.address || '').match(/\b\d+[A-Za-z]?\b/);
  const houseNumber = houseMatch ? String(houseMatch[0]).toUpperCase() : '';
  const expectedStreet = extractStreetName(context?.address || '');

  let best = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    const location = candidate?.location || {};
    const attrs = candidate?.attributes || {};
    const lng = Number(location.x);
    const lat = Number(location.y);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    let score = Number(candidate?.score || 0);
    const addrType = normalizeText(attrs?.Addr_type || attrs?.Type || '');
    const addNum = String(attrs?.AddNum || '').trim().toUpperCase();
    const postal = String(attrs?.Postal || '').trim();
    const cityName = normalizeText(attrs?.City || '');
    const region = String(attrs?.RegionAbbr || '').trim().toUpperCase();
    const streetLine = normalizeStreetText(attrs?.StAddr || attrs?.ShortLabel || attrs?.Match_addr || '');
    const streetOverlap = tokenIntersectionCount(expectedStreet, streetLine);
    const zipMatched = Boolean(zip && postal && postal.startsWith(zip.slice(0, 5)));
    const houseNumberMatched = Boolean(houseNumber && addNum && houseNumber === addNum);

    if (addrType === 'pointaddress') score += 30;
    else if (addrType === 'streetaddress') score += 18;
    if (houseNumberMatched) score += 25;
    if (zipMatched) score += 20;
    if (stateCode && region && stateCode === region) score += 12;
    if (city && cityName && cityName.includes(city)) score += 10;
    if (expectedStreet && streetLine) {
      if (streetLine.includes(expectedStreet) || expectedStreet.includes(streetLine)) score += 28;
      else if (streetOverlap >= 2) score += 16;
      else if (houseNumber && streetOverlap === 0) score -= 26;
    }

    if (score > bestScore) {
      bestScore = score;
      const normalized = score / 150;
      best = {
        lat,
        lng,
        geocodeSource: 'arcgis',
        geocodeConfidence: Number(clamp(normalized, 0.34, 0.99).toFixed(2)),
        streetOverlap,
        zipMatched,
        houseNumberMatched,
      };
    }
  }

  return best;
}

async function _arcGisGeocode(property) {
  if (!ENABLE_CLIENT_GEOCODING) return null;
  const parts = _normalizePropertyLocation(property);
  const stateToken = parts.stateCode || parts.stateFull;
  const query = [parts.address, parts.city, stateToken, parts.zip, 'USA'].filter(Boolean).join(', ');
  if (!query) return null;

  const params = new URLSearchParams({
    f: 'pjson',
    outFields: '*',
    maxLocations: '5',
    countryCode: 'USA',
  });

  if (parts.address) {
    params.set('Address', parts.address);
    if (parts.city) params.set('City', parts.city);
    if (parts.stateCode) params.set('Region', parts.stateCode);
    if (parts.zip) params.set('Postal', parts.zip);
  } else {
    params.set('SingleLine', query);
  }

  try {
    const response = await fetch(`${ARCGIS_GEOCODE_URL}?${params.toString()}`);
    if (!response.ok) {
      if (import.meta.env.DEV) console.warn('[MapView] ArcGIS HTTP', response.status, query);
      return null;
    }
    const data = await response.json();
    return _pickBestArcGisCandidate(data?.candidates || [], {
      address: parts.address,
      city: parts.city,
      stateCode: parts.stateCode,
      zip: parts.zip,
    });
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[MapView] ArcGIS error:', err.message);
    return null;
  }
}

function _pickBestNominatimResult(results, context) {
  if (!Array.isArray(results) || !results.length) return null;

  const zip = String(context?.zip || '').trim();
  const stateCode = String(context?.stateCode || '').trim().toUpperCase();
  const city = normalizeText(context?.city || '');
  const houseMatch = String(context?.address || '').match(/\b\d+[A-Za-z]?\b/);
  const houseNumber = houseMatch ? String(houseMatch[0]).toUpperCase() : '';
  const expectedStreet = extractStreetName(context?.address || '');

  let best = null;
  let bestScore = -1;

  for (const item of results) {
    const lat = Number(item?.lat);
    const lng = Number(item?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const address = item?.address || {};
    const candidateCity = normalizeText(address.city || address.town || address.village || address.municipality || '');
    const candidateZip = String(address.postcode || '').trim();
    const candidateState = String(address.state_code || address.state || '').trim().toUpperCase();
    const candidateStreet = normalizeStreetText(address.road || address.pedestrian || address.neighbourhood || '');
    const candidateHouseNumber = String(address.house_number || '').trim().toUpperCase();
    const streetOverlap = tokenIntersectionCount(expectedStreet, candidateStreet);
    const zipMatched = Boolean(zip && candidateZip && candidateZip.startsWith(zip.slice(0, 5)));
    const houseNumberMatched = Boolean(houseNumber && candidateHouseNumber && houseNumber === candidateHouseNumber);
    const classType = `${normalizeText(item?.class || '')}:${normalizeText(item?.type || '')}`;

    let score = Number(item?.importance || 0) * 100;
    if (zipMatched) score += 30;
    if (stateCode && candidateState && candidateState.includes(stateCode)) score += 16;
    if (city && candidateCity && candidateCity.includes(city)) score += 18;
    if (classType.includes('building') || classType.includes('house')) score += 10;
    if (houseNumberMatched) score += 24;
    if (expectedStreet && candidateStreet) {
      if (candidateStreet.includes(expectedStreet) || expectedStreet.includes(candidateStreet)) score += 26;
      else if (streetOverlap >= 2) score += 14;
      else if (houseNumber && streetOverlap === 0) score -= 22;
    }

    if (score > bestScore) {
      bestScore = score;
      best = {
        lat,
        lng,
        geocodeSource: 'nominatim',
        geocodeConfidence: Number(clamp(score / 160, 0.26, 0.93).toFixed(2)),
        streetOverlap,
        zipMatched,
        houseNumberMatched,
      };
    }
  }

  return best;
}

async function _nominatimDirectGeocode(property) {
  if (!ENABLE_CLIENT_GEOCODING) return null;
  const parts = _normalizePropertyLocation(property);
  const address = parts.address;
  const city = parts.city;
  const stateAb = parts.stateCode;
  const stateFull = parts.stateFull;
  const zip = parts.zip;

  const attempts = [
    [address, city, stateAb, zip, 'USA'].filter(Boolean).join(', '),
    [address, city, stateFull, zip, 'USA'].filter(Boolean).join(', '),
    [address, city, stateAb, 'USA'].filter(Boolean).join(', '),
    [city, stateAb, zip, 'USA'].filter(Boolean).join(', '),
  ].filter(Boolean);

  for (const query of attempts) {
    try {
      const params = new URLSearchParams({
        format: 'jsonv2',
        addressdetails: '1',
        limit: '6',
        countrycodes: 'us',
        q: query,
      });
      const response = await fetch(`${NOMINATIM_SEARCH_URL}?${params.toString()}`);
      if (!response.ok) {
        if (import.meta.env.DEV) console.warn('[MapView] Nominatim HTTP', response.status, query);
        continue;
      }
      const data = await response.json();
      const best = _pickBestNominatimResult(data, {
        city,
        stateCode: stateAb,
        zip,
      });
      if (best) {
        if (import.meta.env.DEV) console.info('[MapView] Geocoded (Nominatim):', query, '→', best.lat, best.lng);
        return best;
      }
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[MapView] Nominatim error:', err.message);
    }
  }

  return null;
}

async function _nominatimStructuredGeocode(property) {
  if (!ENABLE_CLIENT_GEOCODING) return null;
  const parts = _normalizePropertyLocation(property);
  if (!parts.address && !parts.city && !parts.stateCode && !parts.zip) return null;

  const attempts = [];
  if (parts.address || parts.city || parts.stateCode || parts.zip) {
    attempts.push({
      street: parts.address || undefined,
      city: parts.city || undefined,
      state: parts.stateCode || parts.stateFull || undefined,
      postalcode: parts.zip || undefined,
    });
  }
  if (parts.address || parts.city || parts.stateFull || parts.zip) {
    attempts.push({
      street: parts.address || undefined,
      city: parts.city || undefined,
      state: parts.stateFull || undefined,
      postalcode: parts.zip || undefined,
    });
  }

  for (const attempt of attempts) {
    try {
      const params = new URLSearchParams({
        format: 'jsonv2',
        addressdetails: '1',
        limit: '8',
        countrycodes: 'us',
      });
      if (attempt.street) params.set('street', attempt.street);
      if (attempt.city) params.set('city', attempt.city);
      if (attempt.state) params.set('state', attempt.state);
      if (attempt.postalcode) params.set('postalcode', attempt.postalcode);

      const response = await fetch(`${NOMINATIM_SEARCH_URL}?${params.toString()}`, {
        headers: NOMINATIM_HEADERS,
      });
      if (!response.ok) continue;
      const data = await response.json();
      const best = _pickBestNominatimResult(data, {
        address: parts.address,
        city: parts.city,
        stateCode: parts.stateCode,
        zip: parts.zip,
      });
      if (best) return best;
    } catch {
      // noop
    }
  }

  return null;
}

// Async: geocode a single property using real providers only and return
// { lat, lng, geocodeSource, geocodeConfidence } or null.
async function _censusGeocode(property) {
  if (!ENABLE_CLIENT_GEOCODING) return null;
  const parts = _normalizePropertyLocation(property);
  if (!parts.address) return null; // Census requires a street address

  try {
    const params = new URLSearchParams({
      format: 'json',
      benchmark: 'Public_AR_Current',
      street: parts.address,
    });
    if (parts.city) params.set('city', parts.city);
    if (parts.stateCode) params.set('state', parts.stateCode);
    else if (parts.stateFull) params.set('state', parts.stateFull);
    if (parts.zip) params.set('zip', parts.zip);

    const response = await fetch(`${CENSUS_GEOCODE_URL}?${params.toString()}`);
    if (!response.ok) return null;
    const data = await response.json();
    const matches = data?.result?.addressMatches;
    if (!Array.isArray(matches) || !matches.length) return null;

    const match = matches[0];
    const lat = Number(match?.coordinates?.y);
    const lng = Number(match?.coordinates?.x);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    // Sanity check: must be within US bounding box
    if (lat < 18 || lat > 72 || lng < -180 || lng > -65) return null;

    const comp = match?.addressComponents || {};
    const streetNumber = String(comp.streetNumber || '').trim().toUpperCase();
    const streetName = normalizeStreetText(
      [comp.preDirection, comp.streetName, comp.suffixType, comp.suffixDirection].filter(Boolean).join(' ')
    );
    const matchedZip = String(comp.zip || '').trim();

    const houseMatch = String(parts.address || '').match(/\b\d+[A-Za-z]?\b/);
    const houseNumber = houseMatch ? String(houseMatch[0]).toUpperCase() : '';
    const expectedStreet = extractStreetName(parts.address || '');

    const houseNumberMatched = Boolean(houseNumber && streetNumber && houseNumber === streetNumber);
    const zipMatched = Boolean(parts.zip && matchedZip && matchedZip.startsWith(parts.zip.slice(0, 5)));
    const streetOverlap = tokenIntersectionCount(expectedStreet, streetName);

    // Census Bureau is authoritative for US addresses — base confidence is high
    let confidence = 0.90;
    if (!houseNumberMatched && houseNumber) confidence -= 0.12;
    if (zipMatched) confidence = Math.min(0.99, confidence + 0.04);
    if (streetOverlap >= 1) confidence = Math.min(0.99, confidence + 0.03);

    return {
      lat,
      lng,
      geocodeSource: 'census',
      geocodeConfidence: Number(confidence.toFixed(2)),
      streetOverlap,
      zipMatched,
      houseNumberMatched,
    };
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[MapView] Census geocode error:', err.message);
    return null;
  }
}

async function _nominatimGeocode(property) {
  if (!ENABLE_CLIENT_GEOCODING) return null;
  const parts = _normalizePropertyLocation(property);
  const address = parts.address;
  const city = parts.city;
  const stateAb = parts.stateCode;
  const zip = parts.zip;

  if (!address && !city && !stateAb && !zip) return null;

  const stateFull = parts.stateFull;
  const fullAddress = [address, city, stateFull, zip, 'USA'].filter(Boolean).join(', ');

  let bestResult = null;
  const chooseBetter = (candidate) => {
    if (!candidate) return;
    if (!bestResult || Number(candidate.geocodeConfidence || 0) > Number(bestResult.geocodeConfidence || 0)) {
      bestResult = candidate;
    }
  };

  // 0) US Census Bureau – authoritative rooftop geocoding for US addresses, free, no key required.
  const census = await _censusGeocode(property);
  if (census) {
    if (import.meta.env.DEV) console.info('[MapView] Geocoded (Census Bureau):', fullAddress, '→', census.lat, census.lng, census.geocodeConfidence);
    return census; // Census is authoritative — accept immediately without strict gate
  }

  const nominatimStructured = await _nominatimStructuredGeocode(property);
  chooseBetter(nominatimStructured);
  if (
    nominatimStructured
    && Number(nominatimStructured.geocodeConfidence || 0) >= 0.78
    && (Number(nominatimStructured.streetOverlap || 0) >= 1 || nominatimStructured.houseNumberMatched)
  ) {
    if (import.meta.env.DEV) console.info('[MapView] Geocoded (Nominatim structured):', fullAddress, '→', nominatimStructured.lat, nominatimStructured.lng);
    return nominatimStructured;
  }

  const arcgis = await _arcGisGeocode(property);
  chooseBetter(arcgis);
  if (arcgis && Number(arcgis.geocodeConfidence || 0) >= 0.8 && Number(arcgis.streetOverlap || 0) >= 1) {
    if (import.meta.env.DEV) console.info('[MapView] Geocoded (ArcGIS high confidence):', fullAddress, '→', arcgis.lat, arcgis.lng);
    return arcgis;
  }

  // 2) Photon fallback.
  const attempts = [
    fullAddress,
    [address, city, stateAb, zip, 'USA'].filter(Boolean).join(', '),
    [address, city, stateFull, 'USA'].filter(Boolean).join(', '),
    [city, stateFull, zip, 'USA'].filter(Boolean).join(', '),
  ].filter(Boolean);

  for (const query of attempts) {
    try {
      const params = new URLSearchParams({ q: query, limit: '8' });
      const res = await fetch(`${PHOTON_SEARCH_URL}?${params.toString()}`);
      if (!res.ok) {
        if (import.meta.env.DEV) console.warn('[MapView] Photon HTTP', res.status, query);
        continue;
      }
      const data = await res.json();
      const best = _pickBestPhotonFeature(data?.features || [], {
        address,
        city,
        stateCode: stateAb,
        zip,
      });
      if (best) {
        chooseBetter(best);
      }
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[MapView] Photon error:', err.message);
    }
  }

  // 3) Nominatim fallback (best-effort when ArcGIS/Photon fail).
  const nominatim = await _nominatimDirectGeocode(property);
  chooseBetter(nominatim);

  if (bestResult && Number(bestResult.geocodeConfidence || 0) >= 0.55) {
    if (import.meta.env.DEV) console.info('[MapView] Geocoded (best provider):', fullAddress, '→', bestResult.lat, bestResult.lng, bestResult.geocodeSource, bestResult.geocodeConfidence);
    return bestResult;
  }

  if (import.meta.env.DEV) console.warn('[MapView] Geocode failed for:', fullAddress);
  return null;
}

export function MapView({
  nuggets,
  setModal,
  openUnlock,
  unlocked,
  setPage,
  showcaseProperties = [],
  propertyPortfolio = [],
  servicePortfolio = [],
  userProfile,
  accountType = 'professional',
  personalProfile = null,
  professionalProfile = null,
  currentUserId = 'local-user',
  onUpdatePropertyCoords,
  userPreferences = null,
  activeSpotlightKeys = new Set(),
  propertyUnlocks = [],
  isActive = true,
}) {
  const enableMockMapData = import.meta.env.DEV && String(import.meta.env.VITE_ENABLE_MOCK_DATA || '').toLowerCase() === 'true';
  const allT = useT('mapview');
  const tMatches = allT.matches;
  const tCards = allT.cards;
  const tMap = allT.mapViewPage;
  const prefMap = userPreferences?.map || {};
  const preferredInitialZoom = normalizePreferredInitialZoom(prefMap.initialZoom, DEFAULT_ZOOM);
  const preferredMapStyle = normalizeVisibleMapStyle(prefMap.defaultStyle);
  const preferredClusterBehavior = String(prefMap.clusterBehavior || '').trim() === 'mixed' ? 'mixed' : 'pins_city';
  const preferredDefaultFilters = prefMap.defaultFilters && typeof prefMap.defaultFilters === 'object'
    ? prefMap.defaultFilters
    : {};
  const initialMapUiState = useMemo(() => _loadMapUiState(), []);
  const mapUiStateRef = React.useRef(initialMapUiState || {});
  const unlockedIds = useMemo(() => (Array.isArray(unlocked) ? unlocked : []), [unlocked]);
  const isUnlockedId = useCallback((id) => unlockedIds.includes(id), [unlockedIds]);
  const normalizeCardPriority = useCallback((value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'primary' || normalized === 'secondary' || normalized === 'tertiary') return normalized;
    return '';
  }, []);
  const publishedLocalProfileScopes = useMemo(() => {
    const priorityA = accountType === 'fsbo_owner'
      ? ''
      : normalizeCardPriority(professionalProfile?.cardPriorityA || personalProfile?.cardPriorityA || '');
    const priorityB = normalizeCardPriority(professionalProfile?.cardPriorityB || '');
    const priorityC = normalizeCardPriority(accountType === 'fsbo_owner'
      ? (personalProfile?.cardPriorityC || professionalProfile?.cardPriorityC || '')
      : (professionalProfile?.cardPriorityC || personalProfile?.cardPriorityC || ''));
    return new Set([
      priorityA ? 'personal' : '',
      priorityB ? 'professional' : '',
      priorityC ? 'fsbo' : '',
    ].filter(Boolean));
  }, [accountType, normalizeCardPriority, personalProfile, professionalProfile]);
  const getRecordProfileScope = useCallback((record, fallbackScope = '') => {
    return inferRecordProfileScope(record, fallbackScope);
  }, []);
  const isLocalPublishedRecord = useCallback((record) => {
    const ownerId = String(record?.ownerId || '').trim();
    const isLocal = ownerId && ownerId === String(currentUserId || '').trim();
    if (!isLocal) return true;
    const profileScope = getRecordProfileScope(record);
    return Boolean(profileScope) && publishedLocalProfileScopes.has(profileScope);
  }, [currentUserId, publishedLocalProfileScopes, getRecordProfileScope]);
  const getPortfolioPartsForOwner = useCallback((ownerId, scope) => {
    const normalizedOwnerId = String(ownerId || '').trim();
    const normalizedScope = normalizeProfileScope(scope);
    if (!normalizedOwnerId || !normalizedScope) return { properties: [], services: [] };
    const properties = (showcaseProperties || []).filter((property) => (
      String(property?.ownerId || '') === normalizedOwnerId
      && getRecordProfileScope(property) === normalizedScope
      && isTruthyFlag(property?.publishToShowcase, true)
      && property?.dealClosed !== true
    ));
    const services = (servicePortfolio || []).filter((service) => (
      String(service?.ownerId || '') === normalizedOwnerId
      && getRecordProfileScope(service) === normalizedScope
      && isTruthyFlag(service?.publishToConnections, true)
    ));
    return { properties, services };
  }, [getRecordProfileScope, servicePortfolio, showcaseProperties]);
  const getPortfolioSummaryLabel = useCallback((item) => {
    const properties = Array.isArray(item?.linkedProperties) ? item.linkedProperties : [];
    const services = Array.isArray(item?.linkedServices) ? item.linkedServices : [];
    const propertyCount = properties.length;
    const serviceCount = services.length;
    if (propertyCount > 0 && serviceCount > 0) {
      return `Portfolio: ${propertyCount} ${propertyCount === 1 ? 'property' : 'properties'} + ${serviceCount} ${serviceCount === 1 ? 'service' : 'services'}`;
    }
    if (serviceCount > 0) {
      return `Portfolio: ${serviceCount} ${serviceCount === 1 ? 'service' : 'services'}`;
    }
    return tMatches.portfolioCountLabel
      .replace('{count}', String(propertyCount))
      .replace('{item}', propertyCount === 1 ? tMatches.portfolioItemOne : tMatches.portfolioItemOther);
  }, [tMatches.portfolioCountLabel, tMatches.portfolioItemOne, tMatches.portfolioItemOther]);
  const [showPeople, setShowPeople] = useState(() => initialMapUiState.showPeople ?? Boolean(preferredDefaultFilters.showPeople ?? true));
  const [showProperties, setShowProperties] = useState(() => initialMapUiState.showProperties ?? Boolean(preferredDefaultFilters.showProperties ?? true));
  const [showOnlyUnlocked, setShowOnlyUnlocked] = useState(() => initialMapUiState.showOnlyUnlocked ?? Boolean(preferredDefaultFilters.showOnlyUnlocked ?? false));
  const [showOnlyMyPins, setShowOnlyMyPins] = useState(() => initialMapUiState.showOnlyMyPins ?? Boolean(preferredDefaultFilters.showOnlyMyPins ?? false));
  const [locationMode, setLocationMode] = useState(() => (['state', 'city', 'zip'].includes(initialMapUiState.locationMode) ? initialMapUiState.locationMode : 'state'));
  const [mapStyle, setMapStyle] = useState(() => normalizeVisibleMapStyle(initialMapUiState.mapStyle || preferredMapStyle));
  const [locationQuery, setLocationQuery] = useState(() => initialMapUiState.locationQuery || '');
  const [appliedLocationQuery, setAppliedLocationQuery] = useState(() => initialMapUiState.appliedLocationQuery || '');
  // Geocode cache: persisted { cacheKey → { lat, lng, geocodeSource, geocodeConfidence } }
  // Clear stale cache on mount (v11 enforces strict ZIP/house-number acceptance).
  const [geocodeCache, setGeocodeCache] = useState(() => {
    const version = localStorage.getItem('ds_geocode_cache_v');
    if (version !== '12') {
      localStorage.removeItem(GEOCODE_CACHE_KEY);
      localStorage.setItem('ds_geocode_cache_v', '12');
      return {};
    }
    return _loadGeocodeCache();
  });
  const [pinOverrides, setPinOverrides] = useState(() => _loadPinOverrides(userProfile));
  const [panelCollapsed, setPanelCollapsed] = useState(() => {
    if (typeof initialMapUiState.panelCollapsed === 'boolean') return initialMapUiState.panelCollapsed;
    return localStorage.getItem('mapViewPanelCollapsed') === '1';
  });
  const isMobileViewport = useMediaQuery('(max-width: 900px)');
  const [panelToggleOffsetY, setPanelToggleOffsetY] = useState(() => {
    try {
      const raw = Number(localStorage.getItem('ds_map_panel_toggle_offset_y'));
      if (!Number.isFinite(raw)) return 0;
      return Math.max(-260, Math.min(260, raw));
    } catch (e) { void e; return 0; }
  });
  const [isDraggingPanelToggle, setIsDraggingPanelToggle] = useState(false);
  const panelToggleDragRef = React.useRef({ active: false, pointerId: null, startY: 0, startOffsetY: 0 });
  const panelToggleSuppressClickRef = React.useRef(false);
  const [viewport, setViewport] = useState(() => {
    // Check for a back-navigation return viewport FIRST. This is written by navigateToFeed()
    // and takes priority over all other sources so the exact PIN-zoom position is preserved.
    try {
      const returnVp = JSON.parse(localStorage.getItem('ds_map_return_viewport') || 'null');
      const sanitizedReturnVp = sanitizeViewport(returnVp, preferredInitialZoom);
      if (returnVp?.fromNav && sanitizedReturnVp) {
        localStorage.removeItem('ds_map_return_viewport');
        _navReturnViewportConsumed = true; // signal hasAutoFitRealPinsRef to skip auto-fit
        return sanitizedReturnVp;
      }
    } catch (e) { void e; }
    const savedUiViewport = sanitizeViewport(initialMapUiState.viewport, preferredInitialZoom);
    if (savedUiViewport) return savedUiViewport;
    try {
      const saved = sanitizeViewport(JSON.parse(localStorage.getItem('mapViewport') || 'null'), preferredInitialZoom);
      if (saved) return saved;
    } catch (e) {
      void e;
    }
    return {
      center: DEFAULT_CENTER,
      zoom: preferredInitialZoom,
      bounds: [-127, 24, -66, 50],
    };
  });
  const [selectedClusterLeaves, setSelectedClusterLeaves] = useState([]);
  const [selectedClusterFeatures, setSelectedClusterFeatures] = useState([]);
  const [_flyTo, _setFlyTo] = useState(null); // kept for legacy compatibility (unused)
  const mapRef = React.useRef(null);
  const [fitToBounds, setFitToBounds] = useState(() => {
    try {
      const saved = sanitizeViewport(JSON.parse(localStorage.getItem('mapViewport') || 'null'), preferredInitialZoom);
      if (saved) {
        // If a saved viewport exists, don't force-fit to the USA bounds on mount
        return null;
      }
    } catch (e) { void e; }
    return {
      bounds: DEFAULT_USA_BOUNDS,
      maxZoom: preferredInitialZoom,
      key: 'initial-usa',
    };
  });
  const [filterBounds, setFilterBounds] = useState(() => {
    return sanitizeLeafletBounds(initialMapUiState.filterBounds);
  });
  const [boundaryGeoJson, setBoundaryGeoJson] = useState(null);
  const [isBoundaryLoading, setIsBoundaryLoading] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [panelTab, setPanelTab] = useState(() => (initialMapUiState.panelTab === 'filters' ? 'filters' : 'cards'));
  const [floodOverlayOpacity, setFloodOverlayOpacity] = useState(() => {
    const val = Number(initialMapUiState.floodOverlayOpacity);
    return Number.isFinite(val) ? val : 0.65;
  });
  const [geocodeRetryTick, setGeocodeRetryTick] = useState(0);
  const [manualPinTargetId, setManualPinTargetId] = useState(null);
  const [forceSimpleBaseTiles, setForceSimpleBaseTiles] = useState(false);
  const [baseTileFallbackIndex, setBaseTileFallbackIndex] = useState(0);
  const [disabledOverlayUrls, setDisabledOverlayUrls] = useState({});
  const [femaOverlayUnavailable, setFemaOverlayUnavailable] = useState(false);
  const [mapActivationKey, setMapActivationKey] = useState(0);
  const wasActiveRef = React.useRef(isActive);
  const geocodeAttemptRef = React.useRef({});
  const lastBaseFallbackSwitchAtRef = React.useRef(0);
  const femaTileErrorStreakRef = React.useRef(0);

  React.useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      setMapActivationKey((prev) => prev + 1);
    }
    wasActiveRef.current = isActive;
  }, [isActive]);

  const commitCoordsToPortfolio = React.useCallback((property, coords, metadata = {}) => {
    if (!property?.id || typeof onUpdatePropertyCoords !== 'function') return;
    const lat = Number(coords?.lat);
    const lng = Number(coords?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    onUpdatePropertyCoords(String(property.id), {
      lat,
      lng,
      geocodeStatus: metadata.geocodeStatus || 'resolved',
      geocodeSource: metadata.geocodeSource || '',
      geocodeConfidence: metadata.geocodeConfidence ?? null,
      geocodeInput: metadata.geocodeInput || _geocodeCacheKey(property),
      geocodedAt: metadata.geocodedAt || new Date().toISOString(),
    });
  }, [onUpdatePropertyCoords]);
  
  // Resizable panel state
  const [panelWidth, setPanelWidth] = useState(() => {
    const savedUiWidth = Number(initialMapUiState.panelWidth);
    if (Number.isFinite(savedUiWidth)) return Math.max(250, Math.min(600, savedUiWidth));
    const saved = Number(localStorage.getItem('mapViewPanelWidth'));
    if (Number.isFinite(saved)) return Math.max(250, Math.min(600, saved));
    return 320;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [mapUiHydrated, setMapUiHydrated] = useState(false);
  // Start as true when returning from feed navigation so auto-fit doesn't override the restored viewport.
  const hasAutoFitRealPinsRef = React.useRef(_navReturnViewportConsumed);
  React.useEffect(() => {
    _navReturnViewportConsumed = false;
  }, []);

  const persistMapUiState = React.useCallback((overrides = {}) => {
    const snapshot = {
      showPeople,
      showProperties,
      showOnlyUnlocked,
      showOnlyMyPins,
      locationMode,
      mapStyle,
      locationQuery,
      appliedLocationQuery,
      panelTab,
      floodOverlayOpacity,
      filterBounds,
      panelCollapsed,
      panelWidth,
      viewport,
      ...overrides,
    };
    mapUiStateRef.current = snapshot;
    _saveMapUiState(snapshot);
  }, [
    showPeople,
    showProperties,
    showOnlyUnlocked,
    showOnlyMyPins,
    locationMode,
    mapStyle,
    locationQuery,
    appliedLocationQuery,
    panelTab,
    floodOverlayOpacity,
    filterBounds,
    panelCollapsed,
    panelWidth,
    viewport,
  ]);

  // Active restore pass on mount to avoid losing context after redirection/unmount cycles.
  React.useEffect(() => {
    const saved = _loadMapUiState();
    const timer = window.setTimeout(() => {
      if (!saved || typeof saved !== 'object') {
        setMapUiHydrated(true);
        return;
      }
      if (typeof saved.showPeople === 'boolean') setShowPeople(saved.showPeople);
      if (typeof saved.showProperties === 'boolean') setShowProperties(saved.showProperties);
      if (typeof saved.showOnlyUnlocked === 'boolean') setShowOnlyUnlocked(saved.showOnlyUnlocked);
      if (typeof saved.showOnlyMyPins === 'boolean') setShowOnlyMyPins(saved.showOnlyMyPins);
      if (saved.locationMode === 'state' || saved.locationMode === 'city' || saved.locationMode === 'zip') {
        setLocationMode(saved.locationMode);
      }
      if (typeof saved.mapStyle === 'string') {
        const sanitizedMapStyle = normalizeVisibleMapStyle(saved.mapStyle);
        if (MAP_STYLE_OPTIONS[sanitizedMapStyle]) setMapStyle(sanitizedMapStyle);
      }
      if (typeof saved.locationQuery === 'string') setLocationQuery(saved.locationQuery);
      if (typeof saved.appliedLocationQuery === 'string') setAppliedLocationQuery(saved.appliedLocationQuery);
      if (saved.panelTab === 'filters' || saved.panelTab === 'cards') setPanelTab(saved.panelTab);
      const floodOpacity = Number(saved.floodOverlayOpacity);
      if (Number.isFinite(floodOpacity)) setFloodOverlayOpacity(clamp(floodOpacity, 0, 1));
      const sanitizedFilterBounds = sanitizeLeafletBounds(saved.filterBounds);
      if (sanitizedFilterBounds) setFilterBounds(sanitizedFilterBounds);
      if (typeof saved.panelCollapsed === 'boolean') setPanelCollapsed(saved.panelCollapsed);
      const savedWidth = Number(saved.panelWidth);
      if (Number.isFinite(savedWidth)) setPanelWidth(Math.max(250, Math.min(600, savedWidth)));
      const sanitizedViewport = sanitizeViewport(saved.viewport, preferredInitialZoom);
      if (sanitizedViewport) setViewport(sanitizedViewport);
      mapUiStateRef.current = saved;
      setMapUiHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [preferredInitialZoom]);

  React.useEffect(() => {
    if (!mapUiHydrated) return;
    if (!showPeople && !showProperties) {
      const timer = window.setTimeout(() => setShowProperties(true), 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [mapUiHydrated, showPeople, showProperties]);

  React.useEffect(() => {
    try { localStorage.setItem('ds_map_panel_toggle_offset_y', String(panelToggleOffsetY)); } catch (e) { void e; }
  }, [panelToggleOffsetY]);

  const clampPanelToggleOffset = (value) => Math.max(-260, Math.min(260, value));

  const handlePanelTogglePointerDown = (event) => {
    if (!isMobileViewport) return;
    panelToggleSuppressClickRef.current = false;
    panelToggleDragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startY: event.clientY,
      startOffsetY: panelToggleOffsetY,
    };
    setIsDraggingPanelToggle(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePanelTogglePointerMove = (event) => {
    const dragState = panelToggleDragRef.current;
    if (!dragState.active) return;
    if (dragState.pointerId !== null && event.pointerId !== dragState.pointerId) return;
    const deltaY = event.clientY - dragState.startY;
    if (Math.abs(deltaY) > 4) panelToggleSuppressClickRef.current = true;
    setPanelToggleOffsetY(clampPanelToggleOffset(dragState.startOffsetY + deltaY));
  };

  const handlePanelTogglePointerEnd = (event) => {
    const dragState = panelToggleDragRef.current;
    if (!dragState.active) return;
    if (dragState.pointerId !== null && event.pointerId !== dragState.pointerId) return;
    panelToggleDragRef.current = { active: false, pointerId: null, startY: 0, startOffsetY: 0 };
    setIsDraggingPanelToggle(false);
  };

  const handlePanelToggleClick = () => {
    if (panelToggleSuppressClickRef.current) {
      panelToggleSuppressClickRef.current = false;
      return;
    }
    setPanelCollapsed((prev) => !prev);
  };

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      lastBaseFallbackSwitchAtRef.current = 0;
      femaTileErrorStreakRef.current = 0;
      setFemaOverlayUnavailable(false);
      setForceSimpleBaseTiles(false);
      setBaseTileFallbackIndex(0);
      setDisabledOverlayUrls({});
    }, 0);
    return () => window.clearTimeout(timer);
  }, [mapStyle]);

  const handleOverlayTileError = React.useCallback((overlay) => {
    if (!overlay?.url) return;
    if (overlay.isFemaFlood) {
      femaTileErrorStreakRef.current += 1;
      if (femaTileErrorStreakRef.current < FEMA_TILE_ERROR_STREAK_LIMIT) return;
      setFemaOverlayUnavailable(true);
    }
    setDisabledOverlayUrls((prev) => ({ ...prev, [overlay.url]: true }));
  }, []);

  const handleFemaTileLoad = React.useCallback(() => {
    // A successful tile load means the service is reachable in the current network.
    femaTileErrorStreakRef.current = 0;
    setFemaOverlayUnavailable(false);
  }, []);

  const retryFemaOverlay = React.useCallback(() => {
    femaTileErrorStreakRef.current = 0;
    setFemaOverlayUnavailable(false);
    setDisabledOverlayUrls((prev) => {
      if (!prev[FEMA_WMS_URL]) return prev;
      const next = { ...prev };
      delete next[FEMA_WMS_URL];
      return next;
    });
  }, []);

  // Persist viewport changes so current center/zoom become the default next time
  React.useEffect(() => {
    try {
      if (!viewport) return;
      localStorage.setItem('mapViewport', JSON.stringify(viewport));
    } catch (e) { void e; }
    persistMapUiState({ viewport });
  }, [viewport, persistMapUiState]);

  // Persist panel collapsed/open state.
  React.useEffect(() => {
    try {
      localStorage.setItem('mapViewPanelCollapsed', panelCollapsed ? '1' : '0');
    } catch (e) { void e; }
    persistMapUiState({ panelCollapsed });
  }, [panelCollapsed, persistMapUiState]);

  React.useEffect(() => {
    if (!mapUiHydrated) return;
    persistMapUiState();
  }, [
    persistMapUiState,
    mapUiHydrated,
    showPeople,
    showProperties,
    showOnlyUnlocked,
    showOnlyMyPins,
    locationMode,
    mapStyle,
    locationQuery,
    appliedLocationQuery,
    panelTab,
    floodOverlayOpacity,
    filterBounds,
    panelWidth,
    viewport,
    panelCollapsed,
  ]);

  React.useEffect(() => {
    return () => {
      _saveMapUiState(mapUiStateRef.current || {});
    };
  }, []);

  // Keep pin overrides scoped by the active login/user profile.
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setPinOverrides(_loadPinOverrides(userProfile));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [userProfile, userProfile?.id, userProfile?.userId, userProfile?.email, userProfile?.phone]);

  // Handle panel resize
  React.useEffect(() => {
    if (!isResizing || panelCollapsed) return;

    const handleMouseMove = (e) => {
      const newWidth = Math.max(250, Math.min(600, e.clientX - 12));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      localStorage.setItem('mapViewPanelWidth', panelWidth.toString());
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, panelWidth, panelCollapsed]);

  // Retry scheduling for geocoding pending properties (strict mode has no fake fallback).
  React.useEffect(() => {
    if (!ENABLE_CLIENT_GEOCODING) return;
    if (!showcaseProperties?.length) return;
    const cache = _loadGeocodeCache();
    const hasPending = showcaseProperties.some((property) => {
      if (!_hasGeocodeableLocation(property)) return false;
      const key = _geocodeCacheKey(property);
      if (!key) return false;
      return !cache[key];
    });
    if (!hasPending) return;

    const timer = setTimeout(() => {
      setGeocodeRetryTick((prev) => prev + 1);
    }, 6000);

    return () => clearTimeout(timer);
  }, [showcaseProperties, geocodeCache, geocodeRetryTick]);

  // Async geocode user properties that are not yet in the cache
  React.useEffect(() => {
    if (!ENABLE_CLIENT_GEOCODING) return;
    if (!showcaseProperties || !showcaseProperties.length) return;
    let cancelled = false;
    const cache = _loadGeocodeCache();
    const seenKeys = new Set();
    const now = Date.now();
    const toGeocode = showcaseProperties.filter((property) => {
      if (!_hasGeocodeableLocation(property)) return false;
      const key = _geocodeCacheKey(property);
      if (!key || seenKeys.has(key)) return false;
      if (cache[key]) return false;
      const lastAttempt = Number(geocodeAttemptRef.current[key] || 0);
      if (now - lastAttempt < 5000) return false;
      seenKeys.add(key);
      return true;
    });
    if (!toGeocode.length) return;

    (async () => {
      let updated = false;
      try {
        for (let index = 0; index < toGeocode.length; index += 1) {
          const prop = toGeocode[index];
          const cacheKey = _geocodeCacheKey(prop);
          if (cacheKey) geocodeAttemptRef.current[cacheKey] = Date.now();
          if (cancelled) break;
          const geocodeResult = await _nominatimGeocode(prop);
          if (cancelled) break;
          if (geocodeResult) {
            const coords = {
              lat: geocodeResult.lat,
              lng: geocodeResult.lng,
              geocodeSource: geocodeResult.geocodeSource,
              geocodeConfidence: geocodeResult.geocodeConfidence,
            };
            if (cacheKey) {
              cache[cacheKey] = coords;
              delete geocodeAttemptRef.current[cacheKey];
            }
            commitCoordsToPortfolio(prop, coords, {
              geocodeStatus: 'resolved',
              geocodeSource: geocodeResult.geocodeSource,
              geocodeConfidence: geocodeResult.geocodeConfidence,
              geocodeInput: cacheKey,
            });
            updated = true;
          }
          // Brief pause between requests to avoid throttling.
          if (index < toGeocode.length - 1) {
            await new Promise(r => setTimeout(r, 300));
          }
        }
        if (updated && !cancelled) {
          _saveGeocodeCache(cache);
          setGeocodeCache({ ...cache });
        }
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[MapView] Client geocode batch failed:', err.message);
      }
    })();

    return () => { cancelled = true; };
  }, [showcaseProperties, geocodeRetryTick, commitCoordsToPortfolio]);

  const points = useMemo(() => {
    const mapById = new Map();
    const seenPersonVisualKeys = new Set();
    const hasActiveSpotlightKey = (key) => {
      if (!key) return false;
      if (activeSpotlightKeys instanceof Set) return activeSpotlightKeys.has(key);
      if (Array.isArray(activeSpotlightKeys)) return activeSpotlightKeys.includes(key);
      return false;
    };

    const isPayloadSpotlight = (payload, itemType) => {
      if (!payload) return false;
      if (itemType === 'property') return Boolean(payload?.id) && hasActiveSpotlightKey(`property:${payload.id}`);
      const ownerId = String(payload.ownerId || payload.id || '').trim();
      const scope = getRecordProfileScope(payload);
      if (!ownerId || !scope) return false;
      return hasActiveSpotlightKey(`profile:${scope}:${ownerId}`)
        || (servicePortfolio || []).some((service) => (
          String(service?.ownerId || '') === ownerId
          && getRecordProfileScope(service) === scope
          && hasActiveSpotlightKey(`service:${service.id}`)
        ));
    };

    const orderMapFeatures = (features) => {
      const byPayloadId = new Map();
      const payloads = features.map((feature, index) => {
        const id = String(feature?.payload?.id ?? feature?.properties?.featureKey ?? index);
        const itemType = feature?.properties?.itemType || feature?.payload?.cardKind;
        const payload = {
          ...(feature?.payload || {}),
          id,
          cardKind: itemType,
          isOwnCard: feature?.payload?.isOwnCard === true
            || feature?.properties?.isOwn === true
            || String(feature?.payload?.ownerId || '') === String(currentUserId || ''),
          isSpotlight: feature?.payload?.isSpotlight === true || isPayloadSpotlight(feature?.payload, itemType),
        };
        byPayloadId.set(id, { ...feature, payload });
        return payload;
      });
      return orderDeck(payloads, {
        currentUserId,
        activeFilters: {
          type: showPeople && !showProperties ? 'people' : (!showPeople && showProperties ? 'properties' : 'all'),
        },
        sessionSeed: `${String(currentUserId || 'anon')}:map:${showPeople ? 'people' : ''}:${showProperties ? 'properties' : ''}`,
        sortPreference: 'default',
      }).map((payload) => byPayloadId.get(String(payload.id))).filter(Boolean);
    };

    const addMapFeature = (key, feature) => {
      if (!key || !feature?.geometry?.coordinates || !feature?.properties || !feature?.payload) return;
      const [lng, lat] = feature.geometry.coordinates;
      if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return;
      mapById.set(key, {
        ...feature,
        properties: {
          ...feature.properties,
          featureKey: key,
        },
      });
    };

    const addPersonFeature = (key, feature) => {
      const payload = feature?.payload || {};
      const ownerId = String(payload.ownerId || payload.unlockOwnerId || payload.id || feature?.properties?.itemId || '').trim();
      const name = normalizeText(payload.name || feature?.properties?.title || '');
      const loc = normalizeText(payload.loc || '');
      const type = normalizeText(payload.type || payload.cat || '');
      const visualKey = [ownerId, name, loc, type].filter(Boolean).join('|');
      if (visualKey && seenPersonVisualKeys.has(visualKey)) return;
      if (visualKey) seenPersonVisualKeys.add(visualKey);
      addMapFeature(key, feature);
    };

    const addPeople = (onlyUnlocked = false) => {
      (enableMockMapData ? CARDS : [])
        .filter((card) => (
          card.verified
          && Number.isFinite(card.lat)
          && Number.isFinite(card.lng)
          && (!onlyUnlocked || isUnlockedId(card.id))
        ))
        .forEach((card) => {
          const key = `person-${card.id}`;
          addPersonFeature(key, {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [card.lng, card.lat] },
            properties: {
              itemType: 'person',
              itemId: card.id,
              title: card.name,
              subtitle: `${card.type} · ${card.loc}`,
              locked: !isUnlockedId(card.id),
              isUnlocked: isUnlockedId(card.id),
            },
            payload: card,
          });
        });
    };

    const addPublishedPeople = (onlyUnlocked = false) => {
      const byOwner = new Map();
      (showcaseProperties || []).forEach((property) => {
        if (!isTruthyFlag(property?.publishToShowcase, true)) return;
        if (!isLocalPublishedRecord(property)) return;
        const ownerId = String(property?.ownerId || '').trim();
        const normalizedScope = getRecordProfileScope(property);
        if (!normalizedScope) return;
        const ownerPreview = property?.ownerPreview && typeof property.ownerPreview === 'object'
          ? property.ownerPreview
          : null;
        if (!ownerId || !ownerPreview?.name) return;
        if (onlyUnlocked && !isUnlockedId(ownerId)) return;
        const ownerKey = `${ownerId}:${normalizedScope}`;
        if (byOwner.has(ownerKey)) return;
        const coords = resolvePropertyDisplayCoords(property, geocodeCache, pinOverrides);
        if (!coords) return;
        byOwner.set(ownerKey, { ownerId, normalizedScope, ownerPreview, coords, property });
      });

      byOwner.forEach(({ ownerId, normalizedScope, ownerPreview, coords, property }) => {
        const key = `person-${ownerId}-${normalizedScope}`;
        if (mapById.has(key)) return;
        const linkedPortfolio = getPortfolioPartsForOwner(ownerId, normalizedScope);
        const payload = normalizeCard({
          cardKind: 'person',
          ...ownerPreview,
          id: ownerId,
          ownerId,
          primaryProfile: normalizedScope,
          lat: coords.lat,
          lng: coords.lng,
          geocodePending: Boolean(coords.isApproximate),
          portfolioCount: linkedPortfolio.properties.length + linkedPortfolio.services.length,
          ownerPreview: { ...ownerPreview, primaryProfile: normalizedScope },
          linkedProperties: linkedPortfolio.properties,
          linkedServices: linkedPortfolio.services,
        }, currentUserId);
        if (!payload) return;
        addPersonFeature(key, {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [coords.lng, coords.lat] },
          properties: {
            itemType: 'person',
            itemId: ownerId,
            title: ownerPreview.name,
            subtitle: `${ownerPreview.type || ownerPreview.cat || 'Contact'} - ${ownerPreview.loc || property?.state || ''}`,
            locked: !isUnlockedId(ownerId),
            isUnlocked: isUnlockedId(ownerId),
          },
          payload,
        });
      });
    };

    const addPublishedServicePeople = (onlyUnlocked = false) => {
      const byOwner = new Map();
      (servicePortfolio || []).forEach((service) => {
        if (!isLocalPublishedRecord(service)) return;
        const ownerId = String(service?.ownerId || '').trim();
        const ownerPreview = service?.ownerPreview && typeof service.ownerPreview === 'object'
          ? service.ownerPreview
          : null;
        const normalizedScope = getRecordProfileScope(service);
        if (!normalizedScope) return;
        if (!ownerId || !ownerPreview?.name) return;
        if (!isTruthyFlag(service?.publishToConnections, true)) return;
        if (onlyUnlocked && !isUnlockedId(ownerId)) return;
        const ownerKey = `${ownerId}:${normalizedScope}`;
        if (mapById.has(`person-${ownerId}-${normalizedScope}`) || byOwner.has(ownerKey)) return;
        const stateCode = [
          ...(Array.isArray(service?.markets) ? service.markets : []),
          ownerPreview?.loc,
          service?.state,
        ].map(getStateCodeFromMarket).find(Boolean);
        const coords = STATE_CENTER_COORDS[stateCode];
        if (!coords) return;
        byOwner.set(ownerKey, { ownerId, normalizedScope, ownerPreview, coords, stateCode, service });
      });

      byOwner.forEach(({ ownerId, normalizedScope, ownerPreview, coords, stateCode, service }) => {
        const key = `person-${ownerId}-${normalizedScope}`;
        if (mapById.has(key)) return;
        const linkedPortfolio = getPortfolioPartsForOwner(ownerId, normalizedScope);
        const payload = normalizeCard({
          cardKind: 'person',
          ...ownerPreview,
          id: ownerId,
          ownerId,
          primaryProfile: normalizedScope,
          lat: coords.lat,
          lng: coords.lng,
          loc: ownerPreview.loc || stateCode,
          portfolioCount: linkedPortfolio.properties.length + linkedPortfolio.services.length,
          ownerPreview: { ...ownerPreview, primaryProfile: normalizedScope },
          linkedProperties: linkedPortfolio.properties,
          linkedServices: linkedPortfolio.services,
        }, currentUserId);
        if (!payload) return;
        addPersonFeature(key, {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [coords.lng, coords.lat] },
          properties: {
            itemType: 'person',
            itemId: ownerId,
            title: ownerPreview.name,
            subtitle: `${ownerPreview.type || ownerPreview.cat || service?.category || 'Service'} - ${stateCode}`,
            locked: !isUnlockedId(ownerId),
            isUnlocked: isUnlockedId(ownerId),
          },
          payload,
        });
      });
    };

    const addLocalProfilePeople = (onlyUnlocked = false) => {
      const ownerId = String(currentUserId || '').trim();
      if (!ownerId) return;
      ['personal', 'professional', 'fsbo'].forEach((scope) => {
        const normalizedScope = normalizeProfileScope(scope);
        if (!publishedLocalProfileScopes.has(normalizedScope)) return;
        const linkedPropertyCount = (showcaseProperties || []).filter((property) => (
          String(property?.ownerId || '') === ownerId
          && getRecordProfileScope(property) === normalizedScope
          && isTruthyFlag(property?.publishToShowcase, true)
        )).length;
        const linkedServiceCount = (servicePortfolio || []).filter((service) => (
          String(service?.ownerId || '') === ownerId
          && getRecordProfileScope(service) === normalizedScope
          && isTruthyFlag(service?.publishToConnections, true)
        )).length;
        if (linkedPropertyCount + linkedServiceCount <= 0) return;
        if (onlyUnlocked && !isUnlockedId(ownerId)) return;

        const ownerPreview = resolveScopedProfile(normalizedScope, {
          accountType,
          userProfile,
          personalProfile,
          professionalProfile,
        });
        const name = String(ownerPreview?.name || '').trim();
        const stateCode = getStateCodeFromMarket(ownerPreview?.loc);
        const coords = STATE_CENTER_COORDS[stateCode];
        if (!name || !coords) return;
        const key = `person-${ownerId}-${normalizedScope}`;
        if (mapById.has(key)) return;
        const payload = normalizeCard({
          cardKind: 'person',
          ...ownerPreview,
          id: ownerId,
          ownerId,
          primaryProfile: normalizedScope,
          loc: stateCode,
          lat: coords.lat,
          lng: coords.lng,
          portfolioCount: linkedPropertyCount + linkedServiceCount,
          ownerPreview: { ...ownerPreview, primaryProfile: normalizedScope },
          linkedProperties: (showcaseProperties || []).filter((property) => (
            String(property?.ownerId || '') === ownerId
            && getRecordProfileScope(property) === normalizedScope
            && isTruthyFlag(property?.publishToShowcase, true)
          )),
          linkedServices: (servicePortfolio || []).filter((service) => (
            String(service?.ownerId || '') === ownerId
            && getRecordProfileScope(service) === normalizedScope
            && isTruthyFlag(service?.publishToConnections, true)
          )),
        }, currentUserId);
        if (!payload) return;
        addPersonFeature(key, {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [coords.lng, coords.lat] },
          properties: {
            itemType: 'person',
            itemId: ownerId,
            title: name,
            subtitle: `${ownerPreview?.badge || ownerPreview?.categoryLabelFallback || 'Contact'} - ${stateCode}`,
            locked: !isUnlockedId(ownerId),
            isUnlocked: isUnlockedId(ownerId),
          },
          payload,
        });
      });
    };

    const addProperties = (onlyUnlocked = false) => {
      (enableMockMapData ? PROPERTIES : [])
        .filter((property) => (
          Number.isFinite(property.lat)
          && Number.isFinite(property.lng)
          && (!onlyUnlocked || isUnlockedId(property.ownerId))
        ))
        .forEach((property) => {
          const key = `property-${property.id}`;
          addMapFeature(key, {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [property.lng, property.lat] },
            properties: {
              itemType: 'property',
              itemId: property.id,
              title: property.address,
              subtitle: `${property.type} · ${property.city}`,
              isUnlocked: isUnlockedId(property.ownerId),
            },
            payload: property,
          });
        });
    };

    // Add globally published properties while preserving their real owner.
    const addPublishedProperties = (onlyMine = false) => {
      (showcaseProperties || []).forEach((property) => {
        if (!isTruthyFlag(property?.publishToShowcase, true)) return;
        if (!isLocalPublishedRecord(property)) return;
        const isOwnProperty = String(property?.ownerId || '') === String(currentUserId || '')
          || String(property?.ownerId || '') === '999999';
        if (onlyMine && !isOwnProperty) return;
        const coords = resolvePropertyDisplayCoords(property, geocodeCache, pinOverrides);
        if (!coords) return;
        const payload = normalizeCard({
          ...property,
          cardKind: 'property',
          lat: coords.lat,
          lng: coords.lng,
          geocodePending: Boolean(coords.isApproximate),
        }, currentUserId);
        if (!payload) return;
        const key = `user-property-${property.id}`;
        if (mapById.has(key)) return;
        addMapFeature(key, {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [coords.lng, coords.lat] },
          properties: {
            itemType: 'property',
            itemId: property.id,
            title: property.address || 'Property',
            subtitle: `${property.type || 'Property'} - ${property.city || ''}`,
            isUnlocked: isOwnProperty || isUnlockedId(property.ownerId),
            isOwn: isOwnProperty,
          },
          payload,
        });
      });
    };
    if (showOnlyMyPins) {
      addPublishedProperties(true);
      return orderMapFeatures(Array.from(mapById.values()));
    }

    if (showPeople) {
      addPeople(false);
      addLocalProfilePeople(false);
      addPublishedPeople(false);
      addPublishedServicePeople(false);
    }
    if (showProperties) {
      addProperties(false);
      addPublishedProperties(false);
    }

    return orderMapFeatures(Array.from(mapById.values()));
  }, [enableMockMapData, showPeople, showProperties, showOnlyMyPins, showcaseProperties, servicePortfolio, geocodeCache, pinOverrides, isUnlockedId, currentUserId, isLocalPublishedRecord, publishedLocalProfileScopes, accountType, userProfile, personalProfile, professionalProfile, getRecordProfileScope, getPortfolioPartsForOwner, activeSpotlightKeys]);

  const realUserPoints = useMemo(() => {
    return (showcaseProperties || [])
      .filter((property) => isTruthyFlag(property?.publishToShowcase, true))
      .filter(isLocalPublishedRecord)
      .map((property) => {
        const coords = resolvePropertyDisplayCoords(property, geocodeCache, pinOverrides);
        if (!hasValidCoords(coords)) return null;
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [Number(coords.lng), Number(coords.lat)] },
          properties: {
            itemType: 'property',
            itemId: property.id,
            isOwn: String(property?.ownerId || '') === String(currentUserId || '') || String(property?.ownerId || '') === '999999',
            isUnlocked: isUnlockedId(property.ownerId),
          },
          payload: { ...property, geocodePending: Boolean(coords.isApproximate) },
        };
      })
      .filter(Boolean);
  }, [showcaseProperties, geocodeCache, pinOverrides, currentUserId, isUnlockedId, isLocalPublishedRecord]);

  const getLocationMeta = (item, isPerson) => {
    const rawLocation = isPerson ? item?.loc : item?.city;
    const { city, state: parsedState } = parseCityState(rawLocation);
    // User properties store state and zip in separate fields; mock data embeds
    // them inside the city string (e.g. "Phoenix, AZ 85001").
    const state = parsedState || String(item?.state || '').trim();
    const candidates = [item?.zip, item?.zipCode, rawLocation, item?.address]
      .map((value) => String(value || ''))
      .join(' ');
    const zipMatch = candidates.match(/\b\d{5}(?:-\d{4})?\b/);
    const zip = zipMatch ? zipMatch[0] : '';
    return { city, state, zip };
  };

  const filteredPoints = useMemo(() => {
    const query = normalizeText(appliedLocationQuery);
    const basePoints = (showOnlyUnlocked && !showOnlyMyPins)
      ? points.filter((point) => point?.properties?.isUnlocked && !point?.properties?.isOwn)
      : points;
    if (!query) return basePoints;
    return basePoints.filter((point) => {
      const isPerson = point.properties.itemType === 'person';
      const meta = getLocationMeta(point.payload, isPerson);
      return matchesLocationQuery(meta, locationMode, query);
    });
  }, [points, locationMode, appliedLocationQuery, showOnlyUnlocked, showOnlyMyPins]);

  React.useEffect(() => {
    if (showOnlyMyPins) return;
    if (showOnlyUnlocked && realUserPoints.length > 0 && filteredPoints.length === 0) {
      const timer = window.setTimeout(() => {
        setShowOnlyUnlocked(false);
        setShowProperties(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [showOnlyMyPins, showOnlyUnlocked, realUserPoints.length, filteredPoints.length]);

  React.useEffect(() => {
    if (hasAutoFitRealPinsRef.current) return;
    if (realUserPoints.length === 0) return;
    const ownBounds = buildBoundsFromPoints(realUserPoints, 'city');
    if (!ownBounds) return;
    hasAutoFitRealPinsRef.current = true;
    const timer = window.setTimeout(() => {
      setFitToBounds({
        bounds: ownBounds,
        maxZoom: 14,
        key: `real-pins-${realUserPoints.length}`,
      });
      setShowProperties(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [realUserPoints]);

  const manualPinTarget = useMemo(() => {
    if (!manualPinTargetId) return null;
    return (showcaseProperties || []).find((prop) => String(prop.id) === String(manualPinTargetId)) || null;
  }, [manualPinTargetId, showcaseProperties]);

  const applyLocationFilter = async () => {
    const nextQuery = locationQuery.trim();
    setAppliedLocationQuery(nextQuery);
    setSelectedClusterLeaves([]);
    setSelectedCardId(null);

    if (!nextQuery) {
      setFilterBounds(null);
      setBoundaryGeoJson(null);
      setFitToBounds(null);
      return;
    }

    setIsBoundaryLoading(true);
    const queryNormalized = normalizeText(nextQuery);
    const maxZoomByMode = locationMode === 'zip' ? 14 : locationMode === 'city' ? 10 : 7;

    try {
      const realBoundary = await fetchRealBoundary({ mode: locationMode, query: nextQuery });
      if (realBoundary?.bounds) {
        setFilterBounds(realBoundary.bounds);
        setBoundaryGeoJson(realBoundary.geojson || null);
        setFitToBounds({
          bounds: realBoundary.bounds,
          maxZoom: maxZoomByMode,
          key: `real-${locationMode}-${queryNormalized}`,
        });
        return;
      }
    } catch {
      // Fallback below handles offline/API failures.
    } finally {
      setIsBoundaryLoading(false);
    }

    const fallbackPoints = points.filter((point) => {
      if (!queryNormalized) return true;
      const isPerson = point.properties.itemType === 'person';
      const meta = getLocationMeta(point.payload, isPerson);
      return matchesLocationQuery(meta, locationMode, queryNormalized);
    });

    if (!fallbackPoints.length) {
      setFilterBounds(null);
      setBoundaryGeoJson(null);
      setFitToBounds(null);
      return;
    }

    const fallbackBounds = buildBoundsFromPoints(fallbackPoints, locationMode);
    if (!fallbackBounds) return;
    setFilterBounds(fallbackBounds);
    setBoundaryGeoJson(null);
    setFitToBounds({
      bounds: fallbackBounds,
      maxZoom: maxZoomByMode,
      key: `fallback-${locationMode}-${queryNormalized}-${fallbackPoints.length}`,
    });
  };

  const clusterIndex = useMemo(() => {
    const idx = new Supercluster({
      radius: 60,
      maxZoom: 16,
      map: (props) => ({
        peopleCount: props.itemType === 'person' ? 1 : 0,
        propertiesCount: props.itemType === 'property' ? 1 : 0,
        unlockedCount: props.isUnlocked ? 1 : 0,
      }),
      reduce: (accumulated, props) => {
        accumulated.peopleCount += props.peopleCount;
        accumulated.propertiesCount += props.propertiesCount;
        accumulated.unlockedCount += props.unlockedCount;
      },
    });
    idx.load(filteredPoints);
    return idx;
  }, [filteredPoints]);

  const clusters = useMemo(() => {
    if (!viewport?.bounds) return [];
    const roundedZoom = Math.round(viewport.zoom || DEFAULT_ZOOM);
    if (roundedZoom >= CLUSTER_BREAKOUT_ZOOM) return filteredPoints;
    return clusterIndex.getClusters(viewport.bounds, roundedZoom);
  }, [clusterIndex, filteredPoints, viewport]);

  const unclusteredSpreadPoints = useMemo(() => {
    const roundedZoom = Math.round(viewport?.zoom || DEFAULT_ZOOM);
    const zoomOffset = roundedZoom >= 14 ? 0.00028 : 0.00045;
    return spreadCoincidentFeatures(filteredPoints, zoomOffset);
  }, [filteredPoints, viewport?.zoom]);

  // While a card is selected, render unclustered points so the dedicated pin is always visible.
  const renderedFeatures = useMemo(() => {
    const roundedZoom = Math.round(viewport?.zoom || DEFAULT_ZOOM);
    if (selectedClusterFeatures.length > 0) {
      // Keep opened cluster in pin mode (no sub-clusters) after the second click.
      return spreadCoincidentFeatures(selectedClusterFeatures, 0.00045);
    }
    if (selectedCardId != null) return unclusteredSpreadPoints;
    if (preferredClusterBehavior === 'pins_city' && roundedZoom >= CLUSTER_BREAKOUT_ZOOM) return unclusteredSpreadPoints;
    return clusters;
  }, [selectedClusterFeatures, selectedCardId, unclusteredSpreadPoints, clusters, viewport?.zoom, preferredClusterBehavior]);

  const safeRenderedFeatures = useMemo(() => (
    (Array.isArray(renderedFeatures) ? renderedFeatures : []).filter((feature) => {
      const coords = feature?.geometry?.coordinates;
      const props = feature?.properties || {};
      if (!Array.isArray(coords) || coords.length < 2) return false;
      const [lng, lat] = coords;
      if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return false;
      if (props.cluster) return props.cluster_id != null || props.point_count > 0;
      return Boolean(props.itemType && props.itemId != null && feature?.payload);
    })
  ), [renderedFeatures]);

  const safeViewportCenter = sanitizeLatLngPair(viewport?.center) || DEFAULT_CENTER;
  const safeViewportZoomRaw = Number(viewport?.zoom);
  const safeViewportZoom = Number.isFinite(safeViewportZoomRaw) ? clamp(safeViewportZoomRaw, 2, 19) : preferredInitialZoom;

  React.useEffect(() => {
    if (!selectedClusterFeatures.length) return;
    const roundedZoom = Math.round(viewport?.zoom || DEFAULT_ZOOM);
    // Exit explicit opened-cluster pin mode only after zooming OUT below city level.
    if (roundedZoom < CLUSTER_BREAKOUT_ZOOM) {
      const timer = window.setTimeout(() => {
        setSelectedClusterFeatures([]);
        setSelectedClusterLeaves([]);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [selectedClusterFeatures.length, viewport?.zoom]);

  const hasSpotlightKey = React.useCallback((key) => {
    if (!key) return false;
    if (activeSpotlightKeys instanceof Set) return activeSpotlightKeys.has(key);
    if (Array.isArray(activeSpotlightKeys)) return activeSpotlightKeys.includes(key);
    return false;
  }, [activeSpotlightKeys]);

  const getMapItemType = React.useCallback((item) => {
    const kind = String(item?.cardKind || item?.itemType || item?.typeKind || '').trim().toLowerCase();
    if (kind === 'person' || kind === 'profile' || kind === 'contact') return 'person';
    if (kind === 'property' || kind === 'deal') return 'property';
    if (kind === 'service') return 'service';
    if (Array.isArray(item?.linkedProperties) || Array.isArray(item?.linkedServices) || item?.ownerPreview) return 'person';
    if (item?.address || item?.price != null || Array.isArray(item?.images)) return 'property';
    return item?.loc ? 'person' : 'property';
  }, []);

  const isSpotlightItem = React.useCallback((item) => {
    if (!item) return false;
    if (item?.isSpotlight === true || item?.activeSpotlight === true) return true;
    const itemType = getMapItemType(item);
    if (itemType === 'property') {
      const propertyId = String(item?.id || item?.propertyId || item?.cardId || '').trim();
      return Boolean(propertyId) && hasSpotlightKey(`property:${propertyId}`);
    }
    if (itemType === 'service') {
      const serviceId = String(item?.id || item?.serviceId || item?.cardId || '').trim();
      if (serviceId && hasSpotlightKey(`service:${serviceId}`)) return true;
    }
    const ownerId = String(item.ownerId || item.id || '').trim();
    const scope = getRecordProfileScope(item);
    if (!ownerId || !scope) return false;
    return hasSpotlightKey(`profile:${scope}:${ownerId}`)
      || (servicePortfolio || []).some((service) => (
        String(service?.ownerId || '') === ownerId
        && getRecordProfileScope(service) === scope
        && hasSpotlightKey(`service:${service.id}`)
      ));
  }, [getMapItemType, getRecordProfileScope, hasSpotlightKey, servicePortfolio]);

  const spotlightProfileItems = useMemo(() => {
    const byProfile = new Map();
    const addProfileCandidate = (source) => {
      if (!source || !isLocalPublishedRecord(source)) return;
      const ownerId = String(source?.ownerId || '').trim();
      const scope = getRecordProfileScope(source);
      const ownerPreview = source?.ownerPreview && typeof source.ownerPreview === 'object'
        ? source.ownerPreview
        : null;
      if (!ownerId || !scope || !ownerPreview?.name) return;

      const sourceIsService = getMapItemType(source) === 'service' || Boolean(source?.serviceId || source?.category);
      const hasProfileSpotlight = hasSpotlightKey(`profile:${scope}:${ownerId}`);
      const hasServiceSpotlight = sourceIsService && Boolean(source?.id) && hasSpotlightKey(`service:${source.id}`);
      if (!hasProfileSpotlight && !hasServiceSpotlight) return;

      const key = `${ownerId}:${scope}`;
      if (byProfile.has(key)) return;

      const linkedPortfolio = getPortfolioPartsForOwner(ownerId, scope);
      const pointMatch = points.find((point) => (
        point?.properties?.itemType === 'person'
        && String(point?.payload?.ownerId || point?.payload?.id || '') === ownerId
        && getRecordProfileScope(point?.payload) === scope
      ));
      const propertyWithCoords = linkedPortfolio.properties
        .map((property) => resolvePropertyDisplayCoords(property, geocodeCache, pinOverrides))
        .find(Boolean);
      const stateCode = [
        pointMatch?.payload?.loc,
        ownerPreview?.loc,
        source?.state,
        ...(Array.isArray(source?.markets) ? source.markets : []),
      ].map(getStateCodeFromMarket).find(Boolean);
      const fallbackCoords = stateCode ? STATE_CENTER_COORDS[stateCode] : null;
      const [pointLng, pointLat] = pointMatch?.geometry?.coordinates || [];
      const coords = Number.isFinite(pointLat) && Number.isFinite(pointLng)
        ? { lat: pointLat, lng: pointLng }
        : (propertyWithCoords || fallbackCoords || null);

      const item = normalizeCard({
        cardKind: 'person',
        ...ownerPreview,
        id: ownerId,
        ownerId,
        primaryProfile: scope,
        loc: ownerPreview.loc || stateCode || '',
        lat: coords?.lat,
        lng: coords?.lng,
        portfolioCount: linkedPortfolio.properties.length + linkedPortfolio.services.length,
        ownerPreview: { ...ownerPreview, primaryProfile: scope },
        linkedProperties: linkedPortfolio.properties,
        linkedServices: linkedPortfolio.services,
        isSpotlight: true,
      }, currentUserId);
      if (item) byProfile.set(key, item);
    };

    (showcaseProperties || []).forEach(addProfileCandidate);
    (servicePortfolio || []).forEach(addProfileCandidate);
    return [...byProfile.values()];
  }, [
    currentUserId,
    geocodeCache,
    getMapItemType,
    getPortfolioPartsForOwner,
    getRecordProfileScope,
    hasSpotlightKey,
    isLocalPublishedRecord,
    pinOverrides,
    points,
    servicePortfolio,
    showcaseProperties,
  ]);

  const spotlightPropertyItems = useMemo(() => {
    return (showcaseProperties || [])
      .filter((property) => (
        isTruthyFlag(property?.publishToShowcase, true)
        && isLocalPublishedRecord(property)
        && isSpotlightItem(property)
      ))
      .map((property) => {
        const coords = resolvePropertyCoords(property, geocodeCache, pinOverrides);
        if (!coords) return null;
        return normalizeCard({
          ...property,
          cardKind: 'property',
          lat: coords?.lat,
          lng: coords?.lng,
          geocodePending: false,
          isSpotlight: true,
        }, currentUserId);
      })
      .filter(Boolean);
  }, [currentUserId, geocodeCache, isLocalPublishedRecord, isSpotlightItem, pinOverrides, showcaseProperties]);

  const spotlightVisibleItems = useMemo(() => {
    const byKey = new Map();
    [
      ...points.map((point) => point?.payload),
      ...spotlightPropertyItems,
      ...spotlightProfileItems,
    ]
      .filter(isSpotlightItem)
      .forEach((item) => {
        const itemType = getMapItemType(item);
        const scope = getRecordProfileScope(item);
        const key = `${itemType}:${scope || 'any'}:${item?.id || item?.ownerId || item?.cardId || item?.propertyId || item?.serviceId || byKey.size}`;
        if (!byKey.has(key)) byKey.set(key, item);
      });
    return [...byKey.values()];
  }, [getMapItemType, getRecordProfileScope, isSpotlightItem, points, spotlightProfileItems, spotlightPropertyItems]);
  const spotlightNoPinProperties = useMemo(() => {
    return (showcaseProperties || []).filter((prop) => (
      isTruthyFlag(prop?.publishToShowcase, true)
      && isLocalPublishedRecord(prop)
      && isSpotlightItem(prop)
      && !resolvePropertyCoords(prop, geocodeCache, pinOverrides)
    ));
  }, [geocodeCache, isLocalPublishedRecord, isSpotlightItem, pinOverrides, showcaseProperties]);
  const spotlightPanelCount = spotlightVisibleItems.length + spotlightNoPinProperties.length;

  const openCluster = (clusterFeature) => {
    const clusterId = clusterFeature.properties.cluster_id;
    const rawLeaves = clusterIndex.getLeaves(clusterId, Infinity, 0);
    const leavePayloads = rawLeaves.map((leaf) => leaf.payload).filter(Boolean);
    setSelectedClusterLeaves(leavePayloads);
    setSelectedClusterFeatures(rawLeaves);
    setSelectedCardId(null);
    setPanelTab('cards');
    const currentZoom = Number(mapRef.current?.getZoom?.() ?? viewport?.zoom ?? DEFAULT_ZOOM);
    const shouldBreakoutToPins = currentZoom >= CLUSTER_CITY_LEVEL_MAX_ZOOM;

    // On closer zoom (second click feel), break out to individual pins immediately.
    if (shouldBreakoutToPins) {
      const spreadLeaves = spreadCoincidentFeatures(rawLeaves, 0.00045);
      const spreadBounds = buildBoundsFromPoints(spreadLeaves, 'city');
      mapRef.current?.stop();
      if (spreadBounds) {
        mapRef.current?.flyToBounds(spreadBounds, { padding: [36, 36], maxZoom: CLUSTER_BREAKOUT_ZOOM + 1, ...FLY_OPTIONS });
      } else {
        const [lng, lat] = clusterFeature.geometry.coordinates;
        mapRef.current?.flyTo([lat, lng], CLUSTER_BREAKOUT_ZOOM + 1, FLY_OPTIONS);
      }
      return;
    }

    // First click behavior: keep city-level consolidation, only spread clusters.
    const clusterBounds = buildBoundsFromPoints(rawLeaves, 'city');
    if (clusterBounds) {
      mapRef.current?.stop();
      mapRef.current?.flyToBounds(clusterBounds, { padding: [36, 36], maxZoom: CLUSTER_CITY_LEVEL_MAX_ZOOM, ...FLY_OPTIONS });
    } else {
      const [lng, lat] = clusterFeature.geometry.coordinates;
      const expansionZoom = Math.min(clusterIndex.getClusterExpansionZoom(clusterId), CLUSTER_CITY_LEVEL_MAX_ZOOM);
      mapRef.current?.stop();
      mapRef.current?.flyTo([lat, lng], expansionZoom, FLY_OPTIONS);
    }
  };

  const clearClusterSelection = () => {
    setSelectedClusterLeaves([]);
    setSelectedClusterFeatures([]);
  };

  React.useEffect(() => {
    if (!selectedClusterFeatures.length && !selectedClusterLeaves.length) return;
    const timer = window.setTimeout(() => {
      clearClusterSelection();
      setSelectedCardId(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    showPeople,
    showProperties,
    showOnlyUnlocked,
    showOnlyMyPins,
    locationMode,
    appliedLocationQuery,
    selectedClusterFeatures.length,
    selectedClusterLeaves.length,
  ]);

  const startManualPinPlacement = (property) => {
    if (!property?.id) return;
    clearClusterSelection();
    setSelectedCardId(null);
    setManualPinTargetId(String(property.id));
    setPanelTab('cards');
  };

  const applyManualPinPlacement = ({ lat, lng }) => {
    if (!manualPinTarget?.id) return;
    const propId = String(manualPinTarget.id);
    const updated = { ...pinOverrides, [propId]: { lat, lng } };
    setPinOverrides(updated);
    _savePinOverrides(updated, userProfile);
    commitCoordsToPortfolio(manualPinTarget, { lat, lng }, {
      geocodeStatus: 'manual',
      geocodeSource: 'manual',
      geocodeConfidence: 1,
    });
    setManualPinTargetId(null);
    setSelectedCardId(manualPinTarget.id);
    mapRef.current?.flyTo([lat, lng], 16, FLY_OPTIONS);
  };

  const resetToDefaultUsaView = () => {
    clearClusterSelection();
    setSelectedCardId(null);
    setMapStyle('simple');
    setFitToBounds({
      bounds: DEFAULT_USA_BOUNDS,
      maxZoom: DEFAULT_ZOOM,
      key: genId(),
    });
  };

  const getCardCoordinates = (card) => {
    if (Number.isFinite(card?.lat) && Number.isFinite(card?.lng)) {
      return { lat: card.lat, lng: card.lng };
    }

    const isPerson = getMapItemType(card) === 'person';
    const match = filteredPoints.find((point) => (
      point?.properties?.itemType === (isPerson ? 'person' : 'property')
      && point?.properties?.itemId === card?.id
    ));

    if (!match?.geometry?.coordinates || match.geometry.coordinates.length < 2) {
      return null;
    }

    const [lng, lat] = match.geometry.coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  };

  const zoomToCard = (card) => {
    const coords = getCardCoordinates(card);
    if (!coords) return;
    clearClusterSelection();
    setSelectedCardId(card.id);
    setPanelTab('cards');
    // Em mobile, esconde o panel para o usuário ver o mapa ao clicar num card
    if (isMobileViewport) setPanelCollapsed(true);
    // Stop any in-progress animation first so rapid card clicks don't pile up
    mapRef.current?.stop();
    // Use snappy options for card-to-card hops (shorter, more linear)
    mapRef.current?.flyTo([coords.lat, coords.lng], 17, FLY_OPTIONS_SNAP);
  };

  // Em mobile, fecha o painel antes de abrir qualquer modal/popup de compra ou desbloqueio
  const handleOpenUnlock = (item) => {
    if (isMobileViewport) setPanelCollapsed(true);
    openUnlock(item);
  };
  const handleSetModal = (val) => {
    if (isMobileViewport) setPanelCollapsed(true);
    setModal(val);
  };

  const navigateToFeed = (card, explicitType) => {
    const cardType = explicitType || getMapItemType(card);
    const focusPayload = {
      id: card?.id,
      type: cardType,
      ownerId: card?.ownerId || card?.unlockOwnerId || card?.sellerId || '',
      unlockOwnerId: card?.unlockOwnerId || card?.ownerId || card?.sellerId || '',
      propertyId: cardType === 'property' ? (card?.propertyId || card?.id || '') : (card?.propertyId || ''),
      sourceCardId: card?.sourceCardId || card?.cardId || '',
      primaryProfile: card?.primaryProfile || card?.scope || '',
      scope: card?.scope || card?.primaryProfile || '',
      fromMapPin: true,
    };
    persistMapUiState();
    // Save a dedicated return-viewport key so the map restores the exact position on back-navigation,
    // independent of any geographic filters that may trigger fitToBounds on remount.
    try {
      localStorage.setItem('ds_map_return_viewport', JSON.stringify({ ...viewport, fromNav: true }));
    } catch (e) { void e; }
    try {
      localStorage.setItem('focusCard', JSON.stringify(focusPayload));
    } catch {
      // ignore
    }
    try {
      const ev = new CustomEvent('dealsifter.focusCard', { detail: focusPayload });
      window.dispatchEvent(ev);
    } catch {
      // ignore
    }
    setSelectedCardId(card.id);
    setPage('dashboard');
  };

  const unlockPropertySource = useMemo(() => {
    const byId = new Map();
    [...(propertyPortfolio || []), ...(showcaseProperties || []), ...(enableMockMapData ? (PROPERTIES || []) : [])].forEach((property, idx) => {
      if (!property) return;
      const key = String(property.id || property.portfolioId || `${property.ownerId || 'owner'}:${idx}`);
      if (!byId.has(key)) byId.set(key, property);
    });
    return Array.from(byId.values());
  }, [enableMockMapData, propertyPortfolio, showcaseProperties]);

  const getUnlockCost = (personId) => {
    return getPortfolioUnlockCost(personId, unlockPropertySource, servicePortfolio || []);
  };

  const activeMapStyle = useMemo(() => {
    const baseStyle = MAP_STYLE_OPTIONS[mapStyle] || MAP_STYLE_OPTIONS.simple;
    if (mapStyle !== 'flood') return baseStyle;
    // Apply user-controlled opacity to the FEMA NFHL overlay
    return {
      ...baseStyle,
      overlays: (baseStyle.overlays || []).map((overlay) =>
        overlay.isFemaFlood ? { ...overlay, opacity: floodOverlayOpacity } : overlay
      ),
    };
  }, [mapStyle, floodOverlayOpacity]);

  const effectiveMapStyle = useMemo(() => (
    forceSimpleBaseTiles
      ? {
          ...MAP_STYLE_OPTIONS.simple,
          url: BASE_TILE_FALLBACK_CHAIN[baseTileFallbackIndex]?.url || MAP_STYLE_OPTIONS.simple.url,
          attribution: BASE_TILE_FALLBACK_CHAIN[baseTileFallbackIndex]?.attribution || MAP_STYLE_OPTIONS.simple.attribution,
        }
      : activeMapStyle
  ), [forceSimpleBaseTiles, baseTileFallbackIndex, activeMapStyle]);

  const effectiveOverlays = useMemo(() => (
    (effectiveMapStyle.overlays || []).filter((overlay) => !disabledOverlayUrls?.[overlay.url])
  ), [effectiveMapStyle, disabledOverlayUrls]);

  const mapStyleLabels = useMemo(() => ({
    simple: tMap.styleSimple,
    satellite_streets: tMap.styleSatelliteStreets,
    topo: tMap.styleTopo,
    flood: tMap.styleFlood,
  }), [tMap]);
  const visibleMapStyleEntries = useMemo(() => (
    PUBLIC_MAP_STYLE_KEYS.map((styleKey) => [styleKey, MAP_STYLE_OPTIONS[styleKey]]).filter(([, cfg]) => Boolean(cfg))
  ), []);

  const panelOpenWidth = isMobileViewport ? 'min(92vw, 390px)' : `${panelWidth}px`;
  const panelToggleLeft = panelCollapsed
    ? '0px'
    : (isMobileViewport ? '0px' : `${panelWidth}px`);

  return (
    <div style={{ paddingTop: 58, height: 'calc(var(--app-vh, 1vh) * 100)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .map-layout {
          height: calc((var(--app-vh, 1vh) * 100) - 58px);
          --ds-map-bottom-offset: var(--ds-mobile-bottom-nav-visible-height, 0px);
          padding: 0;
          position: relative;
          overflow: hidden;
        }
        .map-panel { border: 1px solid var(--ui-border); border-radius: 0; background: var(--ui-surface); }
        .map-panel {
          position: absolute;
          left: 0;
          top: 0;
          bottom: var(--ds-map-bottom-offset);
          z-index: 12050;
          width: ${panelCollapsed ? '0px' : panelOpenWidth};
          padding: ${panelCollapsed ? 0 : 12}px;
          border-width: ${panelCollapsed ? 0 : 1}px;
          margin-right: 0;
          background: var(--ui-surface);
          color: ${C.t2};
          font-weight: 400;
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
          opacity: ${panelCollapsed ? 0 : 1};
          pointer-events: ${panelCollapsed ? 'none' : 'auto'};
          box-shadow: 0 8px 24px ${C.alpha(C.bg, 0.16)};
          transform: translateX(${panelCollapsed ? '-6px' : '0'});
          will-change: width, padding, border-width, opacity, transform;
          transition:
            width .28s cubic-bezier(.22, .8, .22, 1),
            padding .28s cubic-bezier(.22, .8, .22, 1),
            border-width .28s cubic-bezier(.22, .8, .22, 1),
            opacity .2s ease,
            transform .28s cubic-bezier(.22, .8, .22, 1);
        }
        .map-panel-toggle-tab {
          position: absolute;
          left: ${panelToggleLeft};
          top: 10px;
          z-index: 12060;
          width: 22px;
          height: 56px;
          border: 1px solid var(--ui-border);
          border-left: none;
          border-top-right-radius: 10px;
          border-bottom-right-radius: 10px;
          background: var(--ui-surface);
          color: ${C.t2};
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: grab;
          touch-action: none;
          box-shadow: ${panelCollapsed ? `0 10px 22px ${C.alpha(C.bg, 0.22)}` : `0 4px 12px ${C.alpha(C.bg, 0.08)}`};
          transition:
            left .28s cubic-bezier(.22, .8, .22, 1),
            background .15s ease,
            color .15s ease,
            box-shadow .25s ease,
            transform .2s ease;
        }
        .map-panel-toggle-tab.is-dragging {
          cursor: grabbing;
          transition: none;
        }
        .map-panel-mobile-overlay {
          position: absolute;
          inset: 0;
          z-index: 12040;
          border: none;
          background: rgba(8, 15, 28, 0.28);
          padding: 0;
          cursor: pointer;
        }
        .map-panel-toggle-tab:hover {
          background: var(--ui-hover);
          color: ${C.t1};
          transform: translateX(1px);
          box-shadow: 0 12px 26px ${C.alpha(C.bg, 0.26)};
        }
        .map-panel-header { display:flex; align-items:center; justify-content:space-between; margin-bottom: 10px; }
        .map-panel-tabs {
          display: flex;
          gap: 4px;
          margin-bottom: 12px;
          padding-bottom: 2px;
          border-bottom: 1px solid var(--ui-border);
        }
        .map-panel-tab {
          flex: 1;
          padding: 8px 14px 7px;
          border-top-left-radius: 10px;
          border-top-right-radius: 10px;
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
          border: 1px solid transparent;
          border-bottom: 1px solid transparent;
          background: var(--ui-hover);
          color: ${C.t2};
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          margin-bottom: -3px;
          transition: all .15s ease;
        }
        .map-panel-tab.active {
          border-color: var(--ui-border);
          border-bottom-color: var(--ui-surface);
          background: var(--ui-surface);
          color: ${C.t1};
          box-shadow: inset 0 2px 0 var(--ui-active);
        }
        .map-section-card { margin-bottom: 10px; border: 1px solid var(--ui-border-soft); border-radius: 10px; padding: 10px; background: var(--ui-surface); }
        .map-list-scroll { flex: 1; min-height: 0; overflow: auto; padding-right: 2px; padding-bottom: 4px; }
        .map-resize-handle { 
          position: absolute; 
          left: ${panelWidth}px; 
          top: 0; 
          bottom: var(--ds-map-bottom-offset); 
          width: 4px; 
          cursor: col-resize; 
          z-index: 12045;
          transition: background 0.15s;
        }
        .map-resize-handle:hover, .map-resize-handle.active { 
          background: ${C.accent}; 
        }
        .map-resize-handle::after {
          content: '';
          position: absolute;
          left: -4px;
          right: -4px;
          top: 0;
          bottom: 0;
        }
        ${isResizing ? 'body { cursor: col-resize !important; user-select: none; }' : ''}
        ${panelCollapsed ? '.map-resize-handle { display: none; }' : ''}
        .map-canvas-card {
          overflow: hidden;
          position: relative;
          z-index: 1;
          width: 100%;
          height: 100%;
          border: none;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
        }
        .map-canvas { height: 100%; width: 100%; }
        .map-pin-wrapper { filter: drop-shadow(0 4px 12px rgba(0,0,0,0.25)); }
        .map-cluster { border-radius: 999px; background: linear-gradient(145deg, ${C.gold}, ${C.goldL}); color: ${C.bg}; border: 2px solid #fff; box-shadow: 0 8px 20px rgba(0,0,0,.25); display:flex; flex-direction:column; align-items:center; justify-content:center; line-height:1.15; padding: 4px; }
        .map-cluster-unlocked { background: linear-gradient(145deg, ${C.success}, #75ba75); }
        .map-cluster-total { font-size: var(--cluster-total-size, 14px); font-weight: 700; letter-spacing: -0.2px; line-height: 1; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .map-cluster-breakdown { font-size: var(--cluster-breakdown-size, 8px); opacity: .95; margin-top: 2px; line-height: 1; max-width: calc(100% - 8px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .map-chip, .map-filter-mode { border: 1px solid var(--ui-border); border-radius: 999px; padding: 6px 10px; background: var(--ui-surface); color: ${C.t2}; cursor: pointer; font-size: 12px; font-weight: 400; transition: all .15s ease; min-height: 30px; line-height: 1.15; }
        .map-chip:hover, .map-filter-mode:hover { border-color: var(--ui-border); color: ${C.t1}; background: var(--ui-hover); }
        .map-panel-tab:hover { color: ${C.t1}; background: var(--ui-hover); }
        .map-chip-active, .map-filter-mode-active { background: var(--ui-surface); border-color: var(--ui-active); color: var(--ui-active); font-weight: 600; }
        .map-chip-active:hover, .map-filter-mode-active:hover { background: var(--ui-hover); }
        .map-panel-tab.active:hover { background: var(--ui-surface); }
        .map-chip-row-main {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
          align-items: center;
        }
        .map-chip-row-main .map-chip {
          width: 100%;
          min-width: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 7px 8px;
          font-size: 11px;
          white-space: normal;
          overflow: visible;
          text-overflow: clip;
          word-break: normal;
          hyphens: auto;
        }
        .map-list-item {
          border-radius: 10px;
          padding: 10px;
          margin-bottom: 8px;
          /* layered background to render a gradient border while keeping the inner surface color */
          border: 2px solid transparent;
          background-image: linear-gradient(var(--ui-surface), var(--ui-surface)), linear-gradient(to bottom, var(--map-top, #4280ba), var(--map-bottom, #28324b));
          background-origin: border-box;
          background-clip: padding-box, border-box;
        }
        .map-list-thumb { width: 40px; height: 40px; object-fit: cover; flex-shrink: 0; }
        .person-thumb { border-radius: 999px; }
        .property-thumb { border-radius: 8px; }
        .map-item-type-pill { border: 1px solid transparent; background: var(--ui-surface); border-radius: 999px; padding: 2px 8px; font-size: 11px; font-weight: 700; white-space: nowrap; display: inline-flex; align-items: center; line-height: 1; }
        .person-pill { border-color: var(--ui-active); color: var(--ui-active); }
        .property-pill { border-color: #4381bc; color: #4381bc; }
        .map-filter-input { width: 100%; border: 1px solid var(--ui-border); border-radius: 9px; padding: 8px 10px; background: var(--ui-surface); color: ${C.t1}; font-size: 12px; outline: none; }
        .map-filter-input:focus { border-color: var(--ui-active); box-shadow: 0 0 0 1px var(--ui-active); }
        .map-canvas .leaflet-control-zoom a {
          color: ${C.t1} !important;
          background: var(--ui-surface) !important;
          border-color: var(--ui-border) !important;
        }
        .map-canvas .leaflet-control-zoom a:hover {
          background: var(--ui-hover) !important;
          color: ${C.t1} !important;
        }
        .map-canvas .leaflet-bar {
          border-color: var(--ui-border) !important;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.24);
        }
        .leaflet-popup-content-wrapper {
          border-radius: 12px;
          max-width: min(332px, calc(100vw - 40px));
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
        }
        .leaflet-popup-content {
          margin: 10px;
          max-width: min(312px, calc(100vw - 60px));
          overflow: hidden;
        }
        .leaflet-popup-content img {
          max-width: 100%;
          height: auto;
        }
        .ds-map-popup-card {
          width: min(304px, calc(100vw - 70px));
          display: grid;
          gap: 8px;
          color: ${C.t1};
          font-family: inherit;
          -webkit-font-smoothing: antialiased;
          text-rendering: optimizeLegibility;
        }
        .ds-map-popup-head {
          display: flex;
          gap: 10px;
          align-items: center;
          min-width: 0;
        }
        .ds-map-popup-avatar {
          width: 48px;
          height: 48px;
          border-radius: 999px;
          flex: 0 0 auto;
          object-fit: cover;
        }
        .ds-map-popup-thumb {
          width: 102px;
          height: 74px;
          border-radius: 8px;
          flex: 0 0 auto;
          object-fit: cover;
        }
        .ds-map-popup-title {
          font-size: 12px;
          font-weight: 800;
          font-family: "Arial Narrow", "Helvetica Neue", Arial, sans-serif;
          letter-spacing: 0.1px;
          line-height: 1.2;
          color: #1f2937;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          word-break: break-word;
        }
        .ds-map-popup-subtitle {
          font-size: 12px;
          color: ${C.t2};
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .ds-map-popup-meta {
          margin-top: 2px;
          font-size: 12px;
          color: #111827;
          font-weight: 700;
          letter-spacing: 0.1px;
        }
        .ds-map-popup-cta {
          margin-top: 2px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: ${C.accent};
          font-weight: 700;
          letter-spacing: 0.2px;
        }
        @keyframes ds-geocode-spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes ds-geocode-blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        .ds-geocode-pending-section-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #e53e3e;
          margin-top: 12px;
          margin-bottom: 6px;
          padding-left: 2px;
        }
        .ds-geocode-sync-icon {
          position: absolute;
          top: 6px;
          right: 6px;
          width: 18px;
          height: 18px;
          animation: ds-geocode-spin 1s linear infinite, ds-geocode-blink 1s step-start infinite;
          color: #e53e3e;
          pointer-events: none;
          z-index: 2;
        }
        @media (max-width: 900px) {
          .map-layout {
            --ds-map-mobile-bottom-offset: var(--ds-mobile-bottom-nav-visible-height, 0px);
            height: calc((var(--app-vh, 1vh) * 100) - 58px);
          }
          .map-panel {
            max-height: none;
            height: auto;
            bottom: var(--ds-map-mobile-bottom-offset);
            margin-right: 0;
            box-shadow: 10px 0 28px ${C.alpha(C.bg, 0.24)};
          }
          .map-panel-mobile-overlay {
            bottom: var(--ds-map-mobile-bottom-offset);
          }
          .map-resize-handle { display: none; }
          .map-panel-toggle-tab {
            display: flex;
            left: 0;
            top: 50%;
            width: 24px;
            height: 62px;
            transform: translateY(-50%);
            border-left: none;
            border-top-left-radius: 0;
            border-bottom-left-radius: 0;
            border-top-right-radius: 10px;
            border-bottom-right-radius: 10px;
            box-shadow: 0 10px 24px ${C.alpha(C.bg, 0.24)};
          }
          .map-panel-toggle-tab:hover {
            transform: translateY(-50%);
          }
        }
      `}</style>

      <div className="map-layout">
        {isMobileViewport && !panelCollapsed && (
          <button
            className="map-panel-mobile-overlay"
            type="button"
            onClick={() => setPanelCollapsed(true)}
            aria-label={tMap.closePanel}
          />
        )}
        {!(isMobileViewport && !panelCollapsed) && (
          <button
            className={`map-panel-toggle-tab ${isDraggingPanelToggle ? 'is-dragging' : ''}`}
            onClick={handlePanelToggleClick}
            onPointerDown={handlePanelTogglePointerDown}
            onPointerMove={handlePanelTogglePointerMove}
            onPointerUp={handlePanelTogglePointerEnd}
            onPointerCancel={handlePanelTogglePointerEnd}
            aria-label={panelCollapsed ? tMap.openPanel : tMap.closePanel}
            title={panelCollapsed ? tMap.openPanel : tMap.closePanel}
            aria-expanded={!panelCollapsed}
            style={isMobileViewport ? { top: `calc(50% + ${panelToggleOffsetY}px)` } : undefined}
          >
            <Icon name="filter" size={14} color={C.t2} strokeWidth={1.9} />
          </button>
        )}
        <div 
          className={`map-resize-handle ${isResizing ? 'active' : ''}`}
          onMouseDown={() => {
            if (!panelCollapsed) setIsResizing(true);
          }}
        />
        
        <aside className="map-panel">
          <div className="map-panel-header">
            <h2 style={{ fontSize: 18, color: C.t2, fontWeight: 400 }}>{tMap.title}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button className="map-chip" onClick={resetToDefaultUsaView}>{tMap.clear}</button>
              {isMobileViewport && (
                <button
                  type="button"
                  onClick={() => setPanelCollapsed(true)}
                  style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, width: 28, height: 28, borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  aria-label={tMap.closePanel}
                >
                  <Icon name="close" size={13} color={C.t2} />
                </button>
              )}
            </div>
          </div>

          <div className="map-panel-tabs" role="tablist" aria-label={tMap.panelSectionsLabel || 'Map panel sections'}>
            <button
              className={`map-panel-tab ${panelTab === 'filters' ? 'active' : ''}`}
              role="tab"
              aria-selected={panelTab === 'filters'}
              onClick={() => setPanelTab('filters')}
            >
              {tMap.tabFilters}
            </button>
            <button
              className={`map-panel-tab ${panelTab === 'cards' ? 'active' : ''}`}
              role="tab"
              aria-selected={panelTab === 'cards'}
              onClick={() => setPanelTab('cards')}
            >
              {(tMap.spotlightCards || 'Spotlight Cards')} ({spotlightPanelCount})
            </button>
          </div>

          {panelTab === 'filters' && (
            <>
              <div className="map-section-card">
                <div style={{ color: C.t2, fontSize: 12, marginBottom: 8, fontWeight: 400 }}>{tMap.itemsOnMap}</div>
                <div className="map-chip-row-main">
                  <button
                    className={`map-chip ${showPeople ? 'map-chip-active' : ''}`}
                    onClick={() => setShowPeople((v) => !v)}
                    style={showPeople ? { borderColor: 'var(--ui-active)', color: 'var(--ui-active)', fontWeight: 600 } : undefined}
                  >
                    {tMap.people}
                  </button>
                  <button
                    className={`map-chip ${showProperties ? 'map-chip-active' : ''}`}
                    onClick={() => setShowProperties((v) => !v)}
                    style={showProperties ? { borderColor: '#4381bc', color: '#4381bc', fontWeight: 600 } : undefined}
                  >
                    {tMap.deals}
                  </button>
                  <button
                    className={`map-chip ${showOnlyUnlocked ? 'map-chip-active' : ''}`}
                    onClick={() => {
                      setShowOnlyUnlocked((prev) => {
                        const next = !prev;
                        if (next) setShowOnlyMyPins(false);
                        return next;
                      });
                    }}
                    style={showOnlyUnlocked ? { borderColor: UNLOCKED_PERSON_PIN, color: UNLOCKED_PERSON_PIN, fontWeight: 600 } : undefined}
                  >
                    {tMap.unlocked}
                  </button>
                  <button
                    className={`map-chip ${showOnlyMyPins ? 'map-chip-active' : ''}`}
                    onClick={() => {
                      setShowOnlyMyPins((prev) => {
                        const next = !prev;
                        if (next) setShowOnlyUnlocked(false);
                        return next;
                      });
                    }}
                    style={showOnlyMyPins ? { borderColor: MY_PINS_COLOR, color: MY_PINS_COLOR, fontWeight: 600 } : undefined}
                  >
                    {tMap.myPins}
                  </button>
                </div>
              </div>

              <div className="map-section-card">
                <div style={{ color: C.t2, fontSize: 12, marginBottom: 8, fontWeight: 400 }}>{tMap.mapDisplay}</div>
                  {forceSimpleBaseTiles && (
                    <div style={{
                      marginBottom: 8,
                      padding: '6px 8px',
                      borderRadius: 8,
                      background: C.alpha(C.gold, 0.12),
                      border: `1px solid ${C.alpha(C.gold, 0.35)}`,
                      color: C.gold,
                      fontSize: 11,
                      lineHeight: 1.35,
                    }}>
                      {(tMap.providerFallbackNotice || 'Provider unavailable. Showing fallback: {provider}.')
                        .replace('{provider}', BASE_TILE_FALLBACK_CHAIN[baseTileFallbackIndex]?.label || 'OSM')}
                    </div>
                  )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {visibleMapStyleEntries.map(([styleKey, styleConfig]) => (
                    <button
                      key={styleKey}
                      className={`map-filter-mode ${mapStyle === styleKey ? 'map-filter-mode-active' : ''}`}
                      onClick={() => setMapStyle(styleKey)}
                    >
                      {mapStyleLabels[styleKey] || styleConfig.label}
                    </button>
                  ))}
                </div>
                {mapStyle === 'flood' && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ color: C.t3, fontSize: 11 }}>{tMap.floodOpacity}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[[tMap.opacityLow, 0.35], [tMap.opacityMedium, 0.60], [tMap.opacityHigh, 0.85]].map(([label, val]) => (
                        <button
                          key={label}
                          className={`map-chip ${Math.abs(floodOverlayOpacity - val) < 0.1 ? 'map-chip-active' : ''}`}
                          onClick={() => setFloodOverlayOpacity(val)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {viewport.zoom < 9 && (
                      <div style={{
                        padding: '6px 8px', borderRadius: 8,
                        background: C.alpha(C.gold, 0.12), border: `1px solid ${C.alpha(C.gold, 0.35)}`,
                        color: C.gold, fontSize: 11, lineHeight: 1.4,
                      }}>
                        {`⚠ ${tMap.floodZoomHint}`}
                      </div>
                    )}
                    {femaOverlayUnavailable && (
                      <div style={{
                        padding: '8px 10px', borderRadius: 8,
                        background: C.alpha(C.red, 0.10), border: `1px solid ${C.alpha(C.red, 0.35)}`,
                        color: C.red, fontSize: 11, lineHeight: 1.45,
                      }}>
                        {tMap.femaUnavailableNotice || 'FEMA layer unavailable on this network/region. Keeping imagery + streets only.'}
                        <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button className="map-chip" onClick={retryFemaOverlay}>{tMap.retry || 'Try again'}</button>
                        </div>
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: C.t3, lineHeight: 1.7 }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#5b8af5', marginRight: 5, verticalAlign: 'middle' }} />
                      {tMap.floodLegendHigh}
                      <br />
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#a8c4f8', marginRight: 5, verticalAlign: 'middle' }} />
                      {tMap.floodLegendMedium}
                      <br />
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#d9e8ff', border: '1px solid #aac', marginRight: 5, verticalAlign: 'middle' }} />
                      {tMap.floodLegendLow}
                    </div>
                  </div>
                )}
              </div>

              <div className="map-section-card">
                <div style={{ color: C.t2, fontSize: 12, marginBottom: 8, fontWeight: 400 }}>{tMap.locationFilter}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  <button
                    className={`map-filter-mode ${locationMode === 'state' ? 'map-filter-mode-active' : ''}`}
                    onClick={() => setLocationMode('state')}
                  >
                    {tMap.locationState}
                  </button>
                  <button
                    className={`map-filter-mode ${locationMode === 'city' ? 'map-filter-mode-active' : ''}`}
                    onClick={() => setLocationMode('city')}
                  >
                    {tMap.locationCity}
                  </button>
                  <button
                    className={`map-filter-mode ${locationMode === 'zip' ? 'map-filter-mode-active' : ''}`}
                    onClick={() => setLocationMode('zip')}
                  >
                    {tMap.locationZip}
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    className="map-filter-input"
                    type="text"
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyLocationFilter();
                    }}
                    placeholder={
                      locationMode === 'state'
                        ? tMap.placeholderState
                        : locationMode === 'city'
                          ? tMap.placeholderCity
                          : tMap.placeholderZip
                    }
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="map-chip" onClick={applyLocationFilter}>{isBoundaryLoading ? tMap.searching : tMap.go}</button>
                    <button
                      className="map-chip"
                      onClick={() => {
                        setLocationQuery('');
                        setAppliedLocationQuery('');
                        setFilterBounds(null);
                        setBoundaryGeoJson(null);
                        setFitToBounds(null);
                      }}
                    >
                      {tMap.reset}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ color: C.t3, fontSize: 12, marginBottom: 10 }}>
                {tMap.clusterHint}
              </div>
            </>
          )}

          {panelTab === 'cards' && (
            <div className="map-list-scroll">
              {manualPinTarget && (
                <div style={{
                  marginBottom: 10,
                  borderRadius: 10,
                  padding: '8px 10px',
                  background: C.alpha(C.accent, 0.12),
                  border: `1px solid ${C.alpha(C.accent, 0.45)}`,
                  color: C.t2,
                  fontSize: 12,
                  lineHeight: 1.45,
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{tMap.manualPinTitle || 'Manual pin placement active'}</div>
                  <div style={{ marginBottom: 8 }}>
                    {(tMap.manualPinHint || 'Click the map to save the correct pin for: {address}')
                      .replace('{address}', manualPinTarget.address || tMap.propertyWithoutAddress || 'Property without address')}
                  </div>
                  <button
                    className="map-chip"
                    onClick={() => setManualPinTargetId(null)}
                  >
                    {tMap.cancel || 'Cancel'}
                  </button>
                </div>
              )}
              {(selectedClusterLeaves.length > 0 || selectedCardId) && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <button
                    className="map-chip"
                    onClick={() => {
                      clearClusterSelection();
                      setSelectedCardId(null);
                    }}
                  >
                    {tMap.backToList}
                  </button>
                </div>
              )}
              {spotlightPanelCount === 0 && (
                <div style={{ color: C.t3, fontSize: 13 }}>No paid spotlight cards are active in this view.</div>
              )}
              {spotlightVisibleItems.map((item) => {
              const isPerson = getMapItemType(item) === 'person';
              const isOwnCard = !isPerson && String(item?.ownerId || '') === 'self';
              const exclusivityStatus = !isPerson ? getPropertyExclusivityStatus(propertyUnlocks, item.id, currentUserId) : null;
              const mapCardStatuses = [
                !isPerson && exclusivityStatus?.expiresAt ? CARD_STATUS.exclusive : null,
                item?.verified ? CARD_STATUS.verified : null,
              ].filter(Boolean);
              const mapCardBadgeStatus = pickPriorityStatus(mapCardStatuses.filter((status) => status !== CARD_STATUS.verified));
              const isUnlockedCard = isPerson ? isUnlockedId(item.id) : isUnlockedId(item.ownerId);
              const neonTone = isOwnCard
                ? MY_PINS_COLOR
                : (isUnlockedCard ? UNLOCKED_PERSON_PIN : (isPerson ? C.accent : '#4381bc'));
              const isLocked = isPerson ? !isUnlockedId(item.id) : (exclusivityStatus?.kind === 'blocked' || !isUnlockedId(item.ownerId));
              const unlockCost = isPerson ? getUnlockCost(item.id) : 0;
              return (
                <div 
                  key={`${isPerson ? 'person' : 'property'}-${item.id}`} 
                  className={`map-list-item ${isPerson ? 'person' : 'property'} ${isPerson ? (isUnlockedId(item.id) ? 'unlocked' : '') : (isUnlockedId(item.ownerId) ? 'unlocked' : '')}`}
                  style={{
                    cursor: 'pointer',
                    transition: 'box-shadow 0.18s ease, transform 0.18s ease',
                    position: 'relative',
                    zIndex: selectedCardId === item.id ? 3 : 0,
                    boxShadow: selectedCardId === item.id
                      ? `0 0 0 1px ${C.alpha(neonTone, 0.9)}, 0 0 14px ${C.alpha(neonTone, 0.7)}, 0 0 28px ${C.alpha(neonTone, 0.45)}`
                      : 'none',
                    transform: selectedCardId === item.id ? 'translateY(-1px)' : 'none',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--ui-surface)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--ui-surface)'}
                  onClick={() => zoomToCard(item)}
                >
                  {mapCardStatuses.length ? (
                    <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 4, display: 'inline-flex', alignItems: 'center', gap: 4, pointerEvents: 'none' }}>
                      {mapCardStatuses.map((status) => (
                        <CardStatusIcon key={status} type={status} size={18} iconSize={11} />
                      ))}
                    </div>
                  ) : null}
                  {mapCardBadgeStatus ? (
                    <CardStatusBadge
                      type={mapCardBadgeStatus}
                      compact
                      pulse={mapCardBadgeStatus === CARD_STATUS.exclusive}
                      style={{ position: 'absolute', right: 6, bottom: 6, zIndex: 4 }}
                    >
                      {tCards.exclusiveBadge || 'EXCLUSIVE'}
                    </CardStatusBadge>
                  ) : null}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 0 }}>
                      <img
                        alt=""
                        src={isPerson ? (item.photo || '') : ((item.images && item.images[0]) || '')}
                        className={`map-list-thumb ${isPerson ? 'person-thumb' : 'property-thumb'}`}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: C.t2, fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {isPerson ? item.name : item.address}
                        </div>
                        <div style={{ color: C.t2, fontSize: 12, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', gap: 6, alignItems: 'center' }}>
                              <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {isPerson ? `${item.type} · ${item.loc}` : `${item.type} · ${item.city}`}
                              </div>
                            </div>
                      </div>
                    </div>

                    <div style={{ flexShrink: 0, marginLeft: 8 }}>
                      <span className={`map-item-type-pill ${isPerson ? 'person-pill' : 'property-pill'}`}>
                        {isPerson ? tMap.itemTypePerson : tMap.itemTypeDeal}
                      </span>
                    </div>
                  </div>

                  {isPerson ? (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ minWidth: 0, color: C.t3, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {getPortfolioSummaryLabel(item)}
                        {!isLocked && <span style={{ color: C.success, marginLeft: 8, fontWeight: 400 }}>{tMatches.unlockedLabel}</span>}
                      </div>
                      {isLocked ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); nuggets >= unlockCost ? handleOpenUnlock(item) : handleSetModal('store'); }}
                          style={{
                            border: `1px solid ${C.gold}`,
                            background: 'var(--ui-surface)',
                            color: C.gold,
                            fontSize: 11,
                            fontWeight: 700,
                            borderRadius: 999,
                            padding: '4px 10px',
                            lineHeight: 1,
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            cursor: 'pointer',
                          }}
                        >
                          {nuggets >= unlockCost ? `${tCards.unlock} ${unlockCost}★` : tMatches.buyNuggets}
                        </button>
                      ) : (
                        <button
                          className="map-chip map-chip-active"
                          onClick={(e) => { e.stopPropagation(); navigateToFeed(item, isPerson ? 'person' : 'property'); }}
                          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                        >
                          {tMatches.viewInFeed}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, color: C.t2, fontSize: 12 }}>
                      ${item.price?.toLocaleString()} · Cap {item.capRate}%
                    </div>
                  )}
                </div>
              );
            })}
              {spotlightNoPinProperties.length > 0 && (
                <>
                  <div className="ds-geocode-pending-section-label">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'ds-geocode-spin 1s linear infinite', color: '#e53e3e' }}>
                      <path d="M23 4v6h-6" />
                      <path d="M1 20v-6h6" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
                      <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
                    </svg>
                    {tMap.plottingLocation || 'Plotting location...'}
                  </div>
                  {spotlightNoPinProperties.map((prop) => (
                    <div
                      key={`noping-${prop.id}`}
                      className="map-list-item property"
                      style={{ cursor: 'default', position: 'relative' }}
                    >
                      {/* Spinning red circular arrows in top-right corner, above the Deal badge position */}
                      <svg
                        className="ds-geocode-sync-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-label={tMap.locating || 'Locating'}
                      >
                        <path d="M23 4v6h-6" />
                        <path d="M1 20v-6h6" />
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
                        <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
                      </svg>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 0 }}>
                          <img
                            alt=""
                            src={Array.isArray(prop.images) ? (prop.images[0] || '') : ''}
                            className="map-list-thumb property-thumb"
                          />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: C.t1, fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {prop.address || (tMap.addressNotInformed || 'Address not provided')}
                            </div>
                            <div style={{ color: C.t2, fontSize: 12, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {`${prop.type || tMap.itemTypeDeal || 'Deal'} · ${prop.city || ''}`}
                            </div>
                          </div>
                        </div>
                        {/* Spacer to preserve layout alignment with normal cards */}
                        <div style={{ width: 28, flexShrink: 0 }} />
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: C.t2, fontSize: 11 }}>
                          {tMap.searchingExactAddress || 'Searching exact address...'}
                        </span>
                        <button
                          className="map-chip"
                          onClick={() => startManualPinPlacement(prop)}
                        >
                          {tMap.setPinOnMap || 'Set pin on map'}
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </aside>

        <section className="map-canvas-card">
          <MapContainer key={`mapview-${mapActivationKey}`} center={safeViewportCenter} zoom={safeViewportZoom} className="map-canvas" zoomControl={false}>
            <MapEvents onViewportChange={setViewport} />
            <MapVisibilityController active={isActive} />
            <ManualPinPlacementController
              active={Boolean(manualPinTarget)}
              onPlace={applyManualPinPlacement}
            />
            <MapController mapRef={mapRef} fitToBounds={fitToBounds} />
            <ZoomControl position="topright" />
            <TileLayer
              key={`base-${mapStyle}-${forceSimpleBaseTiles ? `fallback-${baseTileFallbackIndex}` : 'native'}`}
              attribution={effectiveMapStyle.attribution}
              url={effectiveMapStyle.url}
              eventHandlers={{
                tileerror: () => {
                  const now = Date.now();
                  if (now - lastBaseFallbackSwitchAtRef.current < 900) return;
                  lastBaseFallbackSwitchAtRef.current = now;

                  if (!forceSimpleBaseTiles) {
                    setForceSimpleBaseTiles(true);
                    setBaseTileFallbackIndex(0);
                    return;
                  }

                  setBaseTileFallbackIndex((prev) => {
                    if (prev >= BASE_TILE_FALLBACK_CHAIN.length - 1) return prev;
                    return prev + 1;
                  });
                },
              }}
            />
            {effectiveOverlays.map((overlay) => (
              overlay.type === 'wms' ? (
                <WMSTileLayer
                  key={`${mapStyle}-${overlay.url}-${overlay.layers || 'default'}`}
                  url={overlay.url}
                  layers={overlay.layers || '0'}
                  format={overlay.format || 'image/png'}
                  transparent={overlay.transparent !== false}
                  version={overlay.version || '1.3.0'}
                  styles={overlay.styles || ''}
                  opacity={overlay.opacity || 1}
                  minZoom={overlay.minZoom || 0}
                  attribution={overlay.attribution}
                  eventHandlers={{
                    tileerror: () => handleOverlayTileError(overlay),
                    tileload: () => {
                      if (overlay.isFemaFlood) handleFemaTileLoad();
                    },
                  }}
                />
              ) : (
                <TileLayer
                  key={`${mapStyle}-${overlay.url}`}
                  attribution={overlay.attribution}
                  url={overlay.url}
                  opacity={overlay.opacity || 1}
                  minZoom={overlay.minZoom || 0}
                  eventHandlers={{
                    tileerror: () => handleOverlayTileError(overlay),
                  }}
                />
              )
            ))}

            {boundaryGeoJson && (
              <GeoJSON
                data={boundaryGeoJson}
                style={{
                  color: GRAPHITE_DARK,
                  weight: 2,
                  fillColor: GRAPHITE_DARK,
                  fillOpacity: 0.06,
                  dashArray: '8 6',
                }}
              />
            )}

            {!boundaryGeoJson && filterBounds && (
              <Rectangle
                bounds={filterBounds}
                pathOptions={{
                  color: GRAPHITE_DARK,
                  weight: 2,
                  fillColor: GRAPHITE_DARK,
                  fillOpacity: 0.06,
                  dashArray: '8 6',
                }}
              />
            )}

            {safeRenderedFeatures.map((feature) => {
              const [lng, lat] = feature.geometry.coordinates;
              const isCluster = feature.properties.cluster;

              if (isCluster) {
                const total = feature.properties.point_count;
                const peopleCount = feature.properties.peopleCount || 0;
                const propertiesCount = feature.properties.propertiesCount || 0;
                const unlockedCount = feature.properties.unlockedCount || 0;
                const isAllUnlocked = unlockedCount === total;
                const isUnlockedPropertiesOnlyCluster = showOnlyUnlocked && isAllUnlocked && peopleCount === 0 && propertiesCount > 0;
                return (
                  <Marker
                    key={`cluster-${feature.properties.cluster_id ?? `${lat}-${lng}-${total}`}`}
                    position={[lat, lng]}
                    icon={getClusterIcon(total, peopleCount, propertiesCount, isUnlockedPropertiesOnlyCluster)}
                    eventHandlers={{
                      click: () => openCluster(feature),
                    }}
                  />
                );
              }

              const isPerson = feature.properties.itemType === 'person';
              const payload = feature.payload;
              const isOwnProperty = !isPerson && feature.properties.isOwn === true;
              const markerKey = feature.properties.featureKey
                || `${feature.properties.itemType}-${feature.properties.itemId}-${payload?.primaryProfile || payload?.scope || ''}-${lat}-${lng}`;

              return (
                <Marker
                  key={markerKey}
                  position={[lat, lng]}
                  icon={
                    isPerson
                      ? (isUnlockedId(payload.id) ? unlockedPersonIcon : personIcon)
                      : (isOwnProperty ? myPropertyIcon : (isUnlockedId(payload.ownerId) ? unlockedPropertyIcon : propertyIcon))
                  }
                  draggable={isOwnProperty}
                  eventHandlers={isOwnProperty ? {
                    dragend(e) {
                      const { lat: newLat, lng: newLng } = e.target.getLatLng();
                      const propId = String(feature.properties.itemId ?? '');
                      if (!propId) return;
                      const updated = { ...pinOverrides, [propId]: { lat: newLat, lng: newLng } };
                      setPinOverrides(updated);
                      _savePinOverrides(updated, userProfile);
                      commitCoordsToPortfolio(payload, { lat: newLat, lng: newLng }, {
                        geocodeStatus: 'manual',
                        geocodeSource: 'manual',
                        geocodeConfidence: 1,
                      });
                    },
                  } : undefined}
                >
                  <Popup>
                    {isPerson ? (
                      <div 
                        className="ds-map-popup-card"
                        style={{ cursor: 'pointer' }}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); navigateToFeed(payload, 'person'); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); navigateToFeed(payload, 'person'); } }}
                      >
                        <div className="ds-map-popup-head">
                          <SmartImage
                            src={payload.photo || ''}
                            alt={payload.name}
                            style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: '50%', flex: '0 0 auto' }}
                            fallback={<div className="ds-map-popup-avatar" style={{ background:C.border, display:'flex', alignItems:'center', justifyContent:'center', color:C.t3, fontSize:13, fontWeight:700 }}>{String(payload.name || '?').trim().charAt(0).toUpperCase() || '?'}</div>}
                          />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="ds-map-popup-title">{payload.name}</div>
                            <div className="ds-map-popup-subtitle">{payload.type} · {payload.loc}</div>
                          </div>
                        </div>
                        <div style={{ marginTop: 2, fontSize: 12, color: C.gold, fontWeight: 700 }}>
                          {getPortfolioSummaryLabel(payload)}
                        </div>
                        <div style={{ marginTop: 1, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, color: C.t2 }}>
                          <span>{payload.deals} {tMap.deals || 'deals'}</span>
                          {isUnlockedId(payload.id) && (
                            <span style={{ color: '#75ba75', fontWeight: 600, fontSize: 11 }}>{tMatches.unlockedLabel || 'Unlocked'}</span>
                          )}
                        </div>
                        <div className="ds-map-popup-cta">{`${tMatches.viewInFeed} ->`}</div>
                      </div>
                    ) : (
                      <div 
                        className="ds-map-popup-card"
                        style={{ cursor: 'pointer' }}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); navigateToFeed(payload, 'property'); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); navigateToFeed(payload, 'property'); } }}
                      >
                        <div className="ds-map-popup-head">
                          <SmartImage
                            src={(payload.images && payload.images[0]) || payload.image || ''}
                            alt={payload.address}
                            style={{ width: 102, height: 74, objectFit: 'cover', borderRadius: 8, flex: '0 0 auto' }}
                            fallback={<div className="ds-map-popup-thumb" style={{ background:C.border, display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name="home" size={18} color={C.t3} /></div>}
                          />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="ds-map-popup-title">{payload.address}</div>
                            <div className="ds-map-popup-subtitle">{payload.type} · {payload.city}</div>
                            <div className="ds-map-popup-meta">${payload.price?.toLocaleString()} · Cap {payload.capRate}%</div>
                            <div className="ds-map-popup-cta">{`${tMatches.viewInFeed} ->`}</div>
                          </div>
                        </div>
                        {isOwnProperty && (
                          <div style={{ marginTop: 6, fontSize: 11, color: C.t3, textAlign: 'center', borderTop: '1px solid var(--ui-border)', paddingTop: 5 }}>
                            ✥ {tMap.dragToReposition || 'Drag to reposition'}
                          </div>
                        )}
                      </div>
                    )}
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </section>
      </div>
    </div>
  );
}



