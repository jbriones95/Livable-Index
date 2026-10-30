# Littleton, CO — POI dataset audit

**File:** `data/pois_littleton.json`
**Audit date:** 2026-10-30
**Audit bounds:** lat 39.56–39.65, lon -105.07 to -104.97 (the app's Littleton viewport is slightly wider: 39.562–39.646, -105.065 to -104.970)

## Summary

| Category | Before | After | Change |
|---|---:|---:|---|
| coffee | 22 | 16 | -6 duplicates |
| grocery | 6 | 6 | — |
| park | 85 | 83 | -2 out of bounds |
| trail | 41 | 41 | — |
| healthcare | 7 | 7 | — |
| busStop | 94 | 94 | — |
| restaurant | 125 | 109 | -16 duplicates |
| schools | 0 | 10 | +10 from city config |
| **Total** | **380** | **366** | **-14** |

All 366 remaining points have numeric, valid WGS84 coordinates and fall inside the audit bounds. Of these, **275 are inside the City of Littleton limits** and 91 are inside the audit box but in adjacent jurisdictions (see concerns).

## Checks performed

- **Counts / schema:** all eight category keys are arrays of `{ lat, lon, name?, note? }`; no malformed entries.
- **Coordinate validity:** no null, non-numeric, or out-of-range values. Two park points were outside the audit box.
- **Exact duplicates:** one exact-coordinate pair in coffee (Nixon's / Wild Goose), 21 exact-coordinate clusters in restaurant, none elsewhere.
- **Near duplicates:** reviewed all same-category pairs within 50 m.
- **Category errors:** reviewed names against category (see concerns).
- **Name/note quality:** counted missing names and notes.
- **Coverage:** 0.02° grid count of all categories across the audit box.
- **Cross-check:** point-in-polygon against the city's official limits layer (`City_of_Littleton_Limits/FeatureServer/22`).

## Changes made

### Removed duplicate coffee entries (6)

Each pair is the same business at the same address; the richer/first-listed record was kept.

| Removed | Kept | Reason |
|---|---|---|
| Wild Goose Coffee in Denver Seminary | Nixon's Coffee House | identical coordinates, 6399 S Santa Fe Dr |
| DIRT Coffee Bar | Dirt Coffee | same address, 22 m apart |
| Enchanted Grounds Coffeehouse | Enchanted Grounds | same address, 24 m apart |
| Lost Coffee Cafe & Coffee Roastery | Lost Coffee | same address, 31 m apart |
| "6500, South Broadway, Littleton, …" | Atlas Coffee | reverse-geocoded duplicate, 3 m apart |
| Black Rock Coffee | Black Rock Coffee Bar - Broadway | same address, 7961 S Broadway |

### Removed duplicate restaurant entries (16)

| Removed | Kept |
|---|---|
| Mi Cocina Express - Broadway | Mi Cocina |
| Celly's Bar and Grill in the Ice Ranch | Celly’s Bar and Grill |
| Palenque | Palenque Cocina Y Agaveria |
| Gyro’s | Gyros Town Grill |
| Littleton Brewing Co | Littleton Brewing Company |
| Cherry Cricket - Littleton | Cherry Cricket |
| Mama Sol Cafe | Mama Sol |
| Castle Bar | The Castle Bar & Grill |
| Walters | Walter's 303 Pizzeria & Publik House |
| Breck Brew | Breckenridge Brewery |
| 49th Food | The 49th Food & Spirits - Littleton |
| JP Nori Sushi | JP Nori Sushi & Asian Cuisine |
| Toast Fine | Toast Fine Food & Coffee |
| Haveli | Haveli Indian Cuisine |
| Colore | Colore Italian |
| Mannings | Manning's Steaks and Spirits |

### Removed out-of-bounds parks (2)

- **Hogback Hill Park** — 39.5398, -105.1020
- **TrailMark Park** — 39.5378, -105.0976

Both are at ~39.538, outside the audit box's 39.56 southern edge and outside the app's configured Littleton bounds. They are physically in the Trailmark area, which the city's neighborhood layer treats as part of Littleton (see `data/littleton/neighborhoods.md`), so they can be re-added if the app's bounds are widened.

### Added schools (10)

Coordinates copied exactly from `src/livabilityData.js` → `CITIES.littleton.schools`. Names were matched to OSM school features within ~200 m via Overpass; one point had no named OSM school nearby and keeps the fallback name.

| Lat | Lon | Name |
|---|---|---|
| 39.5970231 | -104.9935549 | Euclid Middle School |
| 39.6168560 | -105.0381960 | Goddard Middle School |
| 39.5727920 | -104.9781590 | John Wesley Powell Middle School |
| 39.5843743 | -105.0054175 | Heritage High School |
| 39.6132670 | -104.9857200 | Littleton High School |
| 39.6164866 | -105.0291850 | Centennial Elementary School |
| 39.6190020 | -104.9827180 | Field Elementary School |
| 39.6007891 | -105.0068349 | Little Raven Elementary School |
| 39.5854940 | -104.9988034 | School *(no OSM name; city-config fallback)* |
| 39.6025635 | -105.0429345 | Wilder Elementary School |

All use note `Littleton school (city config)`.

## Remaining concerns

1. **Dataset is regional, not city-limited.** 91 of 366 POIs are inside the audit box but outside Littleton city limits: 48 bus stops, 33 parks, 2 coffee, 2 grocery, 2 schools, 1 healthcare, 1 restaurant, 2 trail. Many are Littleton mailing addresses in unincorporated Jefferson County, Bow Mar, Columbine Valley, Englewood, Sheridan, or Centennial. Neighborhood scores will include these unless POIs are filtered by the city boundary.
2. **Restaurant shared geocodes are not duplicates.** 21 exact-coordinate clusters remain because they are distinct businesses sharing a food-hall/mall geocode: 5950 S Platte Canyon Rd, 5350 S Santa Fe Dr, 1500 W Littleton Blvd, 7301 S Santa Fe Dr, 3625 W Bowles Ave, 2630 W Belleview Ave, 2700 W Bowles Ave, and 1360 W Littleton Blvd. Some individual listings may be closed or stale; that needs external verification, not coordinate dedupe.
3. **Grocery is the weakest category.** All 6 entries have no `name` (address-only notes), and only 4 are inside the city. There are no grocery points in the southwest or southeast.
4. **Park name/note quality.** 28 of 83 parks have no name and 22 have no note. Several are sub-POIs of the same park (East Community Center campus / sports field / playground; Promise Park / Promise Park North; Ridgewood Park Upper / Lower), which can triple-count one park. South Platte Park appears twice as separate access points. Cimarron Trail Park, Columbine Trail Park, and Lee Gulch Overlook & Trailhead are also in `trail`, so they are double-counted across categories.
5. **Trail is a sampled polyline, not POIs.** 38 of 41 trail entries are unnamed GPS vertices whose note is a DMS coordinate; only 3 are named. Consider replacing this category with trail line geometry or at least naming the segments.
6. **Healthcare has category and naming issues.** "Chuze Fitness" is a gym, not healthcare. Several entries are medical office buildings named by street address (e.g. "20 West Dry Creek Circle"). Only AdventHealth Littleton Hospital is a hospital. The category is sparse (7).
7. **Coffee has residual quality issues.** "claire's" is a jewelry store at Southwest Plaza (category error); "Harold and Virginia Simpson Leadership Center" is a Denver Seminary building, not a café; two names are raw reverse geocodes ("6115, South Santa Fe Drive…", "South Broadway"). Two entries (5100 and 4298 S Broadway) are in Englewood.
8. **Bus stops are noisy and skewed.** 11 of 94 have no name/note, 48 are outside city limits, and coverage is concentrated on Broadway and W Oxford Ave. Same-name pairs on opposite sides of the street are separate stops, not duplicates.
9. **Coverage gaps.** The core along Broadway / Littleton Blvd / W Main St is dense (70 POIs in one 0.02° cell), while the southwest (South Platte Park / Trailmark), northwest (Bow Mar), and southeast (County Line / University) edges have 0–2 POIs per cell.
10. **Category-key mismatch with Denver.** Denver uses `parks` and `busStops`; Littleton keeps `park` and `busStop` as instructed. The app must map both naming schemes.

## Main agent follow-up (2026-10-30)

- Widened the app's Littleton bounds to `west -105.115, south 39.532` so the Trailmark area is included.
- Restored **Hogback Hill Park** and **TrailMark Park**; both were verified inside the Trailmark neighborhood polygon.
- Removed four non-coffee or out-of-city coffee entries: `claire's`, `Harold and Virginia Simpson Leadership Center`, `5100 S Broadway`, and `4298 S Broadway`.
- Removed `Chuze Fitness` from healthcare.
- Replaced two raw reverse-geocode coffee names with their address notes.
- Final counts: coffee 12, grocery 6, park 85, trail 41, healthcare 6, busStop 94, restaurant 109, schools 10 (**363 total**).
