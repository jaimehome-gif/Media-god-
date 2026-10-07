# AGENTS.md

## Project Overview
Next.js 16 app (StreamVibe / media-god) — a streaming UI for movies, TV shows, and live TV with watch-party features. Built with v0.

## Stack
- **Framework**: Next.js 16 (App Router), React 19
- **Language**: TypeScript (build errors ignored via `next.config.mjs`)
- **Styling**: Tailwind CSS v4
- **Auth**: better-auth (email/password), backed by PostgreSQL
- **DB**: PostgreSQL via `pg` + `drizzle-orm` (no drizzle-kit migrations; schema in `lib/db/schema.ts`, DDL in `db/init.sql`)
- **Package manager**: pnpm 9 (lockfile v9.0)
- **Data**: TMDB mock data in `lib/tmdb.ts` (no API key required for core pages)

## Environment Setup (Base44)
- `docker-compose.base44.yml` runs PostgreSQL + Next.js dev server.
- PostgreSQL schema is auto-created on first boot via `db/init.sql` mounted into `docker-entrypoint-initdb.d`.
- `DATABASE_URL` is set inline in compose (local infra, not a secret).
- `next.config.mjs` conditionally adds the preview origin to `allowedDevOrigins` when `BASE44_PREVIEW_MODE === '1'`.
- No external secrets are required to boot. `GUARDIAN_CONTENT_API_KEY` exists but is not referenced in code.

## Key Architecture Notes
- `lib/db/index.ts` unconditionally creates a `pg.Pool` — the DB must be reachable for any server action or auth operation.
- `lib/auth.ts` conditionally creates the better-auth instance (null if `DATABASE_URL` is unset); `getSessionSafe` catches errors and returns null.
- `lib/tmdb.ts` uses mock data (no external API calls) for the home page and media rows.
- `src/lib/movie-api.ts` uses `NEXT_PUBLIC_MOVIE_API_KEY` for real TMDB calls but is not imported by core pages.

## Verification
- `docker compose -f docker-compose.base44.yml up -d --build` then curl `http://localhost:3000/`.
- The home page should render with mock movie/TV data.
- Auth pages (`/sign-in`, `/sign-up`) require the DB to be up and `BETTER_AUTH_URL` to be set.
