import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
test("Sources offers sandboxed Movi for local personal files on the website only", () => {
  const page = read("src/components/mg/SourcesView.jsx");
  const panel = read("src/components/mg/PersonalMoviSource.jsx");
  assert.ok(page.includes("<PersonalMoviSource />"));
  assert.ok(panel.includes("underworldhub"));
  assert.ok(panel.includes("globalThis.MediaGodNative"));
  assert.ok(panel.includes("isAndroidMobileRuntime() || isFireTvRuntime()"));
  assert.ok(panel.includes('sandbox="allow-scripts"'));
  assert.ok(panel.includes('src="/decoder-lab/personal.html"'));
  assert.ok(!panel.includes("allow-same-origin"));
});
test("Personal Movi receives only a user-selected File, not URLs or provider results", () => {
  const html = read("public/decoder-lab/personal.html");
  const script = read("public/decoder-lab/personal.js");
  assert.ok(html.includes('type="file"'));
  assert.ok(script.includes("input.files?.[0]"));
  assert.ok(script.includes("file instanceof File"));
  assert.ok(script.includes("player.src = file"));
  assert.ok(script.includes('player.setAttribute("sw", "true")'));
  assert.ok(!/fetch\(|XMLHttpRequest|postMessage|URLSearchParams|localStorage|magnet:|RealDebrid/i.test(script));
});
