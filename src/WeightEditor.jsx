import { useState } from 'react';
import { DIMENSION_LABELS, WEIGHTS as DEFAULT_WEIGHTS } from "./livabilityData";

function normalizeWeights(next) {
  const others = Object.keys(next);
  const total = Object.values(next).reduce((s, v) => s + v, 0);
  if (total !== 100 && others.length > 0) {
    const sorted = others.sort((a, b) => next[b] - next[a]);
    next[sorted[0]] += 100 - total;
  }
  return next;
}

export default function WeightEditor({ weights, onChange, onClose }) {
  const [pending, setPending] = useState(() =>
    Object.fromEntries(
      Object.entries(weights).map(([k, v]) => [k, Math.round(v * 100)])
    )
  );

  function handleSlide(key, raw) {
    const newVal = Math.max(0, Math.min(100, parseInt(raw, 10) || 0));

    setPending(prev => {
      const others = Object.keys(prev).filter(k => k !== key);
      const otherTotal = others.reduce((s, k) => s + prev[k], 0);
      const next = { ...prev, [key]: newVal };

      if (others.length > 0) {
        const remaining = 100 - newVal;
        if (otherTotal > 0) {
          for (const k of others) {
            next[k] = Math.round((prev[k] / otherTotal) * remaining);
          }
        } else {
          const each = Math.floor(remaining / others.length);
          const rem = remaining - each * others.length;
          for (let i = 0; i < others.length; i++) {
            next[others[i]] = each + (i < rem ? 1 : 0);
          }
        }
      }

      return normalizeWeights(next);
    });
  }

  function handleInput(key, raw) {
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed) || parsed < 0 || parsed > 100) return;
    handleSlide(key, raw);
  }

  function handleReset() {
    setPending(
      Object.fromEntries(
        Object.entries(DEFAULT_WEIGHTS).map(([k, v]) => [k, Math.round(v * 100)])
      )
    );
  }

  function handleApply() {
    const normalized = normalizeWeights({ ...pending });
    const decimal = {};
    for (const [k, v] of Object.entries(normalized)) {
      decimal[k] = v / 100;
    }
    onChange(decimal);
    onClose();
  }

  const total = Object.values(pending).reduce((s, v) => s + v, 0);
  const isUnchanged = Object.entries(weights).every(([k, v]) =>
    (pending[k] ?? 0) === Math.round(v * 100)
  );

  return (
    <div className="weight-editor">
      <div className="weight-editor-header">
        <h3>Adjust Weights</h3>
        <button className="weight-editor-close" onClick={onClose} aria-label="Close">&times;</button>
      </div>
      <p className="weight-editor-hint">
        Drag sliders to set the importance of each factor. Total: <strong>{total}%</strong>
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
          <button className="weight-btn weight-btn-apply" onClick={handleApply} disabled={isUnchanged}>Apply</button>
        </div>
      </div>
    </div>
  );
}
