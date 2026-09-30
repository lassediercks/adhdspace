FROM claude-container:latest

# Shared libraries for Playwright's Chromium browser; runtimes live in mise.toml.
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 libatspi2.0-0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libxi6 \
    libgbm1 libasound2 libxkbcommon0 libcups2 libdbus-1-3 \
    libdrm2 libwayland-server0 \
    && rm -rf /var/lib/apt/lists/*
USER codex
