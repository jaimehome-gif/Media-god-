import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import LiveVideo from "../../src/components/mg/LiveVideo.jsx";
import { checkWebsiteDirectMedia, getBrowserMediaCapabilities } from "../../src/components/mg/websiteDirectMediaPolicy.js";

const EMPTY_SUBTITLES = Object.freeze([]);
const root = createRoot(document.getElementById("root"));
export function mountSample({ url, videoCodec, audioCodec }) {
  const gate = checkWebsiteDirectMedia({
    url, item: { mediaInfo: { video_tracks: [{ codec: videoCodec }], audio_tracks: [{ codec: audioCodec }] } },
    ...getBrowserMediaCapabilities(),
  });
  if (!gate.allowed) return gate;
  flushSync(() => root.render(
    <LiveVideo key={url} src={url} sourceLabel={url} isLive={false} allowMutedAutoplay={false}
      showCastButton={false} subtitles={EMPTY_SUBTITLES} subtitlesEnabled={false} />
  ));
  if (!document.querySelector('video[data-mg-playback-surface="active"]')) {
    throw new Error("LiveVideo did not mount: " + document.getElementById("root").innerHTML.slice(0, 1000));
  }
  return gate;
}
export function unmountSample() {
  root.render(null);
}

// Exercise the real Sources player handoff, not just the decoder component.
export async function mountSourcesSample({ url, videoCodec, audioCodec }) {
  const { default: VideoPlayer } = await import("../../src/components/mg/VideoPlayer.jsx");
  const { getPlaybackDeviceProfile } = await import("../../src/components/mg/mediaCompatibility.js");
  const { isWebsiteSourcesPlayback } = await import("../../src/components/mg/websiteDirectMediaPolicy.js");
  const item = {type:"file",src:url,url,label:"Owned synthetic browser sample",subtitles:EMPTY_SUBTITLES,
    mediaInfo:{video_tracks:[{codec:videoCodec}],audio_tracks:[{codec:audioCodec}]}};
  const source = {title:"Owned synthetic browser sample",mediaType:"movie",type:"movie",
    manualSourceSelection:true,skipAddonLookup:true,skipRdLookup:true,noRd:true,
    allowNonPlaybackFallback:false,verifiedPlaybackPolicy:"manual",sources:[item],completeSources:[item]};
  const route = isWebsiteSourcesPlayback({hostname:location.hostname,profile:getPlaybackDeviceProfile(),source,active:item,isLive:false});
  const gate = checkWebsiteDirectMedia({url,item,...getBrowserMediaCapabilities()});
  if (route && gate.allowed) flushSync(()=>root.render(<VideoPlayer source={source} onClose={()=>root.render(null)} />));
  return {route,allowed:gate.allowed,reason:gate.reason};
}
