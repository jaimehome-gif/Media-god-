import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { mountTorrentTitle } from "../../tests/fixtures/website-torrent-sources";

export default function PreviewSourcesTest() {
  const host = "media-god-audio-test-preview-production.up.railway.app";
  const mount = useRef(null);
  const isolated = globalThis.location?.hostname === host;
  useEffect(() => {
    if (!isolated || !mount.current) return;
    // This fixture never requests user credentials, production catalogue data
    // or third-party media. The real Sources UI and player consume local clips.
    let dispose;
    const node = mount.current;
    const timer = setTimeout(() => {
      dispose = mountTorrentTitle({
        url: new URL("/decoder-lab/samples/aac.mp4", location.origin).href,
        mode: "preview", videoCodec: "h264", audioCodec: "aac", container: node,
      });
    }, 0);
    return () => { clearTimeout(timer); if (dispose) setTimeout(dispose, 0); };
  }, [isolated]);
  if (!isolated) return null;
  return (
    <main className="min-h-screen bg-mg-background text-white px-4 py-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Media God — Sources test preview</h1>
        <p className="text-sm text-white/70">Isolated playback review. This is the actual Sources panel and player, with two generated test clips and simulated catalogue responses. No production accounts or external media are used.</p>
        <p className="text-sm">Open a source using the usual controls, confirm moving picture and an audible tone, then choose the other source manually. The AAC clip intentionally has incomplete initial codec metadata.</p>
        <Link className="text-mg-green text-sm font-semibold" to="/browser-decoder-test">Compare standalone decoder test</Link>
        <div ref={mount} />
      </div>
    </main>
  );
}
