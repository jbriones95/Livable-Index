# Livable Index

Interactive livability explorer for Littleton, Centennial, Englewood, and Denver, CO, built with React + Vite and Leaflet.

Features
- Choropleth overlay of synthesized livability scores for neighborhoods and grid cells
- Click the map to view a composite score and per-dimension breakdown at that point
- Adjustable dimension weights
- Deployable to GitHub Pages

Cities
- **Littleton / Centennial / Englewood** fetch POIs from Overpass on demand and score the hex grid in the browser.
- **Denver** uses a bundled dataset (78 statistical neighborhoods) built offline by `tools/build_denver_data.py`. The neighborhood polygons ship with precomputed `overlayScores`, and the POI/trail arrays are code-split chunks loaded only when Denver is selected, so no live Overpass queries are needed.

Denver data
- Regenerate with `python tools/build_denver_data.py` (requires `duckdb` with the `spatial` and `httpfs` extensions).
- Outputs to `data/denver/`: `pois_denver.json`, `neighborhoods.json`, `trails.json`, `metadata.json`.
- Sources: Overture Maps Places plus City and County of Denver open data (neighborhoods, business licenses, food retail, liquor, schools, health facilities, parkland, RTD stops, trails, bike facilities, police stations).

Local
- npm install
- npm run dev -> http://localhost:5173/

Deploy (GitHub Pages)
- See DEPLOY.md for exact commands. Pushing to `main` also builds and deploys via `.github/workflows/gh-pages.yml`.
