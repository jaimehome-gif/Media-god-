import React, { useEffect, useRef, useState } from "react";
import { websiteAudioReport, websiteAudioSnapshot } from "./websiteAudioDiagnostic.js";

export default function WebsiteAudioDiagnostic({ stageRef, playbackKey }) {
  const [report, setReport] = useState("");
  const [running, setRunning] = useState(false);
  const timer = useRef(null);
  useEffect(() => {
    setReport("");
    setRunning(false);
    return () => { if (timer.current !== null) clearTimeout(timer.current); };
  }, [playbackKey]);
  const capture = () => {
    const stage = stageRef.current;
    const video = stage?.querySelector('video[data-mg-playback-surface="active"]') || stage?.querySelector("video");
    const before = websiteAudioSnapshot(video);
    setRunning(true);
    setReport("");
    timer.current = setTimeout(() => {
      const current = stageRef.current;
      const now = current?.querySelector('video[data-mg-playback-surface="active"]') || current?.querySelector("video");
      setReport(JSON.stringify(websiteAudioReport(before, websiteAudioSnapshot(now), video === now), null, 2));
      setRunning(false);
      timer.current = null;
    }, 2500);
  };
  return <details className="my-2 rounded-lg border border-white/15 bg-black/30 p-2 text-xs text-white">
    <summary className="cursor-pointer font-semibold">Audio diagnostics</summary>
    <p className="my-2 text-white/70">While the picture is moving, capture a local audio report. No media URLs or account details are collected.</p>
    <button type="button" disabled={running} onClick={capture} className="rounded border border-white/20 px-3 py-2">{running ? "Measuring playback…" : "Capture audio report"}</button>
    {report && <textarea readOnly aria-label="Audio diagnostic report" className="mt-2 w-full rounded bg-black p-2 text-white" rows={12} value={report} onFocus={event => event.target.select()} />}
  </details>;
}
