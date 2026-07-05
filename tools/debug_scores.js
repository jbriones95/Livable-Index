#!/usr/bin/env node
// Diagnostics: compute per-dimension scores for a list of addresses and show why zeros occur.

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
  "5875 S Lowell Blvd, Littleton, CO 80123",
  // center point for comparison
  "39.6133,-105.0166"
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
    // return null to let caller handle
    return null;
  }
}

const MAX_DIST_KM = {
  coffee: 1.0,
  restaurant: 1.0,
  grocery: 1.5,
  trailhead: 2.0,
  busStop: 0.8,
  healthcare: 2.0,
};

const WEIGHTS = {
  coffee: 0.15,
  restaurant: 0.15,
  grocery: 0.20,
  trailhead: 0.10,
  busStop: 0.20,
  healthcare: 0.20,
};

function classifyOSM(tags = {}) {
  const results = [];
  const a = (tags.amenity || '').toLowerCase();
  const s = (tags.shop || '').toLowerCase();
  const h = (tags.highway || '').toLowerCase();
  const l = (tags.leisure || '').toLowerCase();
  const pt = tags.public_transport ? String(tags.public_transport).toLowerCase() : '';
  const r = (tags.railway || '').toLowerCase();
  const name = (tags.name || '').toLowerCase();
  const cuisine = tags.cuisine ? String(tags.cuisine).toLowerCase() : '';

  // Coffee: cafe or shop=coffee or name contains coffee
  if (
    a === 'cafe' ||
    s.includes('coffee') ||
    s === 'tea_house' ||
    cuisine.includes('coffee') ||
    name.includes('coffee')
  ) {
    results.push('coffee');
  }

  // Restaurant: restaurant or fast_food or food_court
  if (a === 'restaurant' || a === 'fast_food' || a === 'food_court') results.push('restaurant');

  // Grocery: supermarket / convenience / grocery / greengrocer / market
  if (
    s === 'supermarket' ||
    s === 'grocery' ||
    s === 'convenience' ||
    s === 'greengrocer' ||
    a === 'supermarket' ||
    s.includes('market')
  )
    results.push('grocery');

  // Bus / transit: include bus_stop, bus_station, public_transport platforms, and railway/tram stops
  if (
    h === 'bus_stop' ||
    a === 'bus_station' ||
    pt === 'platform' ||
    pt === 'bus_stop' ||
    pt === 'stop_position' ||
    r === 'station' ||
    r === 'tram_stop' ||
    r === 'halt' ||
    r === 'light_rail' ||
    r === 'subway' ||
    r === 'stop'
  )
    results.push('busStop');

  // Trailhead / park: paths, footways, parks, nature_reserve
  if (
    ['path', 'track', 'trailhead', 'footway', 'pedestrian'].includes(h) ||
    l === 'park' ||
    l === 'nature_reserve' ||
    l === 'recreation_ground' ||
    name.includes('trail') ||
    name.includes('park')
  )
    results.push('trailhead');

  // Healthcare
  if (a === 'hospital' || a === 'clinic' || a === 'doctors' || a === 'pharmacy' || a === 'dentist' || tags.healthcare) results.push('healthcare');

  return results;
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

function distToScore(d, max) {
  // Match application logic: 100 inside threshold; for every full 200m beyond
  // threshold subtract 10 points. Floor-based steps.
  if (!isFinite(d)) return 0;
  if (d <= max) return 100;
  const extraMeters = (d - max) * 1000;
  const steps = Math.floor(extraMeters / 200);
  const deduction = steps * 10;
  return Math.max(0, 100 - deduction);
}

async function analyzePoint(lat, lon, opts = {}) {
  const radiusM = opts.radiusM ?? 1500; // default 1.5km like computeScoreAtPoint
  // Overpass 'around' uses meters
  const q = `\n[out:json][timeout:25];\n(\n  node(around:${radiusM},${lat},${lon})["amenity"];\n  way(around:${radiusM},${lat},${lon})["amenity"];\n  node(around:${radiusM},${lat},${lon})["shop"];\n  way(around:${radiusM},${lat},${lon})["shop"];\n  node(around:${radiusM},${lat},${lon})["leisure"];\n  way(around:${radiusM},${lat},${lon})["leisure"];\n  node(around:${radiusM},${lat},${lon})["tourism"];\n  way(around:${radiusM},${lat},${lon})["tourism"];\n  node(around:${radiusM},${lat},${lon})["public_transport"];\n  way(around:${radiusM},${lat},${lon})["public_transport"];\n  node(around:${radiusM},${lat},${lon})["highway"];\n  way(around:${radiusM},${lat},${lon})["highway"];\n  node(around:${radiusM},${lat},${lon})["railway"];\n  way(around:${radiusM},${lat},${lon})["railway"];\n);\nout center;`;

  const over = fetchJson('https://overpass.openstreetmap.fr/api/interpreter', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: q });
  // fetchJson uses curl synchronously; but we wrapped it as sync returning JSON; still mimic async wait for politeness
  await sleep(200);
  if (!over || !over.elements) {
    return { error: 'Overpass returned no data' };
  }

  const poiPoints = over.elements.map((el) => {
    const tags = el.tags || {};
    if (el.type === 'node') return { coords: [el.lat, el.lon], tags };
    if ((el.type === 'way' || el.type === 'relation') && el.center) return { coords: [el.center.lat, el.center.lon], tags };
    return null;
  }).filter(Boolean);

  const pt = [lat, lon];
  const nearest = { coffee: Infinity, restaurant: Infinity, grocery: Infinity, trailhead: Infinity, busStop: Infinity, healthcare: Infinity };
  const counts = { coffee: 0, restaurant: 0, grocery: 0, trailhead: 0, busStop: 0, healthcare: 0 };

  for (const p of poiPoints) {
    const [plat, plon] = p.coords;
    const d = haversineKm(lat, lon, plat, plon);
    const cats = classifyOSM(p.tags);
    for (const cat of cats) {
      if (d < nearest[cat]) nearest[cat] = d;
      if (d <= (MAX_DIST_KM[cat] || 0)) counts[cat]++;
    }
  }

  // supplemental/trusted points not included here — consider adding if needed

  const scores = {};
  for (const key of Object.keys(MAX_DIST_KM)) scores[key] = distToScore(nearest[key], MAX_DIST_KM[key]);

  const composite = Math.round(Object.entries(WEIGHTS).reduce((sum, [dim, weight]) => sum + (scores[dim] || 0) * weight, 0));

  return { lat, lon, counts, nearestKm: nearest, scores, composite };
}

async function main() {
  console.log('Running diagnostics for addresses...');
  const results = [];
  for (const a of addresses) {
    let lat, lon, display;
    if (a.includes(',' ) && !isNaN(Number(a.split(',')[0]))) {
      // coordinate input
      [lat, lon] = a.split(',').map(Number);
      display = `coord:${lat},${lon}`;
    } else {
      const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(a)}&limit=1`;
      const nom = fetchJson(nomUrl, { headers: { 'User-Agent': 'LivableIndex/diag', 'Accept': 'application/json' } });
      await sleep(1100);
      if (!nom || !nom.length) {
        console.log(`- ${a} -> no geocode`);
        results.push({ address: a, error: 'no geocode' });
        continue;
      }
      lat = parseFloat(nom[0].lat);
      lon = parseFloat(nom[0].lon);
      display = nom[0].display_name || a;
    }

    const r = await analyzePoint(lat, lon, { radiusM: 1500 });
    if (r.error) {
      console.log(`- ${a} (${display}) -> ${r.error}`);
      results.push({ address: a, display, error: r.error });
      continue;
    }

    console.log(`- ${a} => ${display} @ ${r.lat},${r.lon}`);
    console.log(`  counts: ${JSON.stringify(r.counts)}`);
    console.log(`  nearestKm: ${Object.fromEntries(Object.entries(r.nearestKm).map(([k,v])=>[k, isFinite(v)?v.toFixed(3):'∞']))}`);
    console.log(`  scores: ${JSON.stringify(r.scores)} composite: ${r.composite}`);
    results.push({ address: a, display, ...r });
    await sleep(600);
  }

  // summary
  const zeros = results.filter((r) => r.scores && Object.values(r.scores).every((s) => s === 0));
  console.log(`\nSummary: ${zeros.length}/${results.length} points had all-zero per-dimension scores`);
  console.log('\nFull results JSON:\n');
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
