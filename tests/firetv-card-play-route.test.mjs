import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("installed Android and Fire TV Play choose Media God's native player when RD is connected", () => {
  const route = read("src/components/mg/fireTvCardPlay.js");
  assert.match(route, /profile\.nativeFireTv && !profile\.nativeAndroidMobile/);
  assert.match(route, /player\?\.hasRd === true \|\| prefersNativeBoxPlayer\(\)/);
  assert.match(route, /player\.play\(nativeRequest\)/);
  assert.match(route, /player\.playOnlyFlix\(scraperMedia\)/);
  assert.match(route, /player\.playVidCore\(scraperMedia\)/);
  assert.ok(route.indexOf("player.play(nativeRequest)") < route.indexOf("player.playOnlyFlix(scraperMedia)"));
  assert.ok(route.indexOf("player.playOnlyFlix(scraperMedia)") < route.indexOf("player.playVidCore(scraperMedia)"));
  assert.match(route, /mediaType: type === "series" \? "tv" : type/);
  assert.match(route, /verifiedPlaybackPolicy: "strict"/);
  assert.match(route, /skipRdLookup: false/);
  assert.match(route, /skipAddonLookup: false/);
  assert.match(route, /type === "movie" \|\| type === "tv" \|\| type === "series"/);
  for (const file of ["MediaCard","HomeDashboard","DetailModal","EpisodeSelector","NewEpisodesRow","RecentlyWatchedRow"]) {
    assert.match(read("src/components/mg/" + file + ".jsx"), /launchFireTvCardPlay\(player,/);
  }
});

test("Manual source cards, Fire TV web backup tabs and LibVLC stay available", () => {
  const core = read("src/components/mg/MediaPlayerProvider.jsx");
  assert.match(core, /return url \? startEmbed\(url, media, "onlyflix"\) : false;/);
  const embedded = read("src/components/mg/OnlyFlixEmbedPlayer.jsx");
  assert.match(embedded, /data-mg-embedded-top-sources="true"/);
  assert.match(embedded, /data-mg-embedded-top-fullscreen="true"/);
  assert.match(embedded, /initialFireTvScraper/);
  const cards = read("src/components/mg/MediaStreamSourcesBox.jsx");
  assert.match(cards, /label: "OnlyFlix • Multiple Servers"/);
  assert.match(cards, /player\.playVidCore\(/);
  const vlc = read("firetv-android/app/src/main/java/com/mediagod/firetv/PlaybackCompatibilityRouter.kt");
  assert.match(vlc, /default-libvlc-vod/);
});

test("native Play uses our verified direct-source route, but guest and web retain embeds", async () => {
  const vm = await import("node:vm");
  const route = read("src/components/mg/fireTvCardPlay.js");
  const body = route.slice(route.indexOf("export const launchFireTvCardPlay ="))
    .replace("export const launchFireTvCardPlay =", "const launchFireTvCardPlay =");
  const make = (profile, preferNative = false) => vm.runInNewContext(
    body + "\nlaunchFireTvCardPlay;",
    {
      getPlaybackDeviceProfile: () => profile,
      prefersNativeBoxPlayer: () => preferNative,
      supportsLegacyBoxWebPlayer: () => false,
      browserCodecSupport: {h264Aac: true},
      navigator: {userAgent: "test"},
      mediaForTorrentFallback: x => x,
    }
  );
  const calls = [];
  const connected = {
    hasRd: true,
    play: request => { calls.push(["native", request]); return Promise.resolve(true); },
    playOnlyFlix: () => { calls.push(["onlyflix"]); return true; },
  };
  const film = {id: 431, mediaType: "movie", title: "Example Film"};
  assert.equal(make({nativeFireTv: true})(connected, film), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "native");
  assert.equal(calls[0][1].verifiedPlaybackPolicy, "strict");
  assert.equal(calls[0][1].skipRdLookup, false);
  assert.equal(calls[0][1].skipAddonLookup, false);
  assert.equal(calls[0][1].src, "");
  calls.length = 0;
  assert.equal(make({nativeAndroidMobile: true})(connected, film), true);
  assert.equal(calls[0][0], "native");
  calls.length = 0;
  assert.equal(make({nativeFireTv: true})({...connected, hasRd: false}, film), true);
  assert.equal(calls[0][0], "onlyflix");
  calls.length = 0;
  assert.equal(make({nativeFireTv: false, nativeAndroidMobile: false})(connected, film), false);
  assert.equal(calls.length, 0);
  assert.equal(make({nativeFireTv: true})(connected, {type: "live", mediaType: "live"}), false);
  assert.equal(calls.length, 0);
});
