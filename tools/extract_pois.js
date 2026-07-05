#!/usr/bin/env node
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Bounding box for Littleton (matches src/livabilityData.js)
const bbox = { north: 39.645, south: 39.580, east: -104.980, west: -105.055 };
const s = bbox.south, w = bbox.west, n = bbox.north, e = bbox.east;

const q = `
[out:json][timeout:60];
(
  node["leisure"="park"](${s},${w},${n},${e});
  way["leisure"="park"](${s},${w},${n},${e});
  relation["leisure"="park"](${s},${w},${n},${e});

  node["leisure"="nature_reserve"](${s},${w},${n},${e});
  way["leisure"="nature_reserve"](${s},${w},${n},${e});
  relation["leisure"="nature_reserve"](${s},${w},${n},${e});

  node["highway"="trailhead"](${s},${w},${n},${e});
  way["highway"="trailhead"](${s},${w},${n},${e});
  relation["highway"="trailhead"](${s},${w},${n},${e});

  node["amenity"="hospital"](${s},${w},${n},${e});
  way["amenity"="hospital"](${s},${w},${n},${e});
  relation["amenity"="hospital"](${s},${w},${n},${e});

  node["amenity"="clinic"](${s},${w},${n},${e});
  way["amenity"="clinic"](${s},${w},${n},${e});
  relation["amenity"="clinic"](${s},${w},${n},${e});

  node["amenity"="doctors"](${s},${w},${n},${e});
  way["amenity"="doctors"](${s},${w},${n},${e});
  relation["amenity"="doctors"](${s},${w},${n},${e});

  node["amenity"="pharmacy"](${s},${w},${n},${e});
  way["amenity"="pharmacy"](${s},${w},${n},${e});
  relation["amenity"="pharmacy"](${s},${w},${n},${e});

  node["amenity"="dentist"](${s},${w},${n},${e});
  way["amenity"="dentist"](${s},${w},${n},${e});
  relation["amenity"="dentist"](${s},${w},${n},${e});

  node["highway"="bus_stop"](${s},${w},${n},${e});
  way["highway"="bus_stop"](${s},${w},${n},${e});

  node["public_transport"](${s},${w},${n},${e});
  way["public_transport"](${s},${w},${n},${e});

  node["railway"="tram_stop"](${s},${w},${n},${e});
  way["railway"="tram_stop"](${s},${w},${n},${e});
  node["railway"="station"](${s},${w},${n},${e});
  way["railway"="station"](${s},${w},${n},${e});
  node["railway"="halt"](${s},${w},${n},${e});
  way["railway"="halt"](${s},${w},${n},${e});
);
out center;`;

console.log('Querying Overpass for parks, trailheads, medical, and transit stops...');
const url = 'https://overpass.openstreetmap.fr/api/interpreter';
let raw;
try {
  raw = execFileSync('curl', ['-s', '-X', 'POST', '-H', 'Content-Type: text/plain', '--data-binary', q, url], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
} catch (err) {
  console.error('Overpass query failed:', err && err.message);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(raw);
} catch (err) {
  console.error('Failed to parse Overpass response:', err && err.message);
  process.exit(1);
}

const elements = data.elements || [];
console.log(`Received ${elements.length} elements from Overpass`);

function normalizePoint(el) {
  let lat = el.lat;
  let lon = el.lon;
  if ((!lat || !lon) && el.center) {
    lat = el.center.lat;
    lon = el.center.lon;
  }
  if (!lat || !lon) return null;
  return {
    lat: Number(lat),
    lon: Number(lon),
    name: (el.tags && (el.tags.name || el.tags.ref)) || null,
    tags: el.tags || {},
    id: `${el.type}/${el.id}`,
  };
}

const parks = new Map();
const trailheads = new Map();
const medical = new Map();
const busStops = new Map();

for (const el of elements) {
  const p = normalizePoint(el);
  if (!p) continue;
  const t = p.tags || {};
  const name = (p.name || '').toLowerCase();

  if (t.leisure === 'park' || t.leisure === 'nature_reserve' || t.leisure === 'recreation_ground') {
    parks.set(p.id, p);
  }
  if (t.highway === 'trailhead' || name.includes('trail') || name.includes('trailhead')) {
    trailheads.set(p.id, p);
  }
  if (['hospital', 'clinic', 'doctors', 'pharmacy', 'dentist'].includes(t.amenity)) {
    medical.set(p.id, p);
  }
  if (t.highway === 'bus_stop' || t.railway === 'tram_stop' || t.railway === 'station' || t.railway === 'halt' || t.public_transport) {
    busStops.set(p.id, p);
  }
}

const poiFile = path.join(__dirname, '..', 'data', 'poi_lists.json');
let existing = { coffee: [], parks: [], trailheads: [], medical: [], busStops: [] };
try {
  existing = JSON.parse(fs.readFileSync(poiFile, 'utf8'));
} catch (err) {
  // file may not exist yet
}

function addUnique(list, item) {
  for (const p of list) {
    if (Math.abs(p.lat - item.lat) < 0.0001 && Math.abs(p.lon - item.lon) < 0.0001) return false;
  }
  list.push(item);
  return true;
}

let added = { parks: 0, trailheads: 0, medical: 0, busStops: 0 };

for (const p of parks.values()) {
  if (addUnique(existing.parks, { lat: p.lat, lon: p.lon, name: p.name, id: p.id })) added.parks++;
}
for (const p of trailheads.values()) {
  if (addUnique(existing.trailheads, { lat: p.lat, lon: p.lon, name: p.name, id: p.id })) added.trailheads++;
}
for (const p of medical.values()) {
  if (addUnique(existing.medical, { lat: p.lat, lon: p.lon, name: p.name, id: p.id })) added.medical++;
}
for (const p of busStops.values()) {
  if (addUnique(existing.busStops, { lat: p.lat, lon: p.lon, name: p.name, id: p.id })) added.busStops++;
}

fs.writeFileSync(poiFile, JSON.stringify(existing, null, 2));
console.log('Wrote', poiFile);
console.log(`Added: parks=${added.parks}, trailheads=${added.trailheads}, medical=${added.medical}, busStops=${added.busStops}`);
console.log(`Totals: parks=${existing.parks.length}, trailheads=${existing.trailheads.length}, medical=${existing.medical.length}, busStops=${existing.busStops.length}`);
