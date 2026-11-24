import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isWebsiteSourcesPlayback, checkWebsiteDirectMedia } from "../src/components/mg/websiteDirectMediaPolicy.js";

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
  assert.match(player,/item: rdOverride \|\| active/);
  assert.match(player,/useNativePlayback \? \(/);
});
