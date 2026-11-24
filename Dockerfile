FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY src ./src
COPY tests/fixtures/website-direct-player.jsx ./tests/fixtures/website-direct-player.jsx
COPY audio-preview ./audio-preview
RUN node_modules/.bin/vite build --config audio-preview/vite.config.mjs
RUN sh audio-preview/generate.sh
FROM nginx:stable-alpine
COPY audio-preview/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/audio-preview/dist /usr/share/nginx/html
EXPOSE 8080
