# Englewood neighborhood zones

File: `data/englewood/neighborhoods.json`
Format: GeoJSON `FeatureCollection`, WGS84 (EPSG:4326), `[lon, lat]` coordinates, closed rings.
8 features, all `Polygon`.

## Source

The zones are built from the **City of Englewood Neighborhood Map**, adopted by City Council in
June 2022. The city's official map defines 40 neighborhoods (two of them currently unnamed). The
authoritative polygons are published in the city's ArcGIS feature service:

- `https://services6.arcgis.com/2gwTlp6STLlfLYIT/arcgis/rest/services/Neighborhoods_Iteration_II/FeatureServer/0`
  (layer "Neighborhoods", 40 polygons, field `Neighborho`)

The city outline used for clipping/validation is the **2020 Census TIGER incorporated place** for
Englewood, CO (GEOID `0824785`, state `08`, place `24785`):

- `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/26`

No ready-made 8-zone layer exists, so the 40 official neighborhoods were grouped into 8 larger
planning/reporting zones. The grouping follows the major arterials (Santa Fe Drive, Broadway,
Downing Street, University Boulevard, Hampden Avenue, Belleview Avenue) and keeps each zone
contiguous.

## Methodology

1. Downloaded the 40 official neighborhood polygons in WGS84 from the city feature service.
2. Assigned every official neighborhood to exactly one of 8 groups (40/40 assigned, no duplicates).
3. Dissolved each group with `@turf/turf` `union`.
4. Clipped each dissolved zone to the Census city boundary.
5. Filled the holes left by the official map (parks, the South Platte/Mary Carter greenway corridor,
   and other unassigned land) by assigning each gap polygon to the zone with the longest shared
   boundary, falling back to the nearest zone. This makes the zones cover the whole city.
6. Removed residual cross-zone overlap (the official polygons overlap by ~0.0005 sq mi in a few places)
   by subtracting previously claimed zones.
7. Rounded coordinates to 6 decimals (~0.1 m) and repaired polygon-clipping pinch vertices where needed.
8. Validated with Node + `@turf/turf`: geometry validity, closed rings, coordinate ranges, pairwise
   overlap, and coverage of the city polygon.

Result: zone area sums to **6.644 sq mi**, matching the city polygon. Maximum pairwise overlap is
**0.0002 sq mi (0.003% of the city)**; uncovered city area is **0.0016 sq mi (0.025%)**. Both are
rounding/arterial-boundary slivers, not gross gaps.

## Zones

| id | name | area (sq mi) | official neighborhoods included |
|---|---|---:|---|
| `evans-southlawn` | Evans-Southlawn | 0.715 | Evans/Southlawn Estates, Englewood Industrial North, Vista Heights |
| `bates-logan` | Bates-Logan | 0.694 | Platte River, Cushing Neighborhood, SG Hamlin, Idlewild, Speers Broadway |
| `yale` | Yale | 0.604 | Killies Neighborhood, Strayers, Yale, Kimble Croft Park, Forest Hill, Arapahoe Acres, Hampden Hill |
| `old-englewood` | Old Englewood | 1.323 | Englewood City Center, Logandale, Hamilton, Wollenwebers, Oxford Heights, Coleman, 2 unnamed blocks |
| `south-broadway` | South Broadway | 1.362 | Rose, Westview, Evanston, Romans Park, Wynetka Heights, South Broadway Heights |
| `centennial-acres` | Centennial Acres | 1.203 | Englewood Industrial South, Knollwood View, Centennial Acres, Bellisle, Sunset Acres |
| `belleview` | Belleview | 0.486 | Leeland Heights, Delaware Heights, Harlem, Signal Hill |
| `brookridge` | Brookridge | 0.257 | Brookridge, Bellewood |

Properties per feature: `id` (slug), `name` (human name), `notes` (short description listing the
official neighborhoods that were dissolved into the zone).

## Caveats

- These are **reporting zones**, not the city's official 40-neighborhood map. The city map should be
  used where neighborhood-level identity matters; these zones are intended for the Livable Index
  score aggregation.
- Two official neighborhoods are unnamed in the source (`Unknown`); they were folded into
  Old Englewood and are noted there.
- Zone edges follow official neighborhood edges (and therefore parcel/street lines), not a buffered
  arterial centerline. Small slivers along shared edges are expected.
- The official map leaves some city land (parks, river corridor) outside any neighborhood; those
  areas were assigned to the nearest/most-adjacent zone as described above.
