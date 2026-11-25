import React, { useEffect, useRef } from "react";

const decoderModule = "/decoder-lab/vendor/element.js";

export default function WebsiteSourcesMovi({ url, onMetadata, onProgress, onFailure }) {
  const container = useRef(null);
  const callbacks = useRef({});
  callbacks.current = { onMetadata, onProgress, onFailure };

  useEffect(() => {
    let closed = false;
    let failed = false;
    let player;
    const fail = () => {
      if (closed || failed) return;
      failed = true;
      player?.pause();
      callbacks.current.onFailure();
    };
    async function open() {
      await import(/* @vite-ignore */ decoderModule);
      if (closed) return;
      player = document.createElement("movi-player");
      for (const name of ["controls", "autoplay", "playsinline"]) player.setAttribute(name, "");
      player.setAttribute("sw", "true");
      player.setAttribute("engine", "wasm");
      player.setAttribute("crossorigin", "anonymous");
      player.className = "absolute inset-0 block h-full w-full";
      player.addEventListener("error", fail);
      player.addEventListener("loadedmetadata", event => {
        if (!closed && !failed) callbacks.current.onMetadata(event);
      });
      player.addEventListener("loadeddata", () => {
        if (!player.audioTracks.length || !player.videoWidth) fail();
      }, { once: true });
      player.addEventListener("timeupdate", event => {
        if (!closed && !failed) callbacks.current.onProgress(event);
      });
      container.current.appendChild(player);
      player.src = url;
    }
    open().catch(fail);
    return () => {
      closed = true;
      player?.pause();
      player?.remove();
    };
  }, [url]);

  return <div ref={container} className="absolute inset-0" />;
}
