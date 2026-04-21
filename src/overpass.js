// Minimal Overpass client to fetch nodes and ways within a bbox
// bbox = [west, south, east, north]
export async function fetchOSM(bbox) {
  const [w, s, e, n] = bbox;
  // Overpass QL: fetch nodes and ways for common POI categories
  const q = `
[out:json][timeout:25];
(
  node["amenity"](${s},${w},${n},${e});
  way["amenity"](${s},${w},${n},${e});

  node["shop"](${s},${w},${n},${e});
  way["shop"](${s},${w},${n},${e});

  node["leisure"](${s},${w},${n},${e});
  way["leisure"](${s},${w},${n},${e});

  node["tourism"](${s},${w},${n},${e});
  way["tourism"](${s},${w},${n},${e});

  node["public_transport"](${s},${w},${n},${e});
  way["public_transport"](${s},${w},${n},${e});

  node["highway"="bus_stop"](${s},${w},${n},${e});
  node["railway"="station"](${s},${w},${n},${e});
  way["railway"="station"](${s},${w},${n},${e});
  way["cycleway"](${s},${w},${n},${e});
  way["building"](${s},${w},${n},${e});
  // include highway/path features (footways, paths, pedestrian zones) to assess walking infrastructure
  node["highway"](${s},${w},${n},${e});
  way["highway"](${s},${w},${n},${e});
);
out center;`; // ways will have a center

  const url = 'https://overpass-api.de/api/interpreter';
  try {
    const res = await fetch(url, { method: 'POST', body: q, headers: {'Content-Type': 'text/plain'} });
    if (!res.ok) {
      console.warn('Overpass returned non-OK:', res.status, res.statusText);
      return [];
    }
    const data = await res.json();
    return data.elements || [];
  } catch (err) {
    // Network errors, CORS, or timeouts may occur in browsers. Return empty array and
    // let callers handle fallback behavior.
    console.warn('Overpass fetch failed:', err && err.message);
    return [];
  }
}
