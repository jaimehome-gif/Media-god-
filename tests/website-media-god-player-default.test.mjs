import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildMediaGodVodRequest, launchMediaGodVod } from "../src/components/mg/mediaGodVodLaunch.js";

const read = path => readFileSync(new URL("../"+path, import.meta.url), "utf8");

test("website primary Play starts Media God's player with fresh addon and RD discovery", () => {
  const calls=[];
  const player={play:request=>{calls.push(request);return Promise.resolve(true);},
    playOnlyFlix:()=>{throw Error("Cannot launch embed from default Play");}};
  assert.equal(launchMediaGodVod(player,{title:"Test film",id:12,mediaType:"movie",src:"https://onlyflix.to/watch/film"}),true);
  assert.equal(calls.length,1);
  assert.equal(calls[0].title,"Test film");
  assert.equal(calls[0].verifiedPlaybackPolicy,"strict");
  assert.equal(calls[0].preferRd,true);
  assert.equal(calls[0].skipAddonLookup,false);
  assert.equal(calls[0].skipRdLookup,false);
  assert.equal(calls[0].src,"");
  assert.deepEqual(calls[0].sources,[]);
  assert.deepEqual(calls[0].completeSources,[]);
});

test("default playback preserves exact episode, resume point and media identity", () => {
  const req=buildMediaGodVodRequest({title:"Example — S02E04",mediaType:"tv",
    season:2,episode:4,startTime:1810,tmdbId:45,rdTitle:"Example",imdbId:"tt123",
    includeAddonNames:["Allowed addon"]});
  assert.equal(req.startTime,1810);
  assert.equal(req.season,2);
  assert.equal(req.episode,4);
  assert.equal(req.tmdbId,45);
  assert.equal(req.rdTitle,"Example");
  assert.equal(req.imdbId,"tt123");
  assert.deepEqual(req.includeAddonNames,["Allowed addon"]);
  assert.equal(req.mediaType,"tv");
});

test("movie cards and Featured no longer launch embedded providers by default",()=>{
  const card=read("src/components/mg/MediaCard.jsx");
  const featured=read("src/components/mg/HomeDashboard.jsx");
  assert.match(card,/launchMediaGodVod\(player, media\)/);
  assert.match(featured,/launchMediaGodVod\(player, media\)/);
  assert.doesNotMatch(card,/player\.playOnlyFlix\(/);
  assert.doesNotMatch(featured,/player\.playOnlyFlix\(/);
});

test("film details and episode Play launch first-party player, not iframe tabs",()=>{
  const details=read("src/components/mg/DetailModal.jsx");
  const episodes=read("src/components/mg/EpisodeSelector.jsx");
  assert.match(details,/launchMediaGodVod\(player, onlyFlixMedia\)/);
  assert.match(episodes,/launchMediaGodVod\(player, baseRequest\)/);
  assert.doesNotMatch(details,/player\.playOnlyFlix\(/);
  assert.doesNotMatch(episodes,/player\.playOnlyFlix\?\.\(/);
  assert.doesNotMatch(episodes,/player\.playVidCore\?\.\(/);
});

test("New Episodes and Recently Watched use Media God video surface",()=>{
  const newEpisodes=read("src/components/mg/NewEpisodesRow.jsx");
  const recent=read("src/components/mg/RecentlyWatchedRow.jsx");
  assert.match(newEpisodes,/void player\.play\(\{/);
  assert.match(recent,/launchMediaGodVod\(player, \{/);
  assert.doesNotMatch(newEpisodes,/player\.playOnlyFlix\?\.\(/);
  assert.doesNotMatch(newEpisodes,/player\.playVidCore\?\.\(/);
  assert.doesNotMatch(recent,/player\.playOnlyFlix\(/);
});

test("Continue Watching uses first-party player, keeps explicit Web players backup",()=>{
  const row=read("src/components/mg/ContinueWatchingRow.jsx");
  const open=row.slice(row.indexOf("  const openDetail = async (item) => {"),
    row.indexOf("  // An explicit Players action",row.indexOf("  const openDetail = async (item) => {")));
  assert.ok(open.length>5000);
  assert.doesNotMatch(open,/player\.playSavedEmbed/);
  assert.doesNotMatch(open,/player\.playOnlyFlix/);
  assert.match(open,/startTime: Number\(item\.progress \|\| 0\)/);
  assert.match(open,/verifiedPlaybackPolicy: "strict"/);
  assert.match(row,/data-mg-continue-player-options="true"/);
  assert.match(row,/const launched = player\.playOnlyFlix\?\.\(\{/);
});

test("same Media God player surface exists on both website and installed apps",()=>{
  const renderer=read("src/components/mg/PlayerPortalRenderer.jsx");
  const player=read("src/components/mg/VideoPlayer.jsx");
  assert.match(renderer,/<VideoPlayer/);
  assert.match(player,/<PlayerControls/);
  assert.match(player,/<InPlayerSourceDrawer/);
  assert.match(player,/isNativeFireTvPlayerAvailable\(\)/);
  assert.match(player,/<LiveVideo/);
});
