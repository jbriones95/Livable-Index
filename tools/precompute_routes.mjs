#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k,v] = a.split('=');
  return [k.replace(/^--/,'') , v ?? 'true'];
}));

const cellSizeKm = parseFloat(args.cellSizeKm || '1.0');
const outFile = path.resolve(__dirname, '..', args.outfile || 'data/grid_precomputed_sample.json');

console.log('Precompute routes — cellSizeKm=', cellSizeKm);

try {
  const mod = await import('../src/livabilityData.js');
  if (!mod.computeGridWithOSM) throw new Error('computeGridWithOSM not exported');
  // Use the module's function to build and score the grid. This will use routing as configured.
  const grid = await mod.computeGridWithOSM(cellSizeKm);
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, JSON.stringify(grid, null, 2), 'utf8');
  console.log('Wrote precomputed grid to', outFile);
} catch (err) {
  console.error('Precompute failed:', err);
  process.exit(1);
}
