import React, { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createVideoTestSession } from "./videoTestSession";

export default function VideoPlaybackTest() {
  const videoRef = useRef(null);
  const buttonRef = useRef(null);
  const sessionRef = useRef(null);
  if (!sessionRef.current) sessionRef.current = createVideoTestSession();

  useEffect(() => {
    const video = videoRef.current;
    const session = sessionRef.current;
    return () => session.close(video);
  }, []);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [failure, setFailure] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    const update = () => {
      const video = videoRef.current;
      if (!video) return;
      if (video.error) {
        const reasons = ["unknown", "interrupted", "network", "decode", "unsupported source"];
        setStatus("Video error " + video.error.code + " — " + (reasons[video.error.code] || "unknown"));
      } else if (video.ended) {
        setStatus("Test finished. Check whether you saw moving text and heard a tone.");
      } else {
        setStatus((video.paused ? "Paused" : "Playback requested") +
          " · " + video.currentTime.toFixed(1) + " seconds · ready " + video.readyState +
          " · network " + video.networkState);
      }
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  const play = () => {
    const video = videoRef.current;
    // Commit visibility before asking older WebViews to start their video surface.
    flushSync(() => { setOpen(true); setFailure(""); });
    sessionRef.current.play(video, (error) => {
      const message = String(error.message || "").replace(/https?:\/\/[^\s]+/g, "[link hidden]").slice(0, 220);
      setFailure("Play request failed (" + error.name + "). " + message);
    });
  };

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <button ref={buttonRef} type="button" onClick={play} aria-expanded={open}
          className="min-h-11 rounded-lg border border-mg-green/50 px-4 py-2 text-sm font-semibold text-white focus:ring-2 focus:ring-mg-green">
          {open ? "Play direct test again" : "Test video"}
        </button>
        {open && <button type="button" onClick={() => {
          sessionRef.current.close(videoRef.current);
          setOpen(false);
          buttonRef.current?.focus();
        }} className="min-h-11 rounded-lg border border-white/20 px-4 text-sm text-white focus:ring-2 focus:ring-mg-green">Close test</button>}
      </div>
      {open && <p role="status" className="mt-3 text-sm text-white">Direct video test · {failure || status}</p>}
      <video ref={videoRef} onPlaying={() => setFailure("")} hidden={!open} playsInline controls preload="none"
        aria-label="Media God picture and sound test"
        className="mt-3 h-64 w-full rounded-lg border border-white/20 bg-black" />
    </div>
  );
}