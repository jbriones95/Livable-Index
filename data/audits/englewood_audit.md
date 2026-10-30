# Englewood POI audit — `data/pois_englewood.json`

Audit date: 2026-10-30

## Counts

| Category | Before | After | Inside Englewood city limits (after) | Unnamed (after) |
|---|---:|---:|---:|---:|
| coffee | 7 | 7 | 7 | 0 |
| grocery | 13 | 13 | 12 | 1 |
| park | 41 | 39 | 26 | 8 |
| healthcare | 32 | 28 | 20 | 0 |
| busStop | 198 | 195 | 122 | 56 |
| restaurant | 59 | 59 | 33 | 0 |
| trail | 120 | 118 | 52 | 0 |
| schools | 42 | 25 | 9 | 3 |
| **Total** | **512** | **484** | **279** | **68** |

"Inside city limits" uses the Census TIGER 2020 Englewood place boundary (GEOID 0824785), not the square
audit box. The dataset is a buffered extract, so many points are in Denver/Centennial/Littleton by design.

## Checks performed

- Coordinate validity: all points are numeric and within the audit box lat 39.61–39.68, lon -105.03 to -104.95.
  Bounding box after cleanup: lat 39.6172–39.6740, lon -105.0247 to -104.9590.
- Exact duplicates: none remained (the build pipeline already deduped on `lat/lon` at 4 decimals).
- Near duplicates: same-name points within 10–25 m reviewed per category; 120 m for unnamed school footprints.
- Category errors: gym/office in healthcare, hospital campus duplicates, sidewalk/skybridge in trail,
  duplicate park/plaza nodes, duplicate RTD platform nodes.
- Name/note quality: names present for every coffee, grocery, healthcare and restaurant point; notes are
  mostly `"<name>, <city>"` strings inherited from the source extract.
- Coverage: counted POIs inside the city boundary and inside the new 8 zones (see `data/englewood/neighborhoods.json`).

## Changes made (28 points removed, no points added or moved)

### healthcare — 32 → 28
- Removed **Chuze Fitness** (gym, not a healthcare provider).
- Removed **Office Bldg** (generic office building, no provider name).
- Removed duplicate **AdventHealth Porter Hospital** campus point (kept one of two, 120 m apart).
- Removed duplicate **Swedish Medical Center** campus point (kept one of two, 65 m apart).
- Kept pharmacies (Walgreens, CVS, Costco, King Soopers, Walmart), dental/vision/surgical practices,
  Porter ICU and Craig Hospital — all are valid healthcare access points.

### schools — 42 → 25
- Removed **"Englwood High School"** (typo duplicate of Englewood High School, 45 m away).
- Removed 16 unnamed OSM school-building footprints within 120 m of a named school on the same campus
  (5 at Saint Mary's Academy, 3 at Saint Louis Catholic, 2 at Maddox, plus Cherrelyn, Bishop,
  Colorado's Finest, Saint Anne's, Englewood HS and one DU building).
- Kept 3 unnamed school points that are >120 m from any named school (distinct sites), the 11 named
  University of Denver buildings, and all K-12/private schools.

### park — 41 → 39
- Removed one of two identical **"South Elati Street & Englewood Parkway"** points (19 m apart).
- Removed one of two identical **"Englewood Parkway & South Acoma Street"** points (25 m apart).
- Kept unnamed green spaces (they are distinct parks/greenbelts, not duplicates), dog parks, sports
  fields and Pirates Cove Water Park.

### trail — 120 → 118
- Removed **"Sky Bridge"** (hospital pedestrian skybridge, not a trail).
- Removed **"South University Boulevard Sidwalk for Newman Center"** (sidewalk, and misspelled).
- Kept all polyline vertices for Big Dry Creek, Mary Carter Greenway, Little Dry Creek, Harvard Gulch,
  High Line Canal, Bear Creek, Platte River and other trails; the dense near-duplicates in this category
  are consecutive vertices of the same path, not duplicate records.

### busStop — 198 → 195
- Removed 3 duplicate **"RTD D Line"** platform nodes that were 4.7–8.0 m from an identical node.
- Kept same-name stops 15–30 m apart (opposite-direction stops and Englewood Station gates A–H).

### coffee, grocery, restaurant — unchanged
- All 7 coffee shops are inside the city; 5 are Starbucks, so the category is thin and chain-heavy.
- Grocery keeps convenience/gas-mart entries (7-Eleven, Corner Store, Conoco, Shell Food Mart, Stinker)
  to match the permissive grocery definition used in `data/denver/pois_denver.json`, where convenience
  markets are also included. These are flagged below rather than removed.
- Restaurants are all named and plausible; no duplicates or coordinate problems found.

## Remaining concerns

1. **Buffered extract, not a city extract.** 205 of 484 points are outside Englewood city limits but inside
   the audit/app bounding box (Denver, Centennial, Littleton, Sheridan). This is consistent with the
   existing build pipeline (`tools/restructure_pois.mjs` uses a square box), but it means zone-level
   counts for edge zones are partly fed by neighbouring cities.
2. **One point outside the app's own bounds.** Starbucks at 5050 S Federal Blvd (39.62596, -105.02470) is
   outside `tools/restructure_pois.mjs` west bound (-105.019) but inside the audit box. It was kept because
   it is a real, nearby coffee shop; the app does not clip points, so it still contributes to scores.
3. **Schools are noisy.** 11 of 25 remaining school points are individual University of Denver buildings
   (Seeley G. Mudd, Knudson Hall, etc.) outside city limits. They are valid "school" features but
   over-represent one campus. Two Maddox ECE entries describe the same campus under different names.
4. **Grocery quality.** 6 of 13 entries are convenience stores or gas stations. If grocery is meant to mean
   full-service supermarkets, only Sprouts, Safeway, King Soopers (×2), Walmart and Target qualify.
5. **Trail vs. street names.** `East Stanford Avenue`, `East Amherst Avenue` and `South Emerson Street`
   are street-named OSM paths kept as trails; they may be bike/pedestrian routes rather than off-street trails.
6. **Thin coverage in the west/south.** Evans-Southlawn has no coffee, grocery, healthcare, restaurant,
   school or bus stop; Centennial Acres has no grocery, healthcare, restaurant or school. This reflects the
   industrial/river-corridor land use but is worth knowing before weighting those categories.
7. **Unnamed transit/park data.** 56 bus stops and 8 parks have no name; they are still valid locations but
   cannot be labelled in the UI without enrichment.

## Main agent follow-up (2026-10-30)

- Added `bundledPois: true` for Englewood: the audited local file is now authoritative, no longer merged
  with live Overpass, and points are filtered to the city boundary at runtime.
- Widened the app's Englewood bounds to north 39.679 / south 39.616 / west -105.036 to cover the full city.
- Wired the 8 Englewood neighborhood zones into the neighborhood picker and the city-scale overlay.
