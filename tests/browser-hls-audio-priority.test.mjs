import test from "node:test";
import assert from "node:assert/strict";
import { browserHlsAudioPenalty } from "../src/components/mg/browserHlsAudioPriority.js";
import { readFileSync } from "node:fs";
const live=readFileSync(new URL("../src/components/mg/LiveVideo.jsx", import.meta.url),"utf8");

test("Browser HLS favours AAC over unsupported English Dolby",()=>{
  const ac3={audioCodec:"ac-3",lang:"en"};
  const aac={audioCodec:"mp4a.40.2",lang:"en"};
  const unsupported=()=>false;
  assert.equal(browserHlsAudioPenalty(ac3,unsupported),-150000);
  assert.equal(browserHlsAudioPenalty(aac,unsupported),0);
});
test("Browser accepting Dolby keeps original language/codec priority",()=>{
  const supported=mime=>mime.includes("ac-3");
  assert.equal(browserHlsAudioPenalty({audioCodec:"ac-3"},supported),0);
  assert.equal(browserHlsAudioPenalty({attrs:{CODECS:"ec-3"}},()=>true),0);
});
test("Unknown codec metadata is not rejected; DTS and TrueHD are penalised",()=>{
  assert.equal(browserHlsAudioPenalty({name:"Main English"},()=>false),0);
  assert.equal(browserHlsAudioPenalty({audioCodec:"dts-hd"},()=>false),-150000);
  assert.equal(browserHlsAudioPenalty({audioCodec:"truehd"},()=>false),-150000);
});
test("Track selection only changes browser VOD, not live TV",()=>{
  assert.match(live,/const choosePreferredHlsAudioTrack = \([\s\S]*?browserVod = false/);
  assert.match(live,/browserVod\s*\? browserHlsAudioPenalty\(/);
  assert.ok((live.match(/requireEnglishAudioRef\.current,\s*!isLive/g)||[]).length>=2);
  assert.match(live,/if \(!isLive && manualVodAudioChoice\) return/);
});
