# Centennial, CO — neighborhood zones

**File:** `data/centennial/neighborhoods.json` (GeoJSON FeatureCollection, WGS84 / EPSG:4326)
**Features:** 12 polygons/multipolygons
**Coverage:** 77.28 km² — identical to the City of Centennial boundary (0.0000 km² gap, 0.0000 km² spill)

## Why these are analytic zones, not official neighborhoods

Centennial does not publish a small set of official statistical neighborhood polygons comparable to Denver's 78 statistical neighborhoods. The city's open-data portal publishes an **HOAs, Civic Associations and Neighborhoods** layer (199 HOA polygons, ~49.5 km² of the 77.3 km² city), which is HOA-level and does not tile the city. It was used only to choose recognizable zone names, not as the zone geometry.

The zones here are therefore a **12-zone analytic partition** built from major arterials and clipped to the official city limit. They are intended for consistent scoring/aggregation, not as legal or HOA boundaries.

## Sources

- **City boundary:** U.S. Census Bureau TIGERweb, 2020 Incorporated Places, Centennial city, GEOID `0812815` (WGS84), 77.28 km². Retrieved from the TIGERweb `Places_CouSub_ConCity_SubMCD` MapServer (layer 25, Census 2020).
- **Name/context:** City of Centennial Open Data, `HOAs_Civic_Associations_and_Neighborhoods` FeatureServer (199 HOA polygons; fields `HOA_Name`, `Nghbrhd`, `neigh_ID`), used to confirm which neighborhood names occur in each area.
- **Arterials used as cuts:** County Line Rd (39.564), Dry Creek Rd (39.5805), Arapahoe Rd (39.5945), Orchard Rd (39.6105), north city limit (39.640); S Broadway (−104.990), S University Blvd (−104.9405), S Colorado Blvd / Holly area (−104.915 to −104.886), I-25 / S Peoria St (−104.848), Parker Rd / east limit (−104.726).

## Method

1. Build a set of non-overlapping rectangles that exactly tile the city bounding box, with edges snapped to the arterials above.
2. Intersect each rectangle with the Census city polygon using `turf.intersect`, preserving the city's interior holes (Cherry Creek State Park and unincorporated enclaves).
3. Round coordinates to 6 decimals (~0.1 m) and close every ring.
4. Validate with `@turf/turf` 7.3.5.

Because every zone is the intersection of a gap-free tiling with the *same* city polygon, the zones tile the city exactly: no overlaps and no gaps beyond floating-point noise.

## Zones

| id | name | area (km²) | notes |
|---|---|---:|---|
| `university` | University | 5.19 | Southwest corner along S University Blvd and County Line Rd; University Place, Village of Four Lakes. |
| `southglenn` | Southglenn | 6.04 | Streets at Southglenn / Southglenn Commons, Dry Creek Rd to Arapahoe Rd. |
| `cherry-knolls` | Cherry Knolls | 6.68 | Northwest edge along Orchard Rd and S Broadway; Orchard Drive, Cherry Hills View, Greenwood Manor. |
| `foxridge` | Foxridge | 3.51 | South-central west of Willow Creek; Foxridge and Ridges at Foxridge. |
| `willow-creek` | Willow Creek | 4.01 | Willow Creek greenbelt and Willow West, south of Dry Creek Rd. |
| `homestead` | Homestead | 7.27 | Homestead Pkwy between Dry Creek Rd and Arapahoe Rd; Mill Creek, Hunters Hill. |
| `walnut-hills` | Walnut Hills | 5.76 | Walnut Hills and Holly Creek, north of Arapahoe Rd around S Holly St. |
| `dry-creek` | Dry Creek | 4.76 | Dry Creek corridor east of I-25, wrapping the south side of Cherry Creek State Park. |
| `arapahoe` | Arapahoe | 1.48 | Arapahoe Rd / DTC edge between I-25 and S Peoria St. |
| `smoky-hill` | Smoky Hill | 13.25 | Southeast Centennial along Smoky Hill Rd; Arapahoe Meadows, Chapparal, Antelope. |
| `orchard` | Orchard | 9.31 | Orchard Rd / Parker Rd area; Orchard Valley, Piney Creek Ranches, Algonquin Acres. |
| `cherry-creek` | Cherry Creek | 10.04 | Northern lobe east of Cherry Creek State Park; Fox Hill / Piney Creek highlands. |

## Validation results

- 12/12 features are `Polygon` or `MultiPolygon`; all rings closed (first = last vertex).
- All coordinates are `[lon, lat]` in WGS84, inside lon −105.0…−104.7, lat 39.55…39.65.
- No self-intersections (`turf.kinks`), all geometries pass `turf.booleanValid`.
- Pairwise intersection area: 0 (no gross overlaps).
- Union area 77.281 km² = city area; `city − union` = 0.0000 km²; `union − city` = 0.0000 km².
- Every feature has string properties `{ id, name, notes }`; `id` values are unique lowercase slugs.

## Caveats

- Zone edges are straight lines on arterial alignments, not parcel/HOA boundaries. Small slivers of a real neighborhood can fall into an adjacent zone.
- The city has large interior holes (Cherry Creek State Park, unincorporated Arapahoe County enclaves). Those holes are preserved in the zone geometries, so a zone may be a `MultiPolygon`.
- `cherry-creek` is named for its proximity to Cherry Creek State Park / the Cherry Creek corridor; it is not the Denver neighborhood of the same name.
- If official city neighborhood or council-district polygons become available, replace these zones and keep the same `id`/`name`/`notes` property shape.
