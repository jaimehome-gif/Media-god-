# StreamVibe (Media-god) — Base44 dev notes

## Stack
- Next.js 16 (App Router) + React 19, Tailwind v4, pnpm 9.
- `better-auth` for auth; `drizzle-orm` + Postgres for data.
- TMDB metadata in `lib/tmdb.ts` is **mock data** — the app boots with no API key. `src/lib/movie-api.ts` reads `NEXT_PUBLIC_MOVIE_API_KEY` but is not imported by any route.

## Running in Base44
- `docker compose -f docker-compose.base44.yml up -d --build`
- Postgres runs as a `db` service; schema is auto-created from `.base44/schema.sql` on first boot (mirrors `lib/db/schema.ts`).
- `DATABASE_URL` is wired so `better-auth` is active (sign-in/sign-up call `auth.api` directly and crash without a DB).
- The web service bind-mounts the repo and runs `next dev` with watcher polling (`WATCHPACK_POLLING=true`) for bind-mount live reload.
- `next.config.mjs` appends the preview origin to `allowedDevOrigins` only when `BASE44_PREVIEW_MODE === '1'`, so dev assets/HMR load inside the preview iframe.

## Verifying
- Home (`/`) renders mock movie/TV rows.
- `/live-tv` lists channels; each links to `/live-tv/{id}` which now renders a live HLS player + EPG. `/live-tv/international` shows all channels.
- The player uses `hls.js` with a public Apple bipbop test stream as the live source.

## Notes
- Secrets `TMDB_API_KEY`, `REAL_DEBRID_API_KEY`, `GUARDIAN_CONTENT_API_KEY` are declared but not required to boot (no code references them yet).
