import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// This config sets the base path for GitHub Pages. When you deploy to
// https://USERNAME.github.io/REPO_NAME/ set the `base` to `/REPO_NAME/`.
// For local development this remains '/'.
const repoName = process.env.GH_PAGES_REPO || '';
const base = repoName ? `/${repoName.replace(/^\/+/, '')}/` : '/';

export default defineConfig({
  base,
  plugins: [react()],
});
