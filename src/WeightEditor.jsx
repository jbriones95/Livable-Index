import { useState } from 'react';
import { DIMENSION_LABELS, WEIGHTS as DEFAULT_WEIGHTS } from "./livabilityData";

export default function WeightEditor({ weights, onChange, onClose }) {
  const [pending, setPending] = useState(() =>
    Object.fromEntries(
      Object.entries(weights).map(([k, v]) => [k, Math.round(v * 100)])
    )
  );

  function handleSlide(key, raw) {
    const newVal = Math.max(0, Math.min(100, parseInt(raw, 10) || 0));
    setPending(prev => ({ ...prev, [key]: newVal }));
  }

  function handleInput(key, raw) {
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed) || parsed < 0 || parsed > 100) return;
    setPending(prev => ({ ...prev, [key]: parsed }));
  }

  function handleReset() {
    setPending(
      Object.fromEntries(
        Object.entries(DEFAULT_WEIGHTS).map(([k, v]) => [k, Math.round(v * 100)])
      )
    );
  }

  function handleApply() {
    const decimal = {};
    for (const [k, v] of Object.entries(pending)) {
      decimal[k] = v / 100;
    }
    onChange(decimal);
    onClose();
  }

  const total = Object.values(pending).reduce((s, v) => s + v, 0);

  return (
    <div className="weight-editor">
      <div className="weight-editor-header">
        <h3>Adjust Weights</h3>
        <button className="weight-editor-close" onClick={onClose} aria-label="Close">&times;</button>
      </div>
      <p className="weight-editor-hint">
        Set each weight freely. Total must equal <strong>100%</strong> to apply. Current total: <strong>{total}%</strong>
      </p>
      <div className="weight-sliders">
        {Object.entries(DIMENSION_LABELS).map(([key, label]) => (
          <div key={key} className="weight-row">
            <label className="weight-label" htmlFor={`w-${key}`}>{label}</label>
            <div className="weight-control">
              <input
                id={`w-${key}`}
                type="range"
                min="0"
                max="100"
                value={pending[key] ?? 0}
                onChange={e => handleSlide(key, e.target.value)}
                className="weight-slider"
              />
              <input
                type="number"
                min="0"
                max="100"
                value={pending[key] ?? 0}
                onChange={e => handleInput(key, e.target.value)}
                className="weight-input"
              />
            </div>
          </div>
        ))}
      </div>
      <div className="weight-editor-actions">
        <button className="weight-btn weight-btn-reset" onClick={handleReset}>Reset</button>
        <div className="weight-editor-actions-right">
          <button className="weight-btn weight-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="weight-btn weight-btn-apply" onClick={handleApply} disabled={total !== 100}>Apply</button>
        </div>
      </div>
    </div>
  );
}
