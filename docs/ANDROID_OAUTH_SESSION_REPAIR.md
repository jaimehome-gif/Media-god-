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
