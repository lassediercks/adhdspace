import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  // GitHub project pages use a subpath; Docker and local builds stay at root.
  base: mode === 'pages' ? '/adhdspace/' : '/',
  server: {
    // Poll bind mounts in Docker, including Docker Desktop/WSL filesystems.
    watch: process.env.DOCKER_WATCH === '1'
      ? { usePolling: true, interval: 150 }
      : undefined,
    // Leave the HMR address automatic: the browser uses the published host port.
  },
}));
