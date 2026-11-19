import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the scraper test entry point embeds the document without requesting a page denied by the host's frame policy", () => {
  for (const file of ["OnlyFlixEmbedPlayer.jsx"]) {
    const source = readFileSync(new URL("../src/components/mg/" + file, import.meta.url), "utf8");
    assert.match(source, /import embeddedVideoTestPage from "\.\.\/\.\.\/\.\.\/public\/embedded-video-test\.html\?raw"/);
    assert.match(source, /srcDoc=\{embeddedVideoTestPage\}/);
    assert.doesNotMatch(source, /src="\/embedded-video-test\.html"/);
  }
  const page = readFileSync(new URL("../public/embedded-video-test.html", import.meta.url), "utf8");
  assert.match(page, /clip\.src="\/media-god-test\.mp4"/);
});

import vm from "node:vm";

test("inline frame startup uses the parent origin and survives failed status delivery", () => {
  const script = readFileSync(new URL("../public/embedded-video-test.html", import.meta.url), "utf8")
    .match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const reportingFails of [false, true]) {
    let plays = 0;
    const messages = [];
    const clip = { play() { plays++; }, currentTime: 0, readyState: 0, networkState: 2 };
    const result = {};
    let timeout;
    const parent = {
      location: { origin: "https://media.example" },
      postMessage(value, origin) {
        assert.equal(origin, "https://media.example");
        if (reportingFails) throw new Error("delivery failed");
        messages.push(value);
      },
    };
    vm.runInNewContext(script, {
      parent, window: {}, location: { origin: "null" },
      document: { getElementById: id => ({ clip, result, play: {} })[id] },
      setTimeout: fn => { timeout = fn; }, clearTimeout() {},
    });
    assert.equal(plays, 1, "reporting must not interrupt video.play");
    timeout();
    assert.match(result.textContent, /stalled/);
    if (!reportingFails) assert.equal(messages.length, 2);
  }
});