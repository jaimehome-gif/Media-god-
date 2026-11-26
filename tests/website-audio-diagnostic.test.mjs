import test from "node:test";
import assert from "node:assert/strict";
import { describeWebsiteAudio, restoreWebsiteAudioOutput, websiteAudioReport, websiteAudioSnapshot } from "../src/components/mg/websiteAudioDiagnostic.js";
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

test("local audio summaries distinguish unsupported decoding, mute and unknown counters",()=>{
  const report={sameElement:true,after:{mediaElement:true,muted:false,volumePercent:100,paused:false},positionAdvancedMs:2000,videoFramesAdvanced:48,audioBytesAdvanced:0};
  assert.match(describeWebsiteAudio(report),/no additional decoded audio bytes/);
  assert.match(describeWebsiteAudio({...report,audioBytesAdvanced:null}),/could not be confirmed/);
  assert.match(describeWebsiteAudio({...report,audioBytesAdvanced:4000}),/reports decoded audio/);
  assert.match(describeWebsiteAudio({...report,after:{...report.after,muted:true}}),/muted/);
  assert.match(describeWebsiteAudio({...report,after:{...report.after,mediaErrorCode:4}}),/rejected the media format/);
  assert.match(describeWebsiteAudio({...report,sameElement:false}),/changed during measurement/);
  assert.match(describeWebsiteAudio({after:{mediaElement:false}}),/No browser media element/);
});
test("explicit unmute preserves selected source, volume preference and playback state",()=>{
  let playCalls=0;
  const video={muted:true,volume:0.4,paused:true,src:"https://example.invalid/personal.mp4",play:()=>playCalls++};
  assert.equal(restoreWebsiteAudioOutput(video),true);
  assert.equal(video.muted,false);
  assert.equal(video.volume,0.4);
  assert.equal(video.paused,true);
  assert.equal(video.src,"https://example.invalid/personal.mp4");
  assert.equal(playCalls,0);
  video.volume=0;
  assert.equal(restoreWebsiteAudioOutput(video),true);
  assert.equal(video.volume,1);
  assert.equal(restoreWebsiteAudioOutput(null),false);
});
