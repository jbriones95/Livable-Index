import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  computeScore,
  computeScoreAtPoint,
  getCityConfig,
  getGridOverlayFeatures,
  getCityBoundaryAsync,
  isPointInCity,
  scoreToColor,
  WEIGHTS,
} from "./livabilityData";
import ScorePanel from "./ScorePanel";

function getOverlayScore(feature, overlayMetric, weights = WEIGHTS) {
  const props = feature?.properties || {};
  const scores = props.overlayScores || props.scores || {};
  if (overlayMetric === "composite") {
    return computeScore(scores, weights);
  }
  const metricScore = scores[overlayMetric];
  return typeof metricScore === "number" ? metricScore : 0;
}

export default function LivabilityMap({ cityKey = 'littleton', locate, overlayMetric, weights }) {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const markerRef = useRef(null);
  const overlayLayerRef = useRef(null);
  const boundaryLayerRef = useRef(null);
  const [overlayFeatures, setOverlayFeatures] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [computing, setComputing] = useState(false);
  const cityKeyRef = useRef(cityKey);
  const weightsRef = useRef(weights);
  const computingRef = useRef(false);
  const lastComputeTs = useRef(0);
  const locateIdRef = useRef(0);

  useEffect(() => { cityKeyRef.current = cityKey; }, [cityKey]);
  useEffect(() => { weightsRef.current = weights; }, [weights]);
  useEffect(() => { computingRef.current = computing; }, [computing]);

  useEffect(() => {
    if (leafletMap.current) return; // already initialized
    console.log('[LivabilityMap] initializing map');
    const initialCity = getCityConfig(cityKeyRef.current);

    const map = L.map(mapRef.current, {
      center: initialCity.center,
      zoom: initialCity.zoom,
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

    map.on('click', async (e) => {
      // compute score for clicked point
      const { lat, lng } = e.latlng;
      // debounce: ignore clicks fired within 900ms of previous compute
      const now = Date.now();
      if (now - lastComputeTs.current < 900) {
        return;
      }
      lastComputeTs.current = now;
      if (computingRef.current) return; // safety
      setComputing(true);
      const activeCityKey = cityKeyRef.current;
      try {
        const allowed = isPointInCity(lat, lng, activeCityKey);
        if (!allowed) {
          setSelectedZone(null);
          setComputing(false);
          return;
        }
      } catch (err) {
        console.warn('isPointInCity check failed', err);
      }
      const result = await computeScoreAtPoint(lat, lng, {
        weights: weightsRef.current,
        cityKey: activeCityKey,
      }).catch((err) => {
        console.error('computeScoreAtPoint failed', err);
        return null;
      });
      if (!result) {
        setComputing(false);
        return;
      }
      setSelectedZone(result);
      setComputing(false);
      // place marker
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
        if (!markerRef.current._map) markerRef.current.addTo(map);
      }
    });

    // Click on map outside zones clears selection handled above via computeScoreAtPoint

    // create a marker but don't add yet
    markerRef.current = L.circleMarker(initialCity.center, { radius: 8, color: '#ffffff', weight:2, fillColor: '#2a9df4', fillOpacity: 0.9 });

    if (!map.getPane('livability-overlay-pane')) {
      map.createPane('livability-overlay-pane');
      map.getPane('livability-overlay-pane').style.zIndex = '340';
    }

    return () => {
      console.log('[LivabilityMap] cleanup: removing map');
      try { map.remove(); } catch (err) { console.error('Error removing map', err); }
      overlayLayerRef.current = null;
      leafletMap.current = null;
    };
  }, []);

  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;
    const city = getCityConfig(cityKey);
    map.setView(city.center, city.zoom, { animate: false });
    setSelectedZone(null);
    setOverlayFeatures(null);
    if (overlayLayerRef.current && map.hasLayer(overlayLayerRef.current)) {
      map.removeLayer(overlayLayerRef.current);
      overlayLayerRef.current = null;
    }
    if (boundaryLayerRef.current && map.hasLayer(boundaryLayerRef.current)) {
      map.removeLayer(boundaryLayerRef.current);
      boundaryLayerRef.current = null;
    }
    if (markerRef.current) {
      markerRef.current.setLatLng(city.center);
      if (markerRef.current._map) {
        markerRef.current.removeFrom(map);
      }
    }
  }, [cityKey]);

  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;
    let cancelled = false;
    (async () => {
      try {
        const geo = await getCityBoundaryAsync(cityKey).catch(() => null);
        if (cancelled || !geo) return;
        if (boundaryLayerRef.current && map.hasLayer(boundaryLayerRef.current)) {
          map.removeLayer(boundaryLayerRef.current);
        }
        const layer = L.geoJSON(geo, { style: { color: '#2a6', weight: 2, fillOpacity: 0.02 } }).addTo(map);
        boundaryLayerRef.current = layer;
        window.__liv_city_boundary_layers_by_city = window.__liv_city_boundary_layers_by_city || {};
        window.__liv_city_boundary_layers_by_city[cityKey] = layer;
      } catch (err) {
        console.warn('Failed to fetch city boundary', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cityKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const features = await getGridOverlayFeatures(cityKey).catch((err) => {
        console.error('Failed to build grid overlay features', err);
        return null;
      });
      if (!cancelled && features) {
        setOverlayFeatures(features);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cityKey]);

  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !overlayFeatures) return;

    if (overlayLayerRef.current) {
      map.removeLayer(overlayLayerRef.current);
      overlayLayerRef.current = null;
    }

    const layer = L.geoJSON(overlayFeatures, {
      pane: 'livability-overlay-pane',
      interactive: false,
      style: (feature) => {
        const score = getOverlayScore(feature, overlayMetric, weights);
        return {
          color: scoreToColor(score),
          weight: 0,
          fillColor: scoreToColor(score),
          fillOpacity: 0.6,
        };
      },
    }).addTo(map);

    overlayLayerRef.current = layer;

    return () => {
      if (overlayLayerRef.current === layer && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
      if (overlayLayerRef.current === layer) {
        overlayLayerRef.current = null;
      }
    };
  }, [overlayFeatures, overlayMetric, weights]);

  // respond to external locate requests: { lat, lng, label }
  useEffect(() => {
    if (!locate || !leafletMap.current) return;
    const { lat, lng } = locate;
    const map = leafletMap.current;
    let clearSelectionTimer = null;

    // optionally prevent locating outside city
    let outsideCity = false;
    try {
      if (!isPointInCity(lat, lng, cityKey)) {
        outsideCity = true;
      }
    } catch (err) {
      console.warn('isPointInCity failed during locate', err);
    }
    if (outsideCity) {
      clearSelectionTimer = window.setTimeout(() => {
        setSelectedZone(null);
      }, 0);
      return () => {
        if (clearSelectionTimer !== null) {
          window.clearTimeout(clearSelectionTimer);
        }
      };
    }

    // pan to location
    map.setView([lat, lng], Math.max(map.getZoom(), 14), { animate: true });

    // place marker
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      if (!markerRef.current._map) markerRef.current.addTo(map);
    }

    // compute score using OSM at the locate point
    const thisId = ++locateIdRef.current;
    (async () => {
      setComputing(true);
      const result = await computeScoreAtPoint(lat, lng, { weights, cityKey }).catch((err) => {
        console.error('computeScoreAtPoint failed for locate', err);
        return null;
      });
      if (thisId !== locateIdRef.current) return; // stale
      if (!result) {
        setComputing(false);
        return;
      }
      setSelectedZone(result);
      setComputing(false);
    })();

    return () => {
      if (clearSelectionTimer !== null) {
        window.clearTimeout(clearSelectionTimer);
      }
    };

  }, [locate, cityKey, weights]);

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
        <ScorePanel zone={selectedZone} weights={weights} onClose={() => setSelectedZone(null)} />
      )}
    </div>
  );
}
