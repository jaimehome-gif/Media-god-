import React, { useState } from "react";
import WebsiteSourcesMovi from "@/components/mg/WebsiteSourcesMovi.jsx";

const clips = [
  ["aac.mp4", "MP4 / AAC"],
  ["ac3.mkv", "MKV / AC-3"],
  ["eac3.mkv", "MKV / E-AC-3"],
  ["dts.mkv", "MKV / DTS"],
];

export default function BrowserDecoderTest() {
  const [selected, setSelected] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState("Choose a generated test clip.");
  const [stats, setStats] = useState(null);
  function inspect(event) {
    const player = event.target;
    const data = {
      time: Number(player.currentTime || 0),
      width: Number(player.videoWidth || 0),
      height: Number(player.videoHeight || 0),
      audioTracks: Number(player.audioTracks?.length || 0),
      frames: Number(player.getVideoPlaybackQuality?.()?.totalVideoFrames || 0),
      paused: player.paused === true,
    };
    setStats(data);
    setStatus(data.time > 0.25 ? "Playback advancing — check that the tone is audible." :
      "Decoder opening. Tap Play inside the player if needed.");
  }
  return (
    <main className="min-h-screen bg-mg-background px-4 py-6 text-white">
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-2xl font-bold">Media God decoder phone preview</h1>
        <p className="text-sm text-white/70">Test the repaired website decoder component with generated picture and tone. No sign-in, external streams or account information is required.</p>
        <div className="flex flex-wrap gap-2">
          {clips.map(([file,label]) => <button key={file} type="button"
            className="rounded-lg border border-white/30 px-4 py-3 text-sm font-semibold"
            onClick={() => {
              setSelected(file);
              setAttempt(n => n + 1);
              setStats(null);
              setStatus("Opening generated clip…");
            }}>{label}</button>)}
        </div>
        <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-black">
          {selected && <WebsiteSourcesMovi key={selected + ":" + attempt}
            url={"/decoder-lab/samples/" + selected}
            onMetadata={inspect} onProgress={inspect}
            onFailure={() => setStatus("Decoder error — report the selected format.")} />}
        </div>
        <p role="status" className="text-sm text-white/90">{status}</p>
        {stats && <p className="text-xs text-white/70">
          Time: {stats.time.toFixed(1)}s · Picture: {stats.width} × {stats.height} ·
          Audio tracks: {stats.audioTracks} · Frames: {stats.frames} · Paused: {stats.paused ? "yes" : "no"}
        </p>}
        <p className="text-xs text-white/60">Each clip is 12 seconds long. Check for a moving test pattern and an audible tone. This preview tests the actual repaired decoder component, not the full authenticated Sources flow.</p>
      </div>
    </main>
  );
}
