// Basemap choices for the livability map. Both use keyless public tile
// services: OpenStreetMap for the street map and Esri World Imagery for aerial.
// The OSM tiles are darkened with CSS (see App.css) so they match the app theme.
export const BASEMAPS = {
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    subdomains: 'abc',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    maxZoom: 19,
  },
};

export const BASEMAP_OPTIONS = [
  { key: 'osm', label: 'Street' },
  { key: 'satellite', label: 'Aerial' },
];
