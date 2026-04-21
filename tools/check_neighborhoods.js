#!/usr/bin/env node
// Small diagnostic script: fetch the Littleton Neighborhood_Boundary GeoJSON
// and report features with missing names or invalid geometry.

const fetch = global.fetch || require('node-fetch');

const URL = 'https://services6.arcgis.com/lJUBf9F1fZJRB4zT/arcgis/rest/services/Neighborhood_Boundary/FeatureServer/70/query?where=1%3D1&outFields=*&outSR=4326&f=geojson';

async function main() {
  console.log('Fetching neighborhood GeoJSON...');
  const res = await fetch(URL);
  if (!res.ok) {
    console.error('Failed to fetch:', res.status, res.statusText);
    process.exit(2);
  }
  const data = await res.json();
  if (!data || data.type !== 'FeatureCollection') {
    console.error('Unexpected payload');
    process.exit(2);
  }
  const feats = data.features || [];
  console.log('Features:', feats.length);

  const badName = [];
  const badGeom = [];
  const outsideCity = [];

  for (const f of feats) {
    const p = f.properties || {};
    const name = p.Neighborho || p.name || null;
    if (!name || String(name).trim().length === 0) badName.push(f.id || '<no-id>');
    if (p.Neighborho === 'Outside of City') outsideCity.push(f.id || '<no-id>');

    const g = f.geometry;
    if (!g) {
      badGeom.push(f.id || '<no-id>');
      continue;
    }
    if (!g.type || !g.coordinates) {
      badGeom.push(f.id || '<no-id>');
      continue;
    }
    // basic polygon checks
    if (g.type === 'Polygon') {
      if (!Array.isArray(g.coordinates) || g.coordinates.length === 0) badGeom.push(f.id || '<no-id>');
    } else if (g.type === 'MultiPolygon') {
      if (!Array.isArray(g.coordinates) || g.coordinates.length === 0) badGeom.push(f.id || '<no-id>');
    } else {
      badGeom.push(f.id || '<no-id>');
    }
  }

  console.log('Features with missing name:', badName.length, badName.slice(0,10));
  console.log('Features with invalid geometry:', badGeom.length, badGeom.slice(0,10));
  console.log('Features explicitly marked Outside of City:', outsideCity.length, outsideCity.slice(0,10));

  // show few sample names
  console.log('Sample neighborhood names:');
  for (let i = 0; i < Math.min(12, feats.length); i++) {
    const p = feats[i].properties || {};
    console.log('-', feats[i].id, p.Neighborho || p.name);
  }

  // exit success
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(3); });
