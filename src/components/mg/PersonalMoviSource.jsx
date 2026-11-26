import React, { useState } from "react";
import PersonalBrowserVerification from "./PersonalBrowserVerification.jsx";
import { isAndroidMobileRuntime, isFireTvRuntime } from "@/components/mg/runtimePlatform";

export function canOpenPersonalMovi() {
  const host = globalThis.location?.hostname || "";
  return /^(?:www\.)?underworldhub\.co\.uk$|^media-god-independent-web-production\.up\.railway\.app$/i.test(host) &&
    !globalThis.MediaGodNative && !(isAndroidMobileRuntime() || isFireTvRuntime());
}

export default function PersonalMoviSource({ defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!canOpenPersonalMovi()) return null;
  return (
    <section className="mt-5 rounded-2xl border border-white/10 bg-mg-card p-4 sm:p-5">
      <h2 className="font-bold text-white">Personal media · Movi Player</h2>
      <p className="mt-2 text-sm text-white/70">Play video files you own or have permission to use directly from this device. Files are not uploaded.</p>
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open}
        className="mt-3 min-h-11 rounded-lg bg-mg-green px-4 font-semibold text-black">
        {open ? "Close Movi Player" : "Open personal media in Movi"}
      </button>
      {open && <iframe title="Personal media Movi player" src="/decoder-lab/personal.html"
        sandbox="allow-scripts" allow="fullscreen; autoplay" allowFullScreen
        className="mt-4 h-[min(85vh,760px)] min-h-[480px] w-full rounded-xl border border-white/10 bg-black" />}
      <PersonalBrowserVerification />
    </section>
  );
}
