// Media readiness events are notifications, not proof of an absent track.
// Some decoders publish track information after their first loadeddata event.
export function attachDecoderLifecycle(player, callbacks) {
  let closed = false;
  let failed = false;
  const notify = (name, event) => {
    if (!closed && !failed) callbacks()[name]?.(event);
  };
  const fail = () => {
    if (closed || failed) return;
    failed = true;
    try { player.pause(); } catch { /* decoder may not have opened */ }
    callbacks().onFailure?.();
  };
  const metadata = event => notify("onMetadata", event);
  const progress = event => notify("onProgress", event);
  player.addEventListener("error", fail);
  player.addEventListener("loadedmetadata", metadata);
  player.addEventListener("timeupdate", progress);
  return {
    fail,
    dispose() {
      closed = true;
      player.removeEventListener("error", fail);
      player.removeEventListener("loadedmetadata", metadata);
      player.removeEventListener("timeupdate", progress);
    },
  };
}
