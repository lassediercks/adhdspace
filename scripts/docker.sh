#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Different checkouts get independent containers, images, and ports.
project_key="$(pwd -P | cksum | awk '{print $1}')"
container="helix-flight-${project_key}"
mode="${3:-development}"
if [[ "$mode" != development && "$mode" != runtime ]]; then
    echo "Unknown Docker target: $mode" >&2; exit 1
fi
image="helix-flight:${project_key}-${mode}"
owner="helix.checkout=${project_key}"

if ! command -v docker >/dev/null 2>&1; then
    echo 'Docker is required. Install and start Docker, then run just up again.' >&2
    exit 1
fi
if ! docker info >/dev/null 2>&1; then
    echo 'Cannot reach Docker. Start Docker Desktop or your Docker daemon, then retry.' >&2
    exit 1
fi

exists() { docker container inspect "$container" >/dev/null 2>&1; }
assert_owned() {
    local label
    label="$(docker inspect --format '{{ index .Config.Labels "helix.checkout" }}' "$container")"
    if [[ "$label" != "$project_key" ]]; then
        echo "Refusing to modify unrelated container: $container" >&2
        exit 1
    fi
}
show_url() {
    local binding
    binding="$(docker port "$container" 8080/tcp | head -n 1)"
    printf '\n  HELIX is running at http://localhost:%s\n\n' "${binding##*:}"
    printf '  Stop: just down  |  Logs: just logs  |  Status: just status\n\n'
}
build() { docker build --target "$mode" --tag "$image" .; }

case "${1:-up}" in
    up)
        port="${2:-3000}"
        if [[ ! "$port" =~ ^[0-9]{1,5}$ ]]; then
            echo 'Starting port must be a number between 1024 and 65535.' >&2; exit 1
        fi
        port=$((10#$port))
        if (( port < 1024 || port > 65535 )); then
            echo 'Starting port must be between 1024 and 65535.' >&2; exit 1
        fi
        run_options=()
        if [[ "$mode" == development ]]; then
            # Keep image dependencies isolated from host node_modules. The anonymous
            # volume is populated from the new image and removed with the container.
            run_options=(--mount "type=bind,src=$(pwd -P),dst=/app,readonly" --volume /app/node_modules)
        fi
        build
        if exists; then assert_owned; docker rm --force --volumes "$container" >/dev/null; fi
        # Let Docker claim the actual port instead of racing a separate port probe.
        while (( port <= 65535 )); do
            if result="$(docker run --detach --name "$container" --label "$owner" \
                --restart unless-stopped --publish "127.0.0.1:${port}:8080" "${run_options[@]}" "$image" 2>&1)"; then
                ready=false
                for (( attempt=0; attempt<30; attempt++ )); do
                    if docker exec "$container" wget -q -O /dev/null http://127.0.0.1:8080/ 2>/dev/null; then
                        ready=true; break
                    fi
                    sleep 1
                done
                if [[ "$ready" == true ]]; then show_url; exit 0; fi
                echo 'Container started but the web server did not become ready. Run just logs for details.' >&2
                exit 1
            fi
            if exists; then assert_owned; docker rm --force --volumes "$container" >/dev/null; fi
            if [[ "$result" == *'port is already allocated'* || "$result" == *'address already in use'* || "$result" == *'ports are not available'* || "$result" == *'Ports are not available'* ]]; then
                printf 'Port %s is occupied; trying %s…\n' "$port" "$((port+1))"
                port=$((port+1))
            else
                printf '%s\n' "$result" >&2; exit 1
            fi
        done
        echo 'No available host port was found.' >&2; exit 1
        ;;
    down)
        if exists; then assert_owned; docker rm --force --volumes "$container" >/dev/null; echo 'HELIX stopped.'
        else echo 'HELIX is already stopped.'; fi
        ;;
    logs) docker logs --follow "$container" ;;
    status)
        if exists; then
            docker inspect --format 'Container: {{.Name}} | State: {{.State.Status}} | Health: {{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' "$container"
            if [[ "$(docker inspect --format '{{.State.Running}}' "$container")" == true ]]; then show_url; fi
        else echo 'HELIX is not running. Start it with just up.'; fi
        ;;
    build) mode=runtime; image="helix-flight:${project_key}-${mode}"; build ;;
    *) echo 'Usage: scripts/docker.sh {up [starting-port]|down|logs|status|build}' >&2; exit 1 ;;
esac
