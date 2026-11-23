import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const row = readFileSync(
  new URL("../src/components/mg/ContinueWatchingRow.jsx", import.meta.url),
  "utf8"
);

test("Continue Watching never freezes an old direct link as its entire source catalogue", () => {
  assert.doesNotMatch(row, /skipRdLookup:\s*true/);
  assert.doesNotMatch(row, /skipAddonLookup:\s*true/);
  assert.doesNotMatch(row, /noRd:\s*true/);
  // The old link is optional first candidate while fresh discovery continues.
  assert.match(row, /sources:\s*\[\{[\s\S]*?Resume last source/);
  assert.match(row, /resumeFromHistory:\s*true/);
});

test("saved torrent is respected but alternative sources are still discovered", () => {
  assert.match(row, /verifiedPlaybackPolicy:\s*"manual",\s*sources:\s*\[savedSource\]/);
  assert.match(row, /const hasSavedSource/);
  assert.match(row, /startTime:\s*Number\(item\.progress\s*\|\|\s*0\)/);
});

test("every history card uses in-player source control rather than a second player launch", () => {
  assert.doesNotMatch(row, /chooseAnotherSource|Other sources/);
  assert.match(row, /onClick=\{\(\) => openDetail\(item\)\}/);
  const player = readFileSync(new URL("../src/components/mg/VideoPlayer.jsx", import.meta.url), "utf8");
  assert.match(player, /data-mg-open-in-player-sources="true"/);
  assert.match(player, /<InPlayerSourceDrawer/);
});

test("OnlyFlix remains an explicit Web players backup, not automatic Resume", () => {
  const resume = row.slice(row.indexOf("  const openDetail = async (item) => {"), row.indexOf("  // An explicit Players action"));
  assert.doesNotMatch(resume, /player\.playOnlyFlix|player\.playSavedEmbed/);
  assert.match(row, /const launched = player\.playOnlyFlix\?\.\(\{/);
  assert.match(row, /data-mg-continue-player-options="true"/);
});
