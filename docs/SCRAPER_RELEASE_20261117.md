# Media God scraper release review — 17 November 2026

## User approval and real-device evidence
- User explicitly requested release to everyone after installing **Media God Scraper Test** on an Android phone.
- User observed **Ebenezer (2026)** opening and playing continuously, without the misleading copyright/takedown page during the new fullscreen flow.
- This confirms a successful **Android phone** test only. The older Android TV box and Fire Stick have **not** been physically verified on the changed release.
- User recognises that the immediate benefit may be limited to phones. Do not represent Android box or Fire Stick as tested.

## Exact changes
- `MediaStreamSourcesBox.jsx`: route recognised Android TV/box scraper pages through the selected provider URL instead of rejecting them or sending HTML to VLC.
- `OnlyFlixEmbedPlayer.jsx`: remove the 'Open separately' action which reopened the webpage in a different Android browser context and appeared to show a takedown notice even when embedded video was playing. Use the existing in-page fullscreen stage.
- `VidCoreEmbedPlayer.jsx`, `VidSrcEmbedPlayer.jsx`, `ExtraEmbedPlayer.jsx`, `EmbedSuPlayer.jsx`: offer the existing in-page fullscreen stage.
- `android-mobile` optional test configuration: separate installable test APK with bundled frontend; public `mediaGodScraperTest=false` by default, so public app ID and hosted front end remain unchanged.
- A standalone test build workflow only publishes a GitHub Actions artifact, not the public APK update channel.

## Protection review
Previous source-reviewed SHA-256 digests for rollback:
- `src/components/mg/OnlyFlixEmbedPlayer.jsx`: `9f186bf782115fffb3c3ac764c00b0f60b4f42e639b0bdbba3143188972d4858`
- `src/components/mg/MediaStreamSourcesBox.jsx`: `70a666f14ce3223ff11d7de510e9efb40eaf13c793abd07d4ad48558d1cd1ed7`

Approved changed SHA-256 digests after code review and the user's phone test:
- `src/components/mg/OnlyFlixEmbedPlayer.jsx`: `c7e676a2ff130d45a6cdfe3c5303e2d09dd71b67e2619199f6d53bf4363cd75d`
- `src/components/mg/MediaStreamSourcesBox.jsx`: `8bc3e768b6843d6d9bd426e63851349c7b8583f244c92bc60f134c963798ca47`

The original 24 October known-good hashes in `known-good-playback-lock.test.mjs` are preserved, and only the reviewed source hashes are revised. Existing native VLC/Media3 decoder and Live TV source resolution were not changed by this release.

## Rollout
1. All automated checks must pass before merging.
2. Merge source changes, then confirm Base44 sync/deploy actually points at the new merge commit; APK rebuild alone is insufficient.
3. Public Android APK and Fire Stick APK must be staged together by normal release process; do not claim the new website is live if Base44 is still on the old commit.
4. Ask Android box / Fire Stick users to validate scraper playback, navigation and fullscreen; revert promptly if native remote/episode source handling regresses.
