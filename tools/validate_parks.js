#!/usr/bin/env node
// Simple validator: forward-geocode addresses with Nominatim and query Overpass
// to check for nearby park/trailhead features.

const addresses = [
  "6954 S Windermere St, Littleton, CO 80120",
  "6147 S Gallup St, Littleton, CO 80120",
  "6028 S Gallup St, Littleton, CO 80120",
  "5800 S Spotswood St, Littleton, CO 80120",
  "164 W Acoma Dr, Littleton, CO 80120",
  "5150 S Windermere St, Littleton, CO 80120",
  "5100 S Hickory St, Littleton, CO 80120",
  "5501 S Federal Blvd, Littleton, CO 80123",
  "Powers Park, Littleton, CO 80120",
  "West Crestline Avenue Unnamed Rd, Littleton, CO 80120",
  "5875 S Lowell Blvd, Littleton, CO 80123"
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { execFileSync } = await import('node:child_process');

function fetchJson(url, opts = {}) {
  const headers = opts.headers || {};
  const args = ['-s'];
  for (const [k, v] of Object.entries(headers)) {
    args.push('-H', `${k}: ${v}`);
  }
  if (opts.method && opts.method.toUpperCase() === 'POST') {
    if (opts.body) {
      args.push('--data-binary', opts.body);
    } else {
      args.push('-X', 'POST');
    }
  }
  args.push(url);
  try {
    const out = execFileSync('curl', args, { encoding: 'utf8' });
    return JSON.parse(out);
  } catch (err) {
    throw err;
  }
}

function classifyOSM(tags = {}) {
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
  if (h === 'path' || h === 'track' || h === 'trailhead' || h === 'footway' || l === 'park' || l === 'nature_reserve' || name.includes('trail')) results.push('nature');
  if (a === 'hospital' || a === 'clinic' || a === 'doctors' || a === 'pharmacy' || a === 'dentist' || tags.healthcare) results.push('healthcare');

  return results;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function checkAddress(addr) {
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=1`;
    const nomHeaders = { 'User-Agent': 'LivableIndex/validate-script', 'Accept': 'application/json' };
    const nom = await fetchJson(nomUrl, { headers: nomHeaders });
    await sleep(1100); // be polite
    if (!nom || nom.length === 0) {
      console.log(`${addr} -> No geocode result`);
      return { address: addr, geocoded: null, found: false };
    }
    const loc = nom[0];
    const lat = parseFloat(loc.lat);
    const lon = parseFloat(loc.lon);

    // construct Overpass query (search 100m radius for park/trailhead)
    const q = `
[out:json][timeout:25];
(
  node(around:100,${lat},${lon})["leisure"="park"];
  way(around:100,${lat},${lon})["leisure"="park"];
  node(around:100,${lat},${lon})["leisure"="nature_reserve"];
  way(around:100,${lat},${lon})["leisure"="nature_reserve"];
  node(around:100,${lat},${lon})["highway"="trailhead"];
  way(around:100,${lat},${lon})["highway"="trailhead"];
  node(around:100,${lat},${lon})["amenity"="park"];
);
out center;`;

    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    const over = await fetchJson(overpassUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: q });
    await sleep(1100);

    const elements = (over && over.elements) || [];
    const classified = elements.map((el) => ({ id: el.id, type: el.type, tags: el.tags || {}, classification: classifyOSM(el.tags || {}), dist_m: el.center ? haversineKm(lat, lon, el.center.lat, el.center.lon) * 1000 : (el.lat ? haversineKm(lat, lon, el.lat, el.lon) * 1000 : null) }));

    const hasNature = classified.some((c) => c.classification.includes('nature'));
    const details = classified.slice(0,5);

    return { address: addr, geocoded: { lat, lon, display_name: loc.display_name }, found: hasNature, details };
  } catch (err) {
    return { address: addr, error: String(err) };
  }
}

(async () => {
  console.log('Validating parks/nature locations (this will take ~12s)');
  const results = [];
  for (const a of addresses) {
    const r = await checkAddress(a);
    results.push(r);
    if (r.geocoded) console.log(`- ${a} => ${r.geocoded.display_name} @ ${r.geocoded.lat},${r.geocoded.lon} -> natureNearby: ${r.found}`);
    else if (r.error) console.log(`- ${a} => error: ${r.error}`);
    else console.log(`- ${a} => no geocode result`);
  }
  console.log('\nFull JSON results:\n');
  console.log(JSON.stringify(results, null, 2));
})();
