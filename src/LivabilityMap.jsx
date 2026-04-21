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
  computeScoreAtPoint,
  isPointInCity,
} from "./livabilityData";
import { point as turfPoint, booleanPointInPolygon, centroid as turfCentroid, distance as turfDistance } from "@turf/turf";
import { featureCollection as turfFeatureCollection } from '@turf/turf';
import ScorePanel from "./ScorePanel";

export default function LivabilityMap({ locate }) {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const geojsonLayer = useRef(null);
  const markerRef = useRef(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [clickPos, setClickPos] = useState(null);
  const [computing, setComputing] = useState(false);
  const lastComputeTs = useRef(0);

  useEffect(() => {
    if (leafletMap.current) return; // already initialized
    console.log('[LivabilityMap] initializing map');
    // create a persistent debug badge in the page body to help diagnose lifecycle
    let debugBadge = document.getElementById('__liv_map_debug');
    if (!debugBadge) {
      debugBadge = document.createElement('div');
      debugBadge.id = '__liv_map_debug';
      debugBadge.style.position = 'fixed';
      debugBadge.style.left = '12px';
      debugBadge.style.bottom = '12px';
      debugBadge.style.zIndex = 999999;
      debugBadge.style.background = 'rgba(0,0,0,0.6)';
      debugBadge.style.color = '#fff';
      debugBadge.style.padding = '8px 10px';
      debugBadge.style.borderRadius = '8px';
      debugBadge.style.fontSize = '12px';
      debugBadge.style.fontFamily = 'monospace';
      debugBadge.textContent = 'map: initializing';
      document.body.appendChild(debugBadge);
    } else {
      debugBadge.textContent = 'map: initializing';
    }

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

    // Do not render the heavy grid client-side. Instead the map listens for clicks
    // and we compute the score at the clicked point on demand.
    geojsonLayer.current = null;

    map.on('click', async (e) => {
      // compute score for clicked point
      const { lat, lng } = e.latlng;
      // debounce: ignore clicks fired within 900ms of previous compute
      const now = Date.now();
      if (now - lastComputeTs.current < 900) {
        try { document.getElementById('__liv_map_debug').textContent = 'debounced'; } catch (e) {}
        return;
      }
      lastComputeTs.current = now;
      if (computing) return; // safety
      setComputing(true);
      // only allow clicks within Littleton city limit approximation
      try {
        const allowed = isPointInCity(lat, lng);
        if (!allowed) {
          try { document.getElementById('__liv_map_debug').textContent = 'outside city limits'; } catch (e) {}
          setSelectedZone(null);
          return;
        }
      } catch (err) {
        console.warn('isPointInCity check failed', err);
      }
      try {
        document.getElementById('__liv_map_debug')?.setAttribute('data-last', 'computing');
      } catch (err) {}
      const result = await computeScoreAtPoint(lat, lng).catch((err) => {
        console.error('computeScoreAtPoint failed', err);
        return null;
      });
      if (!result) {
        // show a small user-facing error in the debug badge
        try { document.getElementById('__liv_map_debug').textContent = 'map: error fetching OSM'; } catch (e) {}
        setComputing(false);
        return;
      }
      setSelectedZone(result);
      setClickPos({ lat, lng });
      setComputing(false);
      // place marker
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
        if (!markerRef.current._map) markerRef.current.addTo(map);
      }
    });

    // Click on map outside zones clears selection handled above via computeScoreAtPoint

    // create a marker but don't add yet
    markerRef.current = L.circleMarker(MAP_CENTER, { radius: 8, color: '#ffffff', weight:2, fillColor: '#2a9df4', fillOpacity: 0.9 });

    // fetch city boundary relation from OSM and draw it (optional)
    (async () => {
      try {
        // query OSM for Littleton admin boundary (by name and admin_level 8). This is a best-effort fetch.
        const name = encodeURIComponent('Littleton');
        const q = `https://nominatim.openstreetmap.org/search.php?q=${name}+CO&polygon_geojson=1&format=json&limit=1`;
        const r = await fetch(q);
        if (!r.ok) return;
        const dat = await r.json();
        if (!dat || dat.length === 0) return;
        const geo = dat[0].geojson;
        if (!geo) return;
        const layer = L.geoJSON(geo, { style: { color: '#2a6', weight: 2, fillOpacity: 0.02 } }).addTo(map);
        // store for debug
        window.__liv_city_boundary = layer;
      } catch (err) {
        console.warn('Failed to fetch city boundary', err);
      }
    })();

    // indicate map ready
    try { document.getElementById('__liv_map_debug').textContent = 'map: ready'; } catch (e) {}

    return () => {
      console.log('[LivabilityMap] cleanup: removing map');
      try { document.getElementById('__liv_map_debug').textContent = 'map: cleanup'; } catch (e) {}
      try { map.remove(); } catch (err) { console.error('Error removing map', err); }
      leafletMap.current = null;
      try { document.getElementById('__liv_map_debug').textContent = 'map: removed'; } catch (e) {}
    };
  }, []);

  // respond to external locate requests: { lat, lng, label }
  useEffect(() => {
    if (!locate || !leafletMap.current) return;
    const { lat, lng, label } = locate;
    const map = leafletMap.current;

    // optionally prevent locating outside city
    try {
      if (!isPointInCity(lat, lng)) {
        try { document.getElementById('__liv_map_debug').textContent = 'search: outside city limits'; } catch (e) {}
        setSelectedZone(null);
        return;
      }
    } catch (err) {
      console.warn('isPointInCity failed during locate', err);
    }

    // pan to location
    map.setView([lat, lng], Math.max(map.getZoom(), 14), { animate: true });

    // place marker
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      if (!markerRef.current._map) markerRef.current.addTo(map);
    }

    // compute score using OSM at the locate point
    (async () => {
      try {
        document.getElementById('__liv_map_debug')?.setAttribute('data-last', 'computing-locate');
      } catch (e) {}
      setComputing(true);
      const result = await computeScoreAtPoint(lat, lng).catch((err) => {
        console.error('computeScoreAtPoint failed for locate', err);
        return null;
      });
      if (!result) {
        try { document.getElementById('__liv_map_debug').textContent = 'search: error fetching OSM'; } catch (e) {}
        setComputing(false);
        return;
      }
      setSelectedZone(result);
      setClickPos({ lat, lng });
      setComputing(false);
    })();

  }, [locate]);

  return (
    <div className="map-wrapper">
      <div ref={mapRef} className="leaflet-container-map" />
      {computing && (
        <div className="map-loading-overlay" aria-hidden>
          <div className="map-spinner" />
          <div className="map-loading-text">Computing score...</div>
        </div>
      )}
      {selectedZone && (
        <ScorePanel zone={selectedZone} onClose={() => setSelectedZone(null)} />
      )}
    </div>
  );
}
