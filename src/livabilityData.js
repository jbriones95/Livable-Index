/**
 * Livability Index - Proximity-Based Scoring Model
 *
 * Score is 0–100, based on closeness to 6 amenity types:
 *   coffee shop, dinner restaurant, grocery store, trailhead, bus stop, healthcare.
 */

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
    notes: "Historic Main Street core with shops, restaurants, light rail (C Line), and walkable blocks.",
  },
  {
    id: "littleton_station",
    name: "Littleton / Mineral Station Area",
    bounds: [39.595, -105.017, 39.606, -105.005],
    scores: { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0 },
    notes: "RTD light rail station hub. Good transit but still auto-oriented surroundings with TOD potential.",
  },
  {
    id: "south_broadway_corridor",
    name: "South Broadway Corridor",
    bounds: [39.617, -105.020, 39.635, -105.012],
    scores: { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0 },
    notes: "Commercial corridor transitioning to mixed-use. Improving bike lanes, bus service on Broadway.",
  },
  {
    id: "arapahoe_community_college",
    name: "ACC / Centennial Area",
    bounds: [39.580, -105.010, 39.598, -104.993],
    scores: { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0 },
    notes: "Suburban college campus area. Low density, car-dependent, limited transit, minimal pedestrian infrastructure.",
  },
  {
    id: "western_residential",
    name: "West Littleton Residential",
    bounds: [39.608, -105.055, 39.635, -105.030],
    scores: { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0 },
    notes: "Low-density single-family suburbs. Limited transit, cul-de-sac streets, car-dependent. Good green space access.",
  },
  {
    id: "heritage_gulch",
    name: "Heritage / Gulch Trail Area",
    bounds: [39.620, -105.030, 39.640, -105.015],
    scores: { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0 },
    notes: "Near the South Platte River trail and Highline Canal. Excellent off-road biking and green space, but auto-oriented for daily errands.",
  },
  {
    id: "river_front",
    name: "Riverfront / Sterne Park",
    bounds: [39.610, -105.040, 39.625, -105.025],
    scores: { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0 },
    notes: "South Platte River corridor. Outstanding trail system and parks. Minimal mixed use or transit.",
  },
  {
    id: "east_littleton",
    name: "East Littleton / Ketring",
    bounds: [39.600, -105.005, 39.618, -104.985],
    scores: { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0 },
    notes: "Mix of residential neighborhoods and parks including Ketring Park. Moderate connectivity, some bus access.",
  },
  {
    id: "northeast_commercial",
    name: "NE Commercial / Broadway & Belleview",
    bounds: [39.630, -105.015, 39.645, -105.000],
    scores: { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0 },
    notes: "Strip mall commercial zone near Englewood border. Bus routes present but pedestrian environment is poor.",
  },
];

export const WEIGHTS = {
  coffee: 0.15,
  restaurant: 0.15,
  grocery: 0.20,
  trailhead: 0.10,
  busStop: 0.20,
  healthcare: 0.20,
};

export const DIMENSION_LABELS = {
  coffee: "Coffee Shop",
  restaurant: "Dinner Restaurant",
  grocery: "Grocery Store",
  trailhead: "Trailhead Access",
  busStop: "Bus Stop",
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
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
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

export function getAllZoneFeatures() {
  try {
    if (typeof window !== 'undefined' && window.__liv_neighborhoods) return window.__liv_neighborhoods;
  } catch (e) {}

  (async () => {
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

  return { type: 'FeatureCollection', features: ZONES.map(zoneToGeoJSON) };
}

import { squareGrid, centroid as turfCentroid, point as turfPoint, booleanPointInPolygon, distance as turfDistance } from '@turf/turf';
import { fetchOSM } from './overpass';

const MAX_DIST_KM = {
  coffee: 1.0,
  restaurant: 1.0,
  grocery: 1.5,
  trailhead: 2.0,
  busStop: 0.8,
  healthcare: 2.0,
};

// Known coffee shops and parks missing from OSM – coordinates from Nominatim geocoding.
// Merged with OSM data during scoring so proximity calculations are accurate.
const SUPPLEMENTAL_POINTS = {
  coffee: [
    [-104.9879769, 39.5722466],   // 7960 S Broadway
    [-105.0252290, 39.5823901],   // 7301 S Santa Fe Dr Ste 310
    [-105.0229385, 39.6032026],   // 6115 S Santa Fe Dr
    [-104.9880828, 39.6012170],   // 6504 S Broadway
    [-105.0223652, 39.6005510],   // 6399 S Santa Fe Dr
  ],
  trailhead: [
    [-104.99338, 39.57879],       // 7900 S Ogden Way / Horseshoe Park area
    [-105.0071743, 39.5787253],   // 7791 S Windermere St
    [-105.01862, 39.58219],       // S Prince St & W Jackass Hill Rd / Jackass Hill Park
    [-105.0233734, 39.5786312],   // 1900 W Mineral Ave
    [-105.0042134, 39.5842020],   // 1312 W Geddes Ave
  ],
};

function distToScore(d, max) {
  if (!isFinite(d)) return 0;
  return Math.round((1 - Math.min(d, max) / max) * 100);
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

  if (a === 'cafe' || s === 'coffee' || s === 'tea_house' || cuisine.includes('coffee')) results.push('coffee');
  if (a === 'restaurant') results.push('restaurant');
  if (s === 'supermarket' || s === 'convenience' || s === 'grocery' || s === 'greengrocer' || a === 'supermarket') results.push('grocery');
  if (h === 'bus_stop' || a === 'bus_station' || pt === 'platform' || pt === 'bus_stop' || pt === 'stop_position') results.push('busStop');
  if (h === 'path' || h === 'track' || h === 'trailhead' || h === 'footway' || l === 'park' || l === 'nature_reserve' || name.includes('trail')) results.push('trailhead');
  if (a === 'hospital' || a === 'clinic' || a === 'doctors' || a === 'pharmacy' || a === 'dentist' || tags.healthcare) results.push('healthcare');

  return results;
}

function nearestAndCounts(poiPoints, pt) {
  const nearest = { coffee: Infinity, restaurant: Infinity, grocery: Infinity, trailhead: Infinity, busStop: Infinity, healthcare: Infinity };
  const counts = { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0 };

  for (const p of poiPoints) {
    const d = turfDistance(pt, p, { units: 'kilometers' });
    const tags = p.properties || {};
    const cats = classifyOSM(tags);
    for (const cat of cats) {
      if (d < nearest[cat]) nearest[cat] = d;
      if (d <= MAX_DIST_KM[cat]) counts[cat]++;
    }
  }

  // Merge supplemental points (known locations missing from OSM)
  for (const [cat, points] of Object.entries(SUPPLEMENTAL_POINTS)) {
    for (const coords of points) {
      const sp = turfPoint(coords);
      const d = turfDistance(pt, sp, { units: 'kilometers' });
      if (d < nearest[cat]) nearest[cat] = d;
      if (d <= MAX_DIST_KM[cat]) counts[cat]++;
    }
  }

  return { nearest, counts };
}

function computeScoresFromNearest(nearest) {
  const scores = {};
  for (const key of Object.keys(MAX_DIST_KM)) {
    scores[key] = distToScore(nearest[key], MAX_DIST_KM[key]);
  }
  return scores;
}

export async function computeScoreAtPoint(lat, lng, opts = {}) {
  const radiusKm = opts.radiusKm ?? 1.5;
  const latRad = (lat * Math.PI) / 180;
  const deltaLat = radiusKm / 111;
  const deltaLon = radiusKm / (111 * Math.cos(latRad));
  const bbox = [lng - deltaLon, lat - deltaLat, lng + deltaLon, lat + deltaLat];
  const osm = await fetchOSM(bbox);

  const poiPoints = osm.map((el) => {
    const tags = el.tags || {};
    if (el.type === 'node') return turfPoint([el.lon, el.lat], tags);
    if ((el.type === 'way' || el.type === 'relation') && el.center) return turfPoint([el.center.lon, el.center.lat], tags);
    return null;
  }).filter(Boolean);

  const pt = turfPoint([lng, lat]);
  const { nearest, counts } = nearestAndCounts(poiPoints, pt);
  const scores = computeScoresFromNearest(nearest);

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
    _osm: { counts, nearestKm: nearest },
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
  const bbox = [LITTLETON_BOUNDS.west, LITTLETON_BOUNDS.south, LITTLETON_BOUNDS.east, LITTLETON_BOUNDS.north];
  const osm = await fetchOSM(bbox);

  const poiPoints = osm.map((el) => {
    const tags = el.tags || {};
    if (el.type === 'node') return turfPoint([el.lon, el.lat], tags);
    if ((el.type === 'way' || el.type === 'relation') && el.center) return turfPoint([el.center.lon, el.center.lat], tags);
    return null;
  }).filter(Boolean);

  for (const cell of grid.features) {
    const c = turfCentroid(cell);
    const { nearest, counts } = nearestAndCounts(poiPoints, c);
    const scores = computeScoresFromNearest(nearest);
    cell.properties.scores = scores;
    cell.properties.composite = computeScore(scores);
    cell.properties._osm = { counts, nearestKm: nearest };
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
