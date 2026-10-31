import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  computeScore,
  computeScoreAtPoint,
  getCityConfig,
  getAllZoneFeaturesAsync,
  getZoomOverlayFeatures,
  getCityBoundaryAsync,
  getNeighborhoodGapFeatures,
  isPointInCity,
  scoreToColor,
  WEIGHTS,
} from "./livabilityData";
import { BASEMAPS } from "./mapStyles";
import { POI_META, poiIconSvg } from "./poiIcons";
import ScorePanel from "./ScorePanel";

const DETAIL_ZOOM = 13;

function getOverlayScore(feature, overlayMetric, weights = WEIGHTS) {
  const props = feature?.properties || {};
  const scores = props.overlayScores || props.scores || {};
  if (overlayMetric === "composite") {
    return computeScore(scores, weights);
  }
  const metricScore = scores[overlayMetric];
  return typeof metricScore === "number" ? metricScore : 0;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function formatPlaceDistance(km) {
  if (typeof km !== "number" || !isFinite(km)) return "";
  if (km < 0.1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(2)} km`;
}

function buildPlaceTooltip(place, meta) {
  const name = place.name ? escapeHtml(place.name) : meta.label;
  const distance = formatPlaceDistance(place.distanceKm);
  const walk = typeof place.walkMin === "number" && place.walkMin > 0
    ? `${place.walkMin} min walk`
    : "";
  const details = [meta.label, distance, walk].filter(Boolean).join(" · ");
  return `<div class="poi-tooltip-name">${name}</div><div class="poi-tooltip-meta">${details}</div>`;
}

export default function LivabilityMap({ cityKey = 'littleton', locate, overlayMetric, weights, focusNeighborhood = '', basemap = 'osm' }) {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const markerRef = useRef(null);
  const overlayLayerRef = useRef(null);
  const gapLayerRef = useRef(null);
  const boundaryLayerRef = useRef(null);
  const highlightLayerRef = useRef(null);
  const poiLayerRef = useRef(null);
  const tileLayerRef = useRef(null);
  const [overlayFeatures, setOverlayFeatures] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [places, setPlaces] = useState([]);
  const [computing, setComputing] = useState(false);
  const [zoom, setZoom] = useState(getCityConfig(cityKey).zoom);
  const cityKeyRef = useRef(cityKey);
  const weightsRef = useRef(weights);
  const computingRef = useRef(false);
  const lastComputeTs = useRef(0);
  const locateIdRef = useRef(0);
  const detailZoom = getCityConfig(cityKey).detailZoom ?? DETAIL_ZOOM;
  const detailActive = zoom >= detailZoom;

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
      zoomControl: false,
      preferCanvas: true,
      worldCopyJump: true,
    });
    leafletMap.current = map;

    // Keep Leaflet in sync when the container changes size (for example when
    // the score panel opens below the map on mobile).
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && mapRef.current) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize({ animate: false });
      });
      resizeObserver.observe(mapRef.current);
    }

    // Keep the map chrome out of the way of the score panel: zoom and scale
    // live in the bottom-right corner and are styled by App.css.
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.scale({
      position: 'bottomright',
      imperial: true,
      metric: true,
      maxWidth: 120,
    }).addTo(map);

    map.on('zoomend', () => {
      setZoom(map.getZoom());
    });

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
      const requestId = ++locateIdRef.current;
      setComputing(true);
      setPlaces([]);
      const activeCityKey = cityKeyRef.current;
      try {
        const allowed = isPointInCity(lat, lng, activeCityKey);
        if (!allowed) {
          if (requestId === locateIdRef.current) {
            setSelectedZone(null);
            setComputing(false);
            if (markerRef.current && markerRef.current._map) {
              markerRef.current.removeFrom(map);
            }
          }
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
      if (requestId !== locateIdRef.current) return; // stale request
      if (leafletMap.current !== map) return; // map was torn down
      if (!result) {
        setComputing(false);
        return;
      }
      setSelectedZone(result);
      setPlaces(result.places || []);
      setComputing(false);
      // place marker
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
        if (!markerRef.current._map) markerRef.current.addTo(map);
      }
    });

    // A pulsing dot marks the location the score panel refers to.
    markerRef.current = L.marker(initialCity.center, {
      icon: L.divIcon({
        className: 'selected-location',
        html: '<span class="selected-location-ring"></span><span class="selected-location-dot"></span>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
      interactive: false,
      keyboard: false,
      zIndexOffset: 1200,
    });

    if (!map.getPane('livability-gap-pane')) {
      map.createPane('livability-gap-pane');
      map.getPane('livability-gap-pane').style.zIndex = '330';
    }
    if (!map.getPane('livability-overlay-pane')) {
      map.createPane('livability-overlay-pane');
      map.getPane('livability-overlay-pane').style.zIndex = '340';
    }
    if (!map.getPane('livability-highlight-pane')) {
      map.createPane('livability-highlight-pane');
      map.getPane('livability-highlight-pane').style.zIndex = '360';
    }
    if (!map.getPane('livability-poi-pane')) {
      map.createPane('livability-poi-pane');
      map.getPane('livability-poi-pane').style.zIndex = '450';
    }

    return () => {
      console.log('[LivabilityMap] cleanup: removing map');
      if (resizeObserver) resizeObserver.disconnect();
      try { map.remove(); } catch (err) { console.error('Error removing map', err); }
      overlayLayerRef.current = null;
      gapLayerRef.current = null;
      boundaryLayerRef.current = null;
      highlightLayerRef.current = null;
      poiLayerRef.current = null;
      tileLayerRef.current = null;
      markerRef.current = null;
      leafletMap.current = null;
    };
  }, []);

  // Swap the basemap without rebuilding the map or losing the current view.
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return undefined;
    const config = BASEMAPS[basemap] || BASEMAPS.osm;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    const layer = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
      // Leaflet always reads options.subdomains, even for URLs without {s}.
      subdomains: config.subdomains || 'abc',
    }).addTo(map);
    tileLayerRef.current = layer;

    map.setMaxZoom(config.maxZoom);
    if (map.getZoom() > config.maxZoom) {
      map.setZoom(config.maxZoom);
    }
    const container = map.getContainer();
    if (container) container.dataset.basemap = basemap;

    return () => {
      if (leafletMap.current === map && tileLayerRef.current === layer) {
        map.removeLayer(layer);
        tileLayerRef.current = null;
      }
    };
  }, [basemap]);

  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;
    locateIdRef.current++;
    const city = getCityConfig(cityKey);
    map.setView(city.center, city.zoom, { animate: false });
    setZoom(city.zoom);
    setSelectedZone(null);
    setPlaces([]);
    setComputing(false);
    setOverlayFeatures(null);
    if (overlayLayerRef.current && map.hasLayer(overlayLayerRef.current)) {
      map.removeLayer(overlayLayerRef.current);
      overlayLayerRef.current = null;
    }
    if (gapLayerRef.current && map.hasLayer(gapLayerRef.current)) {
      map.removeLayer(gapLayerRef.current);
      gapLayerRef.current = null;
    }
    if (boundaryLayerRef.current && map.hasLayer(boundaryLayerRef.current)) {
      map.removeLayer(boundaryLayerRef.current);
      boundaryLayerRef.current = null;
    }
    if (highlightLayerRef.current && map.hasLayer(highlightLayerRef.current)) {
      map.removeLayer(highlightLayerRef.current);
    }
    highlightLayerRef.current = null;
    if (poiLayerRef.current && map.hasLayer(poiLayerRef.current)) {
      map.removeLayer(poiLayerRef.current);
      poiLayerRef.current = null;
    }
    if (markerRef.current) {
      markerRef.current.setLatLng(city.center);
      if (markerRef.current._map) {
        markerRef.current.removeFrom(map);
      }
    }
  }, [cityKey]);

  // Zoom to the selected neighborhood and outline it; clearing the selection
  // returns the map to the full-city view.
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return undefined;
    locateIdRef.current++;
    setSelectedZone(null);
    setPlaces([]);
    setComputing(false);
    if (markerRef.current && markerRef.current._map) {
      markerRef.current.removeFrom(map);
    }
    const city = getCityConfig(cityKey);
    if (!focusNeighborhood) {
      if (highlightLayerRef.current && map.hasLayer(highlightLayerRef.current)) {
        map.removeLayer(highlightLayerRef.current);
      }
      highlightLayerRef.current = null;
      map.setView(city.center, city.zoom, { animate: true });
      return undefined;
    }

    let cancelled = false;
    (async () => {
      const zones = await getAllZoneFeaturesAsync(cityKey).catch(() => null);
      if (cancelled || !zones) return;
      const feature = (zones.features || []).find(
        (f) => f?.properties?.id === focusNeighborhood || f?.properties?.name === focusNeighborhood
      );
      if (!feature) return;
      const bounds = L.geoJSON(feature).getBounds();
      if (!bounds.isValid()) return;
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15, animate: true });
      if (highlightLayerRef.current && map.hasLayer(highlightLayerRef.current)) {
        map.removeLayer(highlightLayerRef.current);
      }
      highlightLayerRef.current = L.geoJSON(feature, {
        pane: 'livability-highlight-pane',
        interactive: false,
        style: {
          color: '#7fe3ff',
          weight: 2.5,
          opacity: 0.95,
          fillColor: '#7fe3ff',
          fillOpacity: 0.06,
        },
      }).addTo(map);
    })();

    return () => {
      cancelled = true;
    };
  }, [focusNeighborhood, cityKey]);

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
        const layer = L.geoJSON(geo, {
          style: {
            color: '#6fd3ff',
            weight: 2,
            opacity: 0.85,
            dashArray: '7 7',
            fillColor: '#6fd3ff',
            fillOpacity: 0.03,
          },
        }).addTo(map);
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
    const map = leafletMap.current;
    // Read the live map zoom so a city switch cannot briefly load the detail
    // grid using the previous city's zoom level.
    const detail = Boolean(map) && map.getZoom() >= (getCityConfig(cityKey).detailZoom ?? DETAIL_ZOOM);
    let cancelled = false;
    (async () => {
      const features = await getZoomOverlayFeatures(cityKey, detail).catch((err) => {
        console.error('Failed to build overlay features', err);
        return null;
      });
      if (!cancelled && features) {
        setOverlayFeatures(features);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cityKey, zoom]);

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
      smoothFactor: 0.8,
      style: (feature) => {
        const score = getOverlayScore(feature, overlayMetric, weights);
        if (detailActive) {
          return {
            color: 'rgba(255,255,255,0.18)',
            weight: 0.6,
            fillColor: scoreToColor(score),
            fillOpacity: 0.55,
          };
        }
        return {
          color: 'rgba(255,255,255,0.08)',
          weight: 0.4,
          fillColor: scoreToColor(score),
          fillOpacity: 0.58,
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
  }, [overlayFeatures, overlayMetric, weights, detailActive]);

  // Fill the gaps between official neighborhood polygons (parks, golf,
  // open space) with a muted city-average colour so the city view has no
  // blank holes.
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return undefined;

    if (gapLayerRef.current) {
      map.removeLayer(gapLayerRef.current);
      gapLayerRef.current = null;
    }
    if (detailActive || !overlayFeatures || !Array.isArray(overlayFeatures.features) || overlayFeatures.features.length <= 1) {
      return undefined;
    }
    const hasNeighborhoodScores = overlayFeatures.features.some(
      (feature) => feature?.properties?.overlayScores || feature?.properties?.scores
    );
    if (!hasNeighborhoodScores) return undefined;

    const scores = overlayFeatures.features
      .map((feature) => getOverlayScore(feature, overlayMetric, weights))
      .filter((score) => typeof score === 'number' && isFinite(score));
    const averageScore = scores.length > 0
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : 50;

    let cancelled = false;
    (async () => {
      const gaps = await getNeighborhoodGapFeatures(cityKey).catch(() => null);
      if (cancelled || !gaps || !Array.isArray(gaps.features) || gaps.features.length === 0) return;
      const layer = L.geoJSON(gaps, {
        pane: 'livability-gap-pane',
        interactive: false,
        style: {
          color: 'transparent',
          weight: 0,
          fillColor: scoreToColor(averageScore),
          fillOpacity: 0.34,
        },
      }).addTo(map);
      gapLayerRef.current = layer;
    })();

    return () => {
      cancelled = true;
      if (gapLayerRef.current && map.hasLayer(gapLayerRef.current)) {
        map.removeLayer(gapLayerRef.current);
      }
      gapLayerRef.current = null;
    };
  }, [cityKey, overlayFeatures, overlayMetric, weights, detailActive]);

  // Small amenity pins around the selected location.
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return undefined;

    if (poiLayerRef.current) {
      map.removeLayer(poiLayerRef.current);
      poiLayerRef.current = null;
    }
    if (!Array.isArray(places) || places.length === 0) return undefined;

    const group = L.layerGroup();
    for (const place of places) {
      const meta = POI_META[place.key];
      if (!meta) continue;
      const lat = Number(place.lat);
      const lng = Number(place.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const marker = L.marker([lat, lng], {
        pane: 'livability-poi-pane',
        icon: L.divIcon({
          className: 'poi-icon-wrap',
          html: `<div class="poi-icon" style="--poi-color:${meta.color}">${poiIconSvg(meta)}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
        riseOnHover: true,
        keyboard: false,
        bubblingMouseEvents: false,
        title: place.name || meta.label,
      });

      marker.bindTooltip(buildPlaceTooltip(place, meta), {
        direction: 'top',
        offset: [0, -13],
        className: 'poi-tooltip',
        opacity: 1,
      });
      group.addLayer(marker);
    }

    group.addTo(map);
    poiLayerRef.current = group;

    return () => {
      if (poiLayerRef.current === group) {
        if (map.hasLayer(group)) map.removeLayer(group);
        poiLayerRef.current = null;
      }
    };
  }, [places]);

  // respond to external locate requests: { lat, lng, label }
  useEffect(() => {
    if (!locate || !leafletMap.current) return undefined;
    const { lat, lng } = locate;
    const map = leafletMap.current;
    const requestId = ++locateIdRef.current;

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
      setSelectedZone(null);
      setPlaces([]);
      setComputing(false);
      if (markerRef.current && markerRef.current._map) {
        markerRef.current.removeFrom(map);
      }
      return undefined;
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
      setComputing(true);
      setPlaces([]);
      const result = await computeScoreAtPoint(lat, lng, { weights, cityKey }).catch((err) => {
        console.error('computeScoreAtPoint failed for locate', err);
        return null;
      });
      if (requestId !== locateIdRef.current) return; // stale
      if (leafletMap.current !== map) return; // map was torn down
      if (!result) {
        setComputing(false);
        return;
      }
      setSelectedZone(result);
      setPlaces(result.places || []);
      setComputing(false);
    })();

    return undefined;
  }, [locate, cityKey, weights]);

  const clearSelection = () => {
    setSelectedZone(null);
    setPlaces([]);
    setComputing(false);
    const map = leafletMap.current;
    if (map && markerRef.current && markerRef.current._map) {
      markerRef.current.removeFrom(map);
    }
  };

  return (
    <div className="map-wrapper">
      <div ref={mapRef} className="leaflet-container-map" />
      <div className="map-top-scrim" aria-hidden />
      {!selectedZone && !computing && (
        <div className="map-hint">
          <span className="map-hint-dot" />
          Click anywhere on the map to score a location
        </div>
      )}
      {computing && (
        <div className="map-loading-overlay" aria-hidden>
          <div className="map-spinner" />
          <div className="map-loading-text">Computing score...</div>
        </div>
      )}
      {selectedZone && (
        <ScorePanel zone={selectedZone} weights={weights} onClose={clearSelection} />
      )}
    </div>
  );
}
