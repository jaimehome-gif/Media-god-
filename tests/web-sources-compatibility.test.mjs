import test from "node:test";
import assert from "node:assert/strict";
import { browserMediaCompatible, filterPublishedWebSources, isWebsiteSourcesRuntime } from "../src/components/mg/webSourcesCompatibility.js";

const supports = {
  canPlayType: mime => /avc1|video\/webm/.test(mime) ? "probably" : "",
  mseSupports: mime => /avc1/.test(mime),
};
const media = (src, videoCodec, audioCodec, extra = {}) => ({ type: "url", src, videoCodec, audioCodec, ...extra });
const mp4 = media("https://media.example.test/sample.mp4", "h264", "aac");
const hevc = media("https://media.example.test/sample.mp4", "hevc", "aac");
const silentRisk = media("https://media.example.test/sample.mp4", "h264", "dts");
const unknown = media("https://media.example.test/sample.mp4", "", "");

test("website Sources excludes native and other runtimes", () => {
  assert.equal(isWebsiteSourcesRuntime({}, "underworldhub.co.uk"), true);
  assert.equal(isWebsiteSourcesRuntime({}, "www.underworldhub.co.uk"), true);
  for (const key of ["nativePlayerAvailable", "nativeAndroidMobile", "nativeFireTv", "mobileApp", "fireTv", "isFireTv"])
    assert.equal(isWebsiteSourcesRuntime({ [key]: true }, "underworldhub.co.uk"), false);
  assert.equal(isWebsiteSourcesRuntime({}, "other.example"), false);
});
test("only direct compatible MP4, HLS and WebM formats are eligible", () => {
  assert.equal(browserMediaCompatible(mp4, supports), true);
  assert.equal(browserMediaCompatible(media("https://media.example.test/sample.m3u8", "h264", "aac"), supports), true);
  assert.equal(browserMediaCompatible(media("https://media.example.test/sample.webm", "vp9", "opus"), supports), true);
  for (const item of [hevc, silentRisk, unknown, media("https://media.example.test/sample.mkv", "h264", "aac"),
    media("http://media.example.test/sample.mp4", "h264", "aac"),
    { ...mp4, type: "provider" }, { ...mp4, type: "torrent" }]) {
    assert.equal(browserMediaCompatible(item, supports), false);
  }
  assert.equal(browserMediaCompatible(mp4, { canPlayType: () => "" }), false);
});
test("actual track metadata supersedes codec labels; mixed unknown audio is not approved", () => {
  assert.equal(browserMediaCompatible({ ...mp4, mediaInfo: { video_tracks: [{ codec: "h264" }],
    audio_tracks: [{ codec: "aac" }, { codec: "dts" }] } }, supports), false);
  assert.equal(browserMediaCompatible({ ...silentRisk, mediaInfo: { video_tracks: [{ codec: "h264" }],
    audio_tracks: [{ codec: "aac" }] } }, supports), true);
});
test("only explicitly marked website playback filters all published source arrays", () => {
  const state = { sources: [silentRisk, mp4, hevc], completeSources: [unknown, mp4],
    discoveredSources: [hevc, mp4], src: silentRisk.src, url: silentRisk.src, sourceDiagnostics: { phase: "complete" } };
  assert.equal(filterPublishedWebSources(state, supports), state);
  const filtered = filterPublishedWebSources({ ...state, webSourcesRequest: true }, supports);
  assert.deepEqual(filtered.sources, [mp4]);
  assert.deepEqual(filtered.completeSources, [mp4]);
  assert.deepEqual(filtered.discoveredSources, [mp4]);
  assert.equal(filtered.src, mp4.src);
  const empty = filterPublishedWebSources({ ...state, webSourcesRequest: true,
    sources: [silentRisk], completeSources: [], discoveredSources: [] }, supports);
  assert.equal(empty.sources[0].type, "status");
  assert.equal(empty.src, "");
  const live = { ...state, webSourcesRequest: true, type: "live" };
  assert.equal(filterPublishedWebSources(live, supports), live);
});
