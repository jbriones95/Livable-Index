import { scoreToColor, scoreToLabel } from "./livabilityData";

const LEGEND_ITEMS = [
  { min: 75, max: 100, label: "Excellent (75–100)" },
  { min: 60, max: 74, label: "Good (60–74)" },
  { min: 48, max: 59, label: "Moderate (48–59)" },
  { min: 35, max: 47, label: "Poor (35–47)" },
  { min: 0, max: 34, label: "Very Poor (0–34)" },
];

export default function Legend() {
  return (
    <div className="legend">
      <h3 className="legend-title">Livability Score</h3>
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
        <h4>Urbanism Factors</h4>
        <ul>
          <li>Walkability (22%)</li>
          <li>Transit Access (20%)</li>
          <li>Mixed Land Use (18%)</li>
          <li>Bike Infrastructure (13%)</li>
          <li>Housing Density (10%)</li>
          <li>Green Space (10%)</li>
          <li>Street Connectivity (7%)</li>
        </ul>
      </div>
    </div>
  );
}
