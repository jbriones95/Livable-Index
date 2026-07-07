/**
 * Livability Index - Proximity-Based Scoring Model
 *
 * Score is 0–100, based on closeness to 6 amenity types:
 *   coffee shop, dinner restaurant, grocery store, nature access, transit stop, healthcare.
 */

import { squareGrid, centroid as turfCentroid, point as turfPoint, booleanPointInPolygon, distance as turfDistance } from '@turf/turf';
import unifiedData from '../data/unified_list.json';

export const LITTLETON_BOUNDS = {
  north: 39.645, south: 39.580, east: -104.980, west: -105.055,
};

export const MAP_CENTER = [39.6133, -105.0166];
export const MAP_ZOOM = 13;

export const ZONES = [
  {
    id: "downtown",
    name: "Downtown Littleton",
    bounds: [39.606, -105.022, 39.617, -105.010],
    scores: { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0 },
    notes: '',
  },
  {
    id: "littleton_station",
    name: "Littleton / Mineral Station Area",
    bounds: [39.595, -105.017, 39.606, -105.005],
    scores: { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0 },
    notes: '',
  },
  {
    id: "south_broadway_corridor",
    name: "South Broadway Corridor",
    bounds: [39.617, -105.020, 39.635, -105.012],
    scores: { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0 },
    notes: '',
  },
  {
    id: "arapahoe_community_college",
    name: "ACC / Centennial Area",
    bounds: [39.580, -105.010, 39.598, -104.993],
    scores: { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0 },
    notes: '',
  },
  {
    id: "western_residential",
    name: "West Littleton Residential",
    bounds: [39.608, -105.055, 39.635, -105.030],
    scores: { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0 },
    notes: '',
  },
  {
    id: "heritage_gulch",
    name: "Heritage / Gulch Trail Area",
    bounds: [39.620, -105.030, 39.640, -105.015],
    scores: { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0 },
    notes: '',
  },
  {
    id: "river_front",
    name: "Riverfront / Sterne Park",
    bounds: [39.610, -105.040, 39.625, -105.025],
    scores: { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0 },
    notes: '',
  },
  {
    id: "east_littleton",
    name: "East Littleton / Ketring",
    bounds: [39.600, -105.005, 39.618, -104.985],
    scores: { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0 },
    notes: '',
  },
  {
    id: "northeast_commercial",
    name: "NE Commercial / Broadway & Belleview",
    bounds: [39.630, -105.015, 39.645, -105.000],
    scores: { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0 },
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
  coffee: 0.15,
  restaurant: 0.15,
  nature: 0.20,
  healthcare: 0.10,
  busStop: 0.20,
  grocery: 0.20,
};

export const DIMENSION_LABELS = {
  coffee: "Coffee Shop",
  restaurant: "Dinner Restaurant",
  grocery: "Grocery Store",
  nature: "Nature Access",
  busStop: "Transit Stop",
  healthcare: "Healthcare",
};

export function computeScore(scores) {
  return Math.round(
    Object.entries(WEIGHTS).reduce((sum, [dim, weight]) => sum + (scores[dim] ?? 0) * weight, 0)
  );
}

export function scoreToColor(score) {
  if (score >= 75) return "#1a7f2e";
  if (score >= 60) return "#5ab552";
  if (score >= 48) return "#c8d44e";
  if (score >= 35) return "#e8a020";
  return "#c0392b";
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

let _neighborhoodFetch = null;

export function getAllZoneFeatures() {
  try {
    if (typeof window !== 'undefined' && window.__liv_neighborhoods) return window.__liv_neighborhoods;
  } catch (e) {}

  if (!_neighborhoodFetch) {
    _neighborhoodFetch = (async () => {
      try {
        const url = 'https://services6.arcgis.com/lJUBf9F1fZJRB4zT/arcgis/rest/services/Neighborhood_Boundary/FeatureServer/70/query?where=1%3D1&outFields=*&outSR=4326&f=geojson';
        const r = await fetch(url);
        if (!r.ok) return;
        const nb = await r.json();
        if (nb && nb.type === 'FeatureCollection') {
          nb.features = nb.features.map((f) => {
            f.properties = f.properties || {};
            if (f.properties.Neighborho && !f.properties.name) f.properties.name = f.properties.Neighborho;
            return f;
          });
          try { if (typeof window !== 'undefined') window.__liv_neighborhoods = nb; } catch (e) {}
        }
      } catch (err) {
        console.warn('Failed to fetch neighborhoods', err && err.message);
      }
    })();
  }

  return { type: 'FeatureCollection', features: ZONES.map(zoneToGeoJSON) };
}

// Named trails to detect for the trailhead portion of the nature composite (80% weight)
const NAMED_TRAILS = [
  'highline canal',
  'lee gulch trail',
  'mary carter greenway trail',
  'littleton community trail',
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
};

// How many candidate POIs (closest by crow-flies) to route per category
const ROUTE_CANDIDATES = {
  coffee: 5,
  restaurant: 5,
  grocery: 5,
  trail: 5,
  park: 5,
  busStop: 5,
  healthcare: 5,
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
};

const SUPPLEMENTAL_POINT_OBJS = {};

for (const [k, v] of Object.entries(unifiedData)) {
  const mapped = CATEGORY_MAPPING[k] || k;
  if (!Array.isArray(v)) continue;
  SUPPLEMENTAL_POINT_OBJS[mapped] = (SUPPLEMENTAL_POINT_OBJS[mapped] || []).concat(
    v.map((p) => ({ lon: p.lon, lat: p.lat, name: p.name || p.note || null, note: p.note || null }))
  );
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
  const h = (tags.highway || '').toLowerCase();
  const l = (tags.leisure || '').toLowerCase();
  const pt = tags.public_transport ? String(tags.public_transport).toLowerCase() : '';
  const name = (tags.name || '').toLowerCase();
  const foot = tags.foot ? String(tags.foot).toLowerCase() : '';
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
  if (a === 'hospital' || a === 'clinic' || a === 'doctors' || a === 'pharmacy' || a === 'dentist' || tags.healthcare) results.push('healthcare');

  return results;
}

function nearestAndCounts(poiPoints, pt) {
  const categories = ['coffee', 'restaurant', 'grocery', 'trail', 'park', 'busStop', 'healthcare'];
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

  // Also include supplemental points derived from `data/unified_list.json`.
  for (const [cat, points] of Object.entries(SUPPLEMENTAL_POINT_OBJS || {})) {
    for (const obj of points) {
      const coords = [obj.lon, obj.lat];
      const sp = turfPoint(coords, { category: cat, name: obj.name, note: obj.note });
      const d = turfDistance(pt, sp, { units: 'kilometers' });
      if (!Object.prototype.hasOwnProperty.call(nearest, cat)) continue;
      if (d < nearest[cat]) { nearest[cat] = d; nearestCoords[cat] = coords; }
      if (d <= MAX_DIST_KM[cat]) counts[cat]++;
      candidates[cat].push({ coords, dist: d });
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
    usedCoords[key] = null;

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

export async function computeScoreAtPoint(lat, lng, opts = {}) {
  const pt = turfPoint([lng, lat]);
  const { nearest, nearestCoords, candidates } = nearestAndCounts([], pt);
  const scoring = await computeScoresFromNearest(nearest, { nearestCoords, pt, useRouting: true, candidates });
  const rawScores = scoring.scores;
  const scores = {
    ...rawScores,
    nature: computeNatureComposite(rawScores.trail ?? 0, rawScores.park ?? 0),
  };

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

  const zones = getAllZoneFeatures().features;
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

  const composite = computeScore(scores);
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

export function getGridFeatures(cellSizeKm = 0.2) {
  const bbox = [LITTLETON_BOUNDS.west, LITTLETON_BOUNDS.south, LITTLETON_BOUNDS.east, LITTLETON_BOUNDS.north];
  const grid = squareGrid(bbox, cellSizeKm, { units: 'kilometers' });
  const zones = getAllZoneFeatures().features;

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

export async function computeGridWithOSM(cellSizeKm = 0.2) {
  const grid = getGridFeatures(cellSizeKm);
  for (const cell of grid.features) {
    const c = turfCentroid(cell);
    const { nearest, nearestCoords, candidates } = nearestAndCounts([], c);
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

export function isPointInCity(lat, lng) {
  const pt = turfPoint([lng, lat]);
  try {
    if (typeof window !== 'undefined' && window.__liv_city_boundary) {
      const layer = window.__liv_city_boundary;
      if (typeof layer.toGeoJSON === 'function') {
        const geo = layer.toGeoJSON(); if (geo) {
          if (geo.type === 'FeatureCollection') for (const f of geo.features) if (booleanPointInPolygon(pt, f)) return true;
          else if (geo.type === 'Feature') if (booleanPointInPolygon(pt, geo)) return true;
          else if (geo.type === 'Polygon' || geo.type === 'MultiPolygon') { if (booleanPointInPolygon(pt, { type: 'Feature', properties: {}, geometry: geo })) return true; }
        }
      }
    }
  } catch (err) { console.warn('city boundary check failed', err && err.message); }
  const features = getAllZoneFeatures().features;
  for (const f of features) { if (!f || !f.geometry) continue; const name = (f.properties && (f.properties.Neighborho || f.properties.name)) || ''; if (String(name).toLowerCase().includes('outside')) continue; if (booleanPointInPolygon(pt, f)) return true; }
  if (lat <= LITTLETON_BOUNDS.north && lat >= LITTLETON_BOUNDS.south && lng <= LITTLETON_BOUNDS.east && lng >= LITTLETON_BOUNDS.west) return true;
  return false;
}
