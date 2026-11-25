import test from "node:test";
import assert from "node:assert/strict";
import { websiteAudioReport, websiteAudioSnapshot } from "../src/components/mg/websiteAudioDiagnostic.js";
test("browser audio report distinguishes silent decoding from advancing picture",()=>{
  const v={muted:false,defaultMuted:false,volume:1,paused:false,readyState:4,currentTime:1,webkitAudioDecodedByteCount:0,audioTracks:[{enabled:true,label:"private"}],getVideoPlaybackQuality:()=>({totalVideoFrames:24}),src:"https://example.test/private-token"};
  const a=websiteAudioSnapshot(v);
  const b=websiteAudioSnapshot({...v,currentTime:3,getVideoPlaybackQuality:()=>({totalVideoFrames:72})});
  const r=websiteAudioReport(a,b);
  assert.equal(r.positionAdvancedMs,2000);
  assert.equal(r.videoFramesAdvanced,48);
  assert.equal(r.audioBytesAdvanced,0);
  assert.equal(r.after.enabledAudioTracks,1);
  assert.doesNotMatch(JSON.stringify(r),/private|example\.test|https/);
});
test("unsupported counters and replaced media elements do not imply zero audio",()=>{
  const a=websiteAudioSnapshot({currentTime:1});
  const b=websiteAudioSnapshot({currentTime:2});
  assert.equal(websiteAudioReport(a,b).audioBytesAdvanced,null);
  assert.equal(websiteAudioReport(a,b,false).positionAdvancedMs,null);
  assert.deepEqual(websiteAudioSnapshot(null),{mediaElement:false});
});
