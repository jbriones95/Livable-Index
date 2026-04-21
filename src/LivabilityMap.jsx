import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MAP_CENTER,
  MAP_ZOOM,
  ZONES,
  DIMENSION_LABELS,
  WEIGHTS,
  computeScore,
  scoreToColor,
  scoreToGrade,
  scoreToLabel,
  zoneToGeoJSON,
  getAllZoneFeatures,
} from "./livabilityData";
import { point as turfPoint, booleanPointInPolygon, centroid as turfCentroid, distance as turfDistance } from "@turf/turf";
import ScorePanel from "./ScorePanel";

export default function LivabilityMap({ locate }) {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const geojsonLayer = useRef(null);
  const markerRef = useRef(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [clickPos, setClickPos] = useState(null);

  useEffect(() => {
    if (leafletMap.current) return; // already initialized

    const map = L.map(mapRef.current, {
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      zoomControl: true,
    });
    leafletMap.current = map;

    // OpenStreetMap tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Build GeoJSON features for each zone
    const features = ZONES.map(zoneToGeoJSON);
    const featureCollection = { type: "FeatureCollection", features };

    geojsonLayer.current = L.geoJSON(featureCollection, {
      style: (feature) => {
        const score = feature.properties.composite;
        return {
          fillColor: scoreToColor(score),
          fillOpacity: 0.55,
          color: "#ffffff",
          weight: 2,
          opacity: 0.9,
        };
      },
      onEachFeature: (feature, layer) => {
        layer.on({
          mouseover: (e) => {
            e.target.setStyle({ fillOpacity: 0.75, weight: 3, color: "#333" });
          },
          mouseout: (e) => {
            geojsonLayer.current.resetStyle(e.target);
          },
          click: (e) => {
            L.DomEvent.stopPropagation(e);
            setSelectedZone(feature.properties);
            setClickPos({ lat: e.latlng.lat, lng: e.latlng.lng });
          },
        });
      },
    }).addTo(map);

    // Click on map outside zones clears selection
    map.on("click", () => {
      setSelectedZone(null);
      setClickPos(null);
    });

    // create a marker but don't add yet
    markerRef.current = L.circleMarker(MAP_CENTER, { radius: 8, color: '#ffffff', weight:2, fillColor: '#2a9df4', fillOpacity: 0.9 });

    return () => {
      map.remove();
      leafletMap.current = null;
    };
  }, []);

  // respond to external locate requests: { lat, lng, label }
  useEffect(() => {
    if (!locate || !leafletMap.current || !geojsonLayer.current) return;
    const { lat, lng, label } = locate;
    const map = leafletMap.current;

    // pan to location
    map.setView([lat, lng], Math.max(map.getZoom(), 14), { animate: true });

    // place marker
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      if (!markerRef.current._map) markerRef.current.addTo(map);
    }

    // find containing zone
    const pt = turfPoint([lng, lat]);
    const features = getAllZoneFeatures().features;
    let found = null;
    for (const f of features) {
      if (booleanPointInPolygon(pt, f)) {
        found = f;
        break;
      }
    }

    if (!found) {
      // fallback: nearest feature by centroid distance
      let nearest = null;
      let minDist = Infinity;
      for (const f of features) {
        const c = turfCentroid(f);
        const d = turfDistance(pt, c);
        if (d < minDist) { minDist = d; nearest = f; }
      }
      found = nearest;
      if (found) {
        found.properties.notes = (found.properties.notes || '') + `\n(Nearest zone — point not inside any zone)`;
      }
    }

    if (found) {
      setSelectedZone(found.properties);
      setClickPos({ lat, lng });
    }

  }, [locate]);

  return (
    <div className="map-wrapper">
      <div ref={mapRef} className="leaflet-container-map" />
      {selectedZone && (
        <ScorePanel zone={selectedZone} onClose={() => setSelectedZone(null)} />
      )}
    </div>
  );
}
