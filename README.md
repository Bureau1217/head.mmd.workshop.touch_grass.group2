# SATpedia

SATpedia is an interactive artwork that imagines how satellite activity could affect access to information. A scientific satellite selects the Wikipedia article, while up to three nearby commercial satellites are represented as simulated interference that progressively distorts the page.

## How it works

The app gets the visitor's location, retrieves satellite data through a Cloudflare Worker, and tracks satellite positions. Commercial satellites within the visitor's perimeter can trigger visual effects; these are simulations, not real attacks.

Double-click **SATpedia** in the header to open the orbital telemetry overlay. It shows satellite and interference status; choose **Satellite map** there to open the map and related orbital information. Press **Esc** or double-click the title again to close the overlay.

## For contributors

Run the app and `keeptrack-proxy` in separate terminals. Set a valid `KEEPTRACK_KEY` in `keeptrack-proxy/.dev.vars`, then start the Worker:

```powershell
cd ..\keeptrack-proxy
Copy-Item .dev.vars.example .dev.vars
npm ci
npm run dev
```

```powershell
# In the app directory; configure .env to use the local proxy
Copy-Item .env.example .env
npm ci
npm run dev
```

Open <http://localhost:3000>. Never commit `.dev.vars` or API keys. The GitHub Actions workflow deploys the static site to GitHub Pages; the Worker is deployed separately. Checks: `npx nuxi typecheck` and `npm run generate` in the app, `npm test` in `keeptrack-proxy`.

## Credits

- Satellite catalog: [KeepTrack](https://keeptrack.space/).
- Article content: [Wikipedia](https://www.wikipedia.org/).
- Map tiles: [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
- AI tools used during development: Gemini, Claude, and GitHub Copilot.