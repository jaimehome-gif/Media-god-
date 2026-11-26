import React, { useEffect, useRef } from "react";
import { attachDecoderLifecycle } from "./websiteDecoderLifecycle.js";

const decoderModule = "/decoder-lab/vendor/element.js";

export default function WebsiteSourcesMovi({ url, onMetadata, onProgress, onFailure }) {
  const container = useRef(null);
  const callbacks = useRef({});
  callbacks.current = { onMetadata, onProgress, onFailure };

  useEffect(() => {
    let closed = false;
    let player;
    let lifecycle;
    async function open() {
      await import(/* @vite-ignore */ decoderModule);
      if (closed) return;
      player = document.createElement("movi-player");
      for (const name of ["controls", "autoplay", "playsinline"]) player.setAttribute(name, "");
      player.setAttribute("sw", "true");
      player.setAttribute("engine", "wasm");
      player.setAttribute("crossorigin", "anonymous");
      player.className = "absolute inset-0 block h-full w-full";
      lifecycle = attachDecoderLifecycle(player, () => callbacks.current);
      container.current.appendChild(player);
      player.src = url;
    }
    open().catch(() => {
      if (closed) return;
      if (lifecycle) lifecycle.fail();
      else callbacks.current.onFailure?.();
    });
    return () => {
      closed = true;
      lifecycle?.dispose();
      try { player?.pause(); } catch { /* decoder may not have opened */ }
      player?.remove();
    };
  }, [url]);

  return <div ref={container} className="absolute inset-0" />;
}
