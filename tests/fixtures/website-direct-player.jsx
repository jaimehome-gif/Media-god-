import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import LiveVideo from "../../src/components/mg/LiveVideo.jsx";
import { checkWebsiteDirectMedia, getBrowserMediaCapabilities } from "../../src/components/mg/websiteDirectMediaPolicy.js";

const root = createRoot(document.getElementById("root"));
export function mountSample({ url, videoCodec, audioCodec }) {
  const gate = checkWebsiteDirectMedia({
    url, item: { mediaInfo: { video_tracks: [{ codec: videoCodec }], audio_tracks: [{ codec: audioCodec }] } },
    ...getBrowserMediaCapabilities(),
  });
  if (!gate.allowed) return gate;
  flushSync(() => root.render(
    <LiveVideo key={url} src={url} sourceLabel={url} isLive={false} allowMutedAutoplay={false}
      showCastButton={false} subtitlesEnabled={false} />
  ));
  if (!document.querySelector('video[data-mg-playback-surface="active"]')) {
    throw new Error("LiveVideo did not mount: " + document.getElementById("root").innerHTML.slice(0, 1000));
  }
  return gate;
}
export function unmountSample() {
  root.render(null);
}
