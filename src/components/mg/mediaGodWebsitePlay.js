import { getPlaybackDeviceProfile } from "./mediaCompatibility.js";
import { isNativeFireTvPlayerAvailable } from "./nativeFireTvBridge.js";

/**
 * Only the ordinary website changes its primary Play action. Installed
 * phone/Fire TV/Android box APKs retain their existing native launch logic.
 * A browser on an Android *phone* is still a website unless the native bridge
 * or the native runtime profile is present.
 */
export const shouldUseMediaGodWebsitePlayer = (
  deviceProfile = {},
  nativeBridge = false,
  hasWindow = true,
) => Boolean(hasWindow) &&
  !nativeBridge &&
  deviceProfile?.nativeFireTv !== true &&
  deviceProfile?.nativeAndroidMobile !== true &&
  deviceProfile?.nativePlayerAvailable !== true;

/** Open the existing VideoPlayer portal and resolve actual playable video.
 * Never feed it an iframe watch page, stale bookmarked URL or HTML embed.
 */
export const mediaGodWebsitePlayRequest = (media = {}) => ({
  ...media,
  preferRd: true,
  noRd: false,
  skipRdLookup: false,
  skipAddonLookup: false,
  verifiedPlaybackPolicy: "strict",
  allowNonPlaybackFallback: false,
  browserFirstPartyPlayback: true,
  sources: [],
  completeSources: [],
  discoveredSources: [],
  src: "",
  url: "",
  video_url: "",
});

export const launchMediaGodWebsitePlay = (player, media) => {
  if (typeof window === "undefined" ||
      !shouldUseMediaGodWebsitePlayer(
        getPlaybackDeviceProfile(),
        isNativeFireTvPlayerAvailable(),
        true
      ) ||
      typeof player?.play !== "function") return false;

  try {
    const request = mediaGodWebsitePlayRequest(media);
    const started = player.play(request);
    if (started && typeof started.catch === "function") {
      void started.catch(error => {
        console.error("[Media God] Website player launch failed", error);
        window.dispatchEvent(new CustomEvent("mg:player-status", {
          detail: { message: "Our player couldn't open that file. Try Sources or the OnlyFlix backup." }
        }));
      });
    }
    return true;
  } catch (error) {
    console.error("[Media God] Website player launch failed", error);
    return false;
  }
};
