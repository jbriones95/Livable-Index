#!/usr/bin/env bash
set -eu

addresses=(
  "6954 S Windermere St, Littleton, CO 80120"
  "6147 S Gallup St, Littleton, CO 80120"
  "6028 S Gallup St, Littleton, CO 80120"
  "5800 S Spotswood St, Littleton, CO 80120"
  "164 W Acoma Dr, Littleton, CO 80120"
  "5150 S Windermere St, Littleton, CO 80120"
  "5100 S Hickory St, Littleton, CO 80120"
  "5501 S Federal Blvd, Littleton, CO 80123"
  "Powers Park, Littleton, CO 80120"
  "West Crestline Avenue Unnamed Rd, Littleton, CO 80120"
  "5875 S Lowell Blvd, Littleton, CO 80123"
)

for a in "${addresses[@]}"; do
  echo "Address: $a"
  ENC=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$a")

  NOMI=$(curl -s -H "User-Agent: LivableIndex/validate-script" -H "Accept: application/json" "https://nominatim.openstreetmap.org/search?format=json&q=${ENC}&limit=1")
  if [ -z "$NOMI" ] || [ "$NOMI" = "[]" ]; then
    echo "  -> No geocode result"
    sleep 1
    continue
  fi

  LAT=$(echo "$NOMI" | python3 -c "import sys,json
try:
  d=json.load(sys.stdin)
  print(d[0].get('lat',''))
except Exception:
  print('')")

  LON=$(echo "$NOMI" | python3 -c "import sys,json
try:
  d=json.load(sys.stdin)
  print(d[0].get('lon',''))
except Exception:
  print('')")

  DISPLAY=$(echo "$NOMI" | python3 -c "import sys,json
try:
  d=json.load(sys.stdin)
  print(d[0].get('display_name',''))
except Exception:
  print('')")

  echo "  -> ${DISPLAY} @ ${LAT},${LON}"

  Q="[out:json][timeout:25];( node(around:100,${LAT},${LON})[\"leisure\"=\"park\"]; way(around:100,${LAT},${LON})[\"leisure\"=\"park\"]; node(around:100,${LAT},${LON})[\"leisure\"=\"nature_reserve\"]; way(around:100,${LAT},${LON})[\"leisure\"=\"nature_reserve\"]; node(around:100,${LAT},${LON})[\"highway\"=\"trailhead\"]; way(around:100,${LAT},${LON})[\"highway\"=\"trailhead\"]; node(around:100,${LAT},${LON})[\"amenity\"=\"park\"]; ); out center;"

  OVER=$(curl -s -X POST -H "Content-Type: text/plain" --data-binary "$Q" "https://overpass.openstreetmap.fr/api/interpreter" || true)
  if [ -z "$OVER" ]; then
    echo "  -> Overpass query failed or returned empty"
    sleep 1
    continue
  fi

  COUNT=$(python3 - <<PY
import sys,json
try:
  d=json.load(sys.stdin)
  print(len(d.get('elements',[])))
except Exception:
  print(0)
PY
  <<<"$OVER")

  if [ "$COUNT" -gt 0 ]; then
    echo "  -> Found $COUNT park/trailhead features nearby"
    python3 - <<PY
import sys,json
try:
  d=json.load(sys.stdin)
  for el in d.get('elements',[])[:5]:
    tags=el.get('tags',{})
    name=tags.get('name','(no name)')
    print('    -', el.get('type'), el.get('id'), name, tags)
except Exception as e:
  print('    - parse error', e)
PY
    <<<"$OVER"
  else
    echo "  -> No park/trailhead features found within 100m"
  fi

  sleep 1
done
