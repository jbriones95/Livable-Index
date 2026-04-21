import {
  computeScore,
  scoreToColor,
  scoreToGrade,
  scoreToLabel,
  DIMENSION_LABELS,
  WEIGHTS,
} from "./livabilityData";

function DimensionBar({ label, score, weight }) {
  const color =
    score >= 75
      ? "#1a7f2e"
      : score >= 60
      ? "#5ab552"
      : score >= 48
      ? "#c8b020"
      : score >= 35
      ? "#e8a020"
      : "#c0392b";

  return (
    <div className="dimension-row">
      <div className="dimension-header">
        <span className="dimension-label">{label}</span>
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
        <h2 className="zone-name">{zone.name}</h2>
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
          />
        ))}
      </div>

      <div className="methodology-note">
        Scores reflect urbanism priorities: walkability, transit access, bike
        infrastructure, mixed land use, green space, housing density, and street
        connectivity. Higher = more livable from an urbanist lens.
      </div>
    </div>
  );
}
