// Shared VOD launch request for Media God's own player surface.
// Browser: branded HTML5/HLS media renderer, controls and source picker.
// Installed Android/Fire TV: the same UI resolves a playable file and hands
// it to the app's native player bridge. Never hand an HTML scraper watch page
// to either media engine as if it were a file.
export const buildMediaGodVodRequest = (media = {}) => ({
  ...media,
  preferRd: true,
  noRd: false,
  skipRdLookup: false,
  skipAddonLookup: false,
  verifiedPlaybackPolicy: "strict",
  allowNonPlaybackFallback: false,
  // Don't import stale URLs or iframe-only providers into primary playback.
  // The Real-Debrid and active-addon discovery pipelines fill these fields.
  sources: [],
  completeSources: [],
  discoveredSources: [],
  src: "",
  url: "",
  video_url: "",
});

export const launchMediaGodVod = (player, media) => {
  if (!player || typeof player.play !== "function") return false;
  const onError = (error) => {
    console.error("[Media God] Default VOD player launch failed", error);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mg:player-status", {
        detail: { message: "Media God could not open this source. Please try Sources or another file." },
      }));
    }
  };
  try {
    const started = player.play(buildMediaGodVodRequest(media));
    if (started && typeof started.catch === "function") void started.catch(onError);
    return true;
  } catch (error) {
    onError(error);
    return false;
  }
};
