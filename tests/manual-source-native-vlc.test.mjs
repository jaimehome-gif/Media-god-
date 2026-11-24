import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = name => readFileSync(new URL("../" + name, import.meta.url), "utf8");

test("Sources direct files request built-in VLC on Android and Fire TV", () => {
  const box = read("src/components/mg/MediaStreamSourcesBox.jsx");
  assert.match(box, /preferNativeVlc: true/);
  assert.match(box, /mediaType === "live"\s*\? stream\s*: \{ \.\.\.stream, preferNativeVlc: true \}/);
  assert.match(box, /completeSources: mediaType === "live"[\s\S]*?preferNativeVlc: true/);
  assert.match(box, /isNativeFireTvPlayerAvailable\(\)[\s\S]*?webScraperPage/);
  assert.match(box, /This source is a web-player page rather than a direct video file/);
});

test("Sources personal servers and saved debrid links request native VLC", () => {
  const source = read("src/components/mg/SourcesView.jsx");
  assert.match(source, /label: \x60\$\{result\.server\.name\} · Direct/);
  assert.match(source, /audioCodec: audio\?\.codec \|\| audio\?\.Codec \|\| "",\s*preferNativeVlc: true/);
  assert.match(source, /audioCodec: "aac",\s*preferNativeVlc: true/);
  assert.match(source, /addon: "Sources",\s*preferNativeVlc: true/);
});

test("Native playback defaults to VLC for non-DRM VOD and preserves Live TV and DRM paths", () => {
  // The protected native bridge does not need an explicit manual-source
  // marker: both native engines already select VLC for every ordinary VOD.
  // Assert the actual decision order, not a redundant bridge implementation.
  const bridge = read("src/components/mg/nativeFireTvBridge.js");
  assert.match(bridge, /live: Boolean\(live\)/);
  assert.match(bridge, /drm:[\s\S]*?licenseUrl/);
  assert.match(bridge, /forceCompatibility: Boolean\(forceCompatibilityReason\)/);
  for (const [platform, pkg] of [["android-mobile","mobile"],["firetv-android","firetv"]]) {
    const router = read(`${platform}/app/src/main/java/com/mediagod/${pkg}/PlaybackCompatibilityRouter.kt`);
    const decision = router.slice(router.indexOf("fun decide(payload: JSONObject)"));
    const drm = decision.indexOf('if (payload.optJSONObject("drm") != null)');
    const vod = decision.indexOf('if (!payload.optBoolean("live", false))');
    const manual = decision.indexOf('if (payload.optBoolean("forceCompatibility", false))');
    assert.ok(drm >= 0 && vod > drm && manual > vod);
    assert.match(decision.slice(drm, vod), /return Decision\(false\)/);
    assert.match(decision.slice(vod, manual), /return Decision\(true, "default-libvlc-vod"\)/);
    const activity = read(`${platform}/app/src/main/java/com/mediagod/${pkg}/MainActivity.kt`);
    assert.match(activity, /CompatibilityPlayerActivity::class\.java/);
  }
});

test("The source player keeps the legacy WebView fallback only when native bridge is absent", () => {
  const player = read("src/components/mg/VideoPlayer.jsx");
  assert.match(player, /const useNativePlayback =\s*nativePlaybackAvailable;/);
  assert.match(player, /const started = playNativeFireTv\(\{/);
  assert.match(player, /nativeFallbackUrl !== nativePlaybackUrl/);
});
