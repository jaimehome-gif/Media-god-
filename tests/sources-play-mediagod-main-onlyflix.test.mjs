import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { classifyTvBoxSource } from "../src/components/mg/tvBoxSourceGate.js";

const read = path => readFileSync(new URL("../"+path, import.meta.url), "utf8");
const sources = read("src/components/mg/MediaStreamSourcesBox.jsx");
const functionBody = (start,end) => {
  const a=sources.indexOf(start),b=sources.indexOf(end,a);
  assert.ok(a>=0&&b>a,"Sources handler missing: "+start);
  return sources.slice(a,b);
};
const createSources = ({
  hasDebrid=true, mediaType="movie", resumeAt=120, savedSources=[]
}={})=>{
  const calls=[],messages=[],combined=[];
  const vars={
    player:{play:async request=>{calls.push(request);return true;}},
    visibleAddonStreams:savedSources,
    addonStreams:savedSources,
    websiteCatalogue:true,
    classifyTvBoxSource,
    setMessage:x=>messages.push(x),
    setRdSearching:()=>{},
    rdSearching:false,
    hasDebrid,mediaType,resumeAt,
    tmdbId:"42",imdbId:"tt12345",resolvedImdb:"tt12345",
    title:"Test film",poster:"/poster.jpg",rdYear:2025,
    season:mediaType==="tv"?2:null,episode:mediaType==="tv"?4:null,
    alternateYears:[],alternateTitles:[],
    sourceHasPendingCacheSignal:()=>false,
    sourceIsConfirmedCachedForPlayback:()=>true,
  };
  const playInMediaGod=vm.runInNewContext(
    functionBody("  const playInMediaGod = async () => {","  const playCombinedDebrid =")+"\nplayInMediaGod",vars
  );
  vars.playCombinedDebrid=async opts=>combined.push(opts);
  const playAddonStream=vm.runInNewContext(
    functionBody("  const playAddonStream =","  const pasteMagnet =")+"\nplayAddonStream",vars
  );
  return {playInMediaGod,playAddonStream,calls,messages,combined};
};
test("main movie Play remains OnlyFlix first and no longer uses the web-player override",()=>{
  const card=read("src/components/mg/MediaCard.jsx");
  const home=read("src/components/mg/HomeDashboard.jsx");
  const details=read("src/components/mg/DetailModal.jsx");
  for(const file of [card,home,details]){
    assert.match(file,/playOnlyFlix/);
    assert.doesNotMatch(file,/launchMediaGodVod/);
    assert.match(file,/launchFireTvCardPlay/);
  }
  const episodes=read("src/components/mg/EpisodeSelector.jsx");
  const newEpisodes=read("src/components/mg/NewEpisodesRow.jsx");
  assert.match(episodes,/player\.playOnlyFlix\?\.\(baseRequest\)/);
  assert.match(episodes,/player\.playVidCore\?\.\(baseRequest\)/);
  assert.match(newEpisodes,/player\.playOnlyFlix\?\.\(/);
  assert.match(newEpisodes,/player\.playVidCore\?\.\(/);
});

test("Sources Play uses our player in browser and APK, preserves resume and candidates",async()=>{
  const direct={type:"url",src:"https://cdn.example.test/film.mkv",label:"1080p WEB-DL"};
  const html={type:"url",src:"https://onlyflix.to/embed/42",label:"OnlyFlix page"};
  const ctx=createSources({savedSources:[direct,html],resumeAt:241});
  await ctx.playInMediaGod();
  assert.equal(ctx.calls.length,1);
  const req=ctx.calls[0];
  assert.equal(req.title,"Test film");
  assert.equal(req.startTime,241);
  assert.equal(req.verifiedPlaybackPolicy,"strict");
  assert.equal(req.noRd,false);
  assert.equal(req.skipAddonLookup,false);
  assert.equal(req.skipRdLookup,false);
  assert.equal(req.allowNonPlaybackFallback,false);
  assert.deepEqual(Array.from(req.sources),[]);
  assert.equal(req.completeSources.length,1);
  assert.equal(req.completeSources[0].src,direct.src);
  assert.equal(req.completeSources[0].preferNativeVlc,true);
  assert.equal(req.src,"");
  assert.equal(req.url,"");
});

test("Sources Play on TV retains exact season and episode with no Real-Debrid",async()=>{
  const ctx=createSources({mediaType:"tv",hasDebrid:false,resumeAt:924});
  await ctx.playInMediaGod();
  assert.equal(ctx.calls.length,1);
  assert.equal(ctx.calls[0].season,2);
  assert.equal(ctx.calls[0].episode,4);
  assert.equal(ctx.calls[0].startTime,924);
  assert.equal(ctx.calls[0].noRd,true);
  assert.equal(ctx.calls[0].preferRd,false);
});

test("individual direct source Play opens the same Media God player, not an iframe",async()=>{
  const direct={type:"url",src:"https://cdn.example.test/film.mp4",label:"English 1080p"};
  const ctx=createSources({savedSources:[direct]});
  await ctx.playAddonStream(direct);
  assert.equal(ctx.calls.length,1);
  const req=ctx.calls[0];
  assert.equal(req.verifiedPlaybackPolicy,"manual");
  assert.equal(req.manualSourceSelection,true);
  assert.equal(req.skipAddonLookup,true);
  assert.equal(req.skipRdLookup,true);
  assert.equal(req.sources[0].src,direct.src);
  assert.equal(req.sources[0].preferNativeVlc,true);
});

test("Sources resolves an HTML watch-page selection to real media, never passes HTML as a file",async()=>{
  const page={type:"url",src:"https://onlyflix.to/watch/123"};
  const ctx=createSources({savedSources:[page]});
  await ctx.playAddonStream(page);
  assert.equal(ctx.calls.length,0);
  assert.equal(ctx.combined.length,1);
  assert.equal(ctx.combined[0].readyOnly,false);
});
test("without Real-Debrid, HTML sources give safe feedback instead of opening a silent web player",async()=>{
  const page={type:"url",src:"https://onlyflix.to/watch/123"};
  const ctx=createSources({savedSources:[page],hasDebrid:false});
  await ctx.playAddonStream(page);
  assert.equal(ctx.calls.length,0);
  assert.equal(ctx.combined.length,0);
  assert.match(ctx.messages.join(" "),/web-player page/);
});

test("Live TV preserves original provider route and has no new Source Play shortcut",async()=>{
  const ctx=createSources({mediaType:"live"});
  await ctx.playInMediaGod();
  assert.equal(ctx.calls.length,0);
  assert.match(sources,/\.\.\.\(mediaType === "live" \? \[\] : \[\{/);
  assert.match(sources,/label: "Play in Media God"/);
  assert.match(sources,/onClick: playInMediaGod/);
});
