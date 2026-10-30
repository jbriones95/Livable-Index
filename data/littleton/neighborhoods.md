# Littleton neighborhood boundaries

**File:** `data/littleton/neighborhoods.json`
**Format:** GeoJSON `FeatureCollection`, WGS84 (EPSG:4326), `[lon, lat]` coordinates
**Built:** 2026-10-30

## Source

City of Littleton open data, ArcGIS Online:

`https://services6.arcgis.com/lJUBf9F1fZJRB4zT/arcgis/rest/services/Neighborhood_Boundary/FeatureServer/70/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`

The service returned **35 features**. The city limits layer
(`City_of_Littleton_Limits/FeatureServer/22`, also WGS84) was used only for coverage validation.

## Methodology

1. Fetched the official neighborhood polygons as GeoJSON in WGS84.
2. Dropped one Southpark feature with a null geometry and two `Outside of City` slivers (0.013 km² combined).
3. Dissolved same-name pieces:
   - **Southpark** — 6 features, including `Peninsula (Southpark 11 A,B,C)`, merged into one MultiPolygon.
   - **Southbridge** — 2 features merged into one MultiPolygon.
4. Normalized names (`Wolhurst landing` → `Wolhurst Landing`) and generated URL-safe slugs.
5. Repaired **Ketring Park**, whose source rings touch at a point (invalid OGC MultiPolygon), with a 0.01 mm buffer. Area change is negligible (<2 m²).
6. Wrote minimal properties: `{ id, name, notes }`. No source attributes are exposed.
7. Validated with Node + `@turf/turf` (see below).

## Zones (24 shown; Sterne Park hidden)

| id | name | area (km²) |
|---|---|---:|
| aberdeen-village | Aberdeen Village | 0.44 |
| bow-mar-south | Bow Mar South | 0.55 |
| centennial | Centennial | 1.82 |
| cobblestone-village | Cobblestone Village | 0.01 |
| coventry | Coventry | 0.41 |
| downtown | Downtown | 0.96 |
| heritage | Heritage | 4.75 |
| kensington-ridge | Kensington Ridge | 0.05 |
| ketring-park | Ketring Park | 2.81 |
| littleton-village | Littleton Village | 0.30 |
| meadowbrook | Meadowbrook | 0.14 |
| ne-littleton | NE Littleton | 2.37 |
| oakbrook | Oakbrook | 0.60 |
| overlook-at-platte-valley | Overlook at Platte Valley | 0.07 |
| riverwalk | Riverwalk | 0.04 |
| santa-fe-park | Santa Fe Park | 0.13 |
| southbridge | Southbridge | 1.61 |
| southpark | Southpark | 2.36 |
| sterne-park | Sterne Park *(hidden in app)* | 2.26 |
| sunset-heights | Sunset Heights | 0.02 |
| the-hamlet-at-columbine | The Hamlet at Columbine | 0.20 |
| the-polo-reserve-pole-ridge-farms | The Polo Reserve - Pole Ridge Farms | 0.43 |
| the-polo-reserve-the-sanctuary | The Polo Reserve - The Sanctuary | 0.08 |
| trailmark | Trailmark | 1.40 |
| wolhurst-landing | Wolhurst Landing | 0.13 |

## Validation results

- 25 source features, all `Polygon` or `MultiPolygon`; **24 are shown** after the Sterne Park `hidden` flag.
- All geometries pass `turf.booleanValid`; all rings are closed; all coordinates are in the Littleton range.
- Sum of feature areas = union area = **23.95 km²** (no meaningful overlaps).
- Largest pairwise overlap is **0.0004 km²** (Aberdeen Village / Ketring Park, ~400 m²); total overlap is under 0.001 km². These are source-data boundary slivers and were left as-is to avoid creating gaps.
- Union clipped to the city limits = **23.90 km²**, or **67.2%** of the city's 35.60 km².
- 0.045 km² of Trailmark falls just outside the city limits polygon (coastline/generalization sliver).

## Coverage caveat

The official layer is a set of **residential neighborhood boundaries**, not a full municipal tessellation. The remaining ~11.7 km² of city area is mostly South Platte Park, golf courses, reservoirs, and open space, plus narrow right-of-way gaps between neighborhoods. POIs that fall in those gaps will not match a neighborhood.

## Trailmark caveat

Trailmark is an official Littleton neighborhood and is inside the city limits, but it lies far southwest of the app's configured Littleton bounds (`north 39.646, south 39.562, east -104.970, west -105.065` in `src/livabilityData.js`). Its extent is about lon -105.111 to -105.093, lat 39.536 to 39.547. If the app uses neighborhood polygons to fit the map, Trailmark will pull the viewport southwest. Either widen the Littleton bounds to roughly `west -105.115, south 39.535`, or filter Trailmark out at load time. `src/` was intentionally not modified.
