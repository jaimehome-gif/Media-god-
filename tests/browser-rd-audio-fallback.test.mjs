import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { browserCannotDecodeResolvedRdAudio } from "../src/components/mg/browserRdAudioCompatibility.js";

const cannotPlay = () => "";
const playsDolby = mime => mime.includes("ec-3") ? "probably" : "";
const resolved = (codecs, state = "hard_codec_original_probe") => ({
  src: "https://example.invalid/private-video",
  audioRescue: { used: false, state },
  videoRescue: null,
  mediaInfo: { audio_tracks: codecs.map(codec => ({ codec })) },
});

test("DTS and TrueHD-only original RD files are known silent in a browser", () => {
  for (const codec of ["DTS-HD MA", "audio/dts", "TrueHD 7.1", "MLP"]) {
    assert.equal(browserCannotDecodeResolvedRdAudio(resolved([codec]), {
      canPlayType: cannotPlay,
    }), true, codec);
  }
});

test("unsupported EAC3/AC3 tracks need an actual negative browser capability probe", () => {
  for (const codec of ["E-AC3", "audio/eac3", "AC-3 5.1"]) {
    assert.equal(browserCannotDecodeResolvedRdAudio(resolved([codec]), {
      canPlayType: cannotPlay,
    }), true, codec);
  }
  assert.equal(browserCannotDecodeResolvedRdAudio(resolved(["E-AC3"]), {
    canPlayType: playsDolby,
  }), false);
});

test("AAC, unknown, and mixed known audio never trigger speculative source rejection", () => {
  for (const tracks of [[], ["AAC"], ["DTS", "AAC"], ["DTS", ""], ["DTS", "MP3"]]) {
    assert.equal(browserCannotDecodeResolvedRdAudio(resolved(tracks), {
      canPlayType: cannotPlay,
    }), false, JSON.stringify(tracks));
  }
});

test("browser-compatible RD transcoding and ordinary RD originals remain playable", () => {
  const data = resolved(["DTS"]);
  data.audioRescue.used = true;
  assert.equal(browserCannotDecodeResolvedRdAudio(data, {canPlayType: cannotPlay}), false);
  data.audioRescue.used = false;
  data.videoRescue = {used: true};
  assert.equal(browserCannotDecodeResolvedRdAudio(data, {canPlayType: cannotPlay}), false);
  data.videoRescue = null;
  data.audioRescue.state = "original_compatible";
  assert.equal(browserCannotDecodeResolvedRdAudio(data, {canPlayType: cannotPlay}), false);
  delete data.mediaInfo;
  data.audioRescue.state = "hard_codec_original_probe";
  assert.equal(browserCannotDecodeResolvedRdAudio(data, {canPlayType: cannotPlay}), false);
});

test("native VLC is preserved, while known-silent browser originals retain manual choice", () => {
  const hook = readFileSync(
    new URL("../src/components/mg/useProactiveCodecGuard.js", import.meta.url), "utf8"
  );
  assert.match(hook, /!nativeFireTvPlayer\s*&&\s*browserCannotDecodeResolvedRdAudio\(rdOverride\)/);
  assert.match(hook, /if \(manualSourceLockActive\(\)\) \{\s*setRdError\(/);
  assert.match(hook, /if \(confirmedSilentBrowserAudio\) \{/);
  assert.match(hook, /const nextIndex = findNextPlayableSource/);
  const branch = hook.slice(hook.indexOf("if (confirmedSilentBrowserAudio) {"));
  assert.ok(branch.indexOf("switchToSource(nextIndex") < branch.indexOf("markSourceFailed(activeIdx)"));
});
