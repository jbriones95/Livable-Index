#!/usr/bin/env node
// Find nearest coffee from unified_list.json and query routes (ORS/OSRM)

const addr = process.argv.slice(2).join(' ') || '2391, West Caley Avenue, Littleton';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { execFileSync } = await import('node:child_process');
const fs = await import('node:fs/promises');

function fetchJson(url, opts = {}) {
  const headers = opts.headers || {};
  const args = ['-s'];
  for (const [k, v] of Object.entries(headers)) {
    args.push('-H', `${k}: ${v}`);
  }
  args.push(url);
  try {
    const out = execFileSync('curl', args, { encoding: 'utf8' });
    return JSON.parse(out);
  } catch (err) {
    return null;
  }
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function main() {
  console.log('Geocoding address:', addr);
  const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=1`;
  const nom = fetchJson(nomUrl, { headers: { 'User-Agent': 'LivableIndex/route-check', Accept: 'application/json' } });
  await sleep(1100);
  if (!nom || !nom.length) {
    console.error('No geocode result for address');
    process.exit(1);
  }
  const lat = parseFloat(nom[0].lat);
  const lon = parseFloat(nom[0].lon);
  console.log(' ->', nom[0].display_name, '@', lat, lon);

  // load unified list
  const raw = await fs.readFile(new URL('../data/unified_list.json', import.meta.url), 'utf8');
  const unified = JSON.parse(raw);
  const coffees = unified.coffee || [];
  if (!coffees.length) {
    console.error('No coffee entries in unified_list.json');
    process.exit(1);
  }

  let best = null;
  for (const c of coffees) {
    if (!c.lat || !c.lon) continue;
    const d = haversineKm(lat, lon, c.lat, c.lon);
    if (!best || d < best.d) best = { d, coord: [c.lon, c.lat], name: c.name || c.note || '(unnamed)', raw: c };
  }

  if (!best) { console.error('No valid coffee coordinates'); process.exit(1); }

  console.log('\nNearest coffee:', best.name);
  console.log('  coords:', best.coord[1], best.coord[0]);
  console.log(`  straight-line: ${best.d.toFixed(3)} km`);

  // routing
  const ORS_KEY = process.env.VITE_ORS_API_KEY || process.env.OPENROUTESERVICE_API_KEY || process.env.ORS_API_KEY;
  const fromLon = lon; const fromLat = lat;
  const toLon = best.coord[0]; const toLat = best.coord[1];

  if (ORS_KEY) {
    console.log('\nQuerying OpenRouteService routes (walking, cycling)...');
    const walkUrl = `https://api.openrouteservice.org/v2/directions/foot-walking?start=${fromLon},${fromLat}&end=${toLon},${toLat}`;
    const walk = fetchJson(walkUrl, { headers: { Authorization: ORS_KEY, Accept: 'application/json' } });
    await sleep(250);
    const bikeUrl = `https://api.openrouteservice.org/v2/directions/cycling-regular?start=${fromLon},${fromLat}&end=${toLon},${toLat}`;
    const bike = fetchJson(bikeUrl, { headers: { Authorization: ORS_KEY, Accept: 'application/json' } });
    await sleep(250);

    const findSummary = (j) => {
      if (!j) return null;
      try {
        if (j.features && j.features[0] && j.features[0].properties && j.features[0].properties.segments && j.features[0].properties.segments[0]) return j.features[0].properties.segments[0];
        if (j.routes && j.routes[0] && j.routes[0].summary) return j.routes[0].summary;
      } catch {
        return null;
      }
      return null;
    };

    const ws = findSummary(walk);
    const bs = findSummary(bike);
    if (ws) console.log(`Walk route: ${(ws.distance/1000).toFixed(3)} km, ${(ws.duration/60).toFixed(1)} min`);
    else console.log('Walk route: (no route)');
    if (bs) console.log(`Bike route: ${(bs.distance/1000).toFixed(3)} km, ${(bs.duration/60).toFixed(1)} min`);
    else console.log('Bike route: (no route)');
  } else {
    console.log('\nNo OpenRouteService key found in environment; falling back to OSRM public server.');
    const walkUrl = `https://router.project-osrm.org/route/v1/foot/${fromLon},${fromLat};${toLon},${toLat}?overview=false`;
    const walk = fetchJson(walkUrl);
    const bikeUrl = `https://router.project-osrm.org/route/v1/bicycle/${fromLon},${fromLat};${toLon},${toLat}?overview=false`;
    const bike = fetchJson(bikeUrl);
    const pick = (j) => { if (!j) return null; if (j.routes && j.routes[0]) return j.routes[0]; return null; };
    const wr = pick(walk); const br = pick(bike);
    if (wr) console.log(`Walk route (OSRM): ${(wr.distance/1000).toFixed(3)} km, ${(wr.duration/60).toFixed(1)} min`); else console.log('Walk route: (no route)');
    if (br) console.log(`Bike route (OSRM): ${(br.distance/1000).toFixed(3)} km, ${(br.duration/60).toFixed(1)} min`); else console.log('Bike route: (no route)');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
