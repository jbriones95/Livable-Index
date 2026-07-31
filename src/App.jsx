import { useState, useCallback, useEffect } from 'react';
import LivabilityMap from "./LivabilityMap";
import Legend from "./Legend";
import AddressSearch from "./AddressSearch";
import WeightEditor from "./WeightEditor";
import { CITIES, OVERLAY_OPTIONS, WEIGHTS as DEFAULT_WEIGHTS, initDataFetching } from "./livabilityData";
import "./App.css";

const ALPHA_CITIES = new Set(['centennial', 'englewood']);
const STORAGE_KEY = 'liv_weights';

function loadWeights() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const values = Object.values(parsed);
      // Migrate old integer-format weights (0-100 scale) to decimals (0-1)
      if (values.length > 0 && values.some(v => v > 1)) {
        const total = values.reduce((s, v) => s + v, 0);
        const result = {};
        for (const [k, v] of Object.entries(parsed)) {
          result[k] = v / total;
        }
        return result;
      }
      return parsed;
    }
  } catch {
    // Ignore malformed saved state and fall back to defaults.
  }
  return { ...DEFAULT_WEIGHTS };
}

export default function App() {
  const [locate, setLocate] = useState(null);
  const [cityKey, setCityKey] = useState('littleton');
  const [overlayMetric, setOverlayMetric] = useState('composite');
  const [weights, setWeights] = useState(loadWeights);
  const [showWeights, setShowWeights] = useState(false);
  const cityLabel = CITIES[cityKey]?.label || 'Littleton';

  // Kick off background data fetches as early as possible
  useEffect(() => { initDataFetching(cityKey); }, [cityKey]);

  const handleWeightsChange = useCallback((next) => {
    setWeights(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage write failures.
    }
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>Livable Index</h1>
          <p className="subtitle">
            {cityLabel}, CO — Urban Livability Explorer
            {ALPHA_CITIES.has(cityKey) && <span className="alpha-badge">ALPHA</span>}
          </p>
        </div>
        <div className="header-right">
          <label className="overlay-select" htmlFor="city-select">
            <span>City</span>
            <select
              id="city-select"
              value={cityKey}
              onChange={(e) => {
                setCityKey(e.target.value);
                setLocate(null);
              }}
            >
              {Object.entries(CITIES).map(([key, city]) => (
                <option key={key} value={key}>
                  {city.label}
                </option>
              ))}
            </select>
          </label>
          <label className="overlay-select" htmlFor="overlay-select">
            <span>Overlay</span>
            <select
              id="overlay-select"
              value={overlayMetric}
              onChange={(e) => setOverlayMetric(e.target.value)}
            >
              {OVERLAY_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className={`weights-toggle ${showWeights ? 'active' : ''}`}
            onClick={() => setShowWeights(v => !v)}
            title="Adjust dimension weights"
          >
            Weights
          </button>
          <AddressSearch cityLabel={cityLabel} onLocate={(loc) => setLocate(loc)} />
        </div>
      </header>
      <main className="app-main">
        <LivabilityMap cityKey={cityKey} locate={locate} overlayMetric={overlayMetric} weights={weights} />
        <Legend overlayMetric={overlayMetric} weights={weights} />
        {showWeights && (
          <WeightEditor
            weights={weights}
            onChange={handleWeightsChange}
            onClose={() => setShowWeights(false)}
          />
        )}
      </main>
    </div>
  );
}
