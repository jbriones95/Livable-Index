import { OVERLAY_OPTIONS, scoreToColor, WEIGHTS as DEFAULT_WEIGHTS, DIMENSION_LABELS } from "./livabilityData";

const LEGEND_ITEMS = [
  { min: 75, max: 100, label: "Excellent (75–100)" },
  { min: 60, max: 74, label: "Good (60–74)" },
  { min: 48, max: 59, label: "Moderate (48–59)" },
  { min: 35, max: 47, label: "Poor (35–47)" },
  { min: 0, max: 34, label: "Very Poor (0–34)" },
];

export default function Legend({ overlayMetric = 'composite', weights = DEFAULT_WEIGHTS }) {
  const activeOverlay = OVERLAY_OPTIONS.find((option) => option.key === overlayMetric) || OVERLAY_OPTIONS[0];

  return (
    <div className="legend">
      <h3 className="legend-title">{activeOverlay.label}</h3>
      {LEGEND_ITEMS.map((item) => (
        <div key={item.min} className="legend-item">
          <span
            className="legend-swatch"
            style={{ backgroundColor: scoreToColor(item.min) }}
          />
          <span className="legend-text">{item.label}</span>
        </div>
      ))}
      <div className="legend-dimensions">
        <h4>Weighted Factors</h4>
        <ul>
          {Object.entries(DIMENSION_LABELS).map(([key, label]) => (
            <li key={key}>
              {label} ({Math.round((weights[key] ?? 0) * 100)}%)
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
