import React from "react";
import { Link } from "react-router-dom";

export default function BrowserDecoderTest() {
  return (
    <main className="min-h-screen bg-mg-background px-4 py-6 text-white">
      <div className="mx-auto max-w-4xl space-y-4">
        <Link to="/" className="text-sm font-semibold text-mg-green">← Back to Media God</Link>
        <h1 className="text-2xl font-bold">Experimental website decoder</h1>
        <p className="text-sm text-white/70">Movi Player 0.4.1 · FFmpeg software decoding. Compare generated test clips containing a test pattern and audible tone. No catalogue, account credentials or external media URLs are passed to the decoder.</p>
        <iframe title="Movi software decoder test" src="/decoder-lab/index.html"
          sandbox="allow-scripts" allow="fullscreen; autoplay" allowFullScreen
          className="h-[min(85vh,760px)] min-h-[520px] w-full rounded-xl border border-white/10 bg-black" />
        <p className="text-xs text-white/50">This experimental panel does not replace normal playback or change the installed apps.</p>
      </div>
    </main>
  );
}
