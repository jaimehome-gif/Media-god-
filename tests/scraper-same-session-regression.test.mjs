import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Android TV scraper source click retains the selected provider URL", () => {
  const code = read("src/components/mg/MediaStreamSourcesBox.jsx");
  const start = code.indexOf("const playAddonStream =");
  const gate = code.indexOf("const webScraperPage =", start);
  const native = code.indexOf("await player.play({", gate);
  assert.ok(start >= 0 && gate > start && native > gate);
  const route = code.slice(gate, native);
  assert.match(route, /supportedWebProvider/);
  assert.match(route, /\["onlyflix", "vidcore", "vidsrc", "twoembed", "cinesrc", "multiembed"\]/);
  assert.match(route, /player\.playSavedEmbed\?\.\(embedMedia, \{ url: selectedUrl, provider: sourceKind\.provider \}\)/);
  assert.match(route, /player\.playVidSrc\?\.\(embedMedia\)/);
  assert.match(route, /player\.playExtraEmbed\?\.\(sourceKind\.provider, embedMedia\)/);
});

test("Web scraper fullscreen never reopens an unrelated provider page", () => {
  const stages = [
    "src/components/mg/OnlyFlixEmbedPlayer.jsx",
    "src/components/mg/VidCoreEmbedPlayer.jsx",
    "src/components/mg/VidSrcEmbedPlayer.jsx",
    "src/components/mg/ExtraEmbedPlayer.jsx",
    "src/components/mg/EmbedSuPlayer.jsx",
  ];
  for (const path of stages) {
    const code = read(path);
    assert.match(code, /mg:embed-toggle-fullscreen/, path);
    assert.match(code, /Fullscreen in this player/, path);
    assert.doesNotMatch(code, /Open separately/, path);
  }
  const safeStage = read("src/components/mg/SafeEmbedStage.jsx");
  assert.match(safeStage, /mg:embed-toggle-fullscreen/);
  assert.match(safeStage, /data-mg-safe-embed-fullscreen/);
  assert.match(safeStage, /Keep the same iframe mounted while expanding/);
});

test("Same-session fix does not change direct-player code or live TV routing", () => {
  const code = read("src/components/mg/MediaStreamSourcesBox.jsx");
  assert.match(code, /if \(isTvBox && mediaType !== "live" && webScraperPage\)/);
  assert.match(code, /await player\.play\(\{/);
});