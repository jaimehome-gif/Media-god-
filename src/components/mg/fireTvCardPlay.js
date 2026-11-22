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
  const profile = getPlaybackDeviceProfile();
  if (!profile.nativeFireTv && !profile.nativeAndroidMobile) return false;
  if (!(type === "movie" || type === "tv" || type === "series")) return false;

  const scraperMedia = {
    ...media,
    mediaType: type === "series" ? "tv" : type,
    type: type === "series" ? "series" : type,
  };

  // After migration, the main Play button was still opening an embedded
  // webpage ahead of Media God's own player. A signed-in Real-Debrid viewer
  // should instead enter the existing source-discovery -> direct HTTP URL ->
  // native Media God / LibVLC route. The native activity owns its audio-track
  // selection and sound recovery; it must never receive an HTML scraper page.
  const nativeRequest = {
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
  };
  const preferBespokePlayer = player?.hasRd === true || prefersNativeBoxPlayer();
  if (preferBespokePlayer && typeof player?.play === "function") {
    void player.play(nativeRequest);
    return true;
  }

  // Visitors without Real-Debrid still retain the working web-scraper route.
  // OnlyFlix/VidCore pages stay in their own embeds, never in native VLC.
  const needsNativeVideo = supportsLegacyBoxWebPlayer(true, navigator.userAgent) &&
    !browserCodecSupport.h264Aac;
  if (!needsNativeVideo) {
    if (typeof player?.playOnlyFlix === "function" &&
        player.playOnlyFlix(scraperMedia)) return true;
    if (typeof player?.playVidCore === "function" &&
        player.playVidCore(scraperMedia)) return true;
  }

  // If the embed route is unavailable, keep the in-app source chooser as
  // the fallback without changing Live TV or the manual scraper tabs.
  if (typeof player?.play !== "function") return false;
  void player.play(nativeRequest);
  return true;
};
