import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../"+path, import.meta.url), "utf8");
const provider = read("src/components/mg/MediaPlayerProvider.jsx");
const portal = read("src/components/mg/PlayerPortalRenderer.jsx");
const embed = read("src/components/mg/OnlyFlixEmbedPlayer.jsx");
const player = read("src/components/mg/VideoPlayer.jsx");
const box = read("src/components/mg/MediaStreamSourcesBox.jsx");

test("OnlyFlix normal one-click Play is preserved on web and APK", () => {
  for (const path of [
    "src/components/mg/MediaCard.jsx",
    "src/components/mg/HomeDashboard.jsx",
    "src/components/mg/DetailModal.jsx",
    "src/components/mg/EpisodeSelector.jsx",
    "src/components/mg/NewEpisodesRow.jsx",
    "src/components/mg/RecentlyWatchedRow.jsx"
  ]) {
    const source = read(path);
    assert.match(source, /playOnlyFlix/,"expected unchanged OnlyFlix Play in "+path);
    assert.doesNotMatch(source,/launchMediaGodWebsitePlay/,"website override forbidden in "+path);
  }
  assert.match(embed,/data-mg-onlyflix-player="true"/);
  assert.match(embed,/<iframe/);
});

test("the embedded Sources button enters Media God, not another web iframe", () => {
  assert.match(embed,/data-mg-embedded-open-sources="true"[\s\S]{0,130}onClick=\{onOpenSources\}/);
  assert.match(portal,/vidSrcEmbed\?\.provider === "onlyflix"/);
  assert.match(portal,/<OnlyFlixEmbedPlayer[\s\S]*?onOpenSources=\{onOpenSources\}/);
  const route = provider.slice(provider.indexOf("onOpenSources={() => {"), provider.indexOf("onOpenSources={() => {") + 1150);
  assert.match(route,/void play\(\{/);
  assert.match(route,/openSourcesDrawer: true/);
  assert.match(route,/skipAddonLookup: false/);
  assert.match(route,/skipRdLookup: false/);
  assert.match(route,/verifiedPlaybackPolicy: "strict"/);
  assert.match(route,/sources: \[\]/);
  assert.match(route,/completeSources: \[\]/);
  assert.match(route,/src: ""/);
});

test("website Sources starts automatic checks and keeps the full drawer available manually", () => {
  assert.match(player,/const \[inPlayerSourcesOpen, setInPlayerSourcesOpen\] = useState\(/);
  assert.match(player,/\(\) => Boolean\(source\?\.openSourcesDrawer && source\?\.mediaType !== "live" && !autoCheckWebsiteSources\)/);
  assert.match(player,/setInPlayerSourcesOpen\(\s*Boolean\(source\?\.openSourcesDrawer && source\?\.mediaType !== "live" && !autoCheckWebsiteSources\)/);
  assert.match(player,/\{inPlayerSourcesOpen && \(/);
  assert.match(player,/<InPlayerSourceDrawer/);
  assert.match(player,/onSelect=\{\(index, item\) => \{/);
});

test("the title Sources panel uses the same first-party player and drawer", () => {
  assert.match(box,/label: "Play in Media God"/);
  assert.match(box,/onClick: playInMediaGod/);
  const route = box.slice(box.indexOf("const playInMediaGod = async () => {"),box.indexOf("const playCombinedDebrid ="));
  assert.match(route,/openSourcesDrawer: true/);
  assert.match(route,/completeSources: playableSources/);
  assert.match(route,/classifyTvBoxSource\(item\)\.kind !== "webpage"/);
});

test("Sources changes never interfere with live TV or the established device native player", () => {
  assert.match(box,/if \(mediaType === "live"\) return/);
  assert.match(player,/source\?\.mediaType !== "live"/);
  assert.match(player,/isNativeFireTvPlayerAvailable\(\)/);
  assert.match(provider,/setVidSrcEmbed\(null\)/);
});
