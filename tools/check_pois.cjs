#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const cities = ['littleton', 'centennial', 'englewood'];
const requiredCats = ['coffee', 'restaurant', 'grocery', 'trail', 'park', 'busStop', 'healthcare', 'schools'];

for (const city of cities) {
  const p = path.join(DATA_DIR, `pois_${city}.json`);
  if (!fs.existsSync(p)) {
    console.error(`Missing file: ${p}`);
    continue;
  }
  const raw = fs.readFileSync(p, 'utf8');
  let data;
  try { data = JSON.parse(raw); } catch (e) { console.error('Parse error', p, e.message); continue; }
  console.log(`\n=== ${city} ===`);
  let total = 0;
  for (const k of Object.keys(data)) total += Array.isArray(data[k]) ? data[k].length : 0;
  console.log('Total POIs:', total);
  for (const c of requiredCats) {
    const count = Array.isArray(data[c]) ? data[c].length : 0;
    console.log(`  ${c}: ${count}` + (count === 0 ? '  <-- MISSING' : ''));
  }
}

console.log('\nCheck complete.');
