import React, { useEffect, useRef, useState } from "react";
import { describeWebsiteAudio, restoreWebsiteAudioOutput, websiteAudioReport, websiteAudioSnapshot } from "./websiteAudioDiagnostic.js";

export default function WebsiteAudioDiagnostic({ stageRef, playbackKey }) {
  const [report, setReport] = useState("");
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState("");
  const [outputStatus, setOutputStatus] = useState("");
  const timer = useRef(null);
  useEffect(() => {
    setReport("");
    setSummary("");
    setOutputStatus("");
    setRunning(false);
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [playbackKey]);
  const getVideo = () => {
    const stage = stageRef.current;
    return stage?.querySelector('video[data-mg-playback-surface="active"]') || stage?.querySelector("video");
  };
  const capture = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    const video = getVideo();
    const before = websiteAudioSnapshot(video);
    setRunning(true);
    setReport("");
    setSummary("");
    timer.current = setTimeout(() => {
      const now = getVideo();
      const result = websiteAudioReport(before, websiteAudioSnapshot(now), video === now);
      setSummary(describeWebsiteAudio(result));
      setReport(JSON.stringify(result, null, 2));
      setRunning(false);
      timer.current = null;
    }, 2500);
  };
  return <details className="my-2 rounded-lg border border-white/15 bg-black/30 p-2 text-xs text-white">
    <summary className="cursor-pointer font-semibold">Audio diagnostics</summary>
    <p className="my-2 text-white/70">While the picture is moving, capture a local audio report. No media URLs or account details are collected.</p>
    <button type="button" disabled={running} onClick={capture} className="rounded border border-white/20 px-3 py-2">{running ? "Measuring playback…" : "Capture audio report"}</button>
    <button type="button" onClick={() => setOutputStatus(restoreWebsiteAudioOutput(getVideo())
      ? "Player unmuted. Check your device audio output if sound is still missing."
      : "No adjustable browser audio output is available.")} className="ml-2 rounded border border-white/20 px-3 py-2">Unmute player</button>
    {outputStatus && <p role="status" className="mt-2">{outputStatus}</p>}
    {summary && <p role="status" className="mt-2 text-sm">{summary}</p>}
    {report && <textarea readOnly aria-label="Audio diagnostic report" className="mt-2 w-full rounded bg-black p-2 text-white" rows={12} value={report} onFocus={event => event.target.select()} />}
  </details>;
}
