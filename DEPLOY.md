Deploying to GitHub Pages
========================

This project is configured to build with Vite and deploy the `dist` folder to GitHub Pages using the `gh-pages` package.

Prerequisites
- A GitHub repository for this project. Example repository URL: `https://github.com/USERNAME/REPO_NAME`.
- The `gh-pages` devDependency is present in package.json.

Common steps
1. Install dependencies: `npm install`
2. Build the app: `npm run build` (this runs `vite build`)
3. Deploy: `npm run deploy` (this runs `gh-pages -d dist`)

Notes
- The Vite config sets `base` to a relative `./` path for production builds so the site works when served from a repository subpath (GitHub Pages project pages).
- The package.json includes a `homepage` field set to `./` which helps some static asset resolvers.
