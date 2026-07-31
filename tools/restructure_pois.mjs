#!/usr/bin/env node
// Split unified_list.json into per-city JSON files
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const SRC = 'data/unified_list.json';
const DATA_DIR = 'data';

const data = JSON.parse(readFileSync(SRC, 'utf8'));

// If it's already city-keyed, skip splitting
const firstVal = Object.values(data)[0];
if (firstVal && typeof firstVal === 'object' && !Array.isArray(firstVal)) {
  console.log('unified_list.json is already city-keyed. Skipping split.');
  process.exit(0);
}

const CITIES = {
  littleton: { north: 39.646, south: 39.562, east: -104.970, west: -105.065 },
  centennial: { north: 39.640, south: 39.564, east: -104.726, west: -104.990 },
  englewood: { north: 39.674, south: 39.617, east: -104.959, west: -105.019 },
};

function pointInBounds(lat, lon, b) {
  return lat <= b.north && lat >= b.south && lon <= b.east && lon >= b.west;
}

const CATEGORY_MAPPING = {
  coffee: 'coffee',
  restaurant: 'restaurant',
  grocery: 'grocery',
  parks: 'park',
  trailheads: 'trail',
  medical: 'healthcare',
  busStops: 'busStop',
  nature: 'trail',
  schools: 'schools',
};

const cityData = {};
for (const cityKey of Object.keys(CITIES)) {
  cityData[cityKey] = {};
}

for (const [cat, points] of Object.entries(data)) {
  if (!Array.isArray(points)) continue;
  const mappedCat = CATEGORY_MAPPING[cat] || cat;

  for (const p of points) {
    if (typeof p.lat !== 'number' || typeof p.lon !== 'number') continue;
    const lat = Number(p.lat);
    const lon = Number(p.lon);

    for (const [cityKey, bounds] of Object.entries(CITIES)) {
      if (pointInBounds(lat, lon, bounds)) {
        if (!cityData[cityKey][mappedCat]) cityData[cityKey][mappedCat] = [];
        cityData[cityKey][mappedCat].push({
          lat,
          lon,
          ...(p.name ? { name: p.name } : {}),
          note: p.note || `${p.name || ''}`.trim(),
        });
      }
    }
  }
}

// Deduplicate per city/category by lat/lon
for (const [cityKey, cats] of Object.entries(cityData)) {
  for (const [cat, points] of Object.entries(cats)) {
    const seen = new Set();
    const deduped = [];
    for (const p of points) {
      const key = `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(p);
    }
    cityData[cityKey][cat] = deduped;
  }
}

// Summary + write per-city files
for (const [cityKey, cats] of Object.entries(cityData)) {
  let total = 0;
  const lines = [`--- ${cityKey} ---`];
  for (const [cat, points] of Object.entries(cats).sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`  ${cat}: ${points.length}`);
    total += points.length;
  }
  lines.push(`  TOTAL: ${total}`);
  console.log(lines.join('\n'));

  const outPath = resolve(DATA_DIR, `pois_${cityKey}.json`);
  writeFileSync(outPath, JSON.stringify(cityData[cityKey], null, 2) + '\n', 'utf8');
  console.log(`Written: ${outPath}`);
}

// Keep unified_list.json as is (backup)
console.log('\nDone. Per-city files written. unified_list.json preserved as-is.');
