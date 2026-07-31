#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import * as turf from '@turf/turf';

const DATA_DIR = path.join(process.cwd(), 'data');
const CITIES = {
  littleton: { bounds: { north: 39.646, south: 39.562, east: -104.970, west: -105.065 }, center: [39.6133, -105.0166] },
  centennial: { bounds: { north: 39.640, south: 39.564, east: -104.726, west: -104.990 }, center: [39.5792, -104.8769] },
  englewood: { bounds: { north: 39.674, south: 39.617, east: -104.959, west: -105.019 }, center: [39.6475, -104.9878] },
};

const CATEGORIES = ['coffee','restaurant','grocery','trail','park','busStop','healthcare','schools'];
const WEIGHTS = { coffee: 0.10, restaurant: 0.10, nature: 0.17, healthcare: 0.10, busStop: 0.10, grocery: 0.17, bikeInfra: 0.05, crime: 0.11, schools: 0.10 };

function haversineKm(lon1, lat1, lon2, lat2){
  const R = 6371;
  const toRad = (deg)=>deg*Math.PI/180;
  const dLat = toRad(lat2-lat1);
  const dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function distToScore(dKm){
  if (!isFinite(dKm)) return 0;
  if (dKm <= 0.3) return 100;
  const extraMeters = (dKm - 0.3) * 1000;
  const steps = Math.ceil(extraMeters / 100);
  return Math.max(0, 100 - steps * 10);
}

function computeNature(trail, park){
  const t = typeof trail === 'number' && isFinite(trail) ? trail : 0;
  const p = typeof park === 'number' && isFinite(park) ? park : 0;
  return Math.round(0.8 * t + 0.2 * p);
}

async function loadCityPois(city){
  const p = path.join(DATA_DIR, `pois_${city}.json`);
  const raw = await fs.readFile(p, 'utf8');
  return JSON.parse(raw);
}

async function run(){
  for (const city of Object.keys(CITIES)){
    console.log('\n========== ' + city.toUpperCase() + ' =========');
    const pois = await loadCityPois(city);
    // build feature list: for each category, array of {lat,lon,name}
    const catMap = {};
    for (const cat of Object.keys(pois)){
      catMap[cat] = Array.isArray(pois[cat]) ? pois[cat].map(p=>({lat: p.lat, lon: p.lon, name: p.name||p.note||null})) : [];
    }

    const bounds = CITIES[city].bounds;
    const bbox = [bounds.west, bounds.south, bounds.east, bounds.north];
    const cellSideKm = 0.2;
    const grid = turf.hexGrid(bbox, cellSideKm, { units: 'kilometers' });
    const total = grid.features.length;
    console.log('Grid cells:', total);

    // sample indices: 0, step, 2*step, ... up to 9 samples or fewer
    const samples = Math.min(10, total);
    const step = Math.max(1, Math.floor(total / samples));
    for (let i=0;i<samples;i++){
      const idx = Math.min(i*step, total-1);
      const cell = grid.features[idx];
      const center = turf.centroid(cell);
      const [lon, lat] = center.geometry.coordinates;
      const perCat = {};
      const nearestInfo = {};
      for (const cat of CATEGORIES){
        const list = catMap[cat] || [];
        let minD = Infinity; let nearest = null;
        for (const p of list){
          const d = haversineKm(lon, lat, p.lon, p.lat);
          if (d < minD){ minD = d; nearest = p; }
        }
        const score = distToScore(minD);
        perCat[cat] = score;
        nearestInfo[cat] = { dist_km: isFinite(minD)?Number(minD.toFixed(4)):null, name: nearest?nearest.name:null, coords: nearest? [nearest.lat, nearest.lon]: null };
      }
      const nature = computeNature(perCat['trail'], perCat['park']);
      const scores = { ...perCat, nature };
      const composite = Math.round(Object.entries(WEIGHTS).reduce((sum,[k,w])=> sum + (scores[k]||0)*w, 0));

      console.log(`\nSample ${i+1}/${samples} (grid idx ${idx}) center=${lat.toFixed(6)},${lon.toFixed(6)}`);
      console.log('  composite:', composite);
      for (const k of ['coffee','restaurant','grocery','trail','park','nature','busStop','healthcare','schools']){
        const v = scores[k] ?? 0;
        console.log(`   ${k.padEnd(10)}: ${String(v).padStart(3)}   nearest: ${nearestInfo[k]?.name ?? 'n/a'} (${nearestInfo[k]?.dist_km ?? 'n/a'}km)`);
      }
    }
  }
}

run().catch((err)=>{ console.error('QA failed', err); process.exit(2); });
