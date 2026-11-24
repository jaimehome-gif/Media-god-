import React, { useEffect, useRef, useState } from "react";

export default function BrowserSourceVlc({ url, startTime, onProgress, onFallback }) {
  const [frame, setFrame] = useState("");
  const progress = useRef(onProgress);
  progress.current = onProgress;
  useEffect(() => {
    const key = crypto.randomUUID();
    const channel = new BroadcastChannel("mg-source-" + key);
    channel.onmessage = ({ data }) => {
      if (data.type === "ready") channel.postMessage({ type: "source", url, startTime });
      if (["progress", "pause", "ended"].includes(data.type) &&
          Number.isFinite(data.time) && data.time > 0 && Number.isFinite(data.duration) && data.duration > 0) {
        progress.current(data.time, data.duration, data.type !== "progress");
      }
    };
    setFrame("/source-player/index.html#" + key);
    return () => { channel.postMessage({ type: "close" }); channel.close(); };
  }, [url, startTime]);
  return <div className="relative h-full w-full bg-black">
    {frame && <iframe className="h-full w-full border-0" title="Media God VLC player" src={frame}
      allow="autoplay; fullscreen; cross-origin-isolated" allowFullScreen />}
    <button type="button" className="absolute right-2 top-2 rounded bg-black/75 px-3 py-2 text-xs text-white"
      onClick={onFallback}>Use browser playback</button>
  </div>;
}
