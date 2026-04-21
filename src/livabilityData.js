/**
 * Livability Index - Urbanism Scoring Model for Littleton, CO
 *
 * Score is 0–100. Higher = more walkable, transit-accessible, mixed-use, bikeable.
 *
 * Scoring dimensions (urbanism priorities):
 *   1. Walkability      – proximity to services on foot
 *   2. Transit Access   – bus/rail proximity and frequency
 *   3. Bike Infrastructure – protected lanes, paths
 *   4. Mixed Land Use   – residential + commercial + civic density
 *   5. Green Space      – parks, trails, tree canopy
 *   6. Housing Density  – units per acre (supports urban vitality)
 *   7. Street Connectivity – grid-like, low dead-ends
 *
 * Data here is approximated/synthesized from public knowledge of Littleton geography.
 * A production version would pull from OSM Overpass, Walk Score API, GTFS feeds, etc.
*/

// Littleton, CO approximate bounding box
export const LITTLETON_BOUNDS = {
  north: 39.645,
  south: 39.580,
  east: -104.980,
  west: -105.055,
};

export const MAP_CENTER = [39.6133, -105.0166];
export const MAP_ZOOM = 13;

/**
 * Zones: named areas within Littleton with approximate bounding polygons
 * and per-dimension scores.
 *
 * Each zone has:
 *   bounds: [south, west, north, east]
 *   scores: { walkability, transit, bike, mixedUse, greenSpace, density, connectivity }
 *   notes: string description shown in popup
 */
export const ZONES = [
  {
    id: "downtown",
    name: "Downtown Littleton",
    bounds: [39.606, -105.022, 39.617, -105.010],
    scores: {
      walkability: 82,
      transit: 78,
      bike: 70,
      mixedUse: 85,
      greenSpace: 65,
      density: 72,
      connectivity: 80,
    },
    notes:
      "Historic Main Street core with shops, restaurants, light rail (C Line), and walkable blocks.",
  },
  {
    id: "littleton_station",
    name: "Littleton / Mineral Station Area",
    bounds: [39.595, -105.017, 39.606, -105.005],
    scores: {
      walkability: 68,
      transit: 90,
      bike: 62,
      mixedUse: 60,
      greenSpace: 55,
      density: 58,
      connectivity: 65,
    },
    notes:
      "RTD light rail station hub. Good transit but still auto-oriented surroundings with TOD potential.",
  },
  {
    id: "south_broadway_corridor",
    name: "South Broadway Corridor",
    bounds: [39.617, -105.020, 39.635, -105.012],
    scores: {
      walkability: 72,
      transit: 65,
      bike: 60,
      mixedUse: 78,
      greenSpace: 50,
      density: 65,
      connectivity: 72,
    },
    notes:
      "Commercial corridor transitioning to mixed-use. Improving bike lanes, bus service on Broadway.",
  },
  {
    id: "arapahoe_community_college",
    name: "ACC / Centennial Area",
    bounds: [39.580, -105.010, 39.598, -104.993],
    scores: {
      walkability: 45,
      transit: 55,
      bike: 40,
      mixedUse: 38,
      greenSpace: 48,
      density: 30,
      connectivity: 42,
    },
    notes:
      "Suburban college campus area. Low density, car-dependent, limited transit, minimal pedestrian infrastructure.",
  },
  {
    id: "western_residential",
    name: "West Littleton Residential",
    bounds: [39.608, -105.055, 39.635, -105.030],
    scores: {
      walkability: 35,
      transit: 28,
      bike: 38,
      mixedUse: 20,
      greenSpace: 60,
      density: 22,
      connectivity: 30,
    },
    notes:
      "Low-density single-family suburbs. Limited transit, cul-de-sac streets, car-dependent. Good green space access.",
  },
  {
    id: "heritage_gulch",
    name: "Heritage / Gulch Trail Area",
    bounds: [39.620, -105.030, 39.640, -105.015],
    scores: {
      walkability: 50,
      transit: 35,
      bike: 72,
      mixedUse: 30,
      greenSpace: 88,
      density: 28,
      connectivity: 45,
    },
    notes:
      "Near the South Platte River trail and Highline Canal. Excellent off-road biking and green space, but auto-oriented for daily errands.",
  },
  {
    id: "river_front",
    name: "Riverfront / Sterne Park",
    bounds: [39.610, -105.040, 39.625, -105.025],
    scores: {
      walkability: 48,
      transit: 30,
      bike: 75,
      mixedUse: 35,
      greenSpace: 90,
      density: 25,
      connectivity: 40,
    },
    notes:
      "South Platte River corridor. Outstanding trail system and parks. Minimal mixed use or transit.",
  },
  {
    id: "east_littleton",
    name: "East Littleton / Ketring",
    bounds: [39.600, -105.005, 39.618, -104.985],
    scores: {
      walkability: 52,
      transit: 50,
      bike: 48,
      mixedUse: 45,
      greenSpace: 62,
      density: 42,
      connectivity: 55,
    },
    notes:
      "Mix of residential neighborhoods and parks including Ketring Park. Moderate connectivity, some bus access.",
  },
  {
    id: "northeast_commercial",
    name: "NE Commercial / Broadway & Belleview",
    bounds: [39.630, -105.015, 39.645, -105.000],
    scores: {
      walkability: 55,
      transit: 60,
      bike: 45,
      mixedUse: 65,
      greenSpace: 35,
      density: 50,
      connectivity: 58,
    },
    notes:
      "Strip mall commercial zone near Englewood border. Bus routes present but pedestrian environment is poor.",
  },
];

/**
 * Weights for each scoring dimension (must sum to 1.0)
 * These reflect an urbanist priority framework.
 */
export const WEIGHTS = {
  walkability: 0.22,
  transit: 0.20,
  bike: 0.13,
  mixedUse: 0.18,
  greenSpace: 0.10,
  density: 0.10,
  connectivity: 0.07,
};

export const DIMENSION_LABELS = {
  walkability: "Walkability",
  transit: "Transit Access",
  bike: "Bike Infrastructure",
  mixedUse: "Mixed Land Use",
  greenSpace: "Green Space",
  density: "Housing Density",
  connectivity: "Street Connectivity",
};

/**
 * Compute weighted composite score for a zone (0–100)
 */
export function computeScore(scores) {
  return Math.round(
    Object.entries(WEIGHTS).reduce(
      (sum, [dim, weight]) => sum + (scores[dim] ?? 0) * weight,
      0
    )
  );
}

/**
 * Get a color based on score (0–100) for choropleth display
 */
export function scoreToColor(score) {
  if (score >= 75) return "#1a7f2e"; // dark green - excellent
  if (score >= 60) return "#5ab552"; // green - good
  if (score >= 48) return "#c8d44e"; // yellow-green - moderate
  if (score >= 35) return "#e8a020"; // orange - poor
  return "#c0392b"; // red - very poor
}

/**
 * Get a letter grade for a score
 */
export function scoreToGrade(score) {
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

/**
 * Get a text label for the score
 */
export function scoreToLabel(score) {
  if (score >= 75) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 48) return "Moderate";
  if (score >= 35) return "Poor";
  return "Very Poor";
}

/**
 * Convert zone bounds to a GeoJSON polygon feature
 */
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
      coordinates: [
        [
          [w, s],
          [e, s],
          [e, n],
          [w, n],
          [w, s],
        ],
      ],
    },
  };
}

export function getAllZoneFeatures() {
  return {
    type: "FeatureCollection",
    features: ZONES.map(zoneToGeoJSON),
  };
}

// --- Grid generation for finer resolution scoring ---
import { squareGrid, centroid as turfCentroid, point as turfPoint, booleanPointInPolygon, distance as turfDistance } from '@turf/turf';
import { fetchOSM } from './overpass';

// Top-level helper to assign weight to a POI based on its tags. Used by multiple routines.
export function poiWeight(tags) {
  if (!tags) return 0.5;
  const shop = (tags.shop || '').toLowerCase();
  const amenity = (tags.amenity || '').toLowerCase();
  const leisure = (tags.leisure || '').toLowerCase();

  // Essential retail (supermarket, convenience, pharmacy, bakery)
  if (shop === 'supermarket' || shop === 'convenience' || shop === 'pharmacy' || shop === 'bakery' || amenity === 'supermarket') return 3.0;

  // Fresh food / grocery alternatives
  if (shop === 'greengrocer' || shop === 'butcher' || shop === 'fishmonger') return 2.5;

  // Cafes / coffee shops
  if (amenity === 'cafe' || tags.cuisine === 'coffee_shop' || shop === 'coffee' || tags.shop === 'coffee') return 1.8;

  // Generic shops (retail, boutique)
  if (shop && shop !== '') return 1.2;

  // Transit stops and stations
  if (amenity === 'bus_station' || tags.highway === 'bus_stop' || amenity === 'bus_stop' || tags.railway === 'station' || tags.public_transport) return 2.5;

  // leisure/tourism has low weight for everyday walkability
  if (leisure || tags.tourism) return 0.8;

  // default small weight
  return 0.6;
}

/**
 * Generate a square grid over Littleton and assign each cell a livability score.
 * cellSizeKm: side length in kilometers (e.g., 0.2 = 200m)
 */
export function getGridFeatures(cellSizeKm = 0.2) {
  const bbox = [LITTLETON_BOUNDS.west, LITTLETON_BOUNDS.south, LITTLETON_BOUNDS.east, LITTLETON_BOUNDS.north];
  const grid = squareGrid(bbox, cellSizeKm, { units: 'kilometers' });

  const zones = getAllZoneFeatures().features;

  for (const cell of grid.features) {
    const c = turfCentroid(cell);
    let matched = null;
    for (const z of zones) {
      if (booleanPointInPolygon(c, z)) {
        matched = z;
        cell.properties.source = 'zone';
        cell.properties.zoneId = z.properties.id;
        break;
      }
    }

    if (!matched) {
      // find nearest zone by centroid distance
      let nearest = null;
      let minD = Infinity;
      for (const z of zones) {
        const zc = turfCentroid(z);
        const d = turfDistance(c, zc, { units: 'kilometers' });
        if (d < minD) { minD = d; nearest = z; }
      }
      matched = nearest;
      cell.properties.source = 'nearest';
      cell.properties.zoneId = matched.properties.id;
    }

    // copy base scores from matched zone for non-walk/transit dims
    const baseScores = matched.properties.scores;
    const scores = { ...baseScores };
    scores.walkability = baseScores.walkability; // will be adjusted below
    scores.transit = baseScores.transit; // adjusted below

    cell.properties.scores = scores;
    cell.properties.composite = computeScore(scores);
    cell.properties.name = matched.properties.name;
    cell.properties.notes = matched.properties.notes;
  }

  return grid;
}

/**
 * Enrich grid with OSM-derived metrics by fetching OSM data and computing POI counts and proximity.
 * This is an async helper that fetches POI data and returns a grid with updated walkability and transit scores.
 */
export async function computeGridWithOSM(cellSizeKm = 0.2) {
  const grid = getGridFeatures(cellSizeKm);
  const bbox = [LITTLETON_BOUNDS.west, LITTLETON_BOUNDS.south, LITTLETON_BOUNDS.east, LITTLETON_BOUNDS.north];
  const osm = await fetchOSM(bbox);

  // Convert elements into points for simple proximity counts. Keep tags for weighting.
  const poiPoints = osm.map((el) => {
    const tags = el.tags || {};
    if (el.type === 'node') return turfPoint([el.lon, el.lat], tags);
    // ways/relations have center
    if ((el.type === 'way' || el.type === 'relation') && el.center) return turfPoint([el.center.lon, el.center.lat], tags);
    return null;
  }).filter(Boolean);

  // Helper: assign a weight to a POI based on OSM tags.
  // Higher weight for supermarkets, convenience stores, pharmacies; medium for shops; lower for leisure/tourism.
  function poiWeight(tags) {
    if (!tags) return 0.5;
    const shop = (tags.shop || '').toLowerCase();
    const amenity = (tags.amenity || '').toLowerCase();
    const leisure = (tags.leisure || '').toLowerCase();

    // Essential retail (supermarket, convenience, pharmacy, bakery)
    if (shop === 'supermarket' || shop === 'convenience' || shop === 'pharmacy' || shop === 'bakery' || amenity === 'supermarket') return 3.0;

    // Fresh food / grocery alternatives
    if (shop === 'greengrocer' || shop === 'butcher' || shop === 'fishmonger') return 2.5;

    // Cafes / coffee shops
    if (amenity === 'cafe' || tags.cuisine === 'coffee_shop' || shop === 'coffee' || tags.shop === 'coffee') return 1.8;

    // Generic shops (retail, boutique)
    if (shop && shop !== '') return 1.2;

    // Transit stops and stations
    if (amenity === 'bus_station' || tags.highway === 'bus_stop' || amenity === 'bus_stop' || tags.railway === 'station' || tags.public_transport) return 2.5;

    // leisure/tourism has low weight for everyday walkability
    if (leisure || tags.tourism) return 0.8;

    // default small weight
    return 0.6;
  }

  // For each cell, compute POI count within 400m and nearest amenity distance
  for (const cell of grid.features) {
    const c = turfCentroid(cell);
    let poiCount = 0;
    let minDist = Infinity;
    let weightedSum = 0;
    // walking infrastructure counters
    let footwayCount = 0;
    let cyclewayCount = 0;
    for (const p of poiPoints) {
      const d = turfDistance(c, p, { units: 'kilometers' });
      if (d < minDist) minDist = d;
      if (d <= 0.4) poiCount++;
      // weighted contribution declines with distance (simple linear falloff to 1km)
      const tags = p.properties || {};
      const w = poiWeight(tags);
      const falloff = Math.max(0, 1 - (d / 1.0));
      weightedSum += w * falloff;

      // detect walking infrastructure tags
      const highway = (tags.highway || '').toLowerCase();
      if (highway === 'footway' || highway === 'pedestrian' || highway === 'path' || highway === 'steps' || tags.foot === 'yes') footwayCount++;
      if (tags.cycleway || (highway === 'cycleway')) cyclewayCount++;
    }

    // Map weightedSum and minDist into walkability score (0-100)
    // weightedSum scale: empirically, a few essential POIs nearby should produce a high score
    const poiScore = Math.min(100, Math.round(weightedSum * 10)); // slightly reduced scale
    const distScore = Math.max(0, Math.round((1 - Math.min(minDist, 2) / 2) * 100));
    // walking infrastructure score boosts the walkability when footways/cycleways are present
    const infraScore = Math.min(100, Math.round((Math.min(5, footwayCount) * 12) + (Math.min(3, cyclewayCount) * 8)));
    // combine: POIs (60%), distance (20%), infra (20%)
    const walkability = Math.round((poiScore * 0.6) + (distScore * 0.2) + (infraScore * 0.2));

    // Transit score: count of public transport POIs (bus_stop, station) within 800m weighted
    let transitCount = 0;
    for (const p of poiPoints) {
      const d = turfDistance(c, p, { units: 'kilometers' });
      if (d <= 0.8) {
        const tags = p.properties || {};
        if (tags.public_transport || tags.highway === 'bus_stop' || tags.railway === 'station' || tags.railway) transitCount += poiWeight(tags);
      }
    }
    const transitScore = Math.min(100, Math.round(transitCount * 18));

    // overwrite scores
    cell.properties.scores.walkability = walkability;
    cell.properties.scores.transit = transitScore;
    cell.properties.composite = computeScore(cell.properties.scores);
    cell.properties._osm = { poiCount, minDistKm: minDist, transitCount };
  }

  return grid;
}

/**
 * Compute a livability score at a single geographic point using nearby OSM POIs.
 * Returns an object compatible with the zone properties used by the UI:
 * { name, scores, composite, notes, _osm, zoneId }
 */
export async function computeScoreAtPoint(lat, lng, opts = {}) {
  const radiusKm = opts.radiusKm ?? 1.0; // search radius
  // build bbox around point
  const latRad = (lat * Math.PI) / 180;
  const deltaLat = radiusKm / 111; // approx degrees
  const deltaLon = radiusKm / (111 * Math.cos(latRad));
  const bbox = [lng - deltaLon, lat - deltaLat, lng + deltaLon, lat + deltaLat];

  // fetch nearby OSM elements
  const osm = await fetchOSM(bbox);

  const poiPoints = osm.map((el) => {
    const tags = el.tags || {};
    if (el.type === 'node') return turfPoint([el.lon, el.lat], tags);
    if ((el.type === 'way' || el.type === 'relation') && el.center) return turfPoint([el.center.lon, el.center.lat], tags);
    return null;
  }).filter(Boolean);

  // Find nearest zone (to copy non-walk/transit dimensions)
  let matched = null;
  const zones = getAllZoneFeatures().features;
  const pt = turfPoint([lng, lat]);
  for (const z of zones) {
    if (booleanPointInPolygon(pt, z)) {
      matched = z;
      break;
    }
  }
  if (!matched) {
    // nearest by centroid
    let minD = Infinity;
    for (const z of zones) {
      const c = turfCentroid(z);
      const d = turfDistance(pt, c, { units: 'kilometers' });
      if (d < minD) { minD = d; matched = z; }
    }
  }

  const base = matched ? matched.properties.scores : ZONES[0].scores;
  const scores = { ...base };

  // compute POI metrics similar to computeGridWithOSM
  let poiCount = 0;
  let minDist = Infinity;
  let weightedSum = 0;
  for (const p of poiPoints) {
    const d = turfDistance(pt, p, { units: 'kilometers' });
    if (d < minDist) minDist = d;
    if (d <= 0.4) poiCount++;
    const tags = p.properties || {};
    const w = poiWeight(tags);
    const falloff = Math.max(0, 1 - (d / 1.0));
    weightedSum += w * falloff;
  }

  const poiScore = Math.min(100, Math.round(weightedSum * 12));
  const distScore = Math.max(0, Math.round((1 - Math.min(minDist, 2) / 2) * 100));
  const walkability = Math.round((poiScore * 0.75) + (distScore * 0.25));

  // transit
  let transitCount = 0;
  for (const p of poiPoints) {
    const d = turfDistance(pt, p, { units: 'kilometers' });
    if (d <= 0.8) {
      const tags = p.properties || {};
      if (tags.public_transport || tags.highway === 'bus_stop' || tags.amenity === 'bus_station' || tags.railway) transitCount += poiWeight(tags);
    }
  }
  const transitScore = Math.min(100, Math.round(transitCount * 18));

  scores.walkability = walkability;
  scores.transit = transitScore;
  const composite = computeScore(scores);

  return {
    name: matched ? matched.properties.name : 'Local area',
    scores,
    composite,
    notes: matched ? matched.properties.notes : '',
    _osm: { poiCount, minDistKm: minDist, transitCount },
    zoneId: matched ? matched.properties.id : null,
  };
}

/**
 * Check whether a point (lat,lng) falls within the union of our zone polygons.
 * This serves as a pragmatic approximation of the Littleton city limits used for
 * bounding selectable areas on the client.
 */
export function isPointInCity(lat, lng) {
  const pt = turfPoint([lng, lat]);

  // 1) If a city boundary layer was loaded into the map (window.__liv_city_boundary), use it.
  try {
    if (typeof window !== 'undefined' && window.__liv_city_boundary) {
      const layer = window.__liv_city_boundary;
      // Leaflet layer -> GeoJSON
      if (typeof layer.toGeoJSON === 'function') {
        const geo = layer.toGeoJSON();
        if (geo) {
          if (geo.type === 'FeatureCollection') {
            for (const f of geo.features) {
              if (booleanPointInPolygon(pt, f)) return true;
            }
          } else if (geo.type === 'Feature') {
            if (booleanPointInPolygon(pt, geo)) return true;
          } else if (geo.type === 'Polygon' || geo.type === 'MultiPolygon') {
            const feature = { type: 'Feature', properties: {}, geometry: geo };
            if (booleanPointInPolygon(pt, feature)) return true;
          }
        }
      }
    }
  } catch (err) {
    // if boundary check fails, continue to fallbacks
    console.warn('city boundary check failed', err && err.message);
  }

  // 2) Fallback: quick bbox check against LITTLETON_BOUNDS (broad but inclusive)
  if (
    lat <= LITTLETON_BOUNDS.north &&
    lat >= LITTLETON_BOUNDS.south &&
    lng <= LITTLETON_BOUNDS.east &&
    lng >= LITTLETON_BOUNDS.west
  ) {
    return true;
  }

  // 3) Final fallback: union of our defined zone polygons
  const features = getAllZoneFeatures().features;
  for (const f of features) {
    if (booleanPointInPolygon(pt, f)) return true;
  }
  return false;
}
