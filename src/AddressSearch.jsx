import { useState } from 'react';

export default function AddressSearch({ onLocate }) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function lookup(e) {
    e.preventDefault();
    setError(null);
    if (!q) return setError('Enter an address');
    setLoading(true);
    try {
      // Use Nominatim (OpenStreetMap) for geocoding
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      if (!data || data.length === 0) {
        setError('Address not found');
      } else {
        const result = data[0];
        onLocate({ lat: parseFloat(result.lat), lng: parseFloat(result.lon), label: result.display_name });
      }
    } catch (err) {
      setError('Geocoding failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="address-search" onSubmit={lookup}>
      <input aria-label="Address" placeholder="Enter address in Littleton, CO" value={q} onChange={(e)=>setQ(e.target.value)} />
      <button type="submit" disabled={loading}>{loading? 'Locating...' : 'Locate'}</button>
      {error && <div className="search-error">{error}</div>}
    </form>
  );
}
