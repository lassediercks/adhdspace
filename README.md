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

The player model is a compact cel-shaded space station with a central hub, docking ports, and four solar wings. It keeps a fixed attitude while drifting, with no cockpit, directional nose, or engine exhaust.

Stabilizer power starts at 0%, with the ship on beam one and no sideways velocity. Steady forward propulsion carries it straight ahead until asteroid gravity bends the trajectory; zero power supplies no beam guidance or asteroid avoidance. Gravity-induced sideways momentum persists, and lost lock requires Rescue boost. Higher stabilizer power narrows the orbit and protects beam lock; 100% follows the selected beam directly. Beam one is selected at launch and new beams never switch the ship automatically. At 0%, beam guidance shuts off and the ship coasts under gravity rather than orbiting a beam. An empty tank stops scoring and disables the lever; Restart flight resets the run. Stabilizer changes ease over roughly ten seconds, with smooth heading changes and an easing forecast line.

Full engine power burns a full tank in 30 seconds. The first blue station is visible from the start, 552 units ahead, reaching approach range around 40–46 seconds during normal travel. Completed refuels reveal the next station 180 units ahead, aligned with the beam route; missed stations receive replacements at low fuel. Blue glows remain legible at long range. Lower power on approach to dock; charging takes 10 seconds, restores guidance, and consumes the station.

Instability is automatic space weather, shown on the right. It draws fresh cryptographic randomness as flight progresses, following a mean-reverting, bell-shaped process around 50%, with rare pulses to 0% or 100%. Above 60% the indicator is yellow; above 80% it is coral and marked HIGH. Explicit seeds remain available for repeatable tests. High stabilizer power greatly reduces derailment risk but does not eliminate it. The seeded risk process is shared with the forecast. Lost lock persists even when weather calms or stabilizer power is raised; rescue or a completed refuel restores guidance. **Rescue boost** applies finite thrust to return to the primary beam, without teleporting or erasing history.

A new beam appears every 30 seconds of active flight, starting with one and capped at ten. New beams fade and grow into view over four seconds. Each has a seeded 50% chance of diverging as a branch from the followed beam, with its fork 240 scene units ahead. Click a branch to select it early; the ship follows the parent until it reaches the fork. Three form a triangle, four a square, and larger counts form regular polygons. Initial polygon spacing is 8 units, independent of stabilizer power; diverging beams gradually spread apart. The forecast includes upcoming additions.

Asteroids use inverse-square gravity outside their bounding spheres and mass proportional to radius cubed. Position and velocity use kick–drift–kick integration at up to 240 substeps per simulated second. Guidance and collision avoidance are explicit thruster forces. This is an illustrative controlled simulation, not a full N-body model. Asteroid capture stops forward progress until rescue, while local motion continues.

A soft line forecasts 42–90 simulated seconds in a Web Worker using cloned physics, navigation, and spawn state. It holds the currently observed instability constant, rather than knowing future random weather. A predicted docking encounter turns the path blue. Live weather changes revise the path; elevated/high instability colors it yellow/coral, increases visibility, and eases revisions into view faster without snapping. The amber past trail is always visible, never fades with age, and retains the entire flight until reload. Its append-only GPU chunks preserve history without rewriting all prior points every frame. Distant points can leave the camera's view without being deleted. Beams stop at actual asteroid silhouettes and resume behind them.

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

Fuel and current consumption are shown on the left and beside the stabilizer lever. Rescue boost costs 10% of tank capacity and has a 30-second cooldown. Blue refueling stations require stabilizers at 5% or less; charging takes ten seconds, then the station disappears. Raising stabilizers interrupts docking. A station can replenish an empty tank.
