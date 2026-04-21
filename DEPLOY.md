Deploying to GitHub Pages
================================

These steps add a minimal configuration to deploy the site to GitHub Pages using gh-pages.

1) Create a repository on GitHub and push this project to it.

2) Set the environment variable GH_PAGES_REPO to your repository name (optional but recommended).
   Example (macOS / Linux):
     export GH_PAGES_REPO=your-repo-name

   If you do not set GH_PAGES_REPO, the Vite base path defaults to '/'. For GitHub Pages you
   usually want the base to be '/REPO_NAME/'. The vite.config.js reads GH_PAGES_REPO.

3) Install deps (if not already):
     npm install

4) Deploy:
     npm run deploy

   The deploy script uses gh-pages to publish the contents of the dist folder to the
   gh-pages branch. GitHub Pages will serve the site at:
     https://USERNAME.github.io/REPO_NAME/

Notes & troubleshooting
- If your repository name contains slashes or a path, set GH_PAGES_REPO to the final repo
  segment only (e.g. my-repo).
- If the site 404s after deploy, check the repository Pages settings and make sure GitHub
  Pages is configured to serve from the gh-pages branch (gh-pages) and the correct folder (/).
- Alternatively you can set the `base` field in vite.config.js manually to '/REPO_NAME/'.
