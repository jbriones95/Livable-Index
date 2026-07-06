#!/usr/bin/env bash
set -euo pipefail

# Usage: ./tools/add_restaurants.sh
# Reads embedded restaurant list, geocodes via Nominatim, and appends to data/unified_list.json

WORKDIR="$(cd "$(dirname "$0")/.." && pwd)"
UNIFIED="$WORKDIR/data/unified_list.json"

USER_AGENT="Livable-Index/1.0 (+https://github.com/jbriones)"

RESTAURANTS=$(cat <<'EOF'
Mannings|51 W Dry Creek Ct, Littleton, CO 80120
Zaika|151 W Mineral Ave #109, Littleton, CO 80120
Poke Co|91 W Mineral Ave #140, Littleton, CO 80120
Sunflower Asian Cafe|91 W Mineral Ave #100, Littleton, CO 80120
Ninja Sushi|7923 S Broadway, Littleton, CO 80122
Hibachi|7961 S Broadway Unit B, Littleton, CO 80122
Mi Cocina|137 W County Line Rd, Littleton, CO 80129
Haveli|301 E County Line Rd, Littleton, CO 80122
Tusty Rap BBQ|311 E County Line Rd Unit A-1B, Littleton, CO 80122
Celly’s Bar and Grill|841 Southpark Dr, Littleton, CO 80120
Panera|7301 S Santa Fe Dr #730, Littleton, CO 80120
Ted’s Montana Grill|7301 S Santa Fe Dr Ste 610, Littleton, CO 80120
Salad Chick|7301 S Santa Fe Dr Unit 320, Littleton, CO 80120
Angelo’s Taverna|7301 S Santa Fe Dr Unit 320, Littleton, CO 80120
Breck Brew|2990 Brewery Ln, Littleton, CO 80120
Platte River Bar and Grill|5995 S Santa Fe Dr, Littleton, CO 80120
Palenque|2609 Main St, Littleton, CO 80120
Pho Real|2399 Main St, Littleton, CO 80120
Santa Fe Grill|1500 W Littleton Blvd, Littleton, CO 80120
Vinameals|1500 W Littleton Blvd #110a, Littleton, CO 80120
Gyro’s|1399 W Littleton Blvd, Littleton, CO 80120
Littleton Brewing Co|1201 W Littleton Blvd, Littleton, CO 80120
Cherry Cricket|819 W Littleton Blvd, Littleton, CO 80120
Latke Love|699 W Littleton Blvd, Littleton, CO 80120
Wild Ginger|699 W Littleton Blvd, Littleton, CO 80120
Pho Littleton|389 W Littleton Blvd, Littleton, CO 80120
Chipotle|5699 S Broadway, Littleton, CO 80121
Mama Sol|6439 S Broadway, Littleton, CO 80121
Castle Bar|6657 S Broadway, Littleton, CO 80121
Dubbs Pub|5301 S Broadway, Littleton, CO 80121
Mi Cocina 2|1600 W Belleview Ave, Littleton, CO 80120
EOF
)

tmpfile=$(mktemp)
jq --argjson emptyObj '{}' '. as $orig | $orig' "$UNIFIED" > "$tmpfile" || { echo "failed to read $UNIFIED"; exit 1; }

echo "Geocoding restaurants and appending to $UNIFIED"

while IFS='|' read -r name addr; do
  echo "- $name — $addr"
  # polite pause to avoid hammering free Nominatim
  sleep 1
  # Nominatim search
  url="https://nominatim.openstreetmap.org/search"
  resp=$(curl -sS -G --user-agent "$USER_AGENT" --data-urlencode "q=$addr" --data-urlencode "format=json" --data-urlencode "limit=1" "$url") || true
  lat=$(echo "$resp" | jq -r '.[0].lat // empty')
  lon=$(echo "$resp" | jq -r '.[0].lon // empty')
  display_name=$(echo "$resp" | jq -r '.[0].display_name // empty')

  if [ -z "$lat" ] || [ -z "$lon" ]; then
    echo "  Geocode failed for $name — skipping"
    continue
  fi

  # Build entry
  entry=$(jq -n --arg lat "$lat" --arg lon "$lon" --arg name "$name" --arg note "$addr" '{lat:(($lat|tonumber)), lon:(($lon|tonumber)), name:$name, note:$note}')

  # Append to `restaurant` array; create array if missing
  tmp2=$(mktemp)
  jq --argjson e "$entry" '
    if .restaurant == null then . + {restaurant: [$e]} else .restaurant += [$e] end' "$tmpfile" > "$tmp2"
  mv "$tmp2" "$tmpfile"
  echo "  Added $name at $lat,$lon"
done <<< "$RESTAURANTS"

cp "$tmpfile" "$UNIFIED"
echo "Done. Updated $UNIFIED"
