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

## Controls

- Drag to orbit the camera; scroll to zoom.
- Pause/resume with the play button or Space.
- Adjust the orbit radius with the slider. Flight speed is fixed at 1.5×.
- A randomized field of 20 asteroids are always present and pass at a constant speed, ranging from small nearby fragments to large, distant boulders, with occasional natural beam intersections. New spawns independently vary their spacing, lateral positions, sizes, jagged silhouettes, muted stone tones, and tumble rates. Each page load gets a fresh seed; reset replays that field. Distant rocks and a deep starfield remain visible out to thousands of scene units. Instability controls only their gravitational pull: 0% means no attraction; higher settings increase the pull. Collision avoidance remains active at every setting.
- The camera stays centered on the ship throughout orbiting, beam transfers, and asteroid capture. Drag and zoom freely; following preserves your viewing angle and distance. Reset restores the default view around the ship.
- At 100% instability, gravity can overpower the ship’s limited guidance thrust and capture it around an asteroid. Forward travel then eases to a halt; local orbital motion and the recorded trail continue. Lower instability below 35% or reset to continue the journey.
- Toggle the flight trail, or press R to reset the flight settings.
- Reduced-motion preferences start the flight paused.

The spacecraft is a Newtonian test particle: asteroids use a spherical mass approximation with inverse-square gravity outside their bounding spheres, and mass scales with radius cubed: doubling radius gives eight times the pull at the same center-to-center distance. Instability scales gravitational strength globally. Stable guidance anticipates and counters gravity; above 35% that compensation and steering authority progressively weaken. At 100%, random asteroid encounters frequently derail the route. The forecast uses these same forces and steering rules. Position and velocity are integrated using kick–drift–kick steps no larger than 1/240 simulated second. The instability slider scales gravitational strength; it does not change planet visibility, size, or flyby speed. Orbit guidance has finite thrust, so strong encounters can eject the ship from its beam orbit. Avoidance is a separate braking thruster, leaving room for the hull and selected orbit radius; positions are never projected or teleported to enforce clearance.

This is a controlled simulation in illustrative units, not a full N-body model: asteroids have prescribed trajectories and the beam orbit is maintained by thrusters. A bound close encounter switches to a local asteroid reference frame. Forward journey progress stops while the ship's physics continue, and the captured asteroid is retained. The camera follows the ship smoothly. Reset clears the encounter and flight history.

A soft blue line forecasts the next 14 simulated seconds using a separate copy of the same gravity, avoidance, capture, and asteroid spawning logic. Its physics run in a Web Worker to keep rendering smooth. It refreshes as the world moves and immediately when settings or spawned bodies change. The brighter trail records actual world positions, including local orbital motion when forward travel is stopped. Changing radius never reshapes its history. The beam stops at asteroid entry surfaces and resumes beyond their exit surfaces, updating as the irregular rocks tumble. Scene assets are procedural; no model downloads are required. Fonts use Google Fonts with local fallbacks.

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

## Beams, coherence, and trail

Use **+ / −** for 1–10 parallel beams. Three form an equilateral triangle, four a square, and 5–10 form regular polygons when viewed along the beam direction. Adjacent beams stay 8 scene units apart, independent of coherence. The first beam remains anchored at the origin. Two beams retain the figure eight; larger layouts orbit each vertex and smoothly transfer to the next, including the closing edge. Changes steer the ship toward the new route. Reset restores one beam.

**Coherence** controls the orbit width: 0% means radius 7; 100% means radius 0. At 100%, the ship still transfers smoothly between active beams without looping around them. With one beam, it flies straight along it. The default is 43% coherence (radius 3.99) and 0% instability. Refresh and reset synchronize the slider thumbs, labels, and physics to these same defaults.

The mint beams, soft blue forecast, and amber recorded trail are visually distinct. The recorded trail retains the entire session without aging or distance fade; reset/reload clears it. Append-only rendering chunks keep old points intact without rewriting the full trail every frame. Distant history can leave the camera's view, but is not deleted.

The background uses 4,850 stars across three depth layers plus 22 muted, low-poly distant planets. Their parallax follows journey progress and stops during pause or asteroid capture. These distant planets are scenery; passing asteroids remain the gravitational encounter bodies.
