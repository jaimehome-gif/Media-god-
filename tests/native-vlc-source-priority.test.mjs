import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const code = readFileSync(new URL("../src/components/mg/fireTvCardPlay.js", import.meta.url), "utf8")
  .replace(/^import\s+[^\n]+\n/gm, "")
  .replace("export const launchFireTvCardPlay", "const launchFireTvCardPlay");

function launch({ native = true, isTv = true, hasOnlyFlix = true } = {}) {
  const calls = [];
  const context = {
    navigator: { userAgent: "Mozilla/5.0 (Linux; Android 11; AFTMM)" },
    getPlaybackDeviceProfile: () => ({ nativeFireTv: isTv }),
    supportsLegacyBoxWebPlayer: () => true,
    prefersNativeBoxPlayer: () => false,
    isNativeFireTvPlayerAvailable: () => native,
    browserCodecSupport: { h264Aac: true },
    mediaForTorrentFallback: x => x
  };
  const handler = vm.runInNewContext(code+"\nlaunchFireTvCardPlay",context);
  const player = {
    play: async req => { calls.push({ mode: "native", request: req }); },
    playOnlyFlix: hasOnlyFlix ? () => { calls.push({mode:"web"}); return true; } : undefined,
    playVidCore: () => { calls.push({mode:"vidcore"}); return true; }
  };
  const result = handler(player,{ title:"Sample Film",id:123,tmdbId:123,mediaType:"movie" });
  return { result, calls };
}

test("installed Fire Stick uses Media God VLC resolution before any web embed", () => {
  const {result,calls}=launch();
  assert.equal(result,true);
  assert.deepEqual(calls.map(c=>c.mode),["native"]);
  assert.equal(calls[0].request.preferRd,true);
  assert.equal(calls[0].request.verifiedPlaybackPolicy,"strict");
  assert.equal(calls[0].request.skipRdLookup,false);
  assert.equal(calls[0].request.skipAddonLookup,false);
  assert.equal(calls[0].request.src,"");
});

test("browser without native bridge retains explicitly supported web backup", () => {
  const {result,calls}=launch({ native:false });
  assert.equal(result,true);
  assert.deepEqual(calls.map(c=>c.mode),["web"]);
});

test("phone and desktop never enter Fire Stick-specific routing", () => {
  const {result,calls}=launch({ isTv:false });
  assert.equal(result,false);
  assert.equal(calls.length,0);
});
