# HELIX

An interactive Three.js spacecraft flying forward in a helical orbit around a luminous beam. Features a low-poly, cel-shaded ship and asteroids, crisp outlines, a starfield, flight trail, and an interactive orbit camera.

## Run in Docker

Install Docker and [just](https://github.com/casey/just), and start the Docker daemon. If you use mise, `mise install` installs the versions of Node and just declared in `mise.toml`.

```sh
just up
```

This builds a development image, starts Vite in Docker with HMR, waits for the server to respond, and prints the URL. It tries **http://localhost:3000**, then 3001, 3002, and so on until Docker successfully binds a port. No host Node installation is needed for Docker usage. The host binding is local to your machine.

```sh
just up 8080  # Start searching at a different port
just status   # Show health and the assigned URL
just logs     # Follow logs; Ctrl+C leaves the app running
just down     # Stop and remove this checkout's container
just build    # Build the production image without starting
just prod     # Serve the production build with Nginx (no HMR)
```

Source files are bind-mounted read-only into the development container. Save CSS to update styles in place; JavaScript and HTML changes automatically reload the page. Polling handles file changes across Docker Desktop mounts. HMR shares the selected HTTP port, so no extra port is needed. Dependencies stay in a separate container volume; after changing package.json or the lockfile, run `just up` again to install them.

Each checkout has its own container name. Running `just up` again rebuilds and replaces that checkout's container. Containers restart with Docker until stopped with `just down`. Both `just up` and `just prod` replace the current container for this checkout.

## Local development

With Node 22 or newer:

```sh
npm ci
npm run dev
```

Or run `just dev`. Vite prints the selected port and automatically tries the next port if its default is occupied. `npm run build` creates the production assets in `dist/`.

## Flight

The flight controls are a vertical **Stabilizer engines** lever and **Rescue boost**. Pull the lever up for stronger stabilization and down to conserve fuel. Drag to orbit the ship-centered camera and scroll to zoom. Reload starts a new flight.

Stabilizer power starts at 43%. Higher stabilizer power narrows the orbit and protects beam lock; 100% follows the beams directly but still transfers between them. Stabilizer changes ease over roughly ten seconds, with smooth heading changes and an easing forecast line.

Instability is automatic space weather, shown on the right. It follows a seeded mean-reverting, bell-shaped process around 50%, with rare pulses to 0% or 100%. High stabilizer power greatly reduces derailment risk but does not eliminate it. The seeded risk process is shared with the forecast. Lost lock persists even when weather calms or stabilizer power is raised. **Rescue boost** applies finite thrust to return to the primary beam, without teleporting or erasing history.

A new beam appears every 30 seconds of active flight, starting with one and capped at ten. Each has a seeded 50% chance of diverging by 2–5 degrees. Flight does not pause: divergence widens the weaving route and increases lock-loss risk. Click a beam to smoothly settle onto that route. Three form a triangle, four a square, and larger counts form regular polygons. Initial polygon spacing is 8 units, independent of stabilizer power; diverging beams gradually spread apart. The forecast includes upcoming additions.

Asteroids use inverse-square gravity outside their bounding spheres and mass proportional to radius cubed. Position and velocity use kick–drift–kick integration at up to 240 substeps per simulated second. Guidance and collision avoidance are explicit thruster forces. This is an illustrative controlled simulation, not a full N-body model. Asteroid capture stops forward progress until rescue, while local motion continues.

A soft blue line forecasts 14–30 simulated seconds in a Web Worker using cloned physics, navigation, weather, and spawn state. The amber past trail is always visible, never fades with age, and retains the entire flight until reload. Its append-only GPU chunks preserve history without rewriting all prior points every frame. Distant points can leave the camera's view without being deleted. Beams stop at actual asteroid silhouettes and resume behind them.

The background has 4,850 stars across three depth layers and 22 muted low-poly distant planets. Their parallax follows journey progress and stops during capture. Distant planets are scenery; passing asteroids provide gravitational encounters. Assets are procedural, with Google Fonts and local font fallbacks.

The force law and flyby behavior follow [NASA's explanation of gravitational acceleration](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/free-falling-objects/) and [gravity-assist mechanics](https://science.nasa.gov/learn/basics-of-space-flight/primer/).

## Validation

```sh
npm test                        # Launcher, port fallback, and flight history tests
npx playwright install chromium # One-time browser download
npm run test:e2e                 # Desktop/mobile controls and CSS/JS/HTML live updates
```

Playwright needs Chromium's system libraries. They are declared in `.claude-container/Dockerfile` for the development container. On another Linux machine, `npx playwright install --with-deps chromium` installs them with administrator access. Browser tests start Vite automatically.

## GitHub Pages

The workflow in `.github/workflows/deploy.yml` tests, builds, and deploys on pushes to `main`, or when run manually from Actions. In repository **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source. The site is served at `https://<username>.github.io/adhdspace/`.

`npm run build:pages` builds `dist/` with the `/adhdspace/` asset prefix, including the prediction worker. To preview this build locally, run `npm run preview -- --mode pages` and visit `/adhdspace/`. Regular builds and `just up` retain the root path for Docker/local use.

Deployment follows the [Vite GitHub Pages guide](https://vite.dev/guide/static-deploy.html#github-pages).

Fuel is shown on the left. High stabilizer power burns more fuel; a rescue boost costs 8% and has a 30-second cooldown, shown on its button. Current fuel use is shown beside the gauge. Mint ring-shaped refueling stations use the same randomized passing field and gravitational model as asteroids. Lower stabilizer power below 40% near a station to deliberately leave the beam and settle into its local orbit. Fuel charges while derailed within the station's servicing range. The station stays nearby until Rescue boost releases it and returns the ship to the primary beam. Running out of fuel loses beam lock; a station can still replenish an empty tank.
