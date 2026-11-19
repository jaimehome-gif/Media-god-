import test from "node:test";
import assert from "node:assert/strict";
import { createVideoTestSession } from "../src/components/mg/videoTestSession.js";

test("remote repeats cannot reset a pending clip; closing ignores its late rejection", async () => {
  let reject;
  let plays = 0;
  let loads = 0;
  const errors = [];
  const video = {
    paused: true, ended: false, src: "",
    getAttribute() { return this.src; },
    play() { plays++; return new Promise((_, fail) => { reject = fail; }); },
    pause() {}, removeAttribute() { this.src = ""; }, load() { loads++; },
  };
  const session = createVideoTestSession();
  session.play(video, error => errors.push(error));
  session.play(video, error => errors.push(error));
  assert.equal(plays, 1);
  assert.equal(loads, 0);
  session.close(video);
  reject(new Error("interrupted by close"));
  await Promise.resolve();
  assert.deepEqual(errors, []);
  assert.equal(loads, 1);
});

test("a failed request can retry without replacing its source or calling load", async () => {
  const error = new Error("decoder failed");
  const errors = [];
  let plays = 0;
  const video = { paused: true, ended: false,
    getAttribute() { return "/media-god-test.mp4"; },
    set src(_) { assert.fail("must not replace source"); },
    load() { assert.fail("must not reload"); },
    play() { plays++; return plays === 1 ? Promise.reject(error) : Promise.resolve(); },
  };
  const session = createVideoTestSession();
  session.play(video, value => errors.push(value));
  await Promise.resolve();
  session.play(video, value => errors.push(value));
  await Promise.resolve();
  assert.equal(plays, 2);
  assert.deepEqual(errors, [error]);
});
