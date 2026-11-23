import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Fire TV edition preserves its own OAuth cookies across app restart", () => {
  const activity = read("firetv-android/app/src/main/java/com/mediagod/firetv/MainActivity.kt");
  assert.match(activity, /override fun onPageFinished[\s\S]*?CookieManager\.getInstance\(\)\.flush\(\)/);
  assert.match(activity, /override fun onPause[\s\S]*?CookieManager\.getInstance\(\)\.flush\(\)/);
  assert.match(activity, /override fun onDestroy[\s\S]*?CookieManager\.getInstance\(\)\.flush\(\)/);
  assert.match(activity, /setAcceptCookie\(true\)/);
  assert.doesNotMatch(activity, /removeAllCookies|WebStorage\.getInstance\(\)\.deleteAllData/);
  const gradle = read("firetv-android/app/build.gradle.kts");
  assert.match(gradle, /applicationId = "com\.mediagod\.firetv"/);
  assert.match(gradle, /versionCode = 134/);
  assert.match(gradle, /versionName = "1\.4\.129"/);
});

test("Android WebView persists OAuth cookies without clearing app data", () => {
  const activity = read("android-mobile/app/src/main/java/com/mediagod/mobile/MainActivity.kt");
  assert.match(activity, /override fun onPageFinished[\s\S]*?CookieManager\.getInstance\(\)\.flush\(\)/);
  assert.match(activity, /override fun onPause[\s\S]*?CookieManager\.getInstance\(\)\.flush\(\)/);
  assert.match(activity, /override fun onDestroy[\s\S]*?CookieManager\.getInstance\(\)\.flush\(\)/);
  assert.match(activity, /domStorageEnabled = true/);
  assert.match(activity, /setAcceptCookie\(true\)/);
  assert.doesNotMatch(activity, /removeAllCookies|WebStorage\.getInstance\(\)\.deleteAllData/);
});

test("Google session hint never replaces a verified server-side account", () => {
  const context = read("src/lib/AuthContext.jsx");
  assert.match(context, /VERIFIED_LOGIN_HINT_KEY/);
  assert.match(context, /currentUser = await base44\.auth\.me\(\)/);
  assert.match(context, /if \(!currentUser\?\.id\)/);
  assert.match(context, /writeVerifiedLoginHint\(true\)/);
  assert.match(context, /writeVerifiedLoginHint\(false\)/);
  assert.match(context, /authCheckSequenceRef/);
  assert.match(context, /visibilitychange/);
  assert.match(context, /setIsGuest\(!readVerifiedLoginHint\(\)\)/);
});

test("Real-Debrid bulk discovery observes cooldown and leaves playback priority", () => {
  const client = read("src/api/independentRealDebrid.js");
  assert.match(client, /isLowPriorityDiscovery/);
  assert.match(client, /reserveDiscoveryRequest\(\)/);
  assert.match(client, /discoveryCooldownUntil/);
  assert.match(client, /response\.status === 429/);
  assert.match(client, /MAX_DISCOVERY_QUEUE_MS/);
  const server = read("deploy/media-god-rd-api/server.mjs");
  assert.match(server, /MAX_BULK_DISCOVERY_REQUESTS_PER_USER/);
  assert.match(server, /bulkDiscovery && limited\("bulk:"/);
  assert.match(server, /limited\("account:"/);
  assert.match(server, /Retry-After/);
});

test("Automatic torrent background preparation cannot exhaust a 287-source title", () => {
  const player = read("src/components/mg/VideoPlayer.jsx");
  assert.match(player, /BACKGROUND_CACHE_CONCURRENCY = 1/);
  assert.match(player, /BACKGROUND_CACHE_MAX_PER_TITLE = 2/);
  assert.match(player, /remainingBackgroundBudget/);
  assert.match(player, /BACKGROUND_CACHE_SLOT_RETRY_MS = 30_000/);
  assert.match(player, /manualSourceLockActive\(\)/);
  const provider = read("src/components/mg/MediaPlayerProvider.jsx");
  assert.match(provider, /DEBRID_CACHE_MAX_PASSES = 2/);
  assert.match(provider, /DEBRID_CACHE_RETRY_DELAY_MS = 900/);
  const transient = read("src/components/mg/realDebridTransientFailure.js");
  assert.match(transient, /"RD_RATE_LIMITED"/);
  assert.match(transient, /"RD_DISCOVERY_RATE_LIMITED"/);
  assert.match(read("deploy/media-god-rd-api/realDebrid.mjs"), /RD_RATE_LIMITED/);
});
