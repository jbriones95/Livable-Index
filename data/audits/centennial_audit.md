# Centennial, CO — POI dataset audit

**File:** `data/pois_centennial.json`
**Audit date:** 2026-10-30
**Reference boundary:** U.S. Census Bureau TIGERweb, 2020 Incorporated Places, Centennial city (GEOID `0812815`), WGS84. Area 77.28 km², bbox lon −104.9884…−104.7262, lat 39.5659…39.6384.

## Counts

| Category | Before | After | Removed |
|---|---:|---:|---:|
| coffee | 7 | 7 | 0 |
| grocery | 68 | 50 | 18 |
| park | 227 | 136 | 91 |
| healthcare | 126 | 92 | 34 |
| busStop | 399 | 190 | 209 |
| restaurant | 331 | 218 | 113 |
| trail | 526 | 317 | 209 |
| schools | 193 | 118 | 75 |
| **Total** | **1,877** | **1,128** | **749** |

Removal breakdown: 721 points more than 500 m outside the city boundary, 27 misclassified cross-category duplicates (23 park, 4 trail), 1 near-duplicate trail vertex.

## What was checked

- JSON structure and per-category counts; every record has numeric `lat`/`lon`.
- Coordinate validity against the official city polygon (not just the loose bbox), including point-to-boundary distance.
- Exact duplicates (6 decimal places) and same-name near-duplicates (< 5 m) within each category.
- Cross-category coordinate collisions (same point present in two categories).
- Name/note completeness and obvious category errors.
- Coverage against the Denver benchmark (`data/denver/pois_denver.json`).

## Changes made

1. **Out-of-bounds removal (> 500 m outside the city polygon).**
   The file had been built from a bbox that includes Littleton, Englewood, Cherry Hills Village, Greenwood Village and Aurora. 721 records were clearly outside Centennial (up to 4.0 km away) and were removed. Examples: Cherry Creek High School / Campus Middle School (Cherry Hills Village), AdventHealth Littleton Hospital, South Broadway stops in Littleton, Cherry Creek Trail vertices in Aurora/Greenwood Village.
   Points **within 500 m** of the boundary were kept (446 records) to preserve street-centreline geocodes and genuine cross-border amenities; deleting them would strand edge neighbourhoods.
2. **Park misclassifications (23 removed).**
   - Trail/path vertices that were duplicated in `trail`: `deKoevend Park Trail` (13), `Sunburst Park Path` (2), `Foxhill Park Path` (2), `Parker Road Trail`, `Clarkson Park Path`, `Piney Creek Trailhead`, `Arapahoe Road Trailhead at Cherry Creek`, two walkways.
   - Intersections / park-and-ride points duplicated in `busStop`: `S DTC Blvd & Park Terrace Ave` (2), `South Broadway & Southpark Drive` (2), `South Broadway & West Sterne Parkway` (2), `Smoky Hill Road & Picadilly Street - Park n' Ride`, `S University Blvd @ deKoevend Park`, `Parker & Orchard`.
3. **Trail misclassifications (4 removed).**
   `de Koevend Park`, `Wagon Trail Park`, `Trails Skatepark` (all parks) and `Trails West Elementary School` (school) were duplicated from those categories.
4. **Near-duplicate removal (1).**
   Two `Cherry Creek Trail` vertices 1.1 m apart collapsed to one.
5. **Normalisation.** Trimmed leading/trailing whitespace in `name`/`note`; dropped empty `name` keys. No coordinates were altered.

All 1,128 remaining records are valid, inside or within 500 m of the city boundary, and no gross cross-category duplicate remains (the only exact cross-category match left is `Smoky Hill Road & Saddle Rock Trail`, which is legitimately both a transit stop and a trail access point).

## Category notes and remaining concerns

- **coffee (7) — severe coverage gap.** Five are Starbucks; only two independents. Denver has 302 coffee POIs. This will under-score Centennial coffee access. Recommend a top-up from Overture Places or OSM (`amenity=cafe`) clipped to the boundary.
- **schools (118, 53 unnamed).** Many records are individual campus buildings/portables, not distinct schools; named + unnamed pairs 10–100 m apart remain (e.g. Homestead, Lois Lenski, Campus Middle). There are roughly 30–35 actual schools in the city. Consider collapsing to one point per campus and naming the unnamed ones.
- **park (136, 62 unnamed).** Unnamed records are mostly OSM park polygons/vertices. Several are linear open-space fragments rather than parks. Acceptable, but unnamed points add little analytic value.
- **healthcare (92).** Much broader than Denver's facility-only list (96): includes dentists, orthodontists, pharmacies, IV/wellness bars and medical office buildings (`Arapahoe Medical Plaza I–III`, `Centennial Medical Plaza`, `Cornerstar Healthcare Plaza`). Valid as "healthcare access", but not comparable one-to-one with Denver. No gyms were found.
- **grocery (50).** Includes 7-Eleven, Circle K, Shell, Sinclair, Maverik, Murphy USA, etc. This matches Denver's broad food-retail definition (Denver also includes convenience/gas), so it was **not** stripped. Full-service supermarkets are ~14; if the metric is meant to be supermarkets only, filter to King Soopers/Safeway/Sprouts/Whole Foods/Natural Grocers/Trader Joe's/Walmart/international markets.
- **busStop (190, 39 unnamed).** Contains 85 RTD light-rail line labels (`RTD E & R Lines`, `RTD H Line`, `RTD R Line`, `RTD E Line`, `RTD H & R Lines`, `RTD Light Rail`) that are track/line waypoints, not bus stops. They were kept because they proxy rail access, but the category is mislabelled; consider a separate `transit` category or renaming them to station names.
- **trail (317).** These are ~10 m-spaced vertices along ~20 named trails, not trailheads. The app maps `trailheads`/`nature` to `trail`, so this is intentional, but "trail" here means proximity to a trail line, not a trailhead.
- **Edge ring retained.** 446 points sit 0–500 m outside the boundary. If the product should be strictly city-only, re-run with a 0–100 m tolerance; expect score changes in edge zones.
- **No `source` field.** Denver records carry `source` (overture, denver_public_schools, …); Centennial records do not, which makes provenance/refresh harder.

## Cross-repo issue for the main agent (src, not modified)

`src/livabilityData.js` → `bundledPointsToTurf()` maps `note: obj.address || null`. The Centennial file uses `note`, not `address`, so **all addresses/notes are silently dropped** when the file is loaded. It should be `note: obj.note || obj.address || null`.

Also note that Centennial is not a `bundledData` city, so at runtime it still runs the live Overpass query and merges this file as *supplemental* points — duplicate facilities between Overpass and this file are possible. Making Centennial bundled (like Denver) would avoid that.

## Method / reproducibility

- Boundary: `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/25/query?where=GEOID='0812815'&outSR=4326&f=geojson`
- Distance/point-in-polygon: `@turf/turf` 7.3.5 (`booleanPointInPolygon`, `pointToLineDistance`).
- Out-of-bounds threshold: > 500 m outside the boundary (about a 6-minute walk). This is a judgment call, documented above.

## Main agent follow-up (2026-10-30)

- Fixed `bundledPointsToTurf()` so `note`/`address` text is preserved.
- Added `bundledPois: true` for Centennial: the audited local file is now the authoritative POI source, no longer merged with live Overpass, and points are filtered to the city boundary at runtime.
- Wired the 12 Centennial neighborhood zones into the neighborhood picker and the city-scale overlay.
