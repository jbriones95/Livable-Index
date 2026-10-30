import {
  scoreToColor,
  scoreToGrade,
  scoreToLabel,
  computeScore,
  DIMENSION_LABELS,
  WEIGHTS as DEFAULT_WEIGHTS,
} from "./livabilityData";
import { POI_META, poiIconSvg } from "./poiIcons";

function formatDist(km) {
  if (typeof km !== 'number' || !isFinite(km)) return '';
  if (km < 0.1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(2)} km`;
}

function formatTime(min) {
  if (typeof min !== 'number' || !isFinite(min) || min <= 0) return '';
  if (min < 1) return '<1 min';
  if (min < 60) return `${Math.round(min)} min`;
  const hours = Math.floor(min / 60);
  const mins = Math.round(min % 60);
  if (mins === 60) return `${hours + 1}h`;
  return `${hours}h ${mins}m`;
}

function formatDistWithMode(km, estimated) {
  const formatted = formatDist(km);
  if (!formatted) return '';
  return estimated ? `${formatted} (est.)` : formatted;
}

function formatMiddle(key, distances, routing, estimated = {}, estimatedBike = {}) {
  const parts = [];
  if (key === 'nature' && distances) {
    const trail = distances.trail;
    const park = distances.park;
    const trailStr = isFinite(trail) ? `trail ${formatDistWithMode(trail, estimated.trail)}` : '';
    const parkStr = isFinite(park) ? `park ${formatDistWithMode(park, estimated.park)}` : '';
    parts.push([trailStr, parkStr].filter(Boolean).join(', '));
    const rt = routing?.nature;
    if (rt) {
      const natureKey = (isFinite(trail) && (!isFinite(park) || trail <= park)) ? 'trail' : 'park';
      const walkTime = formatTime(rt.walk);
      const bikeTime = formatTime(rt.bike);
      if (walkTime) parts.push(`walk ${walkTime}`);
      if (bikeTime) {
        parts.push(`bike ${bikeTime}${estimatedBike[natureKey] && !estimated[natureKey] ? ' (est.)' : ''}`);
      }
    }
  } else {
    const dist = distances?.[key];
    parts.push(isFinite(dist) ? formatDistWithMode(dist, estimated[key]) : 'N/A');
    const rt = routing?.[key];
    if (rt) {
      const walkTime = formatTime(rt.walk);
      const bikeTime = formatTime(rt.bike);
      if (walkTime) parts.push(`walk ${walkTime}`);
      if (bikeTime) {
        parts.push(`bike ${bikeTime}${estimatedBike[key] && !estimated[key] ? ' (est.)' : ''}`);
      }
    }
  }
  return parts.filter(Boolean).join(' · ');
}

function DimensionBar({ label, score, weight, middle }) {
  const color = scoreToColor(score);

  return (
    <div className="dimension-row">
      <div className="dimension-header">
        <span className="dimension-label">{label}</span>
        <span className="dimension-middle">{middle}</span>
        <span className="dimension-score">{score}</span>
      </div>
      <div className="dimension-bar-bg">
        <div
          className="dimension-bar-fill"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <div className="dimension-weight">Weight: {Math.round(weight * 100)}%</div>
    </div>
  );
}

export default function ScorePanel({ zone, weights, onClose }) {
  const activeWeights = weights || DEFAULT_WEIGHTS;
  const composite = computeScore(zone.scores, activeWeights);
  const grade = scoreToGrade(composite);
  const label = scoreToLabel(composite);
  const color = scoreToColor(composite);

  return (
    <div className="score-panel">
      <button className="close-btn" onClick={onClose} aria-label="Close">
        ×
      </button>

      <div className="panel-header">
        <div className="zone-name">
          <span className="zone-address">{zone.name}</span>
          {zone.neighborhood && (
            <span className="zone-neighborhood">{zone.neighborhood}</span>
          )}
        </div>
        <div className="composite-score" style={{ borderColor: color }}>
          <span className="score-number" style={{ color }}>
            {composite}
          </span>
          <span className="score-grade" style={{ color }}>
            {grade}
          </span>
          <span className="score-label">{label}</span>
        </div>
      </div>

      {zone.notes && <p className="zone-notes">{zone.notes}</p>}

      <h3 className="breakdown-title">Score Breakdown</h3>
      <div className="dimensions">
        {Object.entries(DIMENSION_LABELS).map(([key, label]) => (
          <DimensionBar
            key={key}
            label={label}
            score={zone.scores[key] ?? 0}
            weight={activeWeights[key]}
            middle={formatMiddle(key, zone.distances, zone.routing, zone.estimatedDistances, zone.estimatedBikeDistances)}
          />
        ))}
      </div>

      {Array.isArray(zone.places) && zone.places.length > 0 && (
        <>
          <h3 className="breakdown-title nearby-title">Nearby Places</h3>
          <ul className="nearby-places">
            {zone.places.map((place) => {
              const meta = POI_META[place.key];
              if (!meta) return null;
              const distance = formatDist(place.distanceKm);
              const distanceLabel = distance && place.estimated ? `${distance} (est.)` : distance;
              const walkTime = formatTime(place.walkMin);
              const walk = walkTime ? `${walkTime} walk` : '';
              const details = [meta.label, distanceLabel, walk].filter(Boolean).join(' · ');
              return (
                <li key={place.key} className="nearby-place">
                  <span
                    className="nearby-place-icon"
                    style={{ backgroundColor: meta.color }}
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{ __html: poiIconSvg(meta) }}
                  />
                  <span className="nearby-place-text">
                    <span className="nearby-place-name">{place.name || meta.label}</span>
                    <span className="nearby-place-meta">{details}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
