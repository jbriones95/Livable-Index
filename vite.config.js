import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// This config sets the base path for GitHub Pages. When you deploy to
// https://USERNAME.github.io/REPO_NAME/ set the `base` to `/REPO_NAME/`.
// For local development this remains '/'.
// Default to this repo name so GitHub Pages builds that don't set GH_PAGES_REPO
// still produce correct asset paths. You can override by setting GH_PAGES_REPO env.
const repoName = process.env.GH_PAGES_REPO || 'Livable-Index';
const base = repoName ? `/${repoName.replace(/^\/+/, '')}/` : '/';

export default defineConfig({
  base,
  plugins: [react()],
});
