FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# Pinned standalone asset: no changes to the app package lock or native apps.
FROM node:22-alpine AS decoder-lab
RUN apk add --no-cache ffmpeg
WORKDIR /lab
RUN npm pack --ignore-scripts movi-player@0.4.1 && tar -xzf movi-player-0.4.1.tgz && mkdir -p /assets/vendor /assets/samples && cp -R package/dist/. /assets/vendor/ && cp package/LICENSE* /assets/vendor/
RUN set -eux; \
    for pair in aac:mp4 ac3:mkv eac3:mkv dca:mkv; do \
      codec="${pair%:*}"; ext="${pair#*:}"; name="$codec"; \
      if [ "$codec" = dca ]; then name=dts; fi; \
      ffmpeg -hide_banner -loglevel error -y -f lavfi -i testsrc2=size=320x180:rate=24 -f lavfi -i sine=frequency=440:sample_rate=48000 -t 12 -c:v libx264 -pix_fmt yuv420p -c:a "$codec" -strict -2 -ac 2 -b:a 192k "/assets/samples/$name.$ext"; \
    done

FROM nginx:stable-alpine
COPY deploy/media-god-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=decoder-lab /assets/ /usr/share/nginx/html/decoder-lab/
EXPOSE 8080
