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
} from "./livabilityData";
import ScorePanel from "./ScorePanel";

export default function LivabilityMap() {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const geojsonLayer = useRef(null);
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

    return () => {
      map.remove();
      leafletMap.current = null;
    };
  }, []);

  return (
    <div className="map-wrapper">
      <div ref={mapRef} className="leaflet-container-map" />
      {selectedZone && (
        <ScorePanel zone={selectedZone} onClose={() => setSelectedZone(null)} />
      )}
    </div>
  );
}
