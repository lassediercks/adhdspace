# List available commands.
default:
    @just --list

# Start Docker with HMR. Tries port 3000, then 3001, and so on.
up port="3000":
    @bash scripts/docker.sh up "{{port}}"

# Start the production Nginx image without HMR.
prod port="3000":
    @bash scripts/docker.sh up "{{port}}" runtime

# Stop and remove this checkout's container.
down:
    @bash scripts/docker.sh down

# Follow the web server logs (Ctrl+C exits the log stream).
logs:
    @bash scripts/docker.sh logs

# Show container health and the local URL.
status:
    @bash scripts/docker.sh status

# Build the production image without starting a container.
build:
    @bash scripts/docker.sh build

# Run locally without Docker, with Vite's automatic port fallback.
dev:
    npm ci
    npm run dev

# Verify Docker startup, automatic port fallback, and recorded flight history.
test:
    npm test
