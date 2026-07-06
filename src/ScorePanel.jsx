import {
  scoreToColor,
  scoreToGrade,
  scoreToLabel,
  DIMENSION_LABELS,
  WEIGHTS,
} from "./livabilityData";

function formatDist(km) {
  if (!isFinite(km)) return '';
  if (km < 0.1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(2)} km`;
}

function formatTime(min) {
  if (typeof min !== 'number' || !isFinite(min) || min < 1) return '';
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

function formatMiddle(key, distances, routing) {
  const parts = [];
  if (key === 'nature' && distances) {
    const trail = distances.trail;
    const park = distances.park;
    const trailStr = isFinite(trail) ? `trail ${formatDist(trail)}` : '';
    const parkStr = isFinite(park) ? `park ${formatDist(park)}` : '';
    parts.push([trailStr, parkStr].filter(Boolean).join(', '));
    const rt = routing?.trail;
    if (rt && (rt.walk || rt.bike)) {
      parts.push(`walk ${formatTime(rt.walk)}`);
      parts.push(`bike ${formatTime(rt.bike)}`);
    }
  } else {
    parts.push(formatDist(distances?.[key]));
    const rt = routing?.[key];
    if (rt && (rt.walk || rt.bike)) {
      parts.push(`walk ${formatTime(rt.walk)}`);
      parts.push(`bike ${formatTime(rt.bike)}`);
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

export default function ScorePanel({ zone, onClose }) {
  const composite = zone.composite;
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
          {zone.address && zone.address !== zone.name && (
            <div className="zone-full-address">{zone.address}</div>
          )}
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

      <p className="zone-notes">{zone.notes}</p>

      <h3 className="breakdown-title">Score Breakdown</h3>
      <div className="dimensions">
        {Object.entries(DIMENSION_LABELS).map(([key, label]) => (
          <DimensionBar
            key={key}
            label={label}
            score={zone.scores[key] ?? 0}
            weight={WEIGHTS[key]}
            middle={formatMiddle(key, zone.distances, zone.routing)}
          />
        ))}
      </div>
    </div>
  );
}
