#!/usr/bin/env node
// Aggregate OSM metrics per neighborhood (ArcGIS Neighborhood_Boundary) to help manual scoring.
// This script is meant to be run locally (it will call Overpass and the ArcGIS geojson).

import fetch from 'node-fetch';
import * as turf from '@turf/turf';
import fs from 'fs/promises';

const NB_URL = 'https://services6.arcgis.com/lJUBf9F1fZJRB4zT/arcgis/rest/services/Neighborhood_Boundary/FeatureServer/70/query?where=1%3D1&outFields=*&outSR=4326&f=geojson';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

async function fetchNeighborhoods() {
  const r = await fetch(NB_URL);
  if (!r.ok) throw new Error('failed to fetch neighborhoods');
  return r.json();
}

// Build a bbox string "south,west,north,east"
function bboxFromPoly(poly) {
  const bbox = turf.bbox(poly);
  return `${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]}`;
}

async function fetchOverpass(bbox) {
  const q = `[out:json][timeout:25];
(
  node["amenity"](${bbox});
  way["amenity"](${bbox});
  node["shop"](${bbox});
  way["shop"](${bbox});
  node["leisure"](${bbox});
  way["leisure"](${bbox});
  node["public_transport"](${bbox});
  way["public_transport"](${bbox});
  node["highway"="bus_stop"](${bbox});
  node["railway"="station"](${bbox});
  way["railway"="station"](${bbox});
  way["cycleway"](${bbox});
  way["highway"](${bbox});
);
out center;`;
  // retry logic for rate limiting
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(OVERPASS_URL, { method: 'POST', body: q, headers: { 'Content-Type': 'text/plain' } });
    if (res.status === 429) {
      const wait = 1000 * (attempt + 1);
      console.warn('Overpass 429, waiting', wait);
      await new Promise((res) => setTimeout(res, wait));
      continue;
    }
    if (!res.ok) {
      console.error('Overpass error', res.status, res.statusText);
      return [];
    }
    const data = await res.json();
    return data.elements || [];
  }
  console.error('Overpass: exhausted retries');
  return [];
}

function pointForElement(el) {
  if (el.type === 'node') return turf.point([el.lon, el.lat], el.tags || {});
  if ((el.type === 'way' || el.type === 'relation') && el.center) return turf.point([el.center.lon, el.center.lat], el.tags || {});
  return null;
}

async function main() {
  console.log('Fetching neighborhoods...');
  const nb = await fetchNeighborhoods();
  const feats = nb.features || [];
  const results = [];
  for (const f of feats) {
    const name = (f.properties && (f.properties.Neighborho || f.properties.name)) || String(f.id);
    console.log('Processing', f.id, name);
    if (!f.geometry) {
      console.warn('Skipping due to null geometry', f.id);
      continue;
    }
    const bbox = bboxFromPoly(f.geometry);
    const osm = await fetchOverpass(bbox);
    const points = osm.map(pointForElement).filter(Boolean);

    // aggregate
    const counts = { supermarket: 0, cafe: 0, restaurant: 0, transit: 0, footway: 0, cycleway: 0, park: 0 };
    let minSuper = Infinity;
    let minGreen = Infinity;

    const poly = f.geometry;
    // for each point, if inside poly or near (<0.5km from poly), count
    for (const p of points) {
      const d = turf.distance(turf.centroid(poly), p, { units: 'kilometers' });
      const tags = p.properties || {};
      const coords = p.geometry.coordinates;
      const pt = turf.point(coords);
      const inside = turf.booleanPointInPolygon(pt, f);
      // measure distance to polygon (centroid fallback)
      const dist = turf.distance(pt, turf.centroid(f), { units: 'kilometers' });
      // categorize
      const shop = (tags.shop || '').toLowerCase();
      const amen = (tags.amenity || '').toLowerCase();
      const leisure = (tags.leisure || '').toLowerCase();
      if (shop === 'supermarket' || shop === 'convenience' || amen === 'supermarket' || amen === 'pharmacy') {
        counts.supermarket++;
        if (dist < minSuper) minSuper = dist;
      }
      if (amen === 'cafe') counts.cafe++;
      if (amen === 'restaurant' || amen === 'fast_food') counts.restaurant++;
      if (tags.public_transport || tags.highway === 'bus_stop' || tags.railway) counts.transit++;
      if (tags.highway === 'footway' || tags.highway === 'path') counts.footway++;
      if (tags.cycleway || tags.highway === 'cycleway') counts.cycleway++;
      if (leisure === 'park' || tags.landuse === 'recreation_ground' || tags.natural === 'wood') {
        counts.park++;
        if (dist < minGreen) minGreen = dist;
      }
    }

    results.push({ id: f.id, name, counts, minSuper, minGreen });
    // polite pause to avoid Overpass rate limiting
    await new Promise((res) => setTimeout(res, 3000));
  }

  console.log('Done. Writing results to tools/neighborhood_metrics.json');
  await fs.writeFile('tools/neighborhood_metrics.json', JSON.stringify(results, null, 2), 'utf8');
  console.log('Wrote tools/neighborhood_metrics.json');
}

main().catch((err) => { console.error(err); process.exit(2); });
