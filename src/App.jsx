import { useState } from 'react';
import LivabilityMap from "./LivabilityMap";
import Legend from "./Legend";
import AddressSearch from "./AddressSearch";
import "./App.css";

export default function App() {
  const [locate, setLocate] = useState(null);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>Livable Index</h1>
          <p className="subtitle">
            Littleton, CO — Urban Livability Explorer
          </p>
        </div>
        <div className="header-right">
          <AddressSearch onLocate={(loc) => setLocate(loc)} />
        </div>
      </header>
      <main className="app-main">
        <LivabilityMap locate={locate} />
        <Legend />
      </main>
    </div>
  );
}
