#!/usr/bin/env node
import fs from 'node:fs/promises';

const sourcePath = new URL('../data/littleton_eats.csv', import.meta.url);
const outputPath = new URL('../data/pois_littleton.json', import.meta.url);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        value += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(value);
      value = '';
    } else if (ch === '\n') {
      row.push(value.replace(/\r$/, ''));
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = '';
    } else {
      value += ch;
    }
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function streetOnly(address) {
  return address
    .replace(/\s+(?:ste|suite|unit)\s+.+$/i, '')
    .replace(/\s+#\s*.+$/i, '')
    .trim();
}

async function censusGeocode(entries) {
  const batch = entries
    .map((entry, index) => `${index},${streetOnly(entry.address)},${entry.city},${entry.state},`)
    .join('\n');
  const form = new FormData();
  form.append('addressFile', new Blob([batch], { type: 'text/csv' }), 'littleton-eats.csv');
  form.append('benchmark', 'Public_AR_Current');
  const response = await fetch('https://geocoding.geo.census.gov/geocoder/locations/addressbatch', {
    method: 'POST',
    body: form,
  });
  if (!response.ok) throw new Error(`Census geocoder returned ${response.status}`);

  const rows = parseCsv(await response.text());
  const results = new Map();
  for (const row of rows) {
    const id = Number(row[0]);
    const match = row[2] === 'Match' || row[2] === 'Tie';
    const coords = String(row[5] || '').split(',').map(Number);
    if (Number.isInteger(id) && match && coords.length === 2 && coords.every(Number.isFinite)) {
      results.set(id, { lon: coords[0], lat: coords[1] });
    }
  }
  return results;
}

async function nominatimGeocode(entry) {
  const query = encodeURIComponent(`${entry.name}, ${entry.address}, ${entry.city}, ${entry.state}`);
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${query}`, {
    headers: { 'User-Agent': 'Livable-Index/1.0 (https://github.com/jbriones/Livable-Index)' },
  });
  if (!response.ok) return null;
  const data = await response.json();
  const lat = Number(data?.[0]?.lat);
  const lon = Number(data?.[0]?.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

const [header, ...rows] = parseCsv(await fs.readFile(sourcePath, 'utf8'));
const columns = Object.fromEntries(header.map((name, index) => [name, index]));
const entries = rows.map((row) => ({
  category: row[columns.category],
  name: row[columns.name],
  address: row[columns.address],
  city: row[columns.city],
  state: row[columns.state],
}));

const data = JSON.parse(await fs.readFile(outputPath, 'utf8'));
const existingByName = new Map();
for (const category of ['coffee', 'restaurant']) {
  for (const point of data[category] || []) {
    if (point.name) existingByName.set(normalize(point.name), { lat: point.lat, lon: point.lon });
  }
}

const censusResults = await censusGeocode(entries);
const resolved = [];
const unresolved = [];
for (let index = 0; index < entries.length; index++) {
  const entry = entries[index];
  let coords = censusResults.get(index) || existingByName.get(normalize(entry.name));
  if (!coords) {
    await new Promise((resolve) => setTimeout(resolve, 1100));
    coords = await nominatimGeocode(entry).catch(() => null);
  }
  if (!coords) {
    unresolved.push(entry);
    continue;
  }
  resolved.push({
    ...entry,
    lat: coords.lat,
    lon: coords.lon,
  });
}

const suppliedNames = new Set(entries.map((entry) => normalize(entry.name)));
for (const category of Object.keys(data)) {
  if (!Array.isArray(data[category])) continue;
  data[category] = data[category].filter((point) => {
    const note = String(point.note || '');
    if (/\b(?:Centennial|Englewood)\s*$/i.test(note)) return false;
    if ((category === 'coffee' || category === 'restaurant') && suppliedNames.has(normalize(point.name))) return false;
    return true;
  });
}

for (const entry of resolved) {
  data[entry.category] ||= [];
  data[entry.category].push({
    lat: entry.lat,
    lon: entry.lon,
    name: entry.name,
    note: `${entry.address}, ${entry.city}, ${entry.state}`,
  });
}

await fs.writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Imported ${resolved.length}/${entries.length} supplied Littleton places.`);
console.log(`Coffee: ${(data.coffee || []).length}; restaurant: ${(data.restaurant || []).length}`);
if (unresolved.length) {
  console.log('Unresolved:');
  for (const entry of unresolved) console.log(`- ${entry.name}: ${entry.address}`);
  process.exitCode = 1;
}
