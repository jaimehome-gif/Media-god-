import { mediaForTorrentFallback } from "./automaticWebFallback.js";
import { prefersNativeBoxPlayer } from "./boxPlayerPreference.js";
import { supportsLegacyBoxWebPlayer } from "./legacyBoxWebPlayer";
import { browserCodecSupport, getPlaybackDeviceProfile } from "./mediaCompatibility";

// The Fire Stick's main Play button must enter the same selectable web-scraper
// player available from source cards. OnlyFlix is the first provider
// on Fire TV, with the other scrapers still selectable as backups; the
// remote controls, fullscreen and explicit Sources button remain available.
// Native VLC still owns resolved DIRECT media from the Sources handoff.
// Phone, desktop and Live TV never enter this Fire TV-only route.
export const launchFireTvCardPlay = (player, media) => {
  const type = String(media?.mediaType || media?.type || "").toLowerCase();
  // The web embeds for Sunrise on the Reaping repeatedly return an error or
  // a verification page. Use exact-title discovery on its primary Play action.
  const tmdbId = String(media?.tmdbId || media?.tmdb_id || media?.id || "");
  const imdbId = media?.imdbId || media?.imdb_id;
  if (type === "movie" && (tmdbId === "1300968" || imdbId === "tt32558705") &&
      typeof player?.play === "function") {
    void player.play(mediaForTorrentFallback({
      ...media, tmdbId: 1300968, tmdb_id: 1300968, imdbId: "tt32558705", imdb_id: "tt32558705",
    }));
    return true;
  }
  if (!getPlaybackDeviceProfile().nativeFireTv) return false;
  if (!(type === "movie" || type === "tv" || type === "series")) return false;

  const scraperMedia = {
    ...media,
    mediaType: type === "series" ? "tv" : type,
    type: type === "series" ? "series" : type,
  };

  // Never pass an OnlyFlix/VidCore webpage URL to LibVLC: web providers
  // require their own iframe/player with the user's manual scraper selector.
  const needsNativeVideo = supportsLegacyBoxWebPlayer(true, navigator.userAgent) &&
    (!browserCodecSupport.h264Aac || prefersNativeBoxPlayer());
  if (!needsNativeVideo) {
    if (typeof player?.playOnlyFlix === "function" &&
        player.playOnlyFlix(scraperMedia)) return true;
    if (typeof player?.playVidCore === "function" &&
        player.playVidCore(scraperMedia)) return true;
  }

  // Resolve direct media for the native decoder when the WebView lacks H.264/AAC or embed IDs are missing.
  if (typeof player?.play !== "function") return false;
  void player.play({
    ...scraperMedia,
    preferRd: true,
    verifiedPlaybackPolicy: "strict",
    noRd: false,
    skipRdLookup: false,
    skipAddonLookup: false,
    sources: [],
    completeSources: [],
    discoveredSources: [],
    src: "",
    url: "",
    video_url: "",
  });
  return true;
};
