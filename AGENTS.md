# AGENTS.md — Media God

## Scope and architecture
- Active repo: jaimehome-gif/Media-god-; default branch: main. Production: underworldhub.co.uk.
- React 18, Vite 6, JavaScript/JSX, Tailwind, React Router; Node 24 in CI.
- GitHub and Railway are the intended independent deployment path. Check the actual deployed branch/commit before release work; main may lag migration branches.
- Legacy Base44 SDK, functions, Vite plugin and README remain on main. Do not assume they describe the live deployment or restore Base44 dependencies to migrated code.

```text
src/pages/                   Routes, Home and account screens
src/components/mg/           Media UI, player, Sources, catalogue and Live TV
src/components/ui/           Shared UI primitives
src/api/                     Client API routing, sessions, metadata and RD
src/hooks/, src/lib/, src/utils/  Shared application helpers
base44/functions/            Legacy backend handlers (TMDB, RD, Live TV)
deploy/media-god-api/        Railway metadata/public discovery service
deploy/media-god-rd-api/     Railway authenticated Real-Debrid service
android-mobile/              Native Android phone app (Gradle/Kotlin)
firetv-android/              Native Fire TV app (Gradle/Kotlin)
windows-desktop/             Desktop app
tests/, scripts/             Node tests, regression and protection guards
.github/workflows/           CI, signed APKs and release workflows
docs/                        Compatibility and release decisions
```

Key entry points (main; confirm on your working branch):
- Player: src/components/mg/{MediaPlayerProvider,PlayerProvider,VideoPlayer}.jsx; Sources: MediaStreamSourcesBox.jsx, StreamSourcesBox.js in the same directory.
- Catalogue: src/api/independentMetadata.js; deploy/media-god-api/{server,getTmdbMovies,publicDiscovery}.mjs.
- RD: src/api/independentRealDebrid.js; deploy/media-god-rd-api/server.mjs; accountSessionToken.js and railwayDeviceToken.js in src/api/.
- Live TV: src/components/mg/LiveTVView.jsx, freeTvPlaylist.js and additionalLiveTvSources.js; legacy handlers in base44/functions/.
- Native playback: PlayerActivity.kt, CompatibilityPlayerActivity.kt, PlaybackCompatibilityRouter.kt in each Android app's main Java/Kotlin package.
- Inspect branch-specific identity, website/proxy entry points and deployment configuration before editing; do not invent Cloudflare routes.

## Commands (root package.json)
```sh
npm ci
npm run dev
npm run build
npm run lint
npm run typecheck
npm test
npm run test:regression
npm run test:full
npm run preview
```
- Frontend dev/preview alone does not provide backend services; use authorised test configuration.
- test:regression runs unit tests, lint, build, playback, protected, privacy, backend, UI, smoke and native checks.
- test:full adds typecheck. Run targeted tests first, then required regression/typecheck for code changes.
- Targeted scripts: npm run test:playback, test:protected, test:privacy, test:backend, test:ui, test:smoke, test:native, test:network (each via npm run).
- Network smoke depends on external availability; CI treats it as non-blocking. Report failures, not false passes.

## Platform, environment and security
- Keep Vite legacy targets and fetch/AbortController polyfills for older Android/TV WebViews (API 21 install floor on TV; Chrome 37 legacy target on main).
- Preserve native VLC compatibility, audio track handling, single active playback, fullscreen, remote focus/back, and exact Continue Watching resume.
- Browser playback cannot assume native codecs or VLC availability. Keep website fixes isolated from phone/TV behavior.
- Keep Play and Sources distinct; do not change their routing or Live TV behavior for unrelated tasks. Test only authorised media.
- Preserve request coalescing, bounded public metadata cache, 429 backoff and session refresh behavior; no retry storms or credential-clearing shortcuts.
- Keep public catalogue requests free of private credentials. Preserve account/device separation, server-side token handling, CORS and existing authentication boundaries.
- Use environment/service configuration for credentials; never commit secrets, tokens, signing keys or private user data. Do not clear unrelated storage.
- Do not bypass provider access restrictions, authentication, content protections or rate limits.

## Agent rules
- Read only relevant files first; keep diffs minimal and within requested scope.
- No unrequested npm packages, lockfile churn, broad refactors, theme changes or unrelated fixes.
- Do not edit generated assets, release manifests, versions, signing config or deployment settings unless explicitly required.
- Preserve protected media files per scripts/protected-media-baseline.json and scripts/protected-media-guard.mjs.
- For unrelated changes, protected hashes must stay unchanged; run npm run test:regression. A protected-test failure is a stop condition.
- For explicitly requested media-core work, isolate and review the change; update baseline hashes only after explicit acceptance and relevant validation. Never rebaseline just to pass CI.
- Check docs/PLAYBACK_KNOWN_GOOD.md and docs/RELEASE_SAFETY.md for playback/release work.
- Keep signed APK update continuity, matching versionCodes/manifests and prior stable archives; no forced reinstall or downgrade.
- Work on a focused branch/PR. Never force-push or overwrite concurrent work.
- Run build, lint, typecheck and applicable tests before finishing code changes; report exact outcomes and pre-existing failures.
- For docs-only changes, verify the diff and report skipped runtime checks. Do not deploy or publish merely for documentation.
- Report changed files, tests, blockers and any remaining device verification. A green build is not proof of real playback or deployment.
