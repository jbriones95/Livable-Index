import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// This config sets the base path for GitHub Pages. When you deploy to
// https://USERNAME.github.io/REPO_NAME/ set the `base` to `/REPO_NAME/`.
// For local development this remains '/'.
// Use relative paths for production builds so the site works when served from
// a subdirectory (GitHub Pages project pages) regardless of absolute path.
// Treat a build lifecycle or NODE_ENV=production as production so the
// Vite `base` is set to a relative path for GitHub Pages deployments.
const isProd = process.env.NODE_ENV === 'production' || process.env.npm_lifecycle_event === 'build';
const base = isProd ? './' : '/';

export default defineConfig({
  base,
  plugins: [react()],
});
