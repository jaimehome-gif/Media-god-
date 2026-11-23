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

test("Native bridge uses VLC request marker but preserves Live TV and DRM paths", () => {
  const bridge = read("src/components/mg/nativeFireTvBridge.js");
  assert.match(bridge, /preferNativeVlc: item\?\.preferNativeVlc === true/);
  assert.match(bridge, /!live && !drm && selectedHints\?\.preferNativeVlc === true/);
  assert.match(bridge, /sources-manual-built-in-vlc/);
  assert.match(bridge, /forceCompatibility: Boolean\(forceCompatibilityReason\)/);
  for (const [platform, pkg] of [["android-mobile","mobile"],["firetv-android","firetv"]]) {
    const router = read(`${platform}/app/src/main/java/com/mediagod/${pkg}/PlaybackCompatibilityRouter.kt`);
    assert.match(router, /if \(payload\.optJSONObject\("drm"\) != null\)/);
    assert.match(router, /return Decision\(true, "default-libvlc-vod"\)/);
    assert.match(router, /if \(payload\.optBoolean\("forceCompatibility", false\)\)/);
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
