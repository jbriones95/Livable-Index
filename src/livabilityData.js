/**
 * Livability Index - Proximity-Based Scoring Model
 *
 * Score is 0–100, based on closeness to 6 amenity types:
 *   coffee shop, dinner restaurant, grocery store, nature access, transit stop, healthcare.
 */

import {
  hexGrid,
  squareGrid,
  centroid as turfCentroid,
  point as turfPoint,
  booleanPointInPolygon,
  distance as turfDistance,
  intersect as turfIntersect,
  featureCollection as turfFeatureCollection,
  union as turfUnion,
  bbox as turfBbox,
  pointToLineDistance as turfPointToLineDistance,
  nearestPointOnLine as turfNearestPointOnLine,
} from '@turf/turf';
import { lineString as turfLineString } from '@turf/helpers';
import littletonPois from '../data/pois_littleton.json';
import centennialPois from '../data/pois_centennial.json';
import englewoodPois from '../data/pois_englewood.json';
import highlineCanal from '../data/highline_canal.json';
import southPlatteRiver from '../data/south_platte_river.json';
import leeGulch from '../data/lee_gulch.json';
import twoBrands from '../data/two_brands.json';

export const CITIES = {
  littleton: {
    label: 'Littleton',
    bounds: { north: 39.646, south: 39.562, east: -104.970, west: -105.065 },
    center: [39.6133, -105.0166],
    zoom: 13,
    neighborhoodUrl: 'https://services6.arcgis.com/lJUBf9F1fZJRB4zT/arcgis/rest/services/Neighborhood_Boundary/FeatureServer/70/query?where=1%3D1&outFields=*&outSR=4326&f=geojson',
    bikeLaneUrl: 'https://ltngiswa.littletonco.gov/server/rest/services/City/LittletonParksTrails/MapServer/1/query?where=1%3D1&outFields=*&outSR=4326&f=geojson',
    trailUrl: 'https://ltngiswa.littletonco.gov/server/rest/services/City/LittletonParksTrails/MapServer/3/query?where=1%3D1&outFields=*&outSR=4326&f=geojson',
    schools: [
      { lat: 39.5970231, lng: -104.9935549 },
      { lat: 39.6168560, lng: -105.0381960 },
      { lat: 39.5727920, lng: -104.9781590 },
      { lat: 39.5843743, lng: -105.0054175 },
      { lat: 39.6132670, lng: -104.9857200 },
      { lat: 39.6164866, lng: -105.0291850 },
      { lat: 39.6190020, lng: -104.9827180 },
      { lat: 39.6007891, lng: -105.0068349 },
      { lat: 39.5854940, lng: -104.9988034 },
      { lat: 39.6025635, lng: -105.0429345 },
    ],
  },
  centennial: {
    label: 'Centennial',
    bounds: { north: 39.640, south: 39.564, east: -104.726, west: -104.990 },
    center: [39.5792, -104.8769],
    zoom: 12,
    neighborhoodUrl: null,
    bikeLaneUrl: null,
    trailUrl: null,
    schools: [
      { lat: 39.573903, lng: -104.909803 },
      { lat: 39.588120, lng: -104.952792 },
      { lat: 39.602209, lng: -104.878196 },
      { lat: 39.618336, lng: -104.856189 },
      { lat: 39.575708, lng: -104.843237 },
      { lat: 39.589377, lng: -104.801327 },
    ],
  },
  englewood: {
    label: 'Englewood',
    bounds: { north: 39.674, south: 39.617, east: -104.959, west: -105.019 },
    center: [39.6475, -104.9878],
    zoom: 13,
    neighborhoodUrl: null,
    bikeLaneUrl: null,
    trailUrl: null,
    schools: [
      { lat: 39.655560, lng: -104.987410 },
      { lat: 39.642060, lng: -104.994100 },
      { lat: 39.646510, lng: -104.974720 },
      { lat: 39.635600, lng: -104.980900 },
    ],
  },
};

export function getCityConfig(cityKey = 'littleton') {
  return CITIES[cityKey] || CITIES.littleton;
}

function getCityDataContainer(cityKey) {
  if (typeof window === 'undefined') return null;
  const key = cityKey || 'littleton';
  window.__liv_city_data = window.__liv_city_data || {};
  window.__liv_city_data[key] = window.__liv_city_data[key] || {};
  return window.__liv_city_data[key];
}

export const LITTLETON_BOUNDS = CITIES.littleton.bounds;
export const MAP_CENTER = CITIES.littleton.center;
export const MAP_ZOOM = CITIES.littleton.zoom;

export const ZONES = [
  {
    id: "downtown",
    name: "Downtown Littleton",
    bounds: [39.606, -105.022, 39.617, -105.010],
    scores: { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0, schools: 0 },
    notes: '',
  },
  {
    id: "littleton_station",
    name: "Littleton / Mineral Station Area",
    bounds: [39.595, -105.017, 39.606, -105.005],
    scores: { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0, schools: 0 },
    notes: '',
  },
  {
    id: "south_broadway_corridor",
    name: "South Broadway Corridor",
    bounds: [39.617, -105.020, 39.635, -105.012],
    scores: { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0, schools: 0 },
    notes: '',
  },
  {
    id: "arapahoe_community_college",
    name: "ACC / Centennial Area",
    bounds: [39.580, -105.010, 39.598, -104.993],
    scores: { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0, schools: 0 },
    notes: '',
  },
  {
    id: "western_residential",
    name: "West Littleton Residential",
    bounds: [39.608, -105.055, 39.635, -105.030],
    scores: { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0, schools: 0 },
    notes: '',
  },
  {
    id: "heritage_gulch",
    name: "Heritage / Gulch Trail Area",
    bounds: [39.620, -105.030, 39.640, -105.015],
    scores: { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0, schools: 0 },
    notes: '',
  },
  {
    id: "river_front",
    name: "Riverfront / Sterne Park",
    bounds: [39.610, -105.040, 39.625, -105.025],
    scores: { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0, schools: 0 },
    notes: '',
  },
  {
    id: "east_littleton",
    name: "East Littleton / Ketring",
    bounds: [39.600, -105.005, 39.618, -104.985],
    scores: { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0, schools: 0 },
    notes: '',
  },
  {
    id: "northeast_commercial",
    name: "NE Commercial / Broadway & Belleview",
    bounds: [39.630, -105.015, 39.645, -105.000],
    scores: { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0, schools: 0 },
    notes: '',
  },
];

// Normalize legacy `trailhead` key to `nature` in zone scores so older
// zone definitions continue to work after the rename.
for (const z of ZONES) {
  if (z && z.scores && Object.prototype.hasOwnProperty.call(z.scores, 'trailhead') && !Object.prototype.hasOwnProperty.call(z.scores, 'nature')) {
    z.scores.nature = z.scores.trailhead;
    delete z.scores.trailhead;
  }
}

export const WEIGHTS = {
  coffee: 0.10,
  restaurant: 0.10,
  nature: 0.17,
  healthcare: 0.10,
  busStop: 0.10,
  grocery: 0.17,
  bikeInfra: 0.05,
  crime: 0.11,
  schools: 0.10,
};

export const DIMENSION_LABELS = {
  coffee: "Coffee Shop",
  restaurant: "Dinner Restaurant",
  grocery: "Grocery Store",
  nature: "Nature Access",
  busStop: "Transit Stop",
  healthcare: "Healthcare",
  bikeInfra: "Bike/Walk Infrastructure",
  crime: "Public Safety",
  schools: "Schools",
};

export const OVERLAY_OPTIONS = [
  { key: 'composite', label: 'Composite Livability' },
  { key: 'coffee', label: 'Coffee Access' },
  { key: 'restaurant', label: 'Dining Access' },
  { key: 'grocery', label: 'Grocery Access' },
  { key: 'nature', label: 'Nature Access' },
  { key: 'busStop', label: 'Transit Access' },
  { key: 'healthcare', label: 'Medical Access' },
  { key: 'bikeInfra', label: 'Bike/Walk Infrastructure' },
  { key: 'crime', label: 'Public Safety' },
  { key: 'schools', label: 'School Access' },
];

export function computeScore(scores, weights = WEIGHTS) {
  return Math.round(
    Object.entries(weights).reduce((sum, [dim, weight]) => sum + (scores[dim] ?? 0) * weight, 0)
  );
}

export function scoreToColor(score) {
  const t = Math.max(0, Math.min(100, score));
  const stops = [
    { pos: 0, r: 192, g: 57, b: 43 },
    { pos: 25, r: 230, g: 126, b: 34 },
    { pos: 50, r: 241, g: 196, b: 15 },
    { pos: 75, r: 90, g: 181, b: 82 },
    { pos: 100, r: 26, g: 127, b: 46 },
  ];
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].pos && t <= stops[i + 1].pos) {
      lo = stops[i]; hi = stops[i + 1]; break;
    }
  }
  const span = hi.pos - lo.pos;
  const frac = span > 0 ? (t - lo.pos) / span : 0;
  const r = Math.round(lo.r + (hi.r - lo.r) * frac);
  const g = Math.round(lo.g + (hi.g - lo.g) * frac);
  const b = Math.round(lo.b + (hi.b - lo.b) * frac);
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

export function scoreToGrade(score) {
  if (score >= 75) return "A";
  if (score >= 60) return "B";
  if (score >= 48) return "C";
  if (score >= 35) return "D";
  return "F";
}

export function scoreToLabel(score) {
  if (score >= 75) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 48) return "Moderate";
  if (score >= 35) return "Poor";
  return "Very Poor";
}

export function zoneToGeoJSON(zone) {
  const [s, w, n, e] = zone.bounds;
  return {
    type: "Feature",
    properties: {
      id: zone.id,
      name: zone.name,
      scores: zone.scores,
      notes: zone.notes,
      composite: computeScore(zone.scores),
    },
    geometry: {
      type: "Polygon",
      coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
    },
  };
}

function fallbackZoneFeatureCollection(cityKey = 'littleton') {
  if (cityKey === 'littleton') {
    return { type: 'FeatureCollection', features: ZONES.map(zoneToGeoJSON) };
  }
  const cfg = getCityConfig(cityKey);
  const b = cfg.bounds;
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          id: `${cityKey}-area`,
          name: cfg.label,
          notes: '',
          scores: {},
          composite: 0,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [b.west, b.south],
            [b.east, b.south],
            [b.east, b.north],
            [b.west, b.north],
            [b.west, b.south],
          ]],
        },
      },
    ],
  };
}

function normalizeNeighborhoodFeatures(collection) {
  if (!collection || collection.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
    return null;
  }
  collection.features = collection.features.map((feature, index) => {
    const properties = feature.properties || {};
    const name = properties.name || properties.Neighborho || properties.Name || `Area ${index + 1}`;
    return {
      ...feature,
      properties: {
        ...properties,
        id: properties.id || feature.id || `zone-${index + 1}`,
        name,
      },
    };
  });
  return collection;
}

function getCachedNeighborhoodFeatures(cityKey) {
  const cityStore = getCityDataContainer(cityKey);
  if (cityStore && cityStore.neighborhoods) {
    return normalizeNeighborhoodFeatures(cityStore.neighborhoods);
  }
  return null;
}

async function fetchNeighborhoodFeatures(cityKey) {
  const config = CITIES[cityKey];
  if (!config || !config.neighborhoodUrl) return null;
  try {
    const r = await fetch(config.neighborhoodUrl);
    if (!r.ok) return null;
    const data = normalizeNeighborhoodFeatures(await r.json());
    if (data) {
      const cityStore = getCityDataContainer(cityKey);
      if (cityStore) cityStore.neighborhoods = data;
    }
    return data;
  } catch (err) {
    console.warn('Failed to fetch neighborhoods', err && err.message);
    return null;
  }
}

let _neighborhoodFetch = {};
let _scoredZoneFetch = {};

export function getAllZoneFeatures(cityKey = 'littleton') {
  const cached = getCachedNeighborhoodFeatures(cityKey);
  if (cached) return cached;

  if (!_neighborhoodFetch[cityKey]) {
    _neighborhoodFetch[cityKey] = fetchNeighborhoodFeatures(cityKey);
  }

  return fallbackZoneFeatureCollection(cityKey);
}

export async function getAllZoneFeaturesAsync(cityKey = 'littleton') {
  const cached = getCachedNeighborhoodFeatures(cityKey);
  if (cached) return cached;

  if (!_neighborhoodFetch[cityKey]) {
    _neighborhoodFetch[cityKey] = fetchNeighborhoodFeatures(cityKey);
  }

  const remote = await _neighborhoodFetch[cityKey];
  return remote || fallbackZoneFeatureCollection(cityKey);
}

// Named trails to detect for the trailhead portion of the nature composite (80% weight)
const NAMED_TRAILS = [
  'highline canal',
  'lee gulch trail',
  'mary carter greenway trail',
  'littleton community trail',
  'south platte river trail',
  'two brands trail',
];

const MAX_DIST_KM = {
  coffee: 0.8,
  restaurant: 0.8,
  grocery: 1.0,
  // trail and park are combined into the nature composite score
  trail: 2.0,
  park: 2.0,
  busStop: 0.5,
  healthcare: 4.5,
  bikeInfra: 1.5,
  crime: 2.0,
  schools: 1.5,
};

// Authoritative trail polylines used to score distance-to-trail precisely.
// Represented as [lon, lat] coordinate pairs, matching the turf convention.
const TRAIL_POLYLINES = [
  {
    name: 'Highline Canal Trail',
    coords: highlineCanal.coords,
  },
  {
    name: 'South Platte River Trail',
    coords: southPlatteRiver.coords,
  },
  {
    name: 'Lee Gulch Trail',
    coords: leeGulch.coords,
  },
  {
    name: 'Two Brands Trail',
    coords: twoBrands.coords,
  },
];

// Pre-build turf LineStrings for distance calculations.
const TRAIL_LINES = TRAIL_POLYLINES.map((t) => ({
  ...t,
  line: turfLineString(t.coords),
}));

// How many candidate POIs (closest by crow-flies) to route per category
const ROUTE_CANDIDATES = {
  coffee: 5,
  restaurant: 5,
  grocery: 5,
  trail: 5,
  park: 5,
  busStop: 5,
  healthcare: 5,
  bikeInfra: 5,
};

// Routing configuration: try OSRM public endpoint with common profile fallbacks.
// Walking is prioritized over biking in the combined score via `ROUTING_WEIGHTS`.
const ROUTE_SERVICE = {
  baseUrl: 'https://router.project-osrm.org',
  walkingProfiles: ['walking', 'foot'],
  cyclingProfiles: ['cycling', 'bike'],
  orsBaseUrl: 'https://api.openrouteservice.org',
};

const ROUTING_WEIGHTS = { walking: 0.8, biking: 0.2 };
const routeCache = new Map();

// Prefer OpenRouteService when an API key is provided via environment.
const ORS_API_KEY = (typeof process !== 'undefined' && process.env && process.env.OPENROUTESERVICE_API_KEY)
  || (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ORS_API_KEY)
  || null;

const ORS_PROFILES = {
  walking: ['foot-walking', 'foot-hiking'],
  cycling: ['cycling-regular', 'cycling-road', 'cycling-mountain'],
};

// Bike infrastructure scoring (from city-specific ArcGIS data)
const BIKE_LANE_TYPE_WEIGHTS = {
  'Protected Bike Lane': 1.0,
  'Cycle Track': 1.0,
  'Buffered Bike Lane': 0.9,
  'Bike Lane': 0.8,
  'Shared Use Path': 0.7,
  'Sharrows/On-Street Markings': 0.5,
};

const TRAIL_SURFACE_WEIGHTS = {
  'Asphalt': 1.0,
  'Concrete': 1.0,
  'Gravel': 0.6,
  'Chunk Wood': 0.4,
  'Unknown': 0.3,
};

const BIKE_MAX_KM = 1.5;

function isCyclingFriendlyTrail(props) {
  if (!props) return true;
  if (props.ROADCYCLE === 'Yes') return true;
  if (props.SURFTYPE === 'Concrete' || props.SURFTYPE === 'Asphalt') return true;
  return false;
}

function extractGeoJSONCoords(geometry) {
  if (geometry.type === 'LineString') {
    return geometry.coordinates;
  }
  if (geometry.type === 'MultiLineString') {
    const all = [];
    for (const line of geometry.coordinates) {
      for (const pt of line) all.push(pt);
    }
    return all;
  }
  return [];
}

function sampleCoords(coords, maxSamples) {
  if (coords.length <= maxSamples) return coords;
  const step = (coords.length - 1) / (maxSamples - 1);
  const result = [];
  for (let i = 0; i < maxSamples; i++) {
    const idx = Math.round(i * step);
    result.push(coords[Math.min(idx, coords.length - 1)]);
  }
  return result;
}

function haversineKm(lng1, lat1, lng2, lat2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Compute the straight-line distance (km) from a [lon,lat] point to the
// nearest authoritative trail polyline, plus the closest coordinates on it.
function nearestTrailPolylineDistance(lon, lat) {
  let bestKm = Infinity;
  let bestCoords = null;
  const pt = turfPoint([lon, lat]);
  for (const t of TRAIL_LINES) {
    try {
      const km = turfPointToLineDistance(pt, t.line, { units: 'kilometers' });
      if (km < bestKm) {
        bestKm = km;
        const nearest = turfNearestPointOnLine(pt, t.line, { units: 'kilometers' });
        bestCoords = nearest?.geometry?.coordinates || null;
      }
    } catch (_err) {
      // skip malformed line
    }
  }
  return { km: bestKm, coords: bestCoords };
}

let _bikeInfraFetch = {};
let _overpassJsonCache = new Map();

async function fetchOverpassJson(query) {
  const key = String(query || '');
  if (!key) return null;
  if (_overpassJsonCache.has(key)) return _overpassJsonCache.get(key);

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  ];

  for (const endpoint of endpoints) {
    let timeout = null;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 12000);
      const body = new URLSearchParams({ data: key }).toString();
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body,
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        _overpassJsonCache.set(key, data);
        return data;
      }
    } catch (_e) {
      // try next endpoint
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  for (const endpoint of endpoints) {
    let timeout = null;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 12000);
      const url = `${endpoint}?data=${encodeURIComponent(key)}`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) continue;
      const data = await res.json();
      _overpassJsonCache.set(key, data);
      return data;
    } catch (_e) {
      // try next endpoint
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  return null;
}

async function fetchBikeInfrastructureData(cityKey) {
  const cacheKey = cityKey || 'littleton';
  const cityStore = getCityDataContainer(cacheKey);
  if (cityStore?.bikeInfra) return cityStore.bikeInfra;

  const config = getCityConfig(cacheKey);
  const hasBikeData = config && config.bikeLaneUrl && config.trailUrl;

  if (!_bikeInfraFetch[cacheKey] && hasBikeData) {
    _bikeInfraFetch[cacheKey] = (async () => {
      const [bikeRes, trailRes] = await Promise.all([
        fetch(config.bikeLaneUrl).catch(() => null),
        fetch(config.trailUrl).catch(() => null),
      ]);
      const bikeGeoJSON = bikeRes && bikeRes.ok ? await bikeRes.json().catch(() => null) : null;
      const trailGeoJSON = trailRes && trailRes.ok ? await trailRes.json().catch(() => null) : null;

      const bikePoints = [];
      if (bikeGeoJSON && Array.isArray(bikeGeoJSON.features)) {
        for (const f of bikeGeoJSON.features) {
          const typeWeight = BIKE_LANE_TYPE_WEIGHTS[f.properties?.FACILITY_TYPE] || 0.5;
          const statusWeight = f.properties?.STATUS === 'Existing' ? 1.0 : 0.3;
          const weight = typeWeight * statusWeight;
          const coords = extractGeoJSONCoords(f.geometry);
          for (const pt of sampleCoords(coords, 8)) {
            bikePoints.push({ coords: pt, weight });
          }
        }
      }

      const trailPoints = [];
      if (trailGeoJSON && Array.isArray(trailGeoJSON.features)) {
        for (const f of trailGeoJSON.features) {
          if (!isCyclingFriendlyTrail(f.properties)) continue;
          const surfaceWeight = TRAIL_SURFACE_WEIGHTS[f.properties?.SURFTYPE] || 0.5;
          const coords = extractGeoJSONCoords(f.geometry);
          for (const pt of sampleCoords(coords, 6)) {
            trailPoints.push({ coords: pt, weight: surfaceWeight });
          }
        }
      }

      const data = { bikePoints, trailPoints };
      if (cityStore) cityStore.bikeInfra = data;
      return data;
    })();
  }

  return _bikeInfraFetch[cacheKey] || null;
}

async function computeBikeInfraScore(lat, lng, cityKey) {
  try {
    const data = await fetchBikeInfrastructureData(cityKey);
    const bikePoints = data?.bikePoints || [];
    const trailPoints = data?.trailPoints || [];

    if (bikePoints.length === 0 && trailPoints.length === 0) {
      const poiPoints = await getCityPoiPoints(cityKey).catch(() => []);
      let minDist = Infinity;
      for (const p of poiPoints) {
        const cats = Array.isArray(p?.properties?.category) ? p.properties.category : [];
        const highway = String(p?.properties?.highway || '').toLowerCase();
        const cycleway = String(p?.properties?.cycleway || '').toLowerCase();
        const route = String(p?.properties?.route || '').toLowerCase();
        const bicycle = String(p?.properties?.bicycle || '').toLowerCase();
        const isBikeFriendly = cats.includes('trail') || highway === 'cycleway' || cycleway !== '' || route === 'bicycle' || bicycle === 'designated';
        if (!isBikeFriendly) continue;
        const coords = p?.geometry?.coordinates;
        if (!coords || coords.length < 2) continue;
        const d = haversineKm(lng, lat, coords[0], coords[1]);
        if (d < minDist) minDist = d;
      }
      if (!isFinite(minDist) || minDist > BIKE_MAX_KM) return 0;
      return Math.max(0, Math.round((1 - minDist / BIKE_MAX_KM) * 100));
    }

    let minBikeDist = Infinity;
    let bestBikeWeight = 0;
    for (const p of bikePoints) {
      const d = haversineKm(lng, lat, p.coords[0], p.coords[1]);
      if (d < minBikeDist) { minBikeDist = d; bestBikeWeight = p.weight; }
    }

    let minTrailDist = Infinity;
    let bestTrailWeight = 0;
    for (const p of trailPoints) {
      const d = haversineKm(lng, lat, p.coords[0], p.coords[1]);
      if (d < minTrailDist) { minTrailDist = d; bestTrailWeight = p.weight; }
    }

    function proximityToScore(km, maxKm) {
      if (!isFinite(km) || km > maxKm) return 0;
      return Math.max(0, Math.round((1 - km / maxKm) * 100));
    }

    const bikeScore = proximityToScore(minBikeDist, BIKE_MAX_KM) * bestBikeWeight;
    const trailScore = proximityToScore(minTrailDist, BIKE_MAX_KM) * bestTrailWeight;

    return Math.min(100, Math.round(0.6 * bikeScore + 0.4 * trailScore));
  } catch (err) {
    console.warn('computeBikeInfraScore failed', err);
    return 0;
  }
}

// Crime / Public Safety dimension — estimated police drive time from nearest station
const FALLBACK_POLICE_STATIONS_BY_CITY = {
  littleton: [
    { lat: 39.6126, lng: -105.0160 },
  ],
  centennial: [
    { lat: 39.5873, lng: -104.8752 },
  ],
  englewood: [
    { lat: 39.6481, lng: -104.9870 },
  ],
};

function fallbackPoliceStations(cityKey) {
  return FALLBACK_POLICE_STATIONS_BY_CITY[cityKey] || FALLBACK_POLICE_STATIONS_BY_CITY.littleton;
}

function policeOverpassUrl(cityKey) {
  const cfg = getCityConfig(cityKey || 'littleton');
  if (!cfg) return '';
  const pad = 0.08;
  const south = cfg.bounds.south - pad;
  const north = cfg.bounds.north + pad;
  const west = cfg.bounds.west - pad;
  const east = cfg.bounds.east + pad;
  return `[out:json][timeout:25];(node["amenity"="police"](${south},${west},${north},${east});way["amenity"="police"](${south},${west},${north},${east});relation["amenity"="police"](${south},${west},${north},${east}););out center;`;
}

let _policeStationsFetch = {};

async function fetchPoliceStations(cityKey) {
  const cacheKey = cityKey || 'littleton';
  const cityStore = getCityDataContainer(cacheKey);
  if (cityStore?.policeStations) return cityStore.policeStations;

  if (!_policeStationsFetch[cacheKey]) {
    const query = policeOverpassUrl(cityKey);
    _policeStationsFetch[cacheKey] = (async () => {
      if (!query) return fallbackPoliceStations(cacheKey);
      try {
        const data = await fetchOverpassJson(query);
        if (!data || !Array.isArray(data.elements) || data.elements.length === 0) {
          return fallbackPoliceStations(cacheKey);
        }
        const points = data.elements
          .map((el) => {
            const lat = el.lat ?? el.center?.lat;
            const lon = el.lon ?? el.center?.lon;
            if (lat == null || lon == null) return null;
            return { lat, lng: lon };
          })
          .filter(Boolean);
        return points.length > 0 ? points : fallbackPoliceStations(cacheKey);
      } catch (e) {
        return fallbackPoliceStations(cacheKey);
      }
    })();
  }

  const result = await _policeStationsFetch[cacheKey];
  if (cityStore) cityStore.policeStations = result;
  return result;
}

async function computeCrimeScore(lat, lng, cityKey) {
  try {
    const stations = await fetchPoliceStations(cityKey);

    let minDist = Infinity;
    for (const s of stations) {
      const d = haversineKm(lng, lat, s.lng, s.lat);
      if (d < minDist) minDist = d;
    }

    if (!isFinite(minDist)) return 100;

    // Convert crow-flies km to estimated police driving time:
    //   road factor ~1.3x crow-flies; avg speed ~40 km/h (urban)
    //   drivingMin = minDist * 1.3 * 60 / 40 = minDist * 1.95
    const drivingMin = minDist * 1.95;
    // 5 min drive = 100; -10 per minute after
    const score = Math.max(0, 100 - Math.max(0, Math.ceil(drivingMin - 5)) * 10);
    return score;
    } catch (err) {
    console.warn('computeCrimeScore failed', err);
    return 50;
  }
}

async function computeSchoolScore(lat, lng, cityKey) {
  try {
    const poiPoints = await getCityPoiPoints(cityKey).catch(() => []);
    const osmSchools = [];
    for (const p of poiPoints) {
      const cats = Array.isArray(p?.properties?.category) ? p.properties.category : [];
      if (!cats.includes('schools')) continue;
      const coords = p?.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;
      osmSchools.push({ lng: coords[0], lat: coords[1] });
    }

    const fallbackSchools = getCityConfig(cityKey || 'littleton').schools || [];
    const schools = osmSchools.length > 0 ? osmSchools : fallbackSchools;
    if (schools.length === 0) return 50;
    let minDist = Infinity;
    for (const s of schools) {
      const d = haversineKm(lng, lat, s.lng, s.lat);
      if (d < minDist) minDist = d;
    }

    if (!isFinite(minDist)) return 50;

    const maxDist = MAX_DIST_KM.schools || 1.5;
    if (minDist >= maxDist) return 0;
    return Math.round((1 - minDist / maxDist) * 100);
  } catch (err) {
    console.warn('computeSchoolScore failed', err);
    return 50;
  }
}

async function getRouteDistance(fromLon, fromLat, toLon, toLat, modeOrProfiles = []) {
  // modeOrProfiles may be a string 'walking'|'cycling' or an array of OSRM profile names.
  let mode = null;
  if (typeof modeOrProfiles === 'string') mode = modeOrProfiles;
  else if (Array.isArray(modeOrProfiles) && modeOrProfiles.length > 0) {
    const p0 = String(modeOrProfiles[0]).toLowerCase();
    if (p0.includes('walk') || p0 === 'foot') mode = 'walking';
    else mode = 'cycling';
  } else {
    mode = 'walking';
  }

  // Try OpenRouteService first when key is available
  if (ORS_API_KEY) {
    const candidates = ORS_PROFILES[mode] || [];
    for (const prof of candidates) {
      const key = `ors:${prof}:${fromLon},${fromLat}->${toLon},${toLat}`;
      if (routeCache.has(key)) return routeCache.get(key);
      const url = `${ROUTE_SERVICE.orsBaseUrl}/v2/directions/${prof}?start=${fromLon},${fromLat}&end=${toLon},${toLat}`;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, { headers: { Accept: 'application/json', Authorization: ORS_API_KEY }, signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) continue;
        const data = await res.json();
        if (data && data.routes && data.routes[0] && data.routes[0].summary && typeof data.routes[0].summary.distance === 'number') {
          const km = data.routes[0].summary.distance / 1000;
          routeCache.set(key, km);
          return km;
        }
      } catch (err) {
        continue;
      }
    }
  }

  // Fallback to OSRM profiles (single endpoint, retry once on failure)
  const osrmProfiles = mode === 'walking' ? ROUTE_SERVICE.walkingProfiles : ROUTE_SERVICE.cyclingProfiles;
  const tryProfiles = Array.isArray(modeOrProfiles) && modeOrProfiles.length > 0 ? modeOrProfiles : osrmProfiles;
  for (const profile of tryProfiles) {
    const key = `osrm:${profile}:${fromLon},${fromLat}->${toLon},${toLat}`;
    if (routeCache.has(key)) return routeCache.get(key);
    const url = `${ROUTE_SERVICE.baseUrl}/route/v1/${profile}/${fromLon},${fromLat};${toLon},${toLat}?overview=false&alternatives=false&steps=false`;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) { await new Promise(r => setTimeout(r, 1000)); continue; }
        const data = await res.json();
        if (data && data.routes && data.routes[0] && typeof data.routes[0].distance === 'number') {
          const km = data.routes[0].distance / 1000;
          routeCache.set(key, km);
          return km;
        }
      } catch (err) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
    }
  }

  return null;
}

// Build supplemental point arrays from the unified POI list (bundled at build time)
const CATEGORY_MAPPING = {
  coffee: 'coffee',
  restaurant: 'restaurant',
  grocery: 'grocery',
  parks: 'park',
  trailheads: 'trail',
  nature: 'trail',
  medical: 'healthcare',
  busStops: 'busStop',
  busStop: 'busStop',
  schools: 'schools',
};

const CITY_POINT_DATA = {
  littleton: littletonPois,
  centennial: centennialPois,
  englewood: englewoodPois,
};

let _cityPoiFetch = {};

function inBounds(lat, lon, bounds, pad = 0) {
  return lat <= bounds.north + pad
    && lat >= bounds.south - pad
    && lon <= bounds.east + pad
    && lon >= bounds.west - pad;
}

function boundaryToFeatures(boundaryGeo) {
  if (!boundaryGeo) return [];
  if (boundaryGeo.type === 'FeatureCollection' && Array.isArray(boundaryGeo.features)) {
    return boundaryGeo.features.filter((f) => f?.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'));
  }
  if (boundaryGeo.type === 'Feature' && boundaryGeo.geometry && (boundaryGeo.geometry.type === 'Polygon' || boundaryGeo.geometry.type === 'MultiPolygon')) {
    return [boundaryGeo];
  }
  if (boundaryGeo.type === 'Polygon' || boundaryGeo.type === 'MultiPolygon') {
    return [{ type: 'Feature', properties: {}, geometry: boundaryGeo }];
  }
  return [];
}

function isPointInsideBoundary(lon, lat, boundaryFeatures) {
  if (!Array.isArray(boundaryFeatures) || boundaryFeatures.length === 0) return false;
  const pt = turfPoint([lon, lat]);
  for (const f of boundaryFeatures) {
    try {
      if (booleanPointInPolygon(pt, f)) return true;
    } catch (_e) {
      continue;
    }
  }
  return false;
}

function supplementalPointsForCity(cityKey, boundaryFeatures = null) {
  const cityData = CITY_POINT_DATA[cityKey];
  if (!cityData) return [];
  const points = [];
  const hasBoundary = Array.isArray(boundaryFeatures) && boundaryFeatures.length > 0;
  for (const [cat, list] of Object.entries(cityData)) {
    const mapped = CATEGORY_MAPPING[cat] || cat;
    for (const obj of list) {
      if (!obj || typeof obj.lat !== 'number' || typeof obj.lon !== 'number') continue;
      if (hasBoundary && !isPointInsideBoundary(obj.lon, obj.lat, boundaryFeatures)) continue;
      points.push(turfPoint([obj.lon, obj.lat], {
        category: [mapped],
        name: obj.name || null,
        note: obj.note || null,
      }));
    }
  }
  // If boundary-based filtering produced zero points (possible when boundary is malformed),
  // fall back to returning the full city dataset so overlays still render.
  if (hasBoundary && points.length === 0) {
    // build unfiltered points
    for (const [cat, list] of Object.entries(cityData)) {
      const mapped = CATEGORY_MAPPING[cat] || cat;
      for (const obj of list) {
        if (!obj || typeof obj.lat !== 'number' || typeof obj.lon !== 'number') continue;
        points.push(turfPoint([obj.lon, obj.lat], {
          category: [mapped],
          name: obj.name || null,
          note: obj.note || null,
        }));
      }
    }
    if (typeof console !== 'undefined' && console.warn) console.warn('Boundary filtering removed all supplemental POIs for', cityKey, '- falling back to unfiltered city POIs');
  }
  return points;
}

// Query bbox for the OSM POI fetch. Prefer the real city boundary (which can
// extend well beyond the fallback rectangle, e.g. Littleton's Trailmark area
// is south of the fallback bounds), padded slightly, so all in-city amenities
// are included. Falls back to the configured bounds when no boundary is known.
function osmQueryBbox(city, boundaryFeatures) {
  const pad = 0.01; // ~1.1 km, enough to catch amenities just outside the line
  if (Array.isArray(boundaryFeatures) && boundaryFeatures.length > 0) {
    try {
      const bbox = turfBbox(turfFeatureCollection(boundaryFeatures));
      if (bbox && bbox.length === 4) {
        return {
          south: bbox[1] - pad,
          west: bbox[0] - pad,
          north: bbox[3] + pad,
          east: bbox[2] + pad,
        };
      }
    } catch (_err) {
      // fall through to configured bounds
    }
  }
  return city.bounds;
}

function cityOverpassQuery(city, bbox) {
  const bboxOpts = bbox || city.bounds;
  const { south, west, north, east } = bboxOpts;
  const b = `(${south},${west},${north},${east})`;
  return `[out:json][timeout:30];(\n`
    + `node["amenity"~"cafe|restaurant|fast_food|food_court|hospital|clinic|doctors|pharmacy|dentist|school|college|university|kindergarten|bus_station"]${b};\n`
    + `node["shop"~"supermarket|grocery|convenience|greengrocer"]${b};\n`
    + `node["highway"="bus_stop"]${b};\n`
    + `node["public_transport"~"platform|bus_stop|stop_position"]${b};\n`
    + `node["railway"~"station|tram_stop|halt|light_rail|subway"]${b};\n`
    + `node["leisure"~"park|nature_reserve|recreation_ground"]${b};\n`
    + `node["highway"~"path|track|footway|pedestrian|cycleway"]${b};\n`
    + `node["building"~"school|college|university|kindergarten|hospital|clinic"]${b};\n`
    + `way["amenity"~"school|college|university|kindergarten|hospital|clinic|doctors|pharmacy|dentist|bus_station"]${b};\n`
    + `way["shop"~"supermarket|grocery|convenience|greengrocer"]${b};\n`
    + `way["railway"~"station|tram_stop|halt|light_rail|subway"]${b};\n`
    + `way["leisure"~"park|nature_reserve|recreation_ground"]${b};\n`
    + `way["highway"~"path|track|footway|pedestrian|cycleway"]${b};\n`
    + `way["building"~"school|college|university|kindergarten|hospital|clinic"]${b};\n`
    + `relation["amenity"~"school|college|university|kindergarten|hospital|clinic|bus_station"]${b};\n`
    + `relation["railway"~"station|tram_stop|halt|light_rail|subway"]${b};\n`
    + `relation["leisure"~"park|nature_reserve|recreation_ground"]${b};\n`
    + `relation["route"="bicycle"]${b};\n`
    + `);out center;`;
}

export async function getCityPoiPoints(cityKey = 'littleton') {
  const cacheKey = cityKey || 'littleton';
  const cityStore = getCityDataContainer(cacheKey);
  if (cityStore?.poiPoints) return cityStore.poiPoints;

  if (!_cityPoiFetch[cacheKey]) {
    _cityPoiFetch[cacheKey] = (async () => {
      const city = getCityConfig(cacheKey);
      const cityBoundary = await getCityBoundaryAsync(cacheKey).catch(() => null);
      const boundaryFeatures = boundaryToFeatures(cityBoundary);
      const supplemental = supplementalPointsForCity(cacheKey, boundaryFeatures);
      const hasBoundary = boundaryFeatures.length > 0;

      try {
        const query = cityOverpassQuery(city, osmQueryBbox(city, boundaryFeatures));
        const data = await fetchOverpassJson(query);
        if (!data) return supplemental;
        const els = Array.isArray(data?.elements) ? data.elements : [];
        const points = [];
        const seen = new Set();

        for (const el of els) {
          const tags = el?.tags || {};
          const cats = classifyOSM(tags);
          if (cats.length === 0) continue;

          const lat = el.lat ?? el.center?.lat;
          const lon = el.lon ?? el.center?.lon;
          if (typeof lat !== 'number' || typeof lon !== 'number') continue;
          if (hasBoundary) {
            if (!isPointInsideBoundary(lon, lat, boundaryFeatures)) continue;
          } else if (!inBounds(lat, lon, city.bounds, 0.0)) {
            continue;
          }

          const key = `${lat.toFixed(6)},${lon.toFixed(6)}:${cats.slice().sort().join('|')}`;
          if (seen.has(key)) continue;
          seen.add(key);
          points.push(turfPoint([lon, lat], { ...tags, category: cats }));
        }

        const merged = points.concat(supplemental);
        if (cityStore) cityStore.poiPoints = merged;
        return merged;
      } catch (_err) {
        if (cityStore) cityStore.poiPoints = supplemental;
        return supplemental;
      }
    })();
  }

  return _cityPoiFetch[cacheKey];
}

function distToScore(d) {
  if (!isFinite(d)) return 0;
  if (d <= 0.3) return 100;
  const extraMeters = (d - 0.3) * 1000;
  const steps = Math.ceil(extraMeters / 100);
  return Math.max(0, 100 - steps * 10);
}

function classifyOSM(tags) {
  if (!tags) return [];
  const results = [];
  const a = (tags.amenity || '').toLowerCase();
  const s = (tags.shop || '').toLowerCase();
  const b = (tags.building || '').toLowerCase();
  const h = (tags.highway || '').toLowerCase();
  const l = (tags.leisure || '').toLowerCase();
  const pt = tags.public_transport ? String(tags.public_transport).toLowerCase() : '';
  const name = (tags.name || '').toLowerCase();
  const cuisine = tags.cuisine ? String(tags.cuisine).toLowerCase() : '';

  // broaden category matching to reduce false negatives
  const r = (tags.railway || '').toLowerCase();

  // Coffee: cafe/shop=coffee/name includes coffee
  if (
    a === 'cafe' ||
    s.includes('coffee') ||
    s === 'tea_house' ||
    cuisine.includes('coffee') ||
    name.includes('coffee')
  ) {
    results.push('coffee');
  }

  // Restaurant: include fast_food and food_court
  if (a === 'restaurant' || a === 'fast_food' || a === 'food_court') results.push('restaurant');

  // Grocery: supermarkets, convenience stores, markets
  if (
    s === 'supermarket' ||
    s === 'grocery' ||
    s === 'convenience' ||
    s === 'greengrocer' ||
    a === 'supermarket' ||
    s.includes('market')
  ) {
    results.push('grocery');
  }

  // Transit: include bus and rail stops (bus_stop, tram_stop, station, light_rail, etc.)
  if (
    h === 'bus_stop' ||
    a === 'bus_station' ||
    pt === 'platform' ||
    pt === 'bus_stop' ||
    pt === 'stop_position' ||
    r === 'station' ||
    r === 'tram_stop' ||
    r === 'halt' ||
    r === 'light_rail' ||
    r === 'subway'
  ) {
    results.push('busStop');
  }

  // Trail detection: paths, tracks, footways, and named trails
  if (
    ['path', 'track', 'trailhead', 'footway', 'pedestrian'].includes(h) ||
    name.includes('trail') ||
    (name && NAMED_TRAILS.some(t => name.includes(t)))
  ) {
    results.push('trail');
  }

  // Park detection: leisure areas, parks, nature reserves, recreation grounds
  if (
    l === 'park' ||
    l === 'nature_reserve' ||
    l === 'recreation_ground' ||
    name.includes('park')
  ) {
    results.push('park');
  }

  // Healthcare
  if (a === 'hospital' || a === 'clinic' || a === 'doctors' || a === 'pharmacy' || a === 'dentist' || tags.healthcare || b === 'hospital' || b === 'clinic') {
    results.push('healthcare');
  }

  // Schools
  if (a === 'school' || a === 'college' || a === 'university' || a === 'kindergarten' || b === 'school' || b === 'college' || b === 'university' || b === 'kindergarten' || tags.amenity === 'school') {
    results.push('schools');
  }

  return results;
}

function nearestAndCounts(poiPoints, pt, cityKey = 'littleton') {
  const categories = ['coffee', 'restaurant', 'grocery', 'trail', 'park', 'busStop', 'healthcare', 'schools'];
  const nearest = {};
  const nearestCoords = {};
  const counts = {};
  const candidates = {};
  for (const c of categories) {
    nearest[c] = Infinity; nearestCoords[c] = null; counts[c] = 0; candidates[c] = [];
  }
  // Process any POI points (if supplied) — these might be turf points with `.properties`.
  for (const p of poiPoints) {
    const d = turfDistance(pt, p, { units: 'kilometers' });
    const props = p.properties || {};
    // If point was created from the unified list we'll tag it with `category` in properties;
    // prefer that to OSM classification.
    const cats = props.category ? (Array.isArray(props.category) ? props.category : [props.category]) : classifyOSM(props);
    const coords = p.geometry && p.geometry.coordinates ? p.geometry.coordinates : null; // [lon, lat]
    for (const cat of cats) {
      if (!Object.prototype.hasOwnProperty.call(nearest, cat)) continue;
      if (d < nearest[cat]) { nearest[cat] = d; nearestCoords[cat] = coords; }
      if (d <= MAX_DIST_KM[cat]) counts[cat]++;
      if (coords) candidates[cat].push({ coords, dist: d });
    }
  }

  // Backward-compat fallback for calls without pre-fetched points.
  if (!Array.isArray(poiPoints) || poiPoints.length === 0) {
    const localSupplemental = supplementalPointsForCity(cityKey);
    for (const sp of localSupplemental) {
      const coords = sp.geometry?.coordinates;
      if (!coords) continue;
      const cats = Array.isArray(sp.properties?.category) ? sp.properties.category : [];
      const d = turfDistance(pt, sp, { units: 'kilometers' });
      for (const cat of cats) {
        if (!Object.prototype.hasOwnProperty.call(nearest, cat)) continue;
        if (d < nearest[cat]) { nearest[cat] = d; nearestCoords[cat] = coords; }
        if (d <= MAX_DIST_KM[cat]) counts[cat]++;
        candidates[cat].push({ coords, dist: d });
      }
    }
  }

  // Use authoritative trail polylines so houses along a linear trail are
  // credited with their true distance to the trail rather than the nearest
  // sparse sample point.
  if (Object.prototype.hasOwnProperty.call(nearest, 'trail')) {
    const ptCoords = pt?.geometry?.coordinates;
    if (ptCoords && Array.isArray(ptCoords) && ptCoords.length >= 2) {
      const poly = nearestTrailPolylineDistance(ptCoords[0], ptCoords[1]);
      if (poly.km < nearest.trail) {
        nearest.trail = poly.km;
        nearestCoords.trail = poly.coords;
      }
      if (poly.km <= MAX_DIST_KM.trail) counts.trail++;
      if (poly.coords) candidates.trail.push({ coords: poly.coords, dist: poly.km });
    }
  }

  return { nearest, counts, nearestCoords, candidates };
}

async function computeScoresFromNearest(nearest, opts = {}) {
  const { nearestCoords = {}, pt = null, useRouting = false, candidates = {} } = opts;
  const walking = {};
  const biking = {};
  const walkingKm = {};
  const bikingKm = {};
  const combined = {};
  const usedCoords = {}; // [lon,lat] of the chosen candidate per category (for UI)

  // Accept pt either as turf point or coordinate array [lon, lat]
  let ptCoords = null;
  if (pt) {
    if (Array.isArray(pt)) ptCoords = pt;
    else if (pt.geometry && Array.isArray(pt.geometry.coordinates)) ptCoords = pt.geometry.coordinates;
  }

  for (const key of Object.keys(MAX_DIST_KM)) {
    const crowKm = nearest[key];
    walkingKm[key] = isFinite(crowKm) ? crowKm : Infinity;
    bikingKm[key] = isFinite(crowKm) ? crowKm : Infinity;
    usedCoords[key] = nearestCoords[key] || null;

    const topCandidates = (candidates[key] || [])
      .slice()
      .sort((a, b) => a.dist - b.dist)
      .slice(0, ROUTE_CANDIDATES[key] || 3);

    if (useRouting && topCandidates.length > 0 && ptCoords) {
      const walkResults = await Promise.all(
        topCandidates.map(c =>
          getRouteDistance(ptCoords[0], ptCoords[1], c.coords[0], c.coords[1], 'walking')
            .catch(() => null)
        )
      );
      for (let i = 0; i < walkResults.length; i++) {
        const d = walkResults[i];
        if (typeof d === 'number' && d < walkingKm[key]) {
          walkingKm[key] = d;
          usedCoords[key] = topCandidates[i].coords;
        }
      }

      const bikeResults = await Promise.all(
        topCandidates.map(c =>
          getRouteDistance(ptCoords[0], ptCoords[1], c.coords[0], c.coords[1], 'cycling')
            .catch(() => null)
        )
      );
      for (let i = 0; i < bikeResults.length; i++) {
        const d = bikeResults[i];
        if (typeof d === 'number' && d < bikingKm[key]) {
          bikingKm[key] = d;
          // prefer walking candidate for UI coords, but fall back to biking
          if (!usedCoords[key]) usedCoords[key] = topCandidates[i].coords;
        }
      }
    }

    walking[key] = distToScore(walkingKm[key]);
    biking[key] = distToScore(bikingKm[key]);

    const wScore = walking[key] || 0;
    const bScore = biking[key] || 0;
    const comb = (ROUTING_WEIGHTS.walking * wScore + ROUTING_WEIGHTS.biking * bScore) / (ROUTING_WEIGHTS.walking + ROUTING_WEIGHTS.biking);
    combined[key] = Math.round(comb);
  }

  return { scores: combined, walking, biking, walkingKm, bikingKm, usedCoords };
}

// Combine trail (80%) and park (20%) scores into the nature dimension
function computeNatureComposite(trailScore, parkScore) {
  const t = typeof trailScore === 'number' && isFinite(trailScore) ? trailScore : 0;
  const p = typeof parkScore === 'number' && isFinite(parkScore) ? parkScore : 0;
  return Math.round(0.8 * t + 0.2 * p);
}

function normalizeDimensionScores(rawScores = {}) {
  return {
    ...rawScores,
    nature: computeNatureComposite(rawScores.trail ?? 0, rawScores.park ?? 0),
  };
}

function buildScoredFeature(feature, scores) {
  const safeScores = scores || {};
  return {
    ...feature,
    properties: {
      ...(feature.properties || {}),
      overlayScores: safeScores,
      composite: computeScore(safeScores),
    },
  };
}

export async function getScoredZoneFeatures(cityKey = 'littleton') {
  const cityStore = getCityDataContainer(cityKey);
  if (cityStore?.scoredZones) return cityStore.scoredZones;

  if (!_scoredZoneFetch[cityKey]) {
    _scoredZoneFetch[cityKey] = (async () => {
      const base = await getAllZoneFeaturesAsync(cityKey);
      const poiPoints = await getCityPoiPoints(cityKey).catch(() => []);
      const features = Array.isArray(base?.features) ? base.features : [];

      const scoredFeatures = await Promise.all(
        features.map(async (feature) => {
          try {
            const center = turfCentroid(feature);
            const { nearest, nearestCoords, candidates } = nearestAndCounts(poiPoints, center, cityKey);
            const scoring = await computeScoresFromNearest(nearest, {
              nearestCoords,
              pt: center,
              useRouting: false,
              candidates,
            });
            const scores = normalizeDimensionScores(scoring.scores);
            const centerCoords = center.geometry?.coordinates;
            if (centerCoords) {
              scores.bikeInfra = await computeBikeInfraScore(centerCoords[1], centerCoords[0], cityKey);
              scores.crime = await computeCrimeScore(centerCoords[1], centerCoords[0], cityKey);
              scores.schools = await computeSchoolScore(centerCoords[1], centerCoords[0], cityKey);
            }
            return buildScoredFeature(feature, scores);
          } catch (_err) {
            const fallback = feature?.properties?.scores || {};
            return buildScoredFeature(feature, normalizeDimensionScores(fallback));
          }
        })
      );

      const collection = { type: 'FeatureCollection', features: scoredFeatures };
      if (cityStore) cityStore.scoredZones = collection;
      return collection;
    })();
  }

  return _scoredZoneFetch[cityKey];
}

export async function computeScoreAtPoint(lat, lng, opts = {}) {
  const cityKey = opts.cityKey || 'littleton';
  const poiPoints = await getCityPoiPoints(cityKey).catch(() => []);
  const pt = turfPoint([lng, lat]);
  const { nearest, nearestCoords, candidates } = nearestAndCounts(poiPoints, pt, cityKey);
  const scoring = await computeScoresFromNearest(nearest, { nearestCoords, pt, useRouting: true, candidates });
  const rawScores = scoring.scores;
  const scores = normalizeDimensionScores(rawScores);
  scores.bikeInfra = await computeBikeInfraScore(lat, lng, cityKey).catch(() => 0);
  scores.crime = await computeCrimeScore(lat, lng, cityKey).catch(() => 50);
  scores.schools = await computeSchoolScore(lat, lng, cityKey).catch(() => 50);

  const distances = { ...nearest };
  // Update distances to show routed walking distances (minimum across candidates)
  for (const key of Object.keys(scoring.walkingKm)) {
    if (isFinite(scoring.walkingKm[key])) {
      distances[key] = scoring.walkingKm[key];
    }
  }

  // Walking (5 km/h) and biking (15 km/h) time estimates in minutes
  const routing = {};
  for (const key of Object.keys(scoring.walkingKm)) {
    const walkKm = scoring.walkingKm[key];
    const bikeKm = scoring.bikingKm[key];
    if (isFinite(walkKm) && isFinite(bikeKm)) {
      routing[key] = {
        walk: Math.round(walkKm * 12),
        bike: Math.round(bikeKm * 4),
      };
    }
  }
  routing.nature = routing.trail || routing.park || null;

  const zones = getAllZoneFeatures(cityKey).features;
  let matched = null;
  for (const z of zones) {
    try {
      if (!z || !z.geometry) continue;
      if (booleanPointInPolygon(pt, z)) {
        const nm = (z.properties && (z.properties.Neighborho || z.properties.name)) || '';
        if (String(nm).toLowerCase().includes('outside')) continue;
        matched = z; break;
      }
    } catch (err) { continue; }
  }
  if (!matched) {
    let minD = Infinity;
    for (const z of zones) {
      const c = turfCentroid(z);
      const d = turfDistance(pt, c, { units: 'kilometers' });
      if (d < minD) { minD = d; matched = z; }
    }
  }

  const composite = computeScore(scores, opts.weights);
  const neighborhood = matched ? matched.properties.name : null;

  // Reverse geocode to get a readable address for the clicked point
  let address = null;
  try {
    const rev = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&limit=1`,
      { headers: { 'User-Agent': 'LivableIndex/1.0' } }
    );
    if (rev.ok) {
      const revData = await rev.json();
      if (revData && revData.display_name) {
        const parts = revData.display_name.split(', ');
        // Take the first 2-3 parts: e.g. "7330 S Broadway, Littleton"
        address = parts.slice(0, Math.min(3, parts.length)).join(', ');
      }
    }
  } catch (err) {
    // reverse geocode failed – fall back to neighborhood name only
  }

  return {
    name: address || neighborhood || 'Local area',
    scores,
    composite,
    notes: matched ? matched.properties.notes : '',
    neighborhood,
    address,
    distances,
    routing,
    zoneId: matched ? matched.properties.id : null,
  };
}

export function getGridFeatures(cityKey = 'littleton', cellSizeKm = 0.2) {
  const city = getCityConfig(cityKey);
  const bbox = [city.bounds.west, city.bounds.south, city.bounds.east, city.bounds.north];
  const grid = squareGrid(bbox, cellSizeKm, { units: 'kilometers' });
  const zones = getAllZoneFeatures(cityKey).features;

  for (const cell of grid.features) {
    const c = turfCentroid(cell);
    let matched = null;
    for (const z of zones) {
      if (booleanPointInPolygon(c, z)) { matched = z; cell.properties.source = 'zone'; cell.properties.zoneId = z.properties.id; break; }
    }
    if (!matched) {
      let nearest = null; let minD = Infinity;
      for (const z of zones) { const zc = turfCentroid(z); const d = turfDistance(c, zc, { units: 'kilometers' }); if (d < minD) { minD = d; nearest = z; } }
      matched = nearest; cell.properties.source = 'nearest'; cell.properties.zoneId = matched.properties.id;
    }
    const baseScores = { ...matched.properties.scores };
    cell.properties.scores = baseScores;
    cell.properties.composite = computeScore(baseScores);
    cell.properties.name = matched.properties.name;
    cell.properties.notes = matched.properties.notes;
  }

  return grid;
}

export async function computeGridWithOSM(cityKey = 'littleton', cellSizeKm = 0.2) {
  const poiPoints = await getCityPoiPoints(cityKey).catch(() => []);
  const grid = getGridFeatures(cityKey, cellSizeKm);
  for (const cell of grid.features) {
    const c = turfCentroid(cell);
    const { nearest, nearestCoords, candidates } = nearestAndCounts(poiPoints, c, cityKey);
    const scoring = await computeScoresFromNearest(nearest, { nearestCoords, pt: c, useRouting: true, candidates });
    const rawScores = scoring.scores;
    cell.properties.scores = {
      ...rawScores,
      nature: computeNatureComposite(rawScores.trail ?? 0, rawScores.park ?? 0),
    };
    cell.properties.composite = computeScore(cell.properties.scores);
    cell.properties.distances = { ...nearest };
  }

  return grid;
}

export const HEX_CELL_SIDE_KM = 0.2;

const CACHE_VERSION = 'v4';
function gridCacheKey(cityKey, cellSideKm) {
  return `liv_grid_cache_${cityKey}_${cellSideKm}_${CACHE_VERSION}_strictboundary`;
}

function loadGridCache(cityKey, cellSideKm) {
  try {
    const raw = localStorage.getItem(gridCacheKey(cityKey, cellSideKm));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
        return parsed;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function saveGridCache(cityKey, cellSideKm, collection) {
  try {
    localStorage.setItem(gridCacheKey(cityKey, cellSideKm), JSON.stringify(collection));
  } catch (_e) {
    // localStorage full or unavailable — silently skip
  }
}

let _gridOverlayFetch = null;
let _gridOverlayFetchKey = null;

function isValidOverlayMaskFeature(feature) {
  if (!feature || !feature.geometry) return false;
  const type = feature.geometry.type;
  if (type !== 'Polygon' && type !== 'MultiPolygon') return false;
  const name = String(feature.properties?.Neighborho || feature.properties?.name || '').toLowerCase();
  if (name.includes('outside')) return false;
  return true;
}

function buildOverlayMask(maskFeatures) {
  if (!Array.isArray(maskFeatures) || maskFeatures.length === 0) return null;
  if (maskFeatures.length === 1) return maskFeatures[0];
  try {
    const unioned = turfUnion(turfFeatureCollection(maskFeatures));
    if (unioned && unioned.geometry) return unioned;
  } catch (_err) {
    // fall through
  }
  return null;
}

function clipCellsToMask(cells, maskFeatures) {
  const mask = buildOverlayMask(maskFeatures);
  if (!mask) return cells;

  const clipped = [];
  for (const cell of cells) {
    const centroid = turfCentroid(cell);
    if (booleanPointInPolygon(centroid, mask)) {
      clipped.push(cell);
      continue;
    }

    let piece = null;
    try {
      piece = turfIntersect(turfFeatureCollection([cell, mask]));
    } catch (_err) {
      piece = null;
    }
    if (!piece || !piece.geometry) continue;
    const gt = piece.geometry.type;
    if (gt !== 'Polygon' && gt !== 'MultiPolygon') continue;
    piece.properties = { ...(cell.properties || {}) };
    clipped.push(piece);
  }

  return clipped.length > 0 ? clipped : cells;
}

let _cityBoundaryFetch = {};

async function fetchCityBoundaryAsync(cityKey = 'littleton') {
  try {
    const city = getCityConfig(cityKey);
    const censusBase = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/4/query';
    const censusParams = new URLSearchParams({
      where: `STATE='08' AND BASENAME='${city.label.replace(/'/g, "''")}'`,
      outFields: 'NAME,BASENAME,STATE',
      outSR: '4326',
      f: 'geojson',
    });
    const censusUrl = `${censusBase}?${censusParams.toString()}`;
    const censusRes = await fetch(censusUrl);
    if (censusRes.ok) {
      const censusGeo = await censusRes.json();
      if (censusGeo && censusGeo.type === 'FeatureCollection' && Array.isArray(censusGeo.features) && censusGeo.features.length > 0) {
        return censusGeo;
      }
    }

    // Fallback to Nominatim when TIGER is unavailable.
    const name = encodeURIComponent(city.label);
    const q = `https://nominatim.openstreetmap.org/search.php?q=${name}+CO&polygon_geojson=1&format=json&limit=1`;
    const r = await fetch(q);
    if (!r.ok) return null;
    const dat = await r.json();
    if (!dat || dat.length === 0) return null;
    const geo = dat[0].geojson;
    if (!geo) return null;
    return geo;
  } catch (err) {
    console.warn('Failed to fetch city boundary', err && err.message);
    return null;
  }
}

export async function getCityBoundaryAsync(cityKey = 'littleton') {
  const cityStore = getCityDataContainer(cityKey);
  if (cityStore?.cityBoundaryGeojson) return cityStore.cityBoundaryGeojson;
  if (!_cityBoundaryFetch[cityKey]) {
    _cityBoundaryFetch[cityKey] = fetchCityBoundaryAsync(cityKey);
  }
  const result = await _cityBoundaryFetch[cityKey];
  if (result && cityStore) cityStore.cityBoundaryGeojson = result;
  return result;
}

export async function getGridOverlayFeatures(cityKey = 'littleton', cellSideKm = HEX_CELL_SIDE_KM) {
  const city = getCityConfig(cityKey);
  const cacheKey = `grid:${cityKey}:${cellSideKm}`;
  const cityStore = getCityDataContainer(cityKey);

  // Check in-memory cache first
  if (cityStore?.gridOverlay && cityStore.gridOverlayKey === cacheKey) {
    return cityStore.gridOverlay;
  }

  // Check localStorage cache (survives hard refresh)
  const cached = loadGridCache(cityKey, cellSideKm);
  if (cached) {
    if (cityStore) {
      cityStore.gridOverlay = cached;
      cityStore.gridOverlayKey = cacheKey;
    }
    return cached;
  }

  if (!_gridOverlayFetch || _gridOverlayFetchKey !== cacheKey) {
    _gridOverlayFetchKey = cacheKey;
    _gridOverlayFetch = (async () => {
      const zoneCollection = await getAllZoneFeaturesAsync(cityKey).catch(() => null);
      const poiPoints = await getCityPoiPoints(cityKey).catch(() => []);
      let maskFeatures = city.neighborhoodUrl
        ? (zoneCollection?.features || []).filter(isValidOverlayMaskFeature)
        : [];

      // Include the OSM city boundary for a precise city-shaped clip
      const cityBoundary = await getCityBoundaryAsync(cityKey).catch(() => null);
      if (cityBoundary) {
        const boundaryFeatures = [];
        if (cityBoundary.type === 'Feature') {
          boundaryFeatures.push(cityBoundary);
        } else if (cityBoundary.type === 'FeatureCollection') {
          for (const f of cityBoundary.features) {
            boundaryFeatures.push(f);
          }
        } else if (cityBoundary.type === 'Polygon' || cityBoundary.type === 'MultiPolygon') {
          boundaryFeatures.push({ type: 'Feature', properties: {}, geometry: cityBoundary });
        }

        // For Centennial/Englewood (no neighborhood polygons), clip strictly to city boundary.
        if (!city.neighborhoodUrl) {
          maskFeatures = boundaryFeatures;
        } else {
          maskFeatures.push(...boundaryFeatures);
        }
      }

      // For Centennial and Englewood we enforce strict city clipping to avoid spillover.
      if ((cityKey === 'centennial' || cityKey === 'englewood') && cityBoundary) {
        const strictBoundary = boundaryToFeatures(cityBoundary);
        if (strictBoundary.length > 0) {
          maskFeatures = strictBoundary;
        }
      }

      // Use mask bounding box for a tighter grid when available.
      const mask = buildOverlayMask(maskFeatures);
      let gridBbox;
      if (mask) {
        try { gridBbox = turfBbox(mask); } catch (_e) { gridBbox = null; }
      }
      if (!gridBbox) {
        gridBbox = [city.bounds.west, city.bounds.south, city.bounds.east, city.bounds.north];
      }

      const grid = hexGrid(gridBbox, cellSideKm, { units: 'kilometers' });

      const overlayCells = clipCellsToMask(grid.features, maskFeatures);

      const scoredCells = await Promise.all(
        overlayCells.map(async (cell) => {
          try {
            const center = turfCentroid(cell);
            const { nearest, nearestCoords, candidates } = nearestAndCounts(poiPoints, center, cityKey);
            const scoring = await computeScoresFromNearest(nearest, {
              nearestCoords, pt: center, useRouting: false, candidates,
            });
            const scores = normalizeDimensionScores(scoring.scores);
            const cc = center.geometry?.coordinates;
            if (cc) {
              scores.bikeInfra = await computeBikeInfraScore(cc[1], cc[0], cityKey).catch(() => 0);
              scores.crime = await computeCrimeScore(cc[1], cc[0], cityKey).catch(() => 50);
              scores.schools = await computeSchoolScore(cc[1], cc[0], cityKey).catch(() => 50);
            }
            return buildScoredFeature(cell, scores);
          } catch (_err) {
            return buildScoredFeature(cell, normalizeDimensionScores({}));
          }
        })
      );

      const collection = { type: 'FeatureCollection', features: scoredCells };
      saveGridCache(cityKey, cellSideKm, collection);
      if (cityStore) {
        cityStore.gridOverlay = collection;
        cityStore.gridOverlayKey = cacheKey;
      }
      return collection;
    })();
  }

  return _gridOverlayFetch;
}

export function isPointInCity(lat, lng, cityKey = 'littleton') {
  const city = getCityConfig(cityKey);
  const pt = turfPoint([lng, lat]);
  try {
    if (typeof window !== 'undefined' && window.__liv_city_boundary_layers_by_city && window.__liv_city_boundary_layers_by_city[cityKey]) {
      const layer = window.__liv_city_boundary_layers_by_city[cityKey];
      if (typeof layer.toGeoJSON === 'function') {
        const geo = layer.toGeoJSON(); if (geo) {
          if (geo.type === 'FeatureCollection') for (const f of geo.features) if (booleanPointInPolygon(pt, f)) return true;
          else if (geo.type === 'Feature') if (booleanPointInPolygon(pt, geo)) return true;
          else if (geo.type === 'Polygon' || geo.type === 'MultiPolygon') { if (booleanPointInPolygon(pt, { type: 'Feature', properties: {}, geometry: geo })) return true; }
        }
      }
    }
  } catch (err) { console.warn('city boundary check failed', err && err.message); }

  const cityStore = getCityDataContainer(cityKey);
  const cachedBoundary = boundaryToFeatures(cityStore?.cityBoundaryGeojson);
  if (cachedBoundary.length > 0) {
    return isPointInsideBoundary(lng, lat, cachedBoundary);
  }

  const features = getAllZoneFeatures(cityKey).features;
  for (const f of features) { if (!f || !f.geometry) continue; const name = (f.properties && (f.properties.Neighborho || f.properties.name)) || ''; if (String(name).toLowerCase().includes('outside')) continue; if (booleanPointInPolygon(pt, f)) return true; }
  if (lat <= city.bounds.north && lat >= city.bounds.south && lng <= city.bounds.east && lng >= city.bounds.west) return true;
  return false;
}

export function initDataFetching(cityKey = 'littleton') {
  getCityPoiPoints(cityKey).catch(() => {});
  fetchBikeInfrastructureData(cityKey).catch(() => {});
  fetchPoliceStations(cityKey).catch(() => {});
}
