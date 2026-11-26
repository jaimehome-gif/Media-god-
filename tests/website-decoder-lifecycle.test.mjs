import test from "node:test";
import assert from "node:assert/strict";
import { attachDecoderLifecycle } from "../src/components/mg/websiteDecoderLifecycle.js";

test("late audio track metadata is not a decoder error", () => {
  const player = new EventTarget();
  let pauses = 0, metadata = 0, progress = 0, failures = 0;
  player.pause = () => { pauses++; };
  player.audioTracks = [];
  player.videoWidth = 0;
  const lifecycle = attachDecoderLifecycle(player, () => ({
    onMetadata: () => metadata++, onProgress: () => progress++, onFailure: () => failures++,
  }));
  player.dispatchEvent(new Event("loadeddata"));
  assert.equal(failures, 0);
  assert.equal(pauses, 0);
  player.audioTracks = [{}];
  player.videoWidth = 640;
  player.duration = 120;
  player.dispatchEvent(new Event("loadedmetadata"));
  player.dispatchEvent(new Event("timeupdate"));
  assert.equal(metadata, 1);
  assert.equal(progress, 1);
  player.dispatchEvent(new Event("error"));
  player.dispatchEvent(new Event("error"));
  player.dispatchEvent(new Event("timeupdate"));
  assert.equal(failures, 1);
  assert.equal(pauses, 1);
  assert.equal(progress, 1);
  lifecycle.dispose();
});

test("disposed decoder cannot notify after removal", () => {
  const player = new EventTarget();
  let calls = 0;
  player.pause = () => calls++;
  const lifecycle = attachDecoderLifecycle(player, () => ({
    onMetadata: () => calls++, onProgress: () => calls++, onFailure: () => calls++,
  }));
  lifecycle.dispose();
  for (const event of ["loadedmetadata", "loadeddata", "durationchange", "timeupdate", "error"]) {
    player.dispatchEvent(new Event(event));
  }
  lifecycle.fail();
  assert.equal(calls, 0);
});

test("metadata delivered once after duration becomes usable, even without a second loadedmetadata event", () => {
  const player = new EventTarget();
  player.videoWidth = 640;
  player.audioTracks = [];
  player.duration = NaN;
  let metadata = 0, progress = 0;
  const lifecycle = attachDecoderLifecycle(player, () => ({
    onMetadata: () => metadata++, onProgress: () => progress++,
  }));
  player.dispatchEvent(new Event("loadedmetadata"));
  assert.equal(metadata,0);
  player.duration = 120;
  player.dispatchEvent(new Event("durationchange"));
  for (const event of ["loadedmetadata","loadeddata","timeupdate","durationchange"]) player.dispatchEvent(new Event(event));
  assert.equal(metadata,1);
  assert.equal(progress,1);
  lifecycle.dispose();
});
test("audio-only personal file can deliver usable duration metadata", () => {
  const player = new EventTarget();
  player.duration = 60;
  player.videoWidth = 0;
  player.audioTracks = [{}];
  let metadata = 0;
  const lifecycle = attachDecoderLifecycle(player,()=>({onMetadata:()=>metadata++}));
  player.dispatchEvent(new Event("loadeddata"));
  player.dispatchEvent(new Event("timeupdate"));
  assert.equal(metadata,1);
  lifecycle.dispose();
});

test("late decoder tracks use main English once and honour subsequent manual selection", () => {
  const player = new EventTarget();
  player.duration = 120;
  player.videoWidth = 640;
  player.audioTracks = [];
  const lifecycle = attachDecoderLifecycle(player, () => ({}));
  player.dispatchEvent(new Event("loadedmetadata"));
  let selected = 0;
  player.audioTracks = [
    ["fr", "Main"], ["en", "Commentary"], ["en", "Main"],
  ].map(([language, label], index) => ({
    language, label,
    get enabled() { return selected === index; },
    set enabled(enable) { if (enable) selected = index; },
  }));
  player.dispatchEvent(new Event("loadeddata"));
  assert.equal(selected, 2);
  player.audioTracks[1].enabled = true;
  player.dispatchEvent(new Event("timeupdate"));
  assert.equal(selected, 1);
  lifecycle.dispose();
});
