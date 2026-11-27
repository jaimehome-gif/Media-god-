import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { websiteRenditionAllowed, websiteTorrentCandidate, canOpenWebsiteMovi, isWebsiteRateLimitHold, isPublicWebsiteVod, isWebsiteSourcesPlayback, checkWebsiteDirectMedia, isWebsiteDirectSourceChoice, isWebsiteSavedPersonalPendingChoice } from "../src/components/mg/websiteDirectMediaPolicy.js";

const profile = {nativePlayerAvailable:false};
const context = {hostname:"underworldhub.co.uk",profile,source:{openSourcesDrawer:true},isLive:false};
const caps = {canPlayType:mime=>/avc1|video\/webm/.test(mime)?"probably":"",mseSupports:()=>true};
const url = "https://media.example.test/owned-sample.mp4";
const item = (video="h264",audio="aac")=>({mediaInfo:{video_tracks:[{codec:video}],audio_tracks:[{codec:audio}]}});
const check = (value, path=url, capabilities=caps)=>checkWebsiteDirectMedia({url:path,item:value,...capabilities});

test("only the website Sources path changes, never native or ordinary Play",()=>{
  assert.equal(isWebsiteSourcesPlayback(context),true);
  for (const flag of ["nativePlayerAvailable","nativeAndroidMobile","nativeFireTv","mobileApp","fireTv"])
    assert.equal(isWebsiteSourcesPlayback({...context,profile:{...profile,[flag]:true}}),false);
  assert.equal(isWebsiteSourcesPlayback({...context,source:{}}),false);
  assert.equal(isWebsiteSourcesPlayback({...context,isLive:true}),false);
  assert.equal(isWebsiteSourcesPlayback({...context,hostname:"example.test"}),false);
  assert.equal(isWebsiteSourcesPlayback({...context,profile:{}}),false);
});
test("inspected compatible direct media passes browser capability checks",()=>{
  assert.equal(check(item()).allowed,true);
  assert.equal(check(item(),"https://media.example.test/owned-sample.m3u8").allowed,true);
  assert.equal(check(item("vp9","opus"),"https://media.example.test/owned-sample.webm").allowed,true);
  assert.equal(check(item(),url,{canPlayType:()=>""}).allowed,false);
});
test("unsupported, missing, uncertain and mixed audio metadata fail closed",()=>{
  for(const sample of [item("hevc"),item("h264","dts"),item("h264","eac3"),{}, {videoCodec:"h264",audioCodec:"aac"},
    {...item(),audioRescue:{used:true}}, {...item(),drm:{type:"widevine"}}]) assert.equal(check(sample).allowed,false);
  const mixed=item();
  mixed.mediaInfo.audio_tracks.push({codec:"truehd"});
  assert.equal(check(mixed).allowed,false);
  assert.equal(check(item(),"http://media.example.test/owned-sample.mp4").allowed,false);
  assert.equal(check(item(),"https://media.example.test/owned-sample.mkv").allowed,false);
});
test("public website rejects before existing browser playback and keeps native route",()=>{
  const player=readFileSync(new URL("../src/components/mg/VideoPlayer.jsx",import.meta.url),"utf8");
  assert.match(player,/const useBrowserSourceVlc = !websiteSourcesPlayback && !nativeFireTvPlayer/);
  assert.match(player,/websiteDirectMediaCheck\?\.allowed === false[\s\S]*?Return to Sources[\s\S]*?useBrowserSourceVlc \?/);
  assert.match(player,/websiteRenditionAllowed\(resolvedSourceUrl, active, rdOverride\)/);
  assert.match(player,/useNativePlayback \? \(/);
});

test("HLS requires AAC video/audio support in addition to native container support",()=>{
  const hls = "https://media.example.test/owned-sample.m3u8";
  assert.equal(check(item(),hls,{canPlayType:mime=>mime.includes("mpegurl")?"maybe":""}).allowed,false);
  assert.equal(check(item(),hls,{canPlayType:()=> "probably",mseSupports:()=>{throw Error("unavailable");}}).allowed,true);
  assert.equal(check(item(),hls,{canPlayType:mime=>mime.includes("avc1")?"probably":"",mseSupports:()=>{throw Error("unavailable");}}).allowed,false);
});
test("direct browser URLs do not accept embedded credentials",()=>{
  assert.equal(check(item(),"https://user:pass@media.example.test/owned-sample.mp4").allowed,false);
});

test("original protected source remains excluded even when resolved rendition lacks protection metadata",()=>{
  const originalItem = { ...item(), drm: { type: "widevine" } };
  const result = checkWebsiteDirectMedia({url,item:item(),originalItem,...caps});
  assert.equal(result.allowed,false);
  assert.match(result.reason,/Protected media/);
  assert.equal(checkWebsiteDirectMedia({url,item:item(),originalItem:item(),...caps}).allowed,true);
  const player=readFileSync(new URL("../src/components/mg/VideoPlayer.jsx",import.meta.url),"utf8");
  assert.match(player,/websiteRenditionAllowed\(resolvedSourceUrl, active, rdOverride\)/);
});


test("website chooser excludes unknown, failed and non-direct media without renumbering entries",()=>{
  const entries=[{index:2,item:{...item(),src:url}},{index:4,item:{...item("h264","dts"),src:url}},{index:7,item:{src:url}},{index:9,item:{...item(),src:url,headers:{Authorization:"synthetic"}}},{index:12,item:{...item(),src:url}},{index:14,item:{...item(),src:url,type:"external"}}];
  const result=entries.filter(({index,item})=>isWebsiteDirectSourceChoice({item,originalItem:item,url:item.src,failed:index===12,...caps}));
  assert.deepEqual(result.map(entry=>entry.index),[2]);
});

test("website chooser does not inherit original codecs for an unverified rendition",()=>{
  const originalItem={...item(),src:url};
  assert.equal(isWebsiteDirectSourceChoice({item:{src:url},originalItem,url,...caps}),false);
  assert.equal(isWebsiteDirectSourceChoice({item:originalItem,originalItem,url,...caps}),true);
});

test("Sources chooser retains resolver inputs and other website menus retain codec screening",()=>{
  const player=readFileSync(new URL("../src/components/mg/VideoPlayer.jsx",import.meta.url),"utf8");
  const controls=readFileSync(new URL("../src/components/mg/MediaPlayerControls.jsx",import.meta.url),"utf8");
  assert.match(player,/const presentedSourceEntries = filterDirectChoices[\s\S]*?websiteSourceChoiceAllowed\(index, item\)[\s\S]*?: selectableSourceEntries/);
  assert.match(player,/entries=\{presentedSourceEntries\}/);
  assert.match(player,/presentedSelectorEntries\.map\(/);
  assert.equal((player.match(/sourceChoiceAllowed=\{publicWebsiteVod \? websiteSourceChoiceAllowed : undefined\}/g)||[]).length,2);
  assert.match(controls,/!sourceChoiceAllowed \|\| sourceChoiceAllowed\(index, item\)/);
});


test("website WebM accepts only the phone-verified VP9 and Opus combination",()=>{
  const webm="https://media.example.test/owned-sample.webm";
  assert.equal(check(item("vp9","opus"),webm).allowed,true);
  assert.equal(check(item("vp8","opus"),webm).allowed,false);
  assert.equal(check(item("vp9","vorbis"),webm).allowed,false);
  assert.equal(check(item("vp9","aac"),webm).allowed,false);
});


test("both public hostnames use the same direct media engine regardless of launch flags",()=>{
  for(const hostname of ["underworldhub.co.uk","www.underworldhub.co.uk"]){
    assert.equal(isPublicWebsiteVod({...context,hostname,source:{}}),true);
    assert.equal(isWebsiteSourcesPlayback({...context,hostname,source:{}}),false);
    for(const flag of ["nativePlayerAvailable","nativeAndroidMobile","nativeFireTv","mobileApp","fireTv"])
      assert.equal(isPublicWebsiteVod({...context,hostname,profile:{...profile,[flag]:true}}),false);
  }
  assert.equal(isPublicWebsiteVod({...context,isLive:true}),false);
  assert.equal(isPublicWebsiteVod({...context,hostname:"example.test"}),false);
  const player=readFileSync(new URL("../src/components/mg/VideoPlayer.jsx",import.meta.url),"utf8");
  assert.match(player,/const useBrowserSourceVlc = !websiteSourcesPlayback && !nativeFireTvPlayer && !publicWebsiteVod/);
});


test("public Sources screens the resolved transport independently of chooser rows",()=>{
  const player=readFileSync(new URL("../src/components/mg/VideoPlayer.jsx",import.meta.url),"utf8");
  assert.match(player,/const websiteSourceChoiceAllowed = \(index, item\) => \{\s*if \(!filterDirectChoices\) return true;/);
  assert.match(player,/const websiteDirectMediaCheck = websiteSourcesPlayback && resolvedSourceUrl/);
  assert.match(player,/const presentedSourceEntries = filterDirectChoices/);
});


test("rate-limit notice never exposes the unrestricted website menu even if layout is misclassified",()=>{
  for(const hostname of ["underworldhub.co.uk","www.underworldhub.co.uk"]){
    const input={...context,hostname,error:"Real-Debrid is temporarily rate-limiting requests."};
    assert.equal(isWebsiteRateLimitHold(input),true);
    assert.equal(isWebsiteRateLimitHold({...input,profile:{...profile,fireTv:true}}),true);
    assert.equal(isWebsiteRateLimitHold({...input,error:"HTTP 429"}),true);
    for(const flag of ["nativePlayerAvailable","nativeAndroidMobile","nativeFireTv","mobileApp","nativePlatform"])
      assert.equal(isWebsiteRateLimitHold({...input,profile:{...profile,[flag]:true}}),false);
    assert.equal(isWebsiteRateLimitHold({...input,isLive:true}),false);
    assert.equal(isWebsiteRateLimitHold({...input,error:"Other media error"}),false);
    assert.equal(isWebsiteRateLimitHold({...input,hostname:"example.test"}),false);
  }
  const player=readFileSync(new URL("../src/components/mg/VideoPlayer.jsx",import.meta.url),"utf8");
  assert.match(player,/const publicWebsiteVod = [^\n]+ \|\| websiteRateLimitHold\)/);
  assert.match(player,/if \(websiteRateLimitHold\) return false;/);
  assert.equal((player.match(/isRdSource && !websiteRateLimitHold && \(/g)||[]).length,2);
  assert.match(player,/source choices are paused/);
});


test("synthetic website menu remains restricted through normal, rate-limit and recovered states",()=>{
  const choices=[
    {index:0,item:{...item(),src:url}},
    {index:1,item:{...item("hevc","aac"),src:url}},
    {index:2,item:{src:url}},
    {index:3,item:{...item("h264","dts"),src:url}}
  ];
  for(const hostname of ["underworldhub.co.uk","www.underworldhub.co.uk"]){
    const visible=error=>{
      const input={...context,hostname,error};
      const hold=isWebsiteRateLimitHold(input);
      const restricted=isPublicWebsiteVod(input)||hold;
      return choices.filter(({item})=>!restricted||(!hold&&isWebsiteDirectSourceChoice({item,originalItem:item,url:item.src,...caps}))).map(entry=>entry.index);
    };
    assert.deepEqual(visible(""),[0]);
    assert.deepEqual(visible("HTTP 429"),[]);
    assert.deepEqual(visible(""),[0]);
  }
});

test("Movi accepts a secure resolved file without codec labels and honours transport constraints", () => {
  assert.equal(canOpenWebsiteMovi(url, { type: "torrent" }, {}), true);
  for (const value of ["", "magnet:?xt=demo", "https://user:password@media.example.test/video"]) {
    assert.equal(canOpenWebsiteMovi(value, {}, {}), false);
  }
  for (const field of [{ drm: {} }, { requestHeaders: { Authorization: "fixture" } }]) {
    assert.equal(canOpenWebsiteMovi(url, {}, field), false);
    assert.equal(canOpenWebsiteMovi(url, field, {}), false);
  }
});

test("explicitly saved personal torrent is pending, never treated as a verified direct file",()=>{
  const saved={type:"rd",addon:"Sources",magnet:"magnet:?xt=urn:btih:"+"a".repeat(40)};
  const source={id:"debrid-source:fixture",skipAddonLookup:true,skipRdLookup:true,sources:[saved]};
  const input={source,item:saved};
  assert.equal(isWebsiteSavedPersonalPendingChoice(input),true);
  assert.equal(isWebsiteDirectSourceChoice({item:saved,originalItem:saved,url:saved.magnet,...caps}),false);
  assert.equal(isWebsiteSavedPersonalPendingChoice({...input,resolvedUrl:url}),false);
  assert.equal(isWebsiteSavedPersonalPendingChoice({...input,failed:true}),false);
  assert.equal(isWebsiteSavedPersonalPendingChoice({...input,item:{...saved,drm:true}}),false);
  assert.equal(isWebsiteSavedPersonalPendingChoice({...input,source:{...source,id:"catalogue:fixture"}}),false);
  assert.equal(isWebsiteSavedPersonalPendingChoice({...input,source:{...source,skipAddonLookup:false}}),false);
  assert.equal(isWebsiteSavedPersonalPendingChoice({...input,item:{...saved,magnet:saved.magnet+"b"}}),false);
  const player=readFileSync(new URL("../src/components/mg/VideoPlayer.jsx",import.meta.url),"utf8");
  assert.match(player,/if \(websiteRateLimitHold\) return false;\s*if \(websitePersonalPendingChoice\(index, item\)\) return true;/);
  assert.match(player,/websiteDirectMediaCheck\?\.allowed === false/);
  assert.match(player,/awaiting compatibility check/);
});

test("website discovery excludes known incompatible files but retains incomplete metadata for inspection", () => {
  const candidate = label => websiteTorrentCandidate({type:"rd",label});
  for (const label of ["Trusted Cached · 4K · HDR · HEVC", "2160p x264", "1080p AV1 HDR", "x264 Hi10P", "x264 TrueHD"])
    assert.equal(candidate(label),false,label);
  for (const label of ["release.1080p.x264.AAC.mp4", "1080p VP9 Opus.webm", "1080p x265 AAC.mkv", "AV1 Opus.mkv", "XviD MP3.mkv", "VP8 Vorbis.webm", "H264 FLAC.mkv"])
    assert.equal(candidate(label),true,label);
  for (const label of ["x264 AAC.avi", "x264 DTS.mp4", "VP9 MP3.webm"])
    assert.equal(candidate(label),false,label);
  assert.equal(websiteRenditionAllowed(url,{label:"x264 AAC.mp4"},{}),false);
  assert.equal(websiteRenditionAllowed(url,item(),item("h264","dts")),false);
  assert.equal(websiteRenditionAllowed(url,item(),item()),true);
  for (const track of [{height:2160}, {bit_depth:10}, {color_transfer:"smpte2084"}, {pix_fmt:"yuv420p10le"}])
    assert.equal(websiteTorrentCandidate({type:"rd",mediaInfo:{video_tracks:[{codec:"hevc",...track}],audio_tracks:[{codec:"aac"}]}}),false);
  for (const label of ["1080p MPEG-4 container", "1080p", "x264 AAC", "x264.mkv"])
    assert.equal(candidate(label),true,label);
  assert.equal(websiteTorrentCandidate({type:"url",url}),true);
  assert.equal(websiteRenditionAllowed(url,{type:"url",url},{}),false);
});

test("website catalogue excludes pending releases and unsuitable direct links", () => {
  const torrent = {type:"rd", label:"1080p H264 AAC"};
  for (const state of [{label:"Uncached 1080p H264 AAC"}, {rdStatus:"downloading"}, {cometUncached:true},
      {debridCacheChecked:true,debridCached:false}]) {
    assert.equal(websiteTorrentCandidate({...torrent,...state}),false);
  }
  for (const source of [{url:"http://example.test/movie.mp4"}, {url,type:"embed"},
      {url,mimeType:"text/html"}, {url,headers:{Referer:"private"}}, {url,...item("h264","truehd")}]) {
    assert.equal(websiteTorrentCandidate(source),false);
  }
  assert.equal(websiteTorrentCandidate({url,...item("h264","")}),true);
  assert.equal(websiteRenditionAllowed(url,{},item("h264","")),false);
  assert.equal(websiteTorrentCandidate({url,mediaInfo:{video_tracks:[{codec:"h264"}],audio_tracks:[]}}),false);
  assert.equal(websiteTorrentCandidate({url:"https://example.test/opaque",...item("h264","aac")}),true);
  assert.equal(websiteRenditionAllowed("https://example.test/opaque",{},item("h264","aac")),false);
});

// An authorised personal media listing can be incomplete before resolution.
// Discovery must remain stable without admitting unknown codecs to playback.
test("incomplete personal-media listings survive discovery but never bypass rendition validation", () => {
  const candidates = [
    { type:"url", url, label:"Owned test file" },
    { type:"url", url, mediaInfo:{video_tracks:[{codec:"h264"}]} },
    { type:"url", url, mediaInfo:{audio_tracks:[{codec:"aac"}]} },
    { type:"url", url, ...item("h264","truehd") },
    { type:"url", url, drm:true },
  ];
  assert.deepEqual(candidates.map(websiteTorrentCandidate),[true,true,true,false,false]);
  for (const candidate of candidates.slice(0,3)) {
    assert.equal(websiteRenditionAllowed(url,candidate,candidate),false);
    assert.equal(websiteRenditionAllowed(url,candidate,item()),true);
  }
  assert.equal(websiteRenditionAllowed(url,candidates[4],item()),false);
});

// Keep lookup inputs distinct from the public compatible-file list, and make
// Combined Debrid opt into the same website-only automatic decoder checks.
test("Combined Debrid retains discovery candidates and only presents verified website playback choices", () => {
  const player = readFileSync(new URL("../src/components/mg/VideoPlayer.jsx",import.meta.url),"utf8");
  const box = readFileSync(new URL("../src/components/mg/MediaStreamSourcesBox.jsx",import.meta.url),"utf8");
  assert.match(player,/const autoCheckWebsiteSources = Boolean\(\(source\?\.openSourcesDrawer \|\| source\?\.debridManual\) && !source\?\.manualSourceSelection/);
  assert.match(player,/const filterDirectChoices = publicWebsiteVod;/);
  assert.match(player,/if \(websiteSourcesPlayback\) \{[\s\S]*?websiteRenditionAllowed\(getSourceUrl\(rendition\), item, rendition\)/);
  assert.match(player,/const candidates = selectableSourceEntries\.filter/);
  assert.match(box,/const displayedAddonStreams = useMemo\(\(\) => websiteCatalogue[\s\S]*?websiteRenditionAllowed/);
  assert.match(box,/\.\.\.displayedAddonStreams\.slice/);
  assert.match(box,/const playCombinedDebrid =[\s\S]*?completeSources: mediaType === "live"\s*\? visibleAddonStreams\s*: visibleAddonStreams/);
});

// An already inspected personal-library file must not disappear because stale
// discovery metadata described the earlier, unresolved torrent.
test("verified library renditions survive stale cache flags but unresolved files do not", () => {
  const stale = {type:"rd",debridCacheChecked:true,debridCached:false,debridCacheCheckState:"uncached",cacheRequired:true};
  const verified = {...stale,...item(),type:"file",src:url,launchQualified:true};
  assert.equal(websiteTorrentCandidate(verified),true);
  assert.equal(websiteTorrentCandidate({...verified,src:"magnet:?xt=demo"}),false);
  assert.equal(websiteTorrentCandidate({...verified,mediaInfo:undefined}),false);
  assert.equal(websiteTorrentCandidate({...verified,drm:true}),false);
  assert.equal(websiteTorrentCandidate({...verified,headers:{Authorization:"fixture"}}),false);
  assert.equal(websiteTorrentCandidate({...verified,...item("h264","truehd")}),false);
  assert.equal(websiteTorrentCandidate({...verified,launchQualified:false}),false);
});
test("website Combined Debrid checks the account library even with an empty initial candidate pool", () => {
  const provider = readFileSync(new URL("../src/components/mg/MediaPlayerProvider.jsx",import.meta.url),"utf8");
  assert.match(provider,/const websiteAccountLibraryLookup = \(request\?\.openSourcesDrawer \|\| request\?\.debridManual\)/);
  assert.match(provider,/if \(hasRd && !request\?\.noRd && !request\?\.skipRdLookup && websiteAccountLibraryLookup &&\s*initialPlayableSources\.every/);
  assert.match(provider,/cached\?\.launchQualified && websiteTorrentCandidate\(cached\)/);
});
