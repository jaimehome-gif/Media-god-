import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../"+path, import.meta.url),"utf8");
const only=read("src/components/mg/OnlyFlixEmbedPlayer.jsx");
const player=read("src/components/mg/VideoPlayer.jsx");
const core=read("src/components/mg/MediaPlayerProvider.jsx");
const live=read("src/components/mg/LiveVideo.jsx");
const card=read("src/components/mg/MediaCard.jsx");
const sources=read("src/components/mg/MediaStreamSourcesBox.jsx");

test("normal one-click Play remains OnlyFlix and its iframe is not replaced",()=>{
  assert.match(card,/player\.playOnlyFlix\(media\)/);
  assert.match(only,/data-mg-onlyflix-player="true"/);
  assert.match(only,/<iframe/);
  assert.match(only,/sandbox="allow-scripts allow-same-origin allow-presentation"/);
});

test("website-only OnlyFlix audio recovery offers an accessible topbar action",()=>{
  assert.match(only,/!isFireTv && activeEpisodePlayer !== "vyla" && typeof onOpenSources === "function"/);
  assert.match(only,/data-mg-embedded-top-web-sound-recovery="true"/);
  assert.match(only,/aria-label="Fix website sound with Media God"/);
  assert.match(only,/onClick=\{onOpenSources\}/);
  assert.match(only,/data-mg-embed-web-sound-recovery="true"/);
  assert.match(core,/onOpenSources=\{\(\) => \{/);
  assert.match(core,/skipAddonLookup: false/);
  assert.match(core,/skipRdLookup: false/);
  assert.match(core,/verifiedPlaybackPolicy: "strict"/);
  assert.match(core,/src: "",\s*url: "",\s*video_url: ""/);
});

test("Media God direct web player exposes its existing soundtrack and rendition rescue",()=>{
  assert.match(player,/data-mg-web-audio-recovery="true"/);
  assert.match(player,/!isLive && !nativeFireTvPlayer/);
  assert.match(player,/void handleNoSound\(\)/);
  assert.match(player,/force_audio_rescue: true/);
  assert.match(player,/prefer_browser_transcode: prefersBrowserRdCompatibility\(\)/);
  assert.match(player,/source\?\.hasRd/);
  assert.match(player,/tryNextSource\("No usable audio could be recovered from this source\."/);
  assert.match(player,/data-mg-audio-unlock="true"/);
  assert.match(player,/Play with sound/);
});

test("website VOD must not accept silent-muted autoplay fallback; Live TV policy unchanged",()=>{
  const instances=[...player.matchAll(/allowMutedAutoplay=\{isLive\}/g)];
  assert.ok(instances.length>=2,"Direct and Real-Debrid video must allow muted autoplay only for live TV");
  assert.match(live,/if \(!allowMutedAutoplayRef\.current\) \{/);
  assert.match(live,/onAutoplayBlockedRef\.current\?\.\(\)/);
  assert.match(live,/video\.muted\s*=\s*false/);
  assert.match(sources,/label: "Play in Media God"/);
});
