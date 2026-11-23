# Media God Android session and RD rate-limit repair
Date: 22 November 2026

## User report
On reopening the Android phone APK, the previously Google-signed-in user was shown as signed out. Real-Debrid credentials still appeared stored. After generating a new RD key, playback returned HTTP 429 with 287 discovered torrent/source candidates and no verified cached sources in the screenshot.

## Root causes supported by inspection
- The Android WebView enabled cookies and DOM storage but never explicitly flushed pending OAuth cookies to persistent storage after callback or backgrounding.
- The Base44 AuthContext treated a failed User/me check as a sign-out/guest state, and an old Real-Debrid token could be shown as connected separately from Google session verification.
- The Railway Real-Debrid gateway logged a high volume of source-discovery requests (200+ in a minute), with 429 replies and 502s during overload. The gateway previously shared one limit for bulk discovery and actual playback.

## Repairs committed
1. Android MainActivity invokes CookieManager.flush() after page loading, onPause and onDestroy. It does not clear the WebView's cookies or stored OAuth credentials.
2. AuthContext retries restoration with a verified-login hint only to choose another verification attempt, not to grant account access. Logout/Skip-for-now invalidate the hint and overlapping auth checks cannot overwrite a newer check.
3. Independent RD client spaces bulk fetchAddonStreams/check_cache requests and honours server 429 Retry-After via a cooldown. Playback and account authentication are not held behind discovery requests.
4. Railway RD gateway separates the per-account bulk discovery limit (100/min) from its overall request cap (220/min), reserving capacity for playback. It reports Retry-After without escalating retries.
5. MediaPlayerProvider reduces repeated cache scans. VideoPlayer caps automatic background torrent jobs to two per title (one concurrently), without restricting user-selected downloads or the full manual source list.
6. 429 results remain transient, do not mark an unavailable cached item as definitively uncached, and do not erase existing account details.

## Release and test guidance
- Base44 website deployment includes frontend recovery and RD lookup throttling.
- Railway media-god-rd-api successful deployment based on main commit `6a3517caf23ad57d9e6cdeed5e2fdadd82c0c043` includes server-side protections.
- Android version incremented from 1.0.96 (code 97) to **1.0.97 (code 98)**. The native CookieManager.flush() change requires signing and installing a NEW APK; website deployment alone cannot update an installed native activity.
- The release manifest is deliberately NOT sufficient to show an in-app update: `nativeReleaseInfo.js` requires a published release whose APK hash, tag, verified commit, and pinned manifest match. Do not claim a signed APK is live until GitHub workflow has built, signed, and verified it.
- The release automation also builds Fire TV; no Fire TV native source or version change was requested.
- Source-level assertions are at `tests/google-session-and-rd-quota.test.mjs`. Physical-device authentication persistence, Google redirect, full audible playback, and GitHub APK publication are still pending verification.

## Device acceptance test
1. Install signed Android Mobile 1.0.97 over existing app without clearing data.
2. Sign in with Google, close from recent apps, reopen, verify account remains signed in. Repeat after screen lock and a device restart.
3. Verify Real-Debrid status with one request and play one legally accessible cached or user-owned media file, observing audio and picture.
4. Try a title with many source candidates; it must not produce a burst of hundreds of RD calls or claim unchecked torrents are known uncached.
5. Verify Fire TV has unchanged navigation, playback controls, Live TV and update behaviour.

## Protected playback source review — 22 November 2026
This is a deliberately scoped update to the protected-media checksum guard, not a bypass.

- `src/components/mg/VideoPlayer.jsx`: prior SHA-256 `8ccc99e6ce520e2156a6fa0ade784eb47e1475e3f1ee5e29c9680545747dade6`, reviewed new SHA-256 `12f0467d1f0ac3f9e321a9d9feceba610c177412665cbfebc64b659dfe04dd0c`. Source diff in `a360487d356c02815d65353c631269ecc0765392` changes only the timing, concurrency and per-title cap of *automatic* background torrent preparation (14 insertions, 5 removals).
- `src/components/mg/MediaPlayerProvider.jsx`: prior SHA-256 `4ac9442105a010730d0fdc99f2b4bad707df405fb991d80e2d46c7d894c17110`, reviewed new SHA-256 `245ea498e38651c674adda47f8e5a0c20b6d05669354a07534f976b529c31b35`. Source diff in `d473a0d0441e244db0590f8b6dba4510f4ea954b` changes only the repeat pass, retry delay and cached launch probe limits (6 insertions, 6 removals).
- Regression tests were revised to verify the new finite request/worker limits while retaining the original web-provider HTML isolation, source choice, native audio and Live TV checks.
- The SHA-256 guard still checks **all** protected files and rejects any new undocumented drift. The prior baselines remain documented and available for rollback. This source review does not claim physical-device playback verification.

## Same-package Fire TV repair for installed 1.4.126 — 23 November 2026
The owner reported Android's generic "App not installed" error while trying to
install **Mobile 1.0.97** on a device showing installed version **1.4.126**.
The Android package identities are **com.mediagod.mobile** (1.0.97, code 98)
and **com.mediagod.firetv** (1.4.126, code 131). Different packages are NOT
an in-place update path, regardless of matching signer. This difference alone
does not diagnose why a separate second app could not install.

Preserve the existing `com.mediagod.firetv` installation, data and signing
identity. The compatible new build is **Fire TV 1.4.127 (code 132)**,
compiled from the unchanged Fire TV package identity and the existing
GitHub release signing configuration.

Code review of `firetv-android/.../MainActivity.kt`: exactly three additive
`CookieManager.getInstance().flush()` invocations after `onPageFinished`,
at the start of `onPause`, and at the start of `onDestroy`.
The former FULL SHA-256 was
`2d479ed8bab2406896482347b6dd7172a80dc4efea0f8b85215459cfe3729f09`
and the new FULL SHA-256 is
`90842c49b00abf5a18d15f99b2a9be5b1c577437eb3bbb92dc6a17cff6f0bb31`.
The source-reviewed checksum, normalising the existing download-status adapter,
changes from `e601d7d631b40a09fddf3b2bb0ea6a27cd18467ab996fdf7a573f21e3cbf098c`
to `c1034356da63b95a205025cf6ae83ebf192b4f971a8dee4cced72f0de47ccd3d`.

This is a source-review and regression-protected adaptation, NOT confirmation
that the 1.4.127 signed APK has shipped or that a Google session is persistent
on the owner's actual Android device. Update only with the official
`Media-God-Fire-TV.apk` if GitHub Actions has verified signature, source
commit and download hash. Android in-place replacement requires the *installed*
`com.mediagod.firetv` APK signing certificate to match the new one;
do not uninstall/clear app data to work around a certificate mismatch.
