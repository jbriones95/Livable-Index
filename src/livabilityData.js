/**
 * Livability Index - Urbanism Scoring Model for Littleton, CO
 *
 * Score is 0–100. Higher = more walkable, transit-accessible, mixed-use, bikeable.
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

export const ZONES = [
  // ... (zones omitted here for brevity in this patch - kept in repo)
];

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

// --- Grid generation for finer resolution scoring ---
import { squareGrid, centroid as turfCentroid, point as turfPoint, booleanPointInPolygon, distance as turfDistance } from '@turf/turf';
import { fetchOSM } from './overpass';
import { getWalkScore } from './walkscore';

export function poiWeight(tags) {
  if (!tags) return 0.5;
  const shop = (tags.shop || '').toLowerCase();
  const amenity = (tags.amenity || '').toLowerCase();
  const leisure = (tags.leisure || '').toLowerCase();
  const groceryShops = new Set(['supermarket', 'convenience', 'grocery', 'greengrocer', 'food_market', 'bodega', 'delicatessen', 'butcher', 'fishmonger']);
  if (groceryShops.has(shop) || amenity === 'supermarket' || amenity === 'pharmacy') return 3.0;
  const freshShops = new Set(['greengrocer', 'butcher', 'fishmonger', 'organic']);
  if (freshShops.has(shop)) return 2.5;
  if (amenity === 'cafe' || shop === 'coffee' || (tags.cuisine || '').toLowerCase().includes('coffee') || shop === 'tea_house') return 1.8;
  if (amenity === 'restaurant' || amenity === 'fast_food' || shop === 'food' || shop === 'bakery' || shop === 'delicatessen') return 1.6;
  if (amenity === 'bus_station' || tags.highway === 'bus_stop' || amenity === 'bus_stop' || tags.railway === 'station' || tags.public_transport) return 2.5;
  if (leisure || tags.tourism) return 0.8;
  if (shop && shop !== '') return 1.2;
  return 0.6;
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
    const baseScores = matched.properties.scores; const scores = { ...baseScores };
    scores.walkability = baseScores.walkability; scores.transit = baseScores.transit;
    cell.properties.scores = scores; cell.properties.composite = computeScore(scores); cell.properties.name = matched.properties.name; cell.properties.notes = matched.properties.notes;
  }

  return grid;
}

export async function computeGridWithOSM(cellSizeKm = 0.2) {
  const grid = getGridFeatures(cellSizeKm);
  const bbox = [LITTLETON_BOUNDS.west, LITTLETON_BOUNDS.south, LITTLETON_BOUNDS.east, LITTLETON_BOUNDS.north];
  const osm = await fetchOSM(bbox);

  const poiPoints = osm.map((el) => { const tags = el.tags || {}; if (el.type === 'node') return turfPoint([el.lon, el.lat], tags); if ((el.type === 'way' || el.type === 'relation') && el.center) return turfPoint([el.center.lon, el.center.lat], tags); return null; }).filter(Boolean);

  function poiWeightLocal(tags) { return poiWeight(tags); }

  for (const cell of grid.features) {
    const c = turfCentroid(cell);
    let poiCount = 0; let minDist = Infinity; let weightedSum = 0;
    let footwayCount = 0; let cyclewayCount = 0;
    let greenCount = 0; let minGreenDist = Infinity; let minParkDist = Infinity;
    let supermarketCount = 0; let minSupermarketDist = Infinity;

    for (const p of poiPoints) {
      const d = turfDistance(c, p, { units: 'kilometers' }); if (d < minDist) minDist = d; if (d <= 0.4) poiCount++;
      const tags = p.properties || {}; const w = poiWeightLocal(tags); const falloff = Math.max(0, 1 - (d / 1.0)); weightedSum += w * falloff;
      const highway = (tags.highway || '').toLowerCase(); if (highway === 'footway' || highway === 'pedestrian' || highway === 'path' || highway === 'steps' || tags.foot === 'yes') footwayCount++; if (tags.cycleway || (highway === 'cycleway')) cyclewayCount++;

      const name = (tags.name || '').toLowerCase(); const isPark = (tags.leisure === 'park' || tags.landuse === 'recreation_ground' || tags.natural === 'wood'); const isHighline = name.includes('highline'); const isLeeGulch = name.includes('lee gulch') || name.includes('leegulch'); const isTrail = (highway === 'path' || highway === 'track' || tags.foot === 'yes');
      if (isPark || isHighline || isLeeGulch || isTrail) { greenCount++; if (d < minGreenDist) minGreenDist = d; }
      if (isPark) { if (d < minParkDist) minParkDist = d; }
      if (isTrail) { if (d < (cell.properties._nearestTrailDistKm || Infinity)) { cell.properties._nearestTrailDistKm = d; } }

      if (tags.shop === 'supermarket' || tags.shop === 'convenience' || tags.shop === 'grocery' || tags.amenity === 'supermarket' || tags.amenity === 'pharmacy') { supermarketCount++; if (d < minSupermarketDist) minSupermarketDist = d; }
    }

    const poiScore = Math.min(100, Math.round(weightedSum * 10));
    const distScore = Math.max(0, Math.round((1 - Math.min(minDist, 2) / 2) * 100));
    const infraScore = Math.min(100, Math.round((Math.min(5, footwayCount) * 12) + (Math.min(5, cyclewayCount) * 10)));
    const greenScore = Math.max(0, Math.round((1 - Math.min(minGreenDist, 2) / 2) * 100));
    const supermarketScore = Math.max(0, Math.round((1 - Math.min(minSupermarketDist, 2) / 2) * 100));
    const walkability = Math.round((poiScore * 0.43) + (supermarketScore * 0.12) + (distScore * 0.18) + (infraScore * 0.15) + (greenScore * 0.12));

    let transitCount = 0;
    for (const p of poiPoints) { const d = turfDistance(c, p, { units: 'kilometers' }); if (d <= 0.8) { const tags = p.properties || {}; if (tags.public_transport || tags.highway === 'bus_stop' || tags.railway === 'station' || tags.railway) transitCount += poiWeightLocal(tags); } }
    const transitScore = Math.min(100, Math.round(transitCount * 18));

    cell.properties.scores.walkability = walkability;
    cell.properties.scores.transit = transitScore;
    cell.properties.scores.greenSpace = Math.round((cell.properties.scores.greenSpace * 0.6) + (Math.min(100, greenScore) * 0.4));
    const bikeInfra = Math.min(100, Math.round(Math.min(6, cyclewayCount) * 16));
    cell.properties.scores.bike = Math.round((cell.properties.scores.bike * 0.4) + (bikeInfra * 0.35) + (greenScore * 0.15) + (supermarketScore * 0.10));

    const nearestTrail = cell.properties._nearestTrailDistKm;
    if (isFinite(nearestTrail) && nearestTrail <= 0.25) {
      const trailFactor = (1 - nearestTrail / 0.25);
      const walkBoost = Math.round(Math.min(12, trailFactor * 12));
      const bikeBoost = Math.round(Math.min(18, trailFactor * 18));
      cell.properties.scores.walkability = Math.min(100, cell.properties.scores.walkability + walkBoost);
      cell.properties.scores.bike = Math.min(100, cell.properties.scores.bike + bikeBoost);
    }

    if (isFinite(minParkDist) && minParkDist <= 0.25) {
      const parkFactor = (1 - minParkDist / 0.25);
      const walkParkBoost = Math.round(Math.min(10, parkFactor * 10));
      const greenParkBoost = Math.round(Math.min(18, parkFactor * 18));
      cell.properties.scores.walkability = Math.min(100, cell.properties.scores.walkability + walkParkBoost);
      cell.properties.scores.greenSpace = Math.min(100, cell.properties.scores.greenSpace + greenParkBoost);
    }

    cell.properties.composite = computeScore(cell.properties.scores);
    cell.properties._osm = { poiCount, minDistKm: minDist, transitCount, greenCount, minGreenDistKm: minGreenDist, supermarketCount, minSupermarketDistKm: minSupermarketDist };
  }

  return grid;
}

export async function computeScoreAtPoint(lat, lng, opts = {}) {
  const mode = (opts.mode || 'walk');
  const radiusKm = opts.radiusKm ?? (mode === 'bike' ? 2.5 : 1.0);
  const latRad = (lat * Math.PI) / 180;
  const deltaLat = radiusKm / 111; const deltaLon = radiusKm / (111 * Math.cos(latRad));
  const bbox = [lng - deltaLon, lat - deltaLat, lng + deltaLon, lat + deltaLat];
  const osm = await fetchOSM(bbox);

  const poiPoints = osm.map((el) => { const tags = el.tags || {}; if (el.type === 'node') return turfPoint([el.lon, el.lat], tags); if ((el.type === 'way' || el.type === 'relation') && el.center) return turfPoint([el.center.lon, el.center.lat], tags); return null; }).filter(Boolean);

  let matched = null; const zones = getAllZoneFeatures().features; const pt = turfPoint([lng, lat]);
  for (const z of zones) { try { if (!z || !z.geometry) continue; if (booleanPointInPolygon(pt, z)) { const nm = (z.properties && (z.properties.Neighborho || z.properties.name)) || ''; if (String(nm).toLowerCase().includes('outside')) continue; matched = z; break; } } catch (err) { continue; } }
  if (!matched) { let minD = Infinity; for (const z of zones) { const c = turfCentroid(z); const d = turfDistance(pt, c, { units: 'kilometers' }); if (d < minD) { minD = d; matched = z; } } }

  const base = matched ? matched.properties.scores : (ZONES[0] || {}).scores || {};
  const scores = { ...base };

  const maxRadius = radiusKm; const nearest = { transit: Infinity, coffee: Infinity, eatery: Infinity, supermarket: Infinity }; const counts = { transit: 0, coffee: 0, eatery: 0, supermarket: 0 };
  let footwayCount = 0; let cyclewayCount = 0; let greenCount = 0; let minGreenDist = Infinity; let minParkDist = Infinity; let supermarketCount = 0; let minSupermarketDist = Infinity;

  for (const p of poiPoints) {
    const d = turfDistance(pt, p, { units: 'kilometers' }); const tags = p.properties || {};
    if (tags.public_transport || tags.highway === 'bus_stop' || tags.amenity === 'bus_station' || tags.railway === 'station' || tags.railway === 'tram_stop') { if (d < nearest.transit) nearest.transit = d; if (d <= maxRadius) counts.transit += 1; }
    if (tags.amenity === 'cafe' || tags.shop === 'coffee' || (tags.cuisine && tags.cuisine.includes('coffee'))) { if (d < nearest.coffee) nearest.coffee = d; if (d <= maxRadius) counts.coffee += 1; }
    if (tags.amenity === 'restaurant' || tags.amenity === 'fast_food' || tags.food || tags.shop === 'food') { if (d < nearest.eatery) nearest.eatery = d; if (d <= maxRadius) counts.eatery += 1; }
    if (tags.shop === 'supermarket' || tags.shop === 'convenience' || tags.shop === 'greengrocer' || tags.amenity === 'pharmacy' || tags.amenity === 'supermarket') { if (d < nearest.supermarket) nearest.supermarket = d; if (d <= maxRadius) counts.supermarket += 1; }
    const highway = (tags.highway || '').toLowerCase(); if (highway === 'footway' || highway === 'pedestrian' || highway === 'path' || tags.foot === 'yes') footwayCount++; if (tags.cycleway || highway === 'cycleway') cyclewayCount++;
    const pname = (tags.name || '').toLowerCase(); const isPark = (tags.leisure === 'park' || tags.landuse === 'recreation_ground' || tags.natural === 'wood'); const isHighline = pname.includes('highline'); const isLeeGulch = pname.includes('lee gulch') || pname.includes('leegulch'); const isTrail = (highway === 'path' || highway === 'track' || tags.foot === 'yes');
    if (isPark || isHighline || isLeeGulch || isTrail) { greenCount++; if (d < minGreenDist) minGreenDist = d; }
    if (isPark) { if (d < minParkDist) minParkDist = d; }
  }

  function distToScore(d, max) { if (!isFinite(d)) return 0; const capped = Math.min(d, max); return Math.round((1 - capped / max) * 100); }

  const maxForScoring = Math.max(0.5, maxRadius);
  const scoresByAmenity = { transit: distToScore(nearest.transit, maxForScoring), coffee: distToScore(nearest.coffee, maxForScoring), eatery: distToScore(nearest.eatery, maxForScoring), supermarket: distToScore(nearest.supermarket, maxForScoring) };

  const amenityWeights = { supermarket: 0.35, eatery: 0.25, transit: 0.25, coffee: 0.15 };
  let amenityComposite = 0; for (const k of Object.keys(amenityWeights)) amenityComposite += (scoresByAmenity[k] || 0) * amenityWeights[k];

  const infraScore = Math.min(100, Math.round(Math.min(5, footwayCount) * 12 + Math.min(5, cyclewayCount) * 8));
  const greenScore = Math.max(0, Math.round((1 - Math.min(minGreenDist, 2) / 2) * 100));
  const mobilityScore = Math.round(amenityComposite * 0.78 + infraScore * 0.12 + greenScore * 0.10);
  const transitScore = Math.min(100, Math.round((scoresByAmenity.transit * 0.6) + Math.min(100, counts.transit * 20) * 0.4));

  let ws = null; try { ws = await getWalkScore(lat, lng); } catch (err) { console.warn('getWalkScore failed', err && err.message); }
  if (ws && typeof ws.walkscore === 'number') scores.walkability = Math.round((ws.walkscore * 0.7) + (mobilityScore * 0.3)); else scores.walkability = mobilityScore;
  scores.transit = transitScore;
  scores.greenSpace = Math.round((scores.greenSpace || 0) * 0.6 + Math.min(100, greenScore) * 0.4);
  const bikeInfra = Math.min(100, Math.round(Math.min(6, cyclewayCount) * 16));
  scores.bike = Math.round(((scores.bike || 0) * 0.4) + (bikeInfra * 0.45) + (greenScore * 0.15));

  if (isFinite(minGreenDist) && minGreenDist <= 0.25) {
    const trailFactorPt = (1 - minGreenDist / 0.25);
    const walkBoostPt = Math.round(Math.min(12, trailFactorPt * 12));
    const bikeBoostPt = Math.round(Math.min(18, trailFactorPt * 18));
    scores.walkability = Math.min(100, scores.walkability + walkBoostPt);
    scores.bike = Math.min(100, scores.bike + bikeBoostPt);
  }
  if (isFinite(minParkDist) && minParkDist <= 0.25) {
    const parkFactorPt = (1 - minParkDist / 0.25);
    const walkParkBoostPt = Math.round(Math.min(10, parkFactorPt * 10));
    const greenParkBoostPt = Math.round(Math.min(18, parkFactorPt * 18));
    scores.walkability = Math.min(100, scores.walkability + walkParkBoostPt);
    scores.greenSpace = Math.min(100, scores.greenSpace + greenParkBoostPt);
  }

  const composite = computeScore(scores);
  return { name: matched ? matched.properties.name : 'Local area', scores, composite, notes: matched ? matched.properties.notes : '', _osm: { counts, nearestKm: nearest, infra: { footwayCount, cyclewayCount }, green: { greenCount, minGreenDistKm: minGreenDist } }, zoneId: matched ? matched.properties.id : null };
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
          else if (geo.type === 'Polygon' || geo.type === 'MultiPolygon') { const feature = { type: 'Feature', properties: {}, geometry: geo }; if (booleanPointInPolygon(pt, feature)) return true; }
        }
      }
    }
  } catch (err) { console.warn('city boundary check failed', err && err.message); }
  const features = getAllZoneFeatures().features;
  for (const f of features) { if (!f || !f.geometry) continue; const name = (f.properties && (f.properties.Neighborho || f.properties.name)) || ''; if (String(name).toLowerCase().includes('outside')) continue; if (booleanPointInPolygon(pt, f)) return true; }
  if (lat <= LITTLETON_BOUNDS.north && lat >= LITTLETON_BOUNDS.south && lng <= LITTLETON_BOUNDS.east && lng >= LITTLETON_BOUNDS.west) return true;
  return false;
}
