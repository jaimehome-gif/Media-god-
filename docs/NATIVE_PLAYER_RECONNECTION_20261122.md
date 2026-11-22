# Media God native player reconnection — 22 November 2026

## User-reported regression
After the Base44/Railway migration and the restoration of the original Real-Debrid API, the owner reports that Media God's bespoke player is no longer opening and some playback has no sound. Real-Debrid now returns successful requests, but that alone does not establish device audio/video.

## Narrow fix
The installed-app main Play route in `src/components/mg/fireTvCardPlay.js` was preferring an embedded webpage before Media God's built-in native player. For an installed Fire TV or Android Mobile app with a verified Real-Debrid connection (or an explicit native-player preference), it now invokes the existing `player.play` path first, with fresh source lookup and strict source verification. That route opens the existing Media God player and hands only resolved direct HTTP media to the native LibVLC-compatible decoder, where the existing English audio and sound recovery logic resides.

- No HTML scraper webpage is sent to LibVLC.
- OnlyFlix/VidCore remain available to users without Real-Debrid and through the manual web-scraper tabs.
- Desktop/web without a native bridge, Live TV, manually selected stream rows, player controls and download paths are not changed.
- The verified-source gate is preserved; a blocked or missing Real-Debrid source is not assumed playable.

## Source review and recovery
Prior reviewed `fireTvCardPlay.js` SHA-256: `72efdfe72bd5e3bdbe3e18f9556756308f1a06001f3f0cfcc861ba3a5c4b460f`.
New SHA-256: `4dda82ab63cb528a0677543f95e019e156bbab1e79c9f5427bb9ed95dd013540`.
The original known-good playback commit remains `1942a7b382c1c4a19d5514f74d89a2bca3740229` and the original protected hash is retained in `tests/known-good-playback-lock.test.mjs`. The updated source-reviewed hash is recorded separately.

## Required verification before claiming sound is fixed
- Fire Stick movie and TV episode Play: bespoke Media God controls/activity appear and native picture + **audible** English audio work.
- Android phone APK: same for movie and episode, with track selection and subtitles.
- Manually open a web scraper: the explicit embed tab still opens; do not route HTML into VLC.
- Desktop web without a native Android bridge: existing embedded path remains.
- Exit/back, resume and Fire TV remote still work.
- Playback unit/regression tests pass. Physical-device acceptance is **pending**.

A source-level fix alone is not evidence that every external file contains a decodable audio track.