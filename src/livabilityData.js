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
  // Prefer repository-provided official neighborhoods (ArcGIS export) when available.
  // If the official neighborhoods have been fetched and cached on window, use them.
  try {
    if (typeof window !== 'undefined' && window.__liv_neighborhoods) {
      return window.__liv_neighborhoods;
    }
  } catch (err) {}

  // Kick off a background fetch of the authoritative ArcGIS neighborhood layer so
  // future interactions use the exact polygons. We intentionally do this
  // asynchronously and do not block the first caller; fall back to hardcoded ZONES.
  (async () => {
    try {
      const url = 'https://services6.arcgis.com/lJUBf9F1fZJRB4zT/arcgis/rest/services/Neighborhood_Boundary/FeatureServer/70/query?where=1%3D1&outFields=*&outSR=4326&f=geojson';
      const r = await fetch(url);
      if (!r.ok) return;
      const nb = await r.json();
      if (nb && nb.type === 'FeatureCollection') {
        // normalize name property
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

  return {
    type: "FeatureCollection",
    features: ZONES.map(zoneToGeoJSON),
  };
}

// --- Grid generation for finer resolution scoring ---
import { squareGrid, centroid as turfCentroid, point as turfPoint, booleanPointInPolygon, distance as turfDistance } from '@turf/turf';
import { fetchOSM } from './overpass';
import { getWalkScore } from './walkscore';

// Top-level helper to assign weight to a POI based on its tags. Used by multiple routines.
export function poiWeight(tags) {
  if (!tags) return 0.5;
  const shop = (tags.shop || '').toLowerCase();
  const amenity = (tags.amenity || '').toLowerCase();
  const leisure = (tags.leisure || '').toLowerCase();
  // Essential retail / groceries (supermarket, grocery, convenience, pharmacy)
  const groceryShops = new Set(['supermarket', 'convenience', 'grocery', 'greengrocer', 'food_market', 'bodega', 'delicatessen', 'butcher', 'fishmonger']);
  if (groceryShops.has(shop) || amenity === 'supermarket' || amenity === 'pharmacy') return 3.0;

  // Larger fresh food / specialized grocers
  const freshShops = new Set(['greengrocer', 'butcher', 'fishmonger', 'organic']);
  if (freshShops.has(shop)) return 2.5;

  // Cafes / coffee shops
  if (amenity === 'cafe' || shop === 'coffee' || (tags.cuisine || '').toLowerCase().includes('coffee') || shop === 'tea_house') return 1.8;

  // Eateries / restaurants
  if (amenity === 'restaurant' || amenity === 'fast_food' || shop === 'food' || shop === 'bakery' || shop === 'delicatessen') return 1.6;

  // Transit stops and stations are important
  if (amenity === 'bus_station' || tags.highway === 'bus_stop' || amenity === 'bus_stop' || tags.railway === 'station' || tags.public_transport) return 2.5;

  // leisure/tourism has lower weight for everyday errands
  if (leisure || tags.tourism) return 0.8;

  // Generic shops (retail, boutique)
  if (shop && shop !== '') return 1.2;

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
    // green space counters
    let greenCount = 0;
    let minGreenDist = Infinity;
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

      // detect parks/green space/trails (leisure=park, landuse=recreation_ground, natural=wood)
      const name = (tags.name || '').toLowerCase();
      const isPark = (tags.leisure === 'park' || tags.landuse === 'recreation_ground' || tags.natural === 'wood');
      const isHighline = name.includes('highline');
      const isLeeGulch = name.includes('lee gulch') || name.includes('leegulch');
      const isTrail = (highway === 'path' || highway === 'track' || tags.foot === 'yes');
      if (isPark || isHighline || isLeeGulch || isTrail) {
        greenCount++;
        if (d < minGreenDist) minGreenDist = d;
      }
    }

    // Map weightedSum and minDist into walkability score (0-100)
    // weightedSum scale: empirically, a few essential POIs nearby should produce a high score
    const poiScore = Math.min(100, Math.round(weightedSum * 10)); // slightly reduced scale
    const distScore = Math.max(0, Math.round((1 - Math.min(minDist, 2) / 2) * 100));
    // walking infrastructure score boosts the walkability when footways/cycleways are present
    const infraScore = Math.min(100, Math.round((Math.min(5, footwayCount) * 12) + (Math.min(5, cyclewayCount) * 10)));
    // green space influence: proximity to parks/trails
    const greenScore = Math.max(0, Math.round((1 - Math.min(minGreenDist, 2) / 2) * 100));
    // combine: POIs (55%), distance (18%), infra (15%), green (12%)
    const walkability = Math.round((poiScore * 0.55) + (distScore * 0.18) + (infraScore * 0.15) + (greenScore * 0.12));

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
    // boost greenSpace dimension using detected parks/trails
    cell.properties.scores.greenSpace = Math.round((cell.properties.scores.greenSpace * 0.6) + (Math.min(100, greenScore) * 0.4));
    // bike score: combine cycleway infrastructure and proximity to trails/greenways
    const bikeInfra = Math.min(100, Math.round(Math.min(6, cyclewayCount) * 16));
    cell.properties.scores.bike = Math.round((cell.properties.scores.bike * 0.4) + (bikeInfra * 0.45) + (greenScore * 0.15));
    cell.properties.composite = computeScore(cell.properties.scores);
    cell.properties._osm = { poiCount, minDistKm: minDist, transitCount, greenCount, minGreenDistKm: minGreenDist };
  }

  return grid;
}

/**
 * Compute a livability score at a single geographic point using nearby OSM POIs.
 * Returns an object compatible with the zone properties used by the UI:
 * { name, scores, composite, notes, _osm, zoneId }
 */
export async function computeScoreAtPoint(lat, lng, opts = {}) {
  // Mode controls search radius and perception (walk vs bike)
  const mode = (opts.mode || 'walk'); // 'walk' or 'bike'
  const radiusKm = opts.radiusKm ?? (mode === 'bike' ? 2.5 : 1.0); // search radius
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
    try {
      if (!z || !z.geometry) continue; // skip invalid
      if (booleanPointInPolygon(pt, z)) {
        // ignore 'Outside of City' labeled polygons when matching
        const nm = (z.properties && (z.properties.Neighborho || z.properties.name)) || '';
        if (String(nm).toLowerCase().includes('outside')) continue;
        matched = z;
        break;
      }
    } catch (err) {
      // If a polygon is invalid, skip it
      continue;
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

  // compute distances to specific amenity categories (walking- or biking-accessible essentials)
  const maxRadius = radiusKm; // kilometers
  // nearest distances (km) initialized as Infinity
  const nearest = {
    transit: Infinity, // bus stop / light rail / station
    coffee: Infinity, // cafe / coffee shop
    eatery: Infinity, // restaurant / fast_food
    supermarket: Infinity, // supermarket / convenience / pharmacy
  };
  const counts = { transit: 0, coffee: 0, eatery: 0, supermarket: 0 };

  // infra counters
  let footwayCount = 0;
  let cyclewayCount = 0;
  // green space counters for point scoring
  let greenCount = 0;
  let minGreenDist = Infinity;

  for (const p of poiPoints) {
    const d = turfDistance(pt, p, { units: 'kilometers' });
    const tags = p.properties || {};

    // transit
    if (tags.public_transport || tags.highway === 'bus_stop' || tags.amenity === 'bus_station' || tags.railway === 'station' || tags.railway === 'tram_stop') {
      if (d < nearest.transit) nearest.transit = d;
      if (d <= maxRadius) counts.transit += 1;
    }

    // coffee / cafe
    if (tags.amenity === 'cafe' || tags.shop === 'coffee' || (tags.cuisine && tags.cuisine.includes('coffee'))) {
      if (d < nearest.coffee) nearest.coffee = d;
      if (d <= maxRadius) counts.coffee += 1;
    }

    // eatery / restaurant
    if (tags.amenity === 'restaurant' || tags.amenity === 'fast_food' || tags.food || tags.shop === 'food') {
      if (d < nearest.eatery) nearest.eatery = d;
      if (d <= maxRadius) counts.eatery += 1;
    }

    // supermarket / convenience / pharmacy
    if (
      tags.shop === 'supermarket' ||
      tags.shop === 'convenience' ||
      tags.shop === 'greengrocer' ||
      tags.amenity === 'pharmacy' ||
      tags.amenity === 'supermarket'
    ) {
      if (d < nearest.supermarket) nearest.supermarket = d;
      if (d <= maxRadius) counts.supermarket += 1;
    }

    // detect walking/cycling infrastructure
    const highway = (tags.highway || '').toLowerCase();
    if (highway === 'footway' || highway === 'pedestrian' || highway === 'path' || tags.foot === 'yes') footwayCount++;
    if (tags.cycleway || highway === 'cycleway') cyclewayCount++;

    // detect green spaces: parks, named trails like 'highline' or 'lee gulch', or informal trail tags
    const pname = (tags.name || '').toLowerCase();
    const isPark = (tags.leisure === 'park' || tags.landuse === 'recreation_ground' || tags.natural === 'wood');
    const isHighline = pname.includes('highline');
    const isLeeGulch = pname.includes('lee gulch') || pname.includes('leegulch');
    const isTrail = (highway === 'path' || highway === 'track' || tags.foot === 'yes');
    if (isPark || isHighline || isLeeGulch || isTrail) {
      greenCount++;
      if (d < minGreenDist) minGreenDist = d;
    }
  }

  // Convert nearest distances to 0-100 accessibility scores using linear decay to maxRadius
  function distToScore(d, max) {
    if (!isFinite(d)) return 0;
    const capped = Math.min(d, max);
    return Math.round((1 - capped / max) * 100);
  }

  const maxForScoring = mode === 'bike' ? Math.max(0.5, maxRadius) : Math.max(0.5, maxRadius);
  const scoresByAmenity = {
    transit: distToScore(nearest.transit, maxForScoring),
    coffee: distToScore(nearest.coffee, maxForScoring),
    eatery: distToScore(nearest.eatery, maxForScoring),
    supermarket: distToScore(nearest.supermarket, maxForScoring),
  };

  // Compose walk/bike accessibility score from amenities
  // Category weights (tunable): supermarket most important, then eatery, transit, coffee
  const amenityWeights = { supermarket: 0.35, eatery: 0.25, transit: 0.25, coffee: 0.15 };
  let amenityComposite = 0;
  for (const k of Object.keys(amenityWeights)) {
    amenityComposite += (scoresByAmenity[k] || 0) * amenityWeights[k];
  }

  // Infra boost: presence of footway/cycleway increases score (scaled)
  const infraScore = Math.min(100, Math.round(Math.min(5, footwayCount) * 12 + Math.min(5, cyclewayCount) * 8));
  // green score based on proximity to park/trail
  const greenScore = Math.max(0, Math.round((1 - Math.min(minGreenDist, 2) / 2) * 100));

  // Final pedestrian/bike accessibility score: combine amenities, infra and green access
  // weights: amenities dominant, infra secondary, green tertiary
  const mobilityScore = Math.round(amenityComposite * 0.78 + infraScore * 0.12 + greenScore * 0.10);

  // Transit score: scale by proximity and local transit count
  const transitScore = Math.min(100, Math.round((scoresByAmenity.transit * 0.6) + Math.min(100, counts.transit * 20) * 0.4));

  // Optionally augment with Walk Score API if available (via proxy or VITE key)
  let ws = null;
  try {
    ws = await getWalkScore(lat, lng);
  } catch (err) {
    console.warn('getWalkScore failed', err && err.message);
  }

  // If WalkScore returns a score, combine it with our computed mobilityScore (average weighted)
  if (ws && typeof ws.walkscore === 'number') {
    // weight: 70% WalkScore, 30% our heuristic
    scores.walkability = Math.round((ws.walkscore * 0.7) + (mobilityScore * 0.3));
  } else {
    scores.walkability = mobilityScore;
  }
  scores.transit = transitScore;
  // boost greenSpace dimension using detected parks/trails
  scores.greenSpace = Math.round((scores.greenSpace || 0) * 0.6 + Math.min(100, greenScore) * 0.4);
  // bike score: combine detected cycleway infrastructure and proximity to trails/greenways
  const bikeInfra = Math.min(100, Math.round(Math.min(6, cyclewayCount) * 16));
  scores.bike = Math.round(((scores.bike || 0) * 0.4) + (bikeInfra * 0.45) + (greenScore * 0.15));
  const composite = computeScore(scores);

  return {
    name: matched ? matched.properties.name : 'Local area',
    scores,
    composite,
    notes: matched ? matched.properties.notes : '',
    _osm: { counts, nearestKm: nearest, infra: { footwayCount, cyclewayCount }, green: { greenCount, minGreenDistKm: minGreenDist } },
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

  // 2) Check union of our defined zone polygons (more precise than the bbox)
  const features = getAllZoneFeatures().features;
  for (const f of features) {
    // skip features with no geometry (some ArcGIS exports may include placeholders)
    if (!f || !f.geometry) continue;
    // skip 'Outside of City' polygons used for labeling the map
    const name = (f.properties && (f.properties.Neighborho || f.properties.name)) || '';
    if (String(name).toLowerCase().includes('outside')) continue;
    if (booleanPointInPolygon(pt, f)) return true;
  }

  // 3) Final fallback: quick bbox check against LITTLETON_BOUNDS (broad but inclusive)
  // Keep this as the last resort to avoid incorrectly accepting points far outside the
  // mapped zone polygons while still allowing some leniency when boundaries are missing.
  if (
    lat <= LITTLETON_BOUNDS.north &&
    lat >= LITTLETON_BOUNDS.south &&
    lng <= LITTLETON_BOUNDS.east &&
    lng >= LITTLETON_BOUNDS.west
  ) {
    return true;
  }

  return false;
}
