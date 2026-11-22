import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = file => readFileSync(new URL("../" + file, import.meta.url), "utf8");

test("Fire TV WebView routes embedded native fullscreen without reloading provider", () => {
  const source = read("firetv-android/app/src/main/java/com/mediagod/firetv/MainActivity.kt");
  assert.match(source, /webChromeClient = object : WebChromeClient\(\)/);
  assert.match(source, /override fun onShowCustomView\(/);
  assert.match(source, /override fun onHideCustomView\(\)/);
  assert.match(source, /webRoot\.addView\(/);
  assert.match(source, /webRoot\.removeView\(activeView\)/);
  assert.match(source, /FrameLayout\.LayoutParams\(\s*ViewGroup\.LayoutParams\.MATCH_PARENT,\s*ViewGroup\.LayoutParams\.MATCH_PARENT/);
  assert.match(source, /if \(embeddedFullscreenView != null\) \{\s*exitEmbeddedFullscreen\(\)\s*return\s*\}/);
  const dispatch = source.slice(source.indexOf("override fun dispatchKeyEvent"), source.indexOf("private fun handleRemoteBack"));
  assert.match(dispatch, /KEYCODE_BACK[\s\S]*?ACTION_UP && !event\.isCanceled[\s\S]*?handleRemoteBack\(held = event\.eventTime - event\.downTime >= 1500L\)/);
  assert.ok(dispatch.indexOf("KEYCODE_BACK") < dispatch.indexOf("super.dispatchKeyEvent"));
  assert.match(source, /if \(held\) \{[\s\S]*?webView\.stopLoading\(\)\s*webView\.loadUrl\(BuildConfig\.MEDIA_GOD_URL\)\s*return/);
  assert.match(source, /webView\.visibility = View\.VISIBLE/);
  assert.doesNotMatch(source, /fullscreenView.*loadUrl\(/);
  const mobile = read("android-mobile/app/src/main/java/com/mediagod/mobile/MainActivity.kt");
  assert.doesNotMatch(mobile, /embeddedFullscreenView/);
});

test("Fire TV image stage selector cannot accidentally cover an embedded provider selector bar", () => {
  const source = read("firetv-android/app/src/main/java/com/mediagod/firetv/MainActivity.kt");
  const css = read("src/fire-tv-player-failsafe.css");
  assert.doesNotMatch(css, /\[data-mg-player-root="true"\]\s*>\s*div\s*>\s*div:nth-child\(2\)/);
  assert.match(css, /:not\(\[data-mg-embedded-remote-player="true"\]\) \[data-mg-player-stage="true"\]/);
  assert.match(css, /\[data-mg-embedded-remote-player="true"\] \[data-mg-player-stage="true"\] iframe/);
  assert.match(css, /\[data-mg-safe-embed-fullscreen="true"\]/);
  assert.match(css, /width: 100% !important;/);
  const iframe = read("src/components/mg/OnlyFlixEmbedPlayer.jsx");
  assert.match(iframe, /const providerFullscreen = isFireTv && !legacyBox;/);
  assert.match(iframe, /onClick=\{beginTorrentFallback\}[\s\S]*?>Try native player</);
  assert.match(iframe, /allowFullScreen=\{providerFullscreen\}/);
  assert.match(iframe, /"autoplay; encrypted-media; picture-in-picture; fullscreen"/);
  assert.match(iframe, /: "autoplay; encrypted-media; picture-in-picture"/);
  assert.match(source, /embeddedFullscreenFromScraper = scraperFullscreen/);
  assert.match(source, /webView\.visibility = if \(scraperFullscreen\) View\.VISIBLE else View\.INVISIBLE/);
  assert.match(source, /swallowScraperMenuRelease = true/);
  assert.match(source, /KEYCODE_MENU/);
  assert.match(iframe, /data-mg-embed-iframe="true"/);
  assert.match(iframe, /<SafeEmbedStage>/);
});

test("Fire TV update is newer but phone and platform assets remain separate", () => {
  const fire = read("firetv-android/app/build.gradle.kts");
  const phone = read("android-mobile/app/build.gradle.kts");
  const fireManifest = JSON.parse(read("public/firetv-update.json"));
  const phoneManifest = JSON.parse(read("public/android-mobile-update.json"));
  assert.match(fire, /versionCode = 131/);
  assert.match(fire, /versionName = "1\.4\.126"/);
  assert.equal(fireManifest.versionCode, 131);
  assert.equal(fireManifest.versionName, "1.4.126");
  assert.equal(phoneManifest.versionCode, 98);
  assert.equal(phoneManifest.versionName, "1.0.97");
  assert.match(phone, /versionCode = 98/);
  assert.match(phone, /versionName = "1\.0\.97"/);
});
