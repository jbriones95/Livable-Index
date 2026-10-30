#!/usr/bin/env python3
"""Build the bundled Denver livability dataset.

Data sources
------------
* Overture Maps Places (release 2026-10-21.0) - comprehensive open business POI
  layer.  We keep only open, named places inside Denver's statistical
  neighborhoods and classify them into the app's amenity categories.
* City and County of Denver open data (ArcGIS) - authoritative enrichment and
  validation layers:
    - Statistical Neighborhood boundaries (78 polygons)
    - Active Business Licenses (license counts per neighborhood)
    - Food Retail Locations (grocery / convenience, SNAP / WIC)
    - Liquor Licenses (restaurant-type licenses)
    - Public / Non-Public Schools
    - Health Facilities / Hospitals / FQHCs
    - Parkland polygons (park access points)
    - RTD bus stops and rail stations
    - DPR trails
    - Bicycle facilities
    - Police stations

Outputs (all under data/denver/)
--------------------------------
* pois_denver.json       category arrays consumed by src/livabilityData.js
* trails.json            simplified trail polylines
* neighborhoods.json     the 78 statistical neighborhoods with precomputed
                         livability scores and business metrics
* grid.json              250 m detail cells for street-level zoom views
* metadata.json          provenance, release, and row counts

Run with:
    python tools/build_denver_data.py

Requires: duckdb (with the spatial + httpfs extensions) and Python 3.9+.
"""

from __future__ import annotations

import datetime as _dt
import json
import math
import pathlib
import sys
import tempfile
import time
import urllib.parse
import urllib.request

import duckdb

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "denver"
OUT_DIR.mkdir(parents=True, exist_ok=True)

OVERTURE_RELEASE = "2026-10-21.0"
OVERTURE_SRC = (
    "s3://overturemaps-us-west-2/release/"
    f"{OVERTURE_RELEASE}/theme=places/type=place/*.parquet"
)
OVERTURE_BBOX = (
    "bbox.xmin > -105.12 AND bbox.xmax < -104.55 "
    "AND bbox.ymin > 39.60 AND bbox.ymax < 39.95"
)

ARCGIS = "https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/arcgis/rest/services"
NBHD_URL = (
    f"{ARCGIS}/ODC_ADMN_NEIGHBORHOOD_A/FeatureServer/13/query"
    "?where=1%3D1&outFields=NBHD_ID,NBHD_NAME,TYPOLOGY&outSR=4326&f=geojson"
)
LIQUOR_URL = (
    f"{ARCGIS}/ODC_BUSN_LIQUORLICENSES_P/FeatureServer/27/query"
    "?where=LIC_STATUS%3D%27LICENSE%20ISSUED%20-%20ACTIVE%27"
    "&outFields=BUS_PROF_NAME,FULL_ADDRESS,LICENSES,LIC_STATUS,NEIGHBORHOOD"
    "&outSR=4326&f=geojson"
)
FOOD_URL = (
    f"{ARCGIS}/ODC_HLTH_FOODRETAILLOCATIONS_P/FeatureServer/491/query"
    "?where=STATUS%3D%27Active%27&outFields=NAME,ADDRESS_FULL,TYPE,SNAP,DUFB,WIC,STATUS"
    "&outSR=4326&f=geojson"
)
PUBLIC_SCHOOLS_URL = (
    f"{ARCGIS}/ODC_EDU_PUBLICSCHOOLS_P/FeatureServer/258/query"
    "?where=1%3D1&outFields=SCHOOL_NAME,SCHOOL_TYPE,SCHOOL_LEVEL,ADDRESS_LINE1"
    "&outSR=4326&f=geojson"
)
PRIVATE_SCHOOLS_URL = (
    f"{ARCGIS}/ODC_EDU_NONPUBLICSCHOOLS_P/FeatureServer/256/query"
    "?where=1%3D1&outFields=SCHOOL_NAME,SCHOOL_TYPE,SCHOOL_LEVEL,ADDRESS_LINE1"
    "&outSR=4326&f=geojson"
)
HEALTH_URL = (
    f"{ARCGIS}/ODC_SVCS_HEALTHFACILITIES_P/FeatureServer/494/query"
    "?where=1%3D1&outFields=Facility_Name,Facility_Type,Facility_Type_Detail,Address_Full,OPERATING_STATUS"
    "&outSR=4326&f=geojson"
)
HOSPITAL_URL = (
    f"{ARCGIS}/ODC_SVCS_HOSPITAL_P/FeatureServer/495/query"
    "?where=1%3D1&outFields=Facility_Name,Facility_Type,Address_Full,OPERATING_STATUS"
    "&outSR=4326&f=geojson"
)
FQHC_URL = (
    f"{ARCGIS}/ODC_SVCS_FEDQUALHEALTHCENTERS_P/FeatureServer/493/query"
    "?where=1%3D1&outFields=Facility_Name,Facility_Type,Address_Full,OPERATING_STATUS"
    "&outSR=4326&f=geojson"
)
PARKLAND_URL = (
    f"{ARCGIS}/ODC_PARK_PARKLAND_A/FeatureServer/87/query"
    "?where=1%3D1&outFields=FORMAL_NAME,LOCATION,PARK_TYPE,PARK_CLASS,GIS_ACRES"
    "&outSR=4326&f=geojson"
)
BUS_URL = (
    f"{ARCGIS}/ODC_TRANS_RTDBUSTOPS_P/FeatureServer/281/query"
    "?where=1%3D1&outFields=STOP_NAME,ROUTES&outSR=4326&f=geojson"
)
RAIL_URL = (
    f"{ARCGIS}/ODC_TRANS_RAILTRANSITSTATIONS_P/FeatureServer/212/query"
    "?where=1%3D1&outFields=STATION_NAME,LINE_NAME,STATUS&outSR=4326&f=geojson"
)
TRAIL_URL = (
    f"{ARCGIS}/DPR_Trails_General_2020/FeatureServer/0/query"
    "?where=1%3D1&outFields=TRAIL_NAME,REACH,TYPE_CLASS,LENGTH_MIL,PROPOSED,JURISDICTI"
    "&outSR=4326&f=geojson"
)
BIKE_URL = (
    f"{ARCGIS}/Denver_Bicycle_Facilities_ODC/FeatureServer/450/query"
    "?where=STATUS%3D%27Completed%27"
    "&outFields=STREET_NAME,FACILITY_TYPE_EXISTING,STATUS,VERTICAL_ELEMENT_TYPE"
    "&outSR=4326&f=geojson"
)
POLICE_URL = (
    f"{ARCGIS}/ODC_POLICE_STATION_P/FeatureServer/109/query"
    "?where=1%3D1&outFields=STATION,STATION_NAME,STATION_TYPE,DISTRICT_NUMBER"
    "&outSR=4326&f=geojson"
)
BUSINESS_LICENSE_URL = (
    f"{ARCGIS}/ODC_active_business_licenses/FeatureServer/42/query"
)

# Scoring constants mirrored from src/livabilityData.js
MAX_DIST_KM = {
    "coffee": 0.8,
    "restaurant": 0.8,
    "grocery": 1.0,
    "trail": 2.0,
    "park": 2.0,
    "busStop": 0.5,
    "healthcare": 4.5,
    "schools": 1.5,
}
WEIGHTS = {
    "coffee": 0.10,
    "restaurant": 0.10,
    "nature": 0.17,
    "healthcare": 0.10,
    "busStop": 0.10,
    "grocery": 0.17,
    "bikeInfra": 0.05,
    "crime": 0.11,
    "schools": 0.10,
}
BIKE_MAX_KM = 1.5
BIKE_TYPE_WEIGHTS = {
    "Protected Bike Lane": 1.0,
    "Cycle Track": 1.0,
    "Buffered Bike Lane": 0.9,
    "Bike Lane": 0.8,
    "Shared Use Path": 0.7,
    "Sharrows/On-Street Markings": 0.5,
}
TRAIL_TYPE_WEIGHTS = {
    "Regional": 0.9,
    "Minor": 0.7,
    "Neighborhood": 0.6,
}
TRAIL_SURFACE_WEIGHTS = {
    "Asphalt": 1.0,
    "Concrete": 1.0,
    "Porous Concrete": 0.9,
    "Crusher Fines": 0.6,
    "Gravel": 0.6,
    "Natural Surface": 0.4,
    "Stone": 0.4,
    "Wood Decking": 0.4,
    "Decking": 0.4,
    "Brick": 0.5,
}

PARK_TYPES = {"Park", "Open Space", "Conservation Tract", "Grounds"}
POLICE_TYPES = {"DISTRICT", "COP SHOP"}
COMMERCIAL_LICENSE_EXCLUSIONS = {
    "Residential Rental Property",
    "Short Term Rental",
}
FOOD_BUSINESS_TYPES = {
    "Retail Food",
    "Retail Food - Commissary",
    "Combined License",
    "Wholesale Food",
    "Wholesale Food - Commissary",
}

# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------


def log(msg: str) -> None:
    print(f"[denver] {msg}", flush=True)


def fetch_json(url: str, params: dict | None = None, timeout: int = 120):
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": "LivableIndex/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.load(response)


def fetch_business_licenses() -> list[tuple]:
    """Page through every active business license (ArcGIS caps at 2000 rows)."""
    rows: list[tuple] = []
    offset = 0
    page_size = 2000
    fields = (
        "LICENSE_TYPE,LICENSE_SUB_TYPE,LICENSE_STATUS,X_COORD,Y_COORD,"
        "TRADE_NAME,ENTITY_NAME,ADDRESS"
    )
    while True:
        page = fetch_json(
            BUSINESS_LICENSE_URL,
            {
                "where": "1=1",
                "outFields": fields,
                "returnGeometry": "false",
                "resultOffset": str(offset),
                "resultRecordCount": str(page_size),
                "f": "json",
            },
        )
        features = page.get("features") or []
        for feature in features:
            attrs = feature.get("attributes") or {}
            x = attrs.get("X_COORD")
            y = attrs.get("Y_COORD")
            if x is None or y is None:
                continue
            rows.append(
                (
                    attrs.get("LICENSE_TYPE"),
                    attrs.get("LICENSE_SUB_TYPE"),
                    attrs.get("LICENSE_STATUS"),
                    float(x),
                    float(y),
                    attrs.get("TRADE_NAME"),
                    attrs.get("ENTITY_NAME"),
                    attrs.get("ADDRESS"),
                )
            )
        log(f"  {len(rows):,} licenses fetched")
        if not page.get("exceededTransferLimit") or not features:
            break
        offset += page_size
    return rows


def haversine_km(lng1: float, lat1: float, lng2: float, lat2: float) -> float:
    radius = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lng / 2) ** 2
    )
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def dist_to_score(km: float | None, max_km: float | None = None) -> int:
    if km is None or not math.isfinite(km):
        return 0
    if km <= 0.3:
        return 100
    if max_km is not None:
        if km >= max_km:
            return 0
        # Linear falloff from the 300 m plateau to the dimension's access horizon.
        return max(0, round(100 * (1 - (km - 0.3) / (max_km - 0.3))))
    extra_m = (km - 0.3) * 1000.0
    steps = math.ceil(extra_m / 100.0)
    return max(0, 100 - steps * 10)


def school_score(km: float | None) -> int:
    if km is None or not math.isfinite(km):
        return 0
    max_km = MAX_DIST_KM["schools"]
    if km >= max_km:
        return 0
    return round((1 - km / max_km) * 100)


def nature_score(trail: int, park: int) -> int:
    return round(0.8 * trail + 0.2 * park)


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------


def _line_parts(geometry: dict | None):
    if not geometry:
        return []
    gtype = geometry.get("type")
    coords = geometry.get("coordinates") or []
    if gtype == "LineString":
        return [coords]
    if gtype == "MultiLineString":
        return [line for line in coords if line]
    return []


def _polygon_rings(geometry: dict | None):
    if not geometry:
        return []
    gtype = geometry.get("type")
    coords = geometry.get("coordinates") or []
    if gtype == "Polygon":
        return [coords[0]] if coords else []
    if gtype == "MultiPolygon":
        return [poly[0] for poly in coords if poly]
    return []


def sample_coords(coords, max_samples: int):
    if not coords:
        return []
    if len(coords) <= max_samples:
        return coords
    step = (len(coords) - 1) / (max_samples - 1)
    result = []
    for i in range(max_samples):
        idx = round(i * step)
        result.append(coords[min(idx, len(coords) - 1)])
    return result


def sample_ring(ring, max_points: int = 14):
    """Sample exterior-ring vertices for park access points.

    A park is represented by its boundary, so a nearby resident gets credit for
    the closest edge rather than the (sometimes distant) centroid.
    """
    if not ring:
        return []
    pts = list(ring)
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts = pts[:-1]
    if not pts:
        return []
    if len(pts) <= max_points:
        return pts
    step = (len(pts) - 1) / (max_points - 1)
    return [pts[min(round(i * step), len(pts) - 1)] for i in range(max_points)]


def round_coords(coords, digits: int = 6):
    return [[round(pt[0], digits), round(pt[1], digits)] for pt in coords]


# ---------------------------------------------------------------------------
# Database setup
# ---------------------------------------------------------------------------


def build() -> None:
    started = time.time()
    con = duckdb.connect()
    for statement in (
        "INSTALL httpfs",
        "LOAD httpfs",
        "INSTALL spatial",
        "LOAD spatial",
        # Newer spatial builds follow each CRS's authority axis order (EPSG:4326
        # is lat/lon). We keep all source geometries in OGC:CRS84 (lon/lat) so
        # they line up with the GeoJSON output and the app's [lon, lat] arrays.
        "SET s3_region = 'us-west-2'",
    ):
        con.execute(statement)

    # ------------------------------------------------------------------
    # 1. Neighborhood boundaries
    # ------------------------------------------------------------------
    log("loading Denver statistical neighborhoods")
    con.execute(
        f"""
        CREATE TABLE nb AS
        SELECT NBHD_ID, NBHD_NAME, TYPOLOGY, geom
        FROM ST_Read('{NBHD_URL}')
        """
    )
    con.execute(
        """
        CREATE TABLE nb_pts AS
        SELECT *,
               ST_PointOnSurface(geom) AS pt,
               ST_Area(ST_Transform(geom, 'OGC:CRS84', 'EPSG:26913')) / 2589988.11 AS sqmi
        FROM nb
        """
    )
    nbhd_count = con.execute("SELECT count(*) FROM nb").fetchone()[0]
    total_sqmi = con.execute("SELECT sum(sqmi) FROM nb_pts").fetchone()[0]
    log(f"  {nbhd_count} neighborhoods, {total_sqmi:,.1f} sq mi")

    # ------------------------------------------------------------------
    # 2. Overture Places
    # ------------------------------------------------------------------
    log(f"querying Overture Places {OVERTURE_RELEASE}")
    con.execute(
        f"""
        CREATE TABLE ov AS
        SELECT id,
               names.primary AS name,
               basic_category AS basic,
               taxonomy.primary AS cat,
               taxonomy.hierarchy AS hier,
               brand.names.primary AS brand,
               confidence,
               addresses[1].freeform AS address,
               websites,
               phones,
               list_transform(sources, x -> x.dataset) AS src_datasets,
               ST_Centroid(geometry) AS geom
        FROM read_parquet('{OVERTURE_SRC}')
        WHERE {OVERTURE_BBOX}
          AND operating_status = 'open'
          AND names.primary IS NOT NULL
        """
    )
    con.execute(
        """
        CREATE TABLE ov_clip AS
        SELECT o.*, n.NBHD_ID, n.NBHD_NAME
        FROM ov o
        JOIN nb n ON ST_Within(o.geom, n.geom)
        """
    )
    overture_count = con.execute("SELECT count(*) FROM ov_clip").fetchone()[0]
    log(f"  {overture_count:,} open named places inside Denver")

    coffee_expr = "(cat = 'coffee_shop' OR basic = 'coffee_shop')"
    grocery_expr = (
        "(cat IN ('grocery_store', 'supermarket', 'convenience_store', "
        "'specialty_food_store', 'butcher_shop', 'farmers_market', 'health_food_store', "
        "'organic_grocery_store', 'international_grocery_store') "
        "OR basic IN ('grocery_store', 'supermarket', 'convenience_store')) "
        "AND NOT regexp_matches(lower(name), "
        "'liquor|wine|spirit|tobacco|vape|smoke shop|vitamin|supplement|cbd|nutrition')"
    )
    school_expr = (
        "(basic IN ('elementary_school', 'middle_school', 'high_school', 'preschool') "
        "OR cat IN ('elementary_school', 'middle_school', 'high_school', 'preschool', "
        "'public_school', 'private_school', 'college', 'university')) "
        "AND COALESCE(basic, '') <> 'specialty_school' "
        "AND COALESCE(cat, '') <> 'specialty_school'"
    )
    park_expr = "(basic = 'park' OR cat = 'park')"

    # Restaurants and healthcare are curated separately below: both categories
    # are too noisy to classify from Overture alone (chains/fast food for
    # restaurants; dental/vision/home-care noise for healthcare).
    con.execute(
        f"""
        CREATE TABLE points AS
        SELECT category, name, address, geom, 'overture' AS source
        FROM (
            SELECT *,
                   CASE
                       WHEN {coffee_expr} THEN 'coffee'
                       WHEN {grocery_expr} THEN 'grocery'
                       WHEN {school_expr} THEN 'schools'
                       WHEN {park_expr} THEN 'parks'
                       ELSE NULL
                   END AS category
            FROM ov_clip
        )
        WHERE category IS NOT NULL
        """
    )
    for category, count in con.execute(
        "SELECT category, count(*) FROM points GROUP BY category ORDER BY category"
    ).fetchall():
        log(f"  Overture {category}: {count:,}")

    # ------------------------------------------------------------------
    # 3. Curated restaurants: license-gated, fast food excluded
    # ------------------------------------------------------------------
    con.execute(
        """
        CREATE OR REPLACE MACRO norm_name(s) AS
          trim(regexp_replace(regexp_replace(lower(coalesce(s, '')), '[^a-z0-9 ]', ' ', 'g'), ' +', ' ', 'g'));
        """
    )
    con.execute(
        """
        CREATE OR REPLACE MACRO norm_addr(s) AS
          trim(regexp_replace(regexp_replace(lower(coalesce(s, '')), '[^a-z0-9 ]', ' ', 'g'), ' +', ' ', 'g'));
        """
    )

    log("downloading active business licenses (paginated)")
    license_rows = fetch_business_licenses()
    con.execute(
        """
        CREATE TEMP TABLE lic_raw(
            license_type VARCHAR, license_sub_type VARCHAR, license_status VARCHAR,
            x DOUBLE, y DOUBLE, trade_name VARCHAR, entity_name VARCHAR, address VARCHAR
        )
        """
    )
    if license_rows:
        con.executemany("INSERT INTO lic_raw VALUES (?, ?, ?, ?, ?, ?, ?, ?)", license_rows)
    con.execute(
        """
        CREATE TABLE lic AS
        SELECT license_type, license_sub_type, license_status,
               trade_name, entity_name, address,
               ST_Transform(ST_Point(x, y), 'EPSG:2232', 'OGC:CRS84') AS geom
        FROM lic_raw
        """
    )
    con.execute(
        """
        CREATE TEMP TABLE rf AS
        SELECT norm_name(coalesce(trade_name, entity_name)) AS nm,
               coalesce(trade_name, entity_name) AS trade,
               address,
               ST_Transform(ST_Point(x, y), 'EPSG:2232', 'EPSG:26913') AS g_m
        FROM lic_raw
        WHERE license_type = 'Retail Food'
        """
    )
    con.execute(
        f"""
        CREATE TEMP TABLE lic_hr AS
        SELECT norm_name(BUS_PROF_NAME) AS nm, BUS_PROF_NAME AS trade,
               ST_Transform(ST_Centroid(geom), 'OGC:CRS84', 'EPSG:26913') AS g_m
        FROM ST_Read('{LIQUOR_URL}')
        WHERE LICENSES LIKE '%HOTEL AND RESTAURANT%'
           OR LICENSES LIKE '%VINTNER%'
        """
    )
    log(
        "  retail food licenses: "
        f"{con.execute('SELECT count(*) FROM rf').fetchone()[0]:,}; "
        "hotel/restaurant liquor licenses: "
        f"{con.execute('SELECT count(*) FROM lic_hr').fetchone()[0]:,}"
    )

    # Brands that are quick-service/fast-casual rather than a sit-down dinner.
    # Full-service chains are intentionally kept as valid dinner options.
    qsr_brands = [
        "subway", "mcdonald", "burger king", "wendy", "taco bell", "kfc",
        "popeyes", "arby", "hardee", "carl s jr", "jack in the box", "sonic",
        "dairy queen", "culver", "five guys", "shake shack", "chipotle",
        "qdoba", "panera", "jimmy john", "jersey mike", "firehouse subs",
        "wingstop", "little caesars", "papa john", "papa murphy", "domino",
        "pizza hut", "sbarro", "auntie anne", "wetzel", "cinnabon", "baskin",
        "cold stone", "smoothie king", "jamba", "starbucks", "dunkin",
        "dutch bros", "caribou", "insomnia cookies", "nothing bundt",
        "voodoo doughnut", "krispy kreme", "potbelly", "quiznos",
        "which wich", "noodles company", "smashburger", "good times",
        "mod pizza", "blaze pizza", "cava", "sweetgreen", "torchy",
        "panda express", "churchs", "jason s deli", "mcalister",
        "schlotzsky", "charleys", "long john silver", "captain d", "denny",
        "ihop", "village inn", "perkins", "waffle house", "krispy krunchy",
        "marco s pizza", "daves hot chicken", "starbird", "pei wei",
        "freddy", "zenshi", "snowfox",
    ]
    con.execute("CREATE TEMP TABLE qsr(brand VARCHAR)")
    con.executemany("INSERT INTO qsr VALUES (?)", [(brand,) for brand in qsr_brands])

    con.execute(
        """
        CREATE TEMP TABLE rest_cand AS
        WITH base AS (
            SELECT o.*,
                   norm_name(o.name) AS nm,
                   norm_name(o.brand) AS bm,
                   ST_Transform(o.geom, 'OGC:CRS84', 'EPSG:26913') AS g_m
            FROM ov_clip o
            WHERE o.hier[1] = 'food_and_drink'
              AND (
                    o.basic = 'restaurant'
                    OR (o.basic = 'casual_eatery'
                        AND o.cat IN ('diner', 'gastropub', 'bar_and_grill_restaurant',
                                      'tapas_bar', 'bistro', 'fondue_restaurant'))
                  )
              AND coalesce(o.cat, '') NOT IN (
                    'fast_food_restaurant', 'food_court', 'food_truck_stand', 'cafeteria',
                    'food_delivery_service', 'bakery', 'sandwich_shop', 'delicatessen',
                    'coffee_shop', 'cafe', 'dessert_shop', 'ice_cream_shop', 'donut_shop',
                    'bagel_shop', 'candy_store', 'chocolatier', 'cupcake_shop',
                    'frozen_yogurt_shop', 'gelato_shop', 'pretzel_shop', 'popcorn_shop',
                    'acai_bowls', 'smoothie_juice_bar'
                  )
              AND NOT EXISTS (
                    SELECT 1 FROM qsr q
                    WHERE strpos(norm_name(o.name), q.brand) > 0
                       OR strpos(norm_name(o.brand), q.brand) > 0
                  )
              AND NOT regexp_matches(norm_name(o.name),
                    'llc| inc| corp| ltd| dba |towing|welding|granite|reprographics|'
                    'marketing|realty|insurance|salon|barber|spa|gym|fitness|storage|'
                    'printing|auto repair|cleaners|laundry|parking|church|temple|'
                    'academy|daycare|preschool|library|museum|theater|arena|stadium|'
                    'school|college|university|hotel|motel|suites|hilton|marriott|'
                    'hyatt|holiday inn|hampton|residence inn|fairfield|towneplace|'
                    'springhill|comfort inn|best western|days inn|la quinta|'
                    'commissary|catering|vending|dispensary|cannabis|tobacco|vape|'
                    'smoke shop|pharmacy|clinic|dental|hospital|medical center|'
                    'nutrition|supplement|vitamin|consulting|design|solutions|'
                    'services|enterprises|holdings|group|concepts|fuel|gas station|'
                    'conoco|exxon|shell|chevron|circle k|7 eleven|mall')
        )
        SELECT *,
               EXISTS (
                   SELECT 1 FROM rf r
                   WHERE ST_DWithin(base.g_m, r.g_m, 50)
                     AND greatest(
                           jaro_winkler_similarity(base.nm, r.nm),
                           jaro_winkler_similarity(base.bm, r.nm)
                         ) >= 0.6
               ) AS has_rf,
               EXISTS (
                   SELECT 1 FROM lic_hr l
                   WHERE ST_DWithin(base.g_m, l.g_m, 50)
                     AND jaro_winkler_similarity(base.nm, l.nm) >= 0.6
               ) AS has_lic
        FROM base
        """
    )
    con.execute(
        """
        CREATE TEMP TABLE rest_final AS
        SELECT * FROM rest_cand c
        WHERE c.has_rf
           OR c.has_lic
           OR (
                c.websites IS NOT NULL AND len(c.websites) > 0
                AND c.phones IS NOT NULL AND len(c.phones) > 0
                AND NOT list_contains(c.src_datasets, 'BrightQuery')
                AND (
                      c.cat <> 'restaurant'
                      OR regexp_matches(c.nm,
                         'restaurant|grill|kitchen|bistro|cafe|eatery|diner|pub|'
                         'tavern|taco|pizza|sushi|ramen|pho|thai|mexican|burger|'
                         'deli|bbq|barbecue|steakhouse|seafood|noodle|dumpling|'
                         'empanada|pupusa|burrito|wings|breakfast|brunch')
                    )
              )
        """
    )
    con.execute(
        """
        INSERT INTO points
        SELECT 'restaurant', f.name, f.address, f.geom, 'overture' AS source
        FROM rest_final f
        WHERE NOT EXISTS (
            SELECT 1 FROM rest_final d
            WHERE d.id <> f.id
              AND ST_DWithin(f.g_m, d.g_m, 40)
              AND (
                    jaro_winkler_similarity(f.nm, d.nm) >= 0.92
                    OR (f.brand IS NOT NULL AND f.brand = d.brand)
                  )
              AND (
                    d.confidence > f.confidence
                    OR (d.confidence = f.confidence AND d.id < f.id)
                  )
        )
        """
    )
    rest_count = con.execute(
        "SELECT count(*) FROM points WHERE category = 'restaurant'"
    ).fetchone()[0]
    rest_cand_count = con.execute("SELECT count(*) FROM rest_cand").fetchone()[0]
    rest_licensed = con.execute(
        "SELECT count(*) FROM rest_final WHERE has_rf OR has_lic"
    ).fetchone()[0]
    log(
        f"  restaurants kept: {rest_count:,} "
        f"(candidates {rest_cand_count:,}, license-corroborated {rest_licensed:,})"
    )

    # ------------------------------------------------------------------
    # 4. Curated healthcare: physical, no-referral medical facilities
    # ------------------------------------------------------------------
    con.execute(
        f"""
        CREATE TEMP TABLE auth_health AS
        SELECT Facility_Name AS name,
               Address_Full AS address,
               geom,
               CASE
                   WHEN Facility_Type = 'Hospital' THEN 'hospital'
                   WHEN Facility_Type_Detail = 'FREESTANDING EMERGENCY DEPARTMENT' THEN 'urgent'
                   WHEN Facility_Type_Detail = 'FEDERALLY QHC' THEN 'primary'
                   WHEN Facility_Type = 'Community Clinic'
                        AND NOT regexp_matches(lower(Facility_Name),
                              'correctional|reception|infirmary|dispensary') THEN 'primary'
                   WHEN lower(Facility_Name) LIKE '%dialysis%' THEN 'dialysis'
               END AS tier
        FROM ST_Read('{HEALTH_URL}')
        WHERE COALESCE(OPERATING_STATUS, '') = 'Active'
        """
    )
    con.execute(
        """
        DELETE FROM auth_health
        WHERE tier IS NULL
           OR regexp_matches(lower(name), 'eating recovery|behavioral|mental health hospital')
        """
    )
    con.execute(
        """
        CREATE TEMP TABLE auth_health_d AS
        SELECT DISTINCT ON (norm_name(name), norm_addr(address)) *
        FROM auth_health
        """
    )

    con.execute(
        """
        CREATE TEMP TABLE ov_health AS
        WITH base AS (
            SELECT name, address, geom, cat, basic, confidence,
                   lower(coalesce(name, '')) AS lname
            FROM ov_clip
            WHERE confidence >= 0.7
              AND address IS NOT NULL
        )
        SELECT name, address, geom, confidence,
               CASE
                   WHEN regexp_matches(lname,
                     'urgent care|urgent-care|after ?hours|walk-?in clinic|immediate care|'
                     'emergency room|emergency center|emergency department|freestanding er|standalone er')
                     THEN 'urgent'
                   ELSE 'primary'
               END AS tier
        FROM base b
        WHERE NOT regexp_matches(b.lname,
                'dental|dentist|orthodont|endodont|periodont|vision|eye |optical|optometr|ophthalm|'
                'hearing|audiology|chiro|physical therap|physiotherap|behavioral|mental|psych|counsel|'
                'therap|acupunct|naturopath|massage|wellness|spa|dermatolog|skin|cosmetic|plastic|'
                'aesthetic|hair|laser|surg|imaging|radiology|laborator|lab |patholog|pharmac|home health|'
                'home care|hospice|veterinar|pet |animal|cannabis|marijuana|dispensary|canna|allgreens|'
                'herbal|garden|research|trials|foundation|association|insurance|billing|staffing|recruit|'
                'consult|telehealth|telemedicine|virtual|online|mobile|medical supply|equipment|ambulance|'
                'paramedic|hotel|motel|inn |resort|school|university|college|student|salon|barber|'
                'fitness|yoga|gym|retina|arthritis|rheumat|spine|pain|orthoped|foot|ankle|podiatr|vein|'
                'vascular|cardio|heart|neuro|gastro|endoscop|oncology|cancer|hematolog|fertility|ivf|'
                'testosterone|men.s health|suboxone|addiction|rehab|sleep|allergy|asthma|pulmon|kidney|'
                'nephro|urolog|endocrin|infectious|travel|occupational|sports medicine|anesthesia|'
                'eating disorder|weight|functional|integrative|holistic|longevity|regenerative|'
                'hospitalist|advocacy|voice|kidstreet|performance')
          AND NOT regexp_matches(b.lname,
                ',\\s*(md|do|np|pa|m\\.d\\.)|dr\\.|m\\.d\\.| lcsw| lpc| lmft| lpcc| msw| psyd| phd| rn| md$')
          AND regexp_matches(b.lname,
                'clinic|medical|health center|health centre|family medicine|family practice|family health|'
                'family care|primary care|urgent care|urgent-care|pediatric|internal medicine|'
                'women s health|ob gyn|obstetric|gynecolog|physician|doctor|hospital|kaiser|zoomcare|uchealth|'
                'u chealth|healthone|adventhealth|centura|concentra|carenow|afc |guardian urgent|'
                'metro urgent|rocky mountain urgent|denver health|onpoint')
          AND (
                regexp_matches(b.lname,
                  'urgent care|urgent-care|after ?hours|walk-?in clinic|immediate care|'
                  'emergency room|emergency center|emergency department|freestanding er|standalone er')
                OR (
                    (b.cat IN ('primary_care_or_general_clinic', 'family_practice',
                               'internal_medicine', 'public_health_clinic', 'community_clinic',
                               'medical_clinic', 'pediatric_clinic', 'general_practice',
                               'geriatrics', 'nurse_practitioner')
                     OR b.basic IN ('primary_care_or_general_clinic', 'pediatric_clinic',
                                    'public_health_clinic'))
                    AND NOT regexp_matches(b.lname, 'urgent care|after ?hours|walk.?in|immediate care')
                  )
              )
        """
    )

    con.execute(
        """
        CREATE TEMP TABLE health_cand AS
        SELECT name, address, geom, tier, source_rank, confidence,
               norm_name(name) AS nm,
               norm_addr(address) AS an,
               ST_Transform(geom, 'OGC:CRS84', 'EPSG:26913') AS g_m
        FROM (
            SELECT name, address, geom, tier, 0 AS source_rank, 1.0 AS confidence FROM auth_health_d
            UNION ALL
            SELECT name, address, geom, tier, 2 AS source_rank, confidence FROM ov_health
        )
        """
    )
    con.execute(
        """
        CREATE TEMP TABLE health_final AS
        SELECT * FROM health_cand c
        WHERE NOT EXISTS (
            SELECT 1 FROM health_cand p
            WHERE p.tier = c.tier
              AND (p.source_rank < c.source_rank
                   OR (p.source_rank = c.source_rank AND p.confidence > c.confidence)
                   OR (p.source_rank = c.source_rank AND p.confidence = c.confidence
                       AND p.name < c.name))
              AND ST_DWithin(c.g_m, p.g_m, 150)
              AND (c.an = p.an OR jaro_winkler_similarity(c.nm, p.nm) >= 0.80)
        )
        AND NOT EXISTS (
            SELECT 1 FROM health_cand h
            WHERE h.tier = 'hospital'
              AND c.tier <> 'hospital'
              AND ST_DWithin(c.g_m, h.g_m, 250)
        )
        """
    )
    con.execute(
        """
        INSERT INTO points
        SELECT 'healthcare', name, address, geom,
               CASE WHEN source_rank = 0 THEN 'denver_health_facilities' ELSE 'overture' END
        FROM health_final
        """
    )
    health_count = con.execute(
        "SELECT count(*) FROM points WHERE category = 'healthcare'"
    ).fetchone()[0]
    cdphe_count = con.execute("SELECT count(*) FROM auth_health_d").fetchone()[0]
    ov_health_count = con.execute("SELECT count(*) FROM ov_health").fetchone()[0]
    log(
        f"  healthcare kept: {health_count:,} "
        f"(CDPHE {cdphe_count:,}, Overture {ov_health_count:,})"
    )

    # ------------------------------------------------------------------
    # 3. Authoritative Denver layers (dedupe against Overture)
    # ------------------------------------------------------------------
    def merge_auth(
        category: str,
        source: str,
        select_sql: str,
        dedupe_m: int = 75,
        against: tuple[str, ...] | None = None,
    ) -> None:
        con.execute(f"CREATE OR REPLACE TEMP TABLE auth AS {select_sql}")
        total = con.execute("SELECT count(*) FROM auth").fetchone()[0]
        if total == 0:
            log(f"  {source}: 0 records")
            return
        target_cats = against or (category,)
        cat_list = ", ".join(f"'{c}'" for c in target_cats)
        con.execute(
            f"""
            INSERT INTO points
            SELECT '{category}', a.name, a.address, a.geom, '{source}'
            FROM auth a
            WHERE a.name IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1
                  FROM points p
                  WHERE p.category IN ({cat_list})
                    AND ST_DWithin(
                        ST_Transform(a.geom, 'OGC:CRS84', 'EPSG:26913'),
                        ST_Transform(p.geom, 'OGC:CRS84', 'EPSG:26913'),
                        {dedupe_m}
                    )
              )
            """
        )
        added = con.execute(
            f"SELECT count(*) FROM points WHERE source = '{source}'"
        ).fetchone()[0]
        log(f"  {source}: {added:,} added of {total:,} records")

    log("merging authoritative Denver layers")
    merge_auth(
        "grocery",
        "denver_food_retail",
        f"""
        SELECT NAME AS name, ADDRESS_FULL AS address, geom
        FROM ST_Read('{FOOD_URL}')
        """,
    )
    merge_auth(
        "schools",
        "denver_public_schools",
        f"""
        SELECT SCHOOL_NAME AS name, ADDRESS_LINE1 AS address, geom
        FROM ST_Read('{PUBLIC_SCHOOLS_URL}')
        """,
    )
    merge_auth(
        "schools",
        "denver_private_schools",
        f"""
        SELECT SCHOOL_NAME AS name, ADDRESS_LINE1 AS address, geom
        FROM ST_Read('{PRIVATE_SCHOOLS_URL}')
        """,
    )

    # Parkland polygons: sample boundary vertices so distance-to-park reflects
    # the park edge, not a single centroid.
    log("  sampling Denver parkland boundaries")
    park_geo = fetch_json(PARKLAND_URL)
    park_rows = []
    park_seen = set()
    for feature in park_geo.get("features", []):
        props = feature.get("properties") or {}
        if props.get("PARK_TYPE") not in PARK_TYPES:
            continue
        name = props.get("FORMAL_NAME") or props.get("LOCATION") or "Denver park"
        for ring in _polygon_rings(feature.get("geometry")):
            for lng, lat in sample_ring(ring, 14):
                key = (round(lng, 6), round(lat, 6))
                if key in park_seen:
                    continue
                park_seen.add(key)
                park_rows.append((name, lng, lat))
    con.execute("CREATE OR REPLACE TEMP TABLE park_raw(name VARCHAR, lon DOUBLE, lat DOUBLE)")
    if park_rows:
        con.executemany("INSERT INTO park_raw VALUES (?, ?, ?)", park_rows)
    merge_auth(
        "parks",
        "denver_parkland",
        """
        SELECT name, NULL AS address,
               ST_GeomFromText('POINT(' || lon || ' ' || lat || ')') AS geom
        FROM park_raw
        """,
        dedupe_m=100,
    )

    # Transit: RTD bus stops (authoritative) plus rail stations.
    con.execute(
        f"""
        INSERT INTO points
        SELECT 'busStops', STOP_NAME, NULL, geom, 'rtd_bus_stops'
        FROM ST_Read('{BUS_URL}')
        WHERE STOP_NAME IS NOT NULL
        """
    )
    bus_added = con.execute(
        "SELECT count(*) FROM points WHERE source = 'rtd_bus_stops'"
    ).fetchone()[0]
    log(f"  rtd_bus_stops: {bus_added:,} added")
    merge_auth(
        "busStops",
        "rtd_rail_stations",
        f"""
        SELECT STATION_NAME AS name, LINE_NAME AS address, geom
        FROM ST_Read('{RAIL_URL}')
        WHERE STATION_NAME IS NOT NULL
        """,
        dedupe_m=30,
    )

    point_total = con.execute("SELECT count(*) FROM points").fetchone()[0]
    log(f"  total bundled POIs: {point_total:,}")

    # ------------------------------------------------------------------
    # 4. Trails
    # ------------------------------------------------------------------
    log("loading and simplifying DPR trails")
    con.execute(
        f"""
        CREATE TABLE trails AS
        SELECT TRAIL_NAME AS name,
               REACH,
               TYPE_CLASS,
               ST_Simplify(geom, 0.00002) AS geom
        FROM ST_Read('{TRAIL_URL}')
        WHERE COALESCE(PROPOSED, 'No') <> 'Yes'
        """
    )
    trail_features = []
    for name, geom_json in con.execute(
        "SELECT name, ST_AsGeoJSON(geom) FROM trails"
    ).fetchall():
        if not geom_json:
            continue
        geometry = json.loads(geom_json)
        for line in _line_parts(geometry):
            coords = round_coords(line)
            if len(coords) >= 2:
                trail_features.append({"name": name or "Denver trail", "coords": coords})
    (OUT_DIR / "trails.json").write_text(
        json.dumps(trail_features, separators=(",", ":")), encoding="utf-8"
    )
    trail_coords = sum(len(t["coords"]) for t in trail_features)
    log(f"  {len(trail_features)} trail segments, {trail_coords:,} coordinates")

    # ------------------------------------------------------------------
    # 5. Neighborhood assignment, counts, and nearest distances
    # ------------------------------------------------------------------
    log("assigning POIs to neighborhoods and computing metrics")
    con.execute(
        """
        CREATE TABLE points_nb AS
        SELECT p.*, n.NBHD_ID, n.NBHD_NAME
        FROM points p
        LEFT JOIN nb n ON ST_Within(p.geom, n.geom)
        """
    )
    con.execute(
        """
        CREATE TABLE points_m AS
        SELECT *, ST_Transform(geom, 'OGC:CRS84', 'EPSG:26913') AS geom_m
        FROM points_nb
        """
    )
    con.execute(
        """
        CREATE TABLE nb_m AS
        SELECT *,
               ST_Transform(pt, 'OGC:CRS84', 'EPSG:26913') AS pt_m,
               ST_Transform(geom, 'OGC:CRS84', 'EPSG:26913') AS geom_m
        FROM nb_pts
        """
    )
    con.execute(
        """
        CREATE TABLE trails_m AS
        SELECT name, TYPE_CLASS,
               ST_Transform(geom, 'OGC:CRS84', 'EPSG:26913') AS geom_m
        FROM trails
        """
    )

    nearest_exprs = []
    for category in (
        "coffee",
        "restaurant",
        "grocery",
        "parks",
        "healthcare",
        "schools",
        "busStops",
    ):
        nearest_exprs.append(
            f"(SELECT min(ST_Distance(n.pt_m, p.geom_m)) / 1000.0 "
            f"FROM points_m p WHERE p.category = '{category}') AS {category}_km"
        )
    nearest_exprs.append(
        "(SELECT min(ST_Distance(n.pt_m, t.geom_m)) / 1000.0 "
        "FROM trails_m t) AS trail_km"
    )
    con.execute(
        f"""
        CREATE TABLE nearest AS
        SELECT n.NBHD_ID, {', '.join(nearest_exprs)}
        FROM nb_m n
        """
    )

    count_exprs = []
    for category in (
        "coffee",
        "restaurant",
        "grocery",
        "parks",
        "healthcare",
        "schools",
        "busStops",
    ):
        count_exprs.append(
            f"count(*) FILTER (WHERE p.category = '{category}') AS {category}"
        )
    con.execute(
        f"""
        CREATE TABLE counts AS
        SELECT n.NBHD_ID, {', '.join(count_exprs)}
        FROM nb_pts n
        LEFT JOIN points_nb p ON p.NBHD_ID = n.NBHD_ID
        GROUP BY n.NBHD_ID
        """
    )
    con.execute(
        """
        CREATE TABLE trail_counts AS
        SELECT n.NBHD_ID, count(*) AS trails
        FROM nb_m n
        JOIN trails_m t ON ST_Intersects(n.geom_m, t.geom_m)
        GROUP BY n.NBHD_ID
        """
    )

    # ------------------------------------------------------------------
    # 6. Active business licenses (already downloaded in step 3)
    # ------------------------------------------------------------------
    con.execute(
        """
        CREATE TABLE lic_nb AS
        SELECT l.*, n.NBHD_ID
        FROM lic l
        JOIN nb n ON ST_Within(l.geom, n.geom)
        """
    )
    commercial_types = ", ".join(
        "'" + t.replace("'", "''") + "'" for t in COMMERCIAL_LICENSE_EXCLUSIONS
    )
    food_types = ", ".join("'" + t.replace("'", "''") + "'" for t in FOOD_BUSINESS_TYPES)
    con.execute(
        f"""
        CREATE TABLE license_counts AS
        SELECT NBHD_ID,
               count(*) FILTER (WHERE license_type NOT IN ({commercial_types})) AS active_business,
               count(*) FILTER (WHERE license_type = 'Liquor') AS liquor,
               count(*) FILTER (WHERE license_type IN ({food_types})) AS food_business
        FROM lic_nb
        GROUP BY NBHD_ID
        """
    )
    license_totals = con.execute(
        f"""
        SELECT
            count(*) AS total,
            count(*) FILTER (WHERE license_type NOT IN ({commercial_types})) AS commercial,
            count(*) FILTER (WHERE license_type = 'Liquor') AS liquor,
            count(*) FILTER (WHERE license_type IN ({food_types})) AS food
        FROM lic
        """
    ).fetchone()
    log(
        "  licenses: "
        f"{license_totals[0]:,} total / {license_totals[1]:,} commercial / "
        f"{license_totals[2]:,} liquor / {license_totals[3]:,} food"
    )

    # ------------------------------------------------------------------
    # 7. Bike infrastructure and public safety scoring
    # ------------------------------------------------------------------
    log("computing bike and public-safety dimensions")
    bike_geo = fetch_json(BIKE_URL)
    bike_points = []
    for feature in bike_geo.get("features", []):
        props = feature.get("properties") or {}
        facility_type = (
            props.get("FACILITY_TYPE_EXISTING")
            or props.get("FACILITY_TYPE")
            or props.get("VERTICAL_ELEMENT_TYPE")
        )
        weight = BIKE_TYPE_WEIGHTS.get(facility_type, 0.5)
        for line in _line_parts(feature.get("geometry")):
            for lng, lat in sample_coords(line, 8):
                bike_points.append((lng, lat, weight))

    trail_geo = fetch_json(TRAIL_URL)
    bike_trail_points = []
    for feature in trail_geo.get("features", []):
        props = feature.get("properties") or {}
        if props.get("PROPOSED") == "Yes":
            continue
        surface = props.get("SURFTYPE") or props.get("SURFACE_TYPE")
        type_class = props.get("TYPE_CLASS")
        if surface:
            weight = TRAIL_SURFACE_WEIGHTS.get(surface, 0.5)
        elif type_class:
            weight = TRAIL_TYPE_WEIGHTS.get(type_class, 0.7)
        else:
            weight = 0.5
        for line in _line_parts(feature.get("geometry")):
            for lng, lat in sample_coords(line, 6):
                bike_trail_points.append((lng, lat, weight))

    police_geo = fetch_json(POLICE_URL)
    police_points = []
    for feature in police_geo.get("features", []):
        props = feature.get("properties") or {}
        if props.get("STATION_TYPE") not in POLICE_TYPES:
            continue
        geometry = feature.get("geometry") or {}
        coords = geometry.get("coordinates")
        if coords and len(coords) >= 2:
            police_points.append((coords[0], coords[1]))

    def nearest_weighted(lng: float, lat: float, candidates):
        best_km = float("inf")
        best_weight = 0.0
        for c_lng, c_lat, weight in candidates:
            d = haversine_km(lng, lat, c_lng, c_lat)
            if d < best_km:
                best_km = d
                best_weight = weight
        return best_km, best_weight

    def proximity_score(km: float, max_km: float) -> int:
        if not math.isfinite(km) or km > max_km:
            return 0
        return max(0, round((1 - km / max_km) * 100))

    def bike_infra_score(lng: float, lat: float) -> int:
        bike_km, bike_weight = nearest_weighted(lng, lat, bike_points)
        trail_km, trail_weight = nearest_weighted(lng, lat, bike_trail_points)
        bike_component = proximity_score(bike_km, BIKE_MAX_KM) * bike_weight
        trail_component = proximity_score(trail_km, BIKE_MAX_KM) * trail_weight
        return min(100, round(0.6 * bike_component + 0.4 * trail_component))

    def crime_score(lng: float, lat: float) -> int:
        if not police_points:
            return 100
        min_km = min(haversine_km(lng, lat, p_lng, p_lat) for p_lng, p_lat in police_points)
        driving_min = min_km * 1.95
        return max(0, 100 - max(0, math.ceil(driving_min - 5)) * 10)

    # ------------------------------------------------------------------
    # 8. Assemble neighborhood records
    # ------------------------------------------------------------------
    log("assembling neighborhood scores and metrics")
    nbhd_rows = con.execute(
        """
        SELECT NBHD_ID, NBHD_NAME, TYPOLOGY, sqmi,
               ST_X(pt) AS pt_lng, ST_Y(pt) AS pt_lat,
               ST_AsGeoJSON(ST_Simplify(geom, 0.00001)) AS geom_json
        FROM nb_pts
        ORDER BY NBHD_ID
        """
    ).fetchall()
    nearest_rows = {
        row[0]: row
        for row in con.execute(
            """
            SELECT NBHD_ID, coffee_km, restaurant_km, grocery_km, parks_km,
                   healthcare_km, schools_km, busStops_km, trail_km
            FROM nearest
            """
        ).fetchall()
    }
    count_rows = {
        row[0]: row
        for row in con.execute(
            """
            SELECT NBHD_ID, coffee, restaurant, grocery, parks, healthcare,
                   schools, busStops
            FROM counts
            """
        ).fetchall()
    }
    trail_count_rows = {
        row[0]: row[1]
        for row in con.execute("SELECT NBHD_ID, trails FROM trail_counts").fetchall()
    }
    license_rows_by_nbhd = {
        row[0]: row
        for row in con.execute(
            """
            SELECT NBHD_ID, active_business, liquor, food_business
            FROM license_counts
            """
        ).fetchall()
    }

    features = []
    nbhd_scores = {}
    for nbhd_id, name, typology, sqmi, pt_lng, pt_lat, geom_json in nbhd_rows:
        nearest = nearest_rows.get(nbhd_id)
        if nearest is None:
            nearest = (nbhd_id,) + (None,) * 8
        (
            _,
            coffee_km,
            restaurant_km,
            grocery_km,
            parks_km,
            healthcare_km,
            schools_km,
            busStops_km,
            trail_km,
        ) = nearest

        counts = count_rows.get(nbhd_id)
        if counts is None:
            counts = (nbhd_id,) + (0,) * 7
        (
            _,
            coffee_count,
            restaurant_count,
            grocery_count,
            park_count,
            health_count,
            school_count,
            bus_count,
        ) = counts

        licenses = license_rows_by_nbhd.get(nbhd_id)
        if licenses is None:
            licenses = (nbhd_id, 0, 0, 0)
        _, active_business, liquor_count, food_business = licenses

        scores = {
            "coffee": dist_to_score(coffee_km),
            "restaurant": dist_to_score(restaurant_km),
            "grocery": dist_to_score(grocery_km),
            "trail": dist_to_score(trail_km),
            "park": dist_to_score(parks_km),
            "busStop": dist_to_score(busStops_km),
            "healthcare": dist_to_score(healthcare_km, MAX_DIST_KM["healthcare"]),
            "schools": school_score(schools_km),
            "bikeInfra": bike_infra_score(pt_lng, pt_lat),
            "crime": crime_score(pt_lng, pt_lat),
        }
        scores["nature"] = nature_score(scores["trail"], scores["park"])
        nbhd_scores[nbhd_id] = scores

        composite = round(
            sum(scores[key] * weight for key, weight in WEIGHTS.items())
        )

        def km(value):
            return round(value, 3) if value is not None and math.isfinite(value) else None

        properties = {
            "id": f"denver-{nbhd_id}",
            "name": name,
            "NBHD_ID": nbhd_id,
            "NBHD_NAME": name,
            "TYPOLOGY": typology,
            "sqmi": round(sqmi, 3),
            "overlayScores": scores,
            "composite": composite,
            "metrics": {
                "sqmi": round(sqmi, 3),
                "counts": {
                    "coffee": int(coffee_count),
                    "restaurant": int(restaurant_count),
                    "grocery": int(grocery_count),
                    "parks": int(park_count),
                    "healthcare": int(health_count),
                    "schools": int(school_count),
                    "busStops": int(bus_count),
                    "trails": int(trail_count_rows.get(nbhd_id, 0)),
                },
                "licenses": {
                    "activeBusiness": int(active_business),
                    "foodBusiness": int(food_business),
                    "liquor": int(liquor_count),
                },
                "nearestKm": {
                    "coffee": km(coffee_km),
                    "restaurant": km(restaurant_km),
                    "grocery": km(grocery_km),
                    "parks": km(parks_km),
                    "healthcare": km(healthcare_km),
                    "schools": km(schools_km),
                    "busStops": km(busStops_km),
                    "trail": km(trail_km),
                },
            },
        }
        features.append(
            {
                "type": "Feature",
                "properties": properties,
                "geometry": json.loads(geom_json),
            }
        )

    neighborhoods = {"type": "FeatureCollection", "features": features}
    (OUT_DIR / "neighborhoods.json").write_text(
        json.dumps(neighborhoods, separators=(",", ":")), encoding="utf-8"
    )

    # ------------------------------------------------------------------
    # 9. Detail grid (street-level cells shown when the map is zoomed in)
    # ------------------------------------------------------------------
    log("building 250 m detail grid")
    cell_m = 250.0
    lon_step = cell_m / (111_320.0 * math.cos(math.radians(39.76)))
    lat_step = cell_m / 110_574.0
    west, south, east, north = -105.110, 39.614, -104.600, 39.915
    nx = int(math.ceil((east - west) / lon_step))
    ny = int(math.ceil((north - south) / lat_step))
    cell_rows = []
    cell_id = 0
    for ix in range(nx):
        lon = west + ix * lon_step
        for iy in range(ny):
            lat = south + iy * lat_step
            wkt = (
                f"POLYGON(({lon:.6f} {lat:.6f},{lon + lon_step:.6f} {lat:.6f},"
                f"{lon + lon_step:.6f} {lat + lat_step:.6f},"
                f"{lon:.6f} {lat + lat_step:.6f},{lon:.6f} {lat:.6f}))"
            )
            cell_rows.append((cell_id, wkt))
            cell_id += 1
    log(f"  {len(cell_rows):,} candidate cells")

    con.execute("CREATE TEMP TABLE cell_raw(id INTEGER, wkt VARCHAR)")
    con.executemany("INSERT INTO cell_raw VALUES (?, ?)", cell_rows)
    con.execute(
        """
        CREATE TABLE cells AS
        SELECT c.id,
               n.NBHD_ID,
               n.NBHD_NAME,
               ST_Intersection(c.geom, n.geom) AS geom,
               ST_Centroid(c.geom) AS pt,
               ST_Transform(ST_Centroid(c.geom), 'OGC:CRS84', 'EPSG:26913') AS pt_m
        FROM (SELECT id, ST_MakeValid(ST_GeomFromText(wkt)) AS geom FROM cell_raw) c
        JOIN (SELECT NBHD_ID, NBHD_NAME, ST_MakeValid(geom) AS geom FROM nb) n
          ON ST_Contains(n.geom, ST_Centroid(c.geom))
        """
    )
    cell_count = con.execute("SELECT count(*) FROM cells").fetchone()[0]
    log(f"  {cell_count:,} cells inside Denver")

    con.execute(
        """
        CREATE TABLE cell_d AS
        SELECT c.id,
               (min(ST_Distance(c.pt_m, p.geom_m)) FILTER (WHERE p.category = 'coffee')) / 1000.0 AS coffee_km,
               (min(ST_Distance(c.pt_m, p.geom_m)) FILTER (WHERE p.category = 'restaurant')) / 1000.0 AS restaurant_km,
               (min(ST_Distance(c.pt_m, p.geom_m)) FILTER (WHERE p.category = 'grocery')) / 1000.0 AS grocery_km,
               (min(ST_Distance(c.pt_m, p.geom_m)) FILTER (WHERE p.category = 'parks')) / 1000.0 AS parks_km,
               (min(ST_Distance(c.pt_m, p.geom_m)) FILTER (WHERE p.category = 'healthcare')) / 1000.0 AS healthcare_km,
               (min(ST_Distance(c.pt_m, p.geom_m)) FILTER (WHERE p.category = 'schools')) / 1000.0 AS schools_km,
               (min(ST_Distance(c.pt_m, p.geom_m)) FILTER (WHERE p.category = 'busStops')) / 1000.0 AS busStops_km
        FROM cells c
        JOIN points_m p ON ST_DWithin(c.pt_m, p.geom_m, 4500)
        GROUP BY c.id
        """
    )
    con.execute(
        """
        CREATE TABLE cell_t AS
        SELECT c.id, min(ST_Distance(c.pt_m, t.geom_m)) / 1000.0 AS trail_km
        FROM cells c
        JOIN trails_m t ON ST_DWithin(c.pt_m, t.geom_m, 4500)
        GROUP BY c.id
        """
    )
    grid_rows = con.execute(
        """
        SELECT c.id, c.NBHD_ID, c.NBHD_NAME, ST_AsGeoJSON(c.geom),
               d.coffee_km, d.restaurant_km, d.grocery_km, d.parks_km,
               d.healthcare_km, d.schools_km, d.busStops_km, t.trail_km
        FROM cells c
        LEFT JOIN cell_d d ON d.id = c.id
        LEFT JOIN cell_t t ON t.id = c.id
        ORDER BY c.id
        """
    ).fetchall()

    grid_features = []
    for (
        cid,
        nb_id,
        nb_name,
        geom_json,
        coffee_km,
        restaurant_km,
        grocery_km,
        parks_km,
        healthcare_km,
        schools_km,
        busStops_km,
        trail_km,
    ) in grid_rows:
        parent = nbhd_scores.get(nb_id, {})
        cell_scores = {
            "coffee": dist_to_score(coffee_km),
            "restaurant": dist_to_score(restaurant_km),
            "grocery": dist_to_score(grocery_km),
            "trail": dist_to_score(trail_km),
            "park": dist_to_score(parks_km),
            "busStop": dist_to_score(busStops_km),
            "healthcare": dist_to_score(healthcare_km, MAX_DIST_KM["healthcare"]),
            "schools": school_score(schools_km),
            "bikeInfra": parent.get("bikeInfra", 0),
            "crime": parent.get("crime", 50),
        }
        cell_scores["nature"] = nature_score(cell_scores["trail"], cell_scores["park"])
        grid_features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": f"denver-cell-{cid}",
                    "name": nb_name,
                    "NBHD_ID": nb_id,
                    "cell": cid,
                    "overlayScores": cell_scores,
                    "composite": round(
                        sum(cell_scores[key] * weight for key, weight in WEIGHTS.items())
                    ),
                },
                "geometry": json.loads(geom_json),
            }
        )
    (OUT_DIR / "grid.json").write_text(
        json.dumps(
            {"type": "FeatureCollection", "features": grid_features},
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    log(f"  wrote {len(grid_features):,} detail cells")

    # ------------------------------------------------------------------
    # 10. Write bundled POI arrays
    # ------------------------------------------------------------------
    log("writing POI arrays")
    poi_output = {}
    category_order = (
        "coffee",
        "restaurant",
        "grocery",
        "parks",
        "healthcare",
        "schools",
        "busStops",
    )
    for category in category_order:
        rows = con.execute(
            """
            SELECT name, address, ST_Y(geom) AS lat, ST_X(geom) AS lon, source
            FROM points
            WHERE category = ?
            ORDER BY name NULLS LAST, lat, lon
            """,
            [category],
        ).fetchall()
        poi_output[category] = [
            {
                "name": name,
                "lat": round(lat, 6),
                "lon": round(lon, 6),
                "source": source,
            }
            for name, address, lat, lon, source in rows
        ]
        log(f"  {category}: {len(poi_output[category]):,}")

    (OUT_DIR / "pois_denver.json").write_text(
        json.dumps(poi_output, separators=(",", ":")), encoding="utf-8"
    )

    # ------------------------------------------------------------------
    # 10. Metadata
    # ------------------------------------------------------------------
    metadata = {
        "city": "Denver",
        "generated": _dt.date.today().isoformat(),
        "overture": {
            "release": OVERTURE_RELEASE,
            "dataset": "theme=places/type=place",
            "license": "CDLA-Permissive-2.0",
            "queryBbox": [-105.12, 39.60, -104.55, 39.95],
            "openNamedPlacesInDenver": overture_count,
        },
        "neighborhoods": {
            "source": "City and County of Denver Statistical Neighborhood",
            "count": nbhd_count,
            "totalSqMi": round(total_sqmi, 1),
        },
        "grid": {
            "cellMeters": 250,
            "cells": len(grid_features),
            "note": "Street-level detail cells, clipped to statistical neighborhoods.",
        },
        "pois": {
            "total": point_total,
            "byCategory": {k: len(v) for k, v in poi_output.items()},
        },
        "licenses": {
            "source": "Denver Active Business Licenses",
            "total": license_totals[0],
            "commercial": license_totals[1],
            "liquor": license_totals[2],
            "foodBusiness": license_totals[3],
            "note": "Commercial counts exclude Residential Rental and Short Term Rental licenses.",
        },
        "trails": {
            "source": "Denver Parks & Recreation DPR_Trails_General_2020",
            "segments": len(trail_features),
        },
        "sources": [
            {
                "name": "Overture Maps Places",
                "url": "https://overturemaps.org/download/",
                "license": "CDLA-Permissive-2.0",
            },
            {
                "name": "Denver Open Data - Statistical Neighborhood",
                "url": "https://data.denvergov.org/",
            },
            {
                "name": "Denver Open Data - Active Business Licenses",
                "url": "https://data.denvergov.org/",
            },
            {
                "name": "Denver Open Data - Food Retail Locations",
                "url": "https://data.denvergov.org/",
            },
            {
                "name": "Denver Open Data - Liquor Licenses",
                "url": "https://data.denvergov.org/",
            },
            {
                "name": "Denver Open Data - Public and Non-Public Schools",
                "url": "https://data.denvergov.org/",
            },
            {
                "name": "Denver Open Data - Health Facilities / Hospitals / FQHCs",
                "url": "https://data.denvergov.org/",
            },
            {
                "name": "Denver Open Data - Parkland",
                "url": "https://data.denvergov.org/",
            },
            {
                "name": "Denver Open Data - RTD Bus Stops and Rail Stations",
                "url": "https://data.denvergov.org/",
            },
            {
                "name": "Denver Open Data - DPR Trails",
                "url": "https://data.denvergov.org/",
            },
            {
                "name": "Denver Open Data - Bicycle Facilities",
                "url": "https://data.denvergov.org/",
            },
            {
                "name": "Denver Open Data - Police Stations",
                "url": "https://data.denvergov.org/",
            },
        ],
    }
    (OUT_DIR / "metadata.json").write_text(
        json.dumps(metadata, indent=2), encoding="utf-8"
    )

    elapsed = time.time() - started
    log(f"done in {elapsed:,.1f}s")
    log(f"outputs written to {OUT_DIR}")


if __name__ == "__main__":
    try:
        build()
    except Exception as exc:  # noqa: BLE001 - surface a useful message
        print(f"[denver] FAILED: {exc}", file=sys.stderr)
        raise
