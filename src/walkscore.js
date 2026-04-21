/**
 * Wrapper to fetch Walk Score for a point.
 *
 * Preferred: call a server-side proxy that holds the Walk Score API key and returns
 * the Walk Score JSON to avoid exposing the API key in the browser.
 * If no proxy is provided, the function will attempt a direct client-side call
 * using Vite env variable VITE_WALKSCORE_API_KEY (NOT RECOMMENDED for production).
 */

const WALK_SCORE_PROXY = typeof window !== 'undefined' ? window.__WALKSCORE_PROXY : undefined;

export async function getWalkScore(lat, lng) {
  // Try proxy first
  if (WALK_SCORE_PROXY) {
    try {
      const url = new URL(WALK_SCORE_PROXY);
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lon', String(lng));
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('proxy returned non-OK');
      const data = await res.json();
      // expected structure: { walkscore: <0-100>, description: '', logo_url: '', ws_summary: '' }
      return data;
    } catch (err) {
      console.warn('WalkScore proxy failed:', err && err.message);
    }
  }

  // Fallback: direct client-side call using VITE_WALKSCORE_API_KEY (insecure)
  try {
    // Vite exposes variables prefixed with VITE_ via import.meta.env
    const key = import.meta.env?.VITE_WALKSCORE_API_KEY;
    if (!key) return null;
    // Walk Score API endpoint (JSON)
    const url = `https://api.walkscore.com/score?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&wsapikey=${encodeURIComponent(key)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`walkscore returned ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('WalkScore direct call failed:', err && err.message);
    return null;
  }
}
