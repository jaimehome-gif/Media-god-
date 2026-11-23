import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { classifyTvBoxSource } from "../src/components/mg/tvBoxSourceGate.js";
import { restoreResumeSource } from "../src/components/mg/resumeSource.js";
import { hasSeekableHistoryPosition } from "../src/components/mg/resumeHistoryPolicy.js";

const source=readFileSync(new URL("../src/components/mg/ContinueWatchingRow.jsx",import.meta.url),"utf8");
const start=source.indexOf("  const openDetail = async (item) => {");
const end=source.indexOf("\n  // An explicit Players action",start);
assert.ok(start>=0&&end>start,"Continue Watching resume handler must be present");
const method=source.slice(start,end);

const setup=({native=true,allowed=true,bookmark=null,imdbId="tt1234",meta={mediaType:"movie",title:"Test film",tmdbId:"55",year:"2026"}}={})=>{
  const calls=[],messages=[];
  const player={
    playSavedEmbed:(_media,b)=>{calls.push({kind:"embed",bookmark:b});return true;},
    playOnlyFlix:()=>{calls.push({kind:"onlyflix"});return true;},
    play:async req=>{calls.push({kind:"native",request:req});return true;}
  };
  const context={
    player,setResumeMessage:message=>messages.push(message),isNativeFireTvPlayerAvailable:()=>native,
    nativeFireTvAppInfo:()=>({native:allowed}),
    parseContentKey:item=>item.meta||meta,
    resolveTmdbIdQuickly:async meta=>meta.tmdbId||"",
    readEmbedBookmark:item=>item.bookmark??bookmark,
    hasSeekableHistoryPosition,
    restoreResumeSource,
    classifyTvBoxSource,
    isIpBoundHostedProvider:()=>false,
    isElfHostedUrl:()=>false,
    window:{location:{hostname:"underworldhub.co.uk",href:"https://underworldhub.co.uk/"}},
    decodeURIComponent,JSON,Number,String,Boolean,URL
  };
  const openDetail=vm.runInNewContext(method+"\nopenDetail",context);
  return {calls,messages,openDetail};
};

test("installed APK Resume does not reopen OnlyFlix/embed bookmark without saved position",async()=>{
  const {calls,openDetail}=setup({bookmark:{url:"https://onlyflix.to/embed/film123",provider:"onlyflix"}});
  await openDetail({source_type:"embed",progress:0,duration:0,video_url:"mgembed:old"});
  assert.deepEqual(calls.map(x=>x.kind),["native"]);
  assert.equal(calls[0].request.verifiedPlaybackPolicy,"strict");
  assert.equal(calls[0].request.resumeFromHistory,true);
  assert.deepEqual(Array.from(calls[0].request.sources),[]);
});

test("ordinary website retains explicitly saved embedded bookmark when no seek exists",async()=>{
  const {calls,openDetail}=setup({native:false,bookmark:{url:"https://onlyflix.to/embed/film123",provider:"onlyflix"}});
  await openDetail({source_type:"embed",progress:0,duration:0});
  assert.deepEqual(calls.map(x=>x.kind),["embed"]);
});

test("native Resume rejects saved HTML watch pages mislabelled as direct media",async()=>{
  const {calls,openDetail}=setup();
  await openDetail({source_type:"file",video_url:"https://onlyflix.to/watch/film123",progress:281,duration:3900});
  assert.deepEqual(calls.map(x=>x.kind),["native"]);
  assert.equal(calls[0].request.verifiedPlaybackPolicy,"strict");
  assert.deepEqual(Array.from(calls[0].request.sources),[]);
  assert.equal(calls[0].request.startTime,281);
});

test("native Resume preserves durable selected torrent source, seek point and exact TV episode",async()=>{
  const meta={mediaType:"tv",title:"Example show",tmdbId:"123",year:"2026",season:2,episode:4,episodeName:"Episode 4"};
  const {calls,openDetail}=setup({meta,bookmark:{url:"https://onlyflix.to/embed/episode",provider:"onlyflix"}});
  const original={infoHash:"a".repeat(40),fileIdx:5,src:"magnet:?xt=urn:btih:"+"a".repeat(40),type:"torrent"};
  const encoded="mgsource:"+encodeURIComponent(JSON.stringify(original));
  await openDetail({source_type:"rd",video_url:encoded,progress:913,duration:2700});
  assert.deepEqual(calls.map(x=>x.kind),["native"]);
  const r=calls[0].request;
  assert.equal(r.startTime,913);
  assert.equal(r.mediaType,"tv");
  assert.equal(r.season,2);
  assert.equal(r.episode,4);
  assert.equal(r.rdTitle,"Example show");
  assert.equal(r.verifiedPlaybackPolicy,"manual");
  assert.equal(r.manualSourceSelection,true);
  assert.equal(r.sources[0].fileIdx,5);
  assert.equal(r.sources[0].preferNativeVlc,true);
  assert.equal(r.sources[0].type,"torrent");
});

test("blocked native APK displays recovery notice rather than launching the silent web player",async()=>{
  const {calls,messages,openDetail}=setup({native:true,allowed:false});
  await openDetail({source_type:"embed",progress:0,duration:0});
  assert.equal(calls.length,0);
  assert.match(messages.join(" "),/built-in|installed Media God player|blocked/i);
  assert.match(source,/Reopen Media God for VLC/);
  assert.match(source,/url\.hostname = "underworldhub\.co\.uk"/);
});
