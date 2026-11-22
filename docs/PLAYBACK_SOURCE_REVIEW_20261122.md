# Media God playback source-failure review — 22 November 2026

## Reason for protected-core update

The current VideoPlayer.jsx differs from the previous protected baseline by one import and one 12-line catch guard added in commit dcc9c1e68c7b3dd2a57f072814b84d1938f1d3e3. The additional logic handles authentication, network, HTTP 429 and HTTP 5xx failures during Real-Debrid resolution as service-level problems, not evidence that the selected source is invalid.

The guard clears only the in-progress resolution/polling/preparation state, displays a retryable error, and returns without calling tryNextSource. Ordinary invalid-source failures still reach existing source selection. Live TV, audio selection, resume, native routing, and decoder paths were not modified by this commit.

## Source changes reviewed

- src/components/mg/VideoPlayer.jsx: 13 lines added (one import, 12 lines in RD resolution catch), no existing lines removed.
- src/components/mg/realDebridTransientFailure.js: distinguishes transport/account errors from invalid source errors.
- tests/real-debrid-transient-errors.test.mjs: covers 401, 403, 408, 429 and 5xx, and preserves ordinary invalid-source rejection.
- src/components/mg/useProactiveCodecGuard.js and browserRdAudioCompatibility.js: separate browser-only audio guard; no native VLC or Live TV change.

## Tests and limitations

GitHub Regression run 45052484407 passed its application build, unit tests and playback checks, but protected-media hash failed because VideoPlayer.jsx baseline predated this change. This review authorises updating only that file's SHA-256 in scripts/protected-media-baseline.json.

Source-level review only. It does not certify actual device audio/video, Real-Debrid unrestrict, Render deployment or a new APK. Physical testing remains required.
