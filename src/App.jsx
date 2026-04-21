import LivabilityMap from "./LivabilityMap";
import Legend from "./Legend";
import "./App.css";

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>Livable Index</h1>
          <p className="subtitle">
            Littleton, CO &mdash; Urban Livability Explorer
          </p>
        </div>
        <div className="header-hint">Click a zone on the map to see its livability score</div>
      </header>
      <main className="app-main">
        <LivabilityMap />
        <Legend />
      </main>
    </div>
  );
}
