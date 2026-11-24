// Web-only direct-media screening. It does not discover or resolve streams,
// alter DRM/access controls, or make claims about rights to a media URL.
export const isWebsiteSourcesPlayback = ({ hostname, profile, source, active, isLive }) =>
  !isLive && source?.mediaType !== "live" &&
  /^(?:www\.)?underworldhub\.co\.uk$/i.test(String(hostname || "")) &&
  profile?.nativePlayerAvailable === false && !profile?.nativeAndroidMobile &&
  !profile?.nativeFireTv && !profile?.mobileApp && !profile?.fireTv &&
  Boolean(source?.openSourcesDrawer || source?.manualSourceSelection || active?.preferNativeVlc);

const codec = track => String(track?.codec || track?.codec_name || "").trim().toLowerCase();
const h264 = v => /^(?:h[._ -]?264|avc|avc1(?:\..*)?)$/.test(v);
const aac = a => /^(?:aac|aac[ -]?lc|mp4a\.40\.2)$/.test(a);
const vp = v => /^(?:vp8|vp9|vp08(?:\..*)?|vp09(?:\..*)?)$/.test(v);
const webAudio = a => a === "opus" || a === "vorbis";
const canPlay = (probe, mime) => {
  try { return ["probably", "maybe"].includes(probe?.(mime)); }
  catch { return false; }
};

export function checkWebsiteDirectMedia({ url, item, canPlayType, mseSupports } = {}) {
  if (!url || !item || item.drm) return { allowed: false, reason: "No verified direct media file is ready." };
  let parsed;
  try { parsed = new URL(url); } catch { return { allowed: false, reason: "Invalid video URL." }; }
  if (parsed.protocol !== "https:") return { allowed: false, reason: "Only secure direct media is supported." };
  const info = item.mediaInfo || item.media_info;
  const videos = info?.video_tracks || info?.videoTracks;
  const audios = info?.audio_tracks || info?.audioTracks;
  if (!Array.isArray(videos) || !videos.length || !Array.isArray(audios) || !audios.length) {
    return { allowed: false, reason: "The video and audio codecs could not be verified." };
  }
  // A compatibility rendition must have its own inspection rather than
  // inheriting possibly unrelated codec metadata from the original file.
  if ((item.audioRescue?.used || item.videoRescue?.used) && !info?.rendition_verified) {
    return { allowed: false, reason: "The converted rendition's codecs have not been verified." };
  }
  const path = parsed.pathname.toLowerCase();
  const mime = String(item.mimeType || item.mime_type || item.contentType || "").toLowerCase();
  const hls = path.endsWith(".m3u8") || /mpegurl/.test(mime);
  const mp4 = /\.(mp4|m4v)$/.test(path) || /^video\/mp4(?:;|$)/.test(mime);
  const webm = path.endsWith(".webm") || /^video\/webm(?:;|$)/.test(mime);
  const avcMime = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
  let allowed = false;
  if (hls || mp4) {
    const supported = hls
      ? canPlay(canPlayType, "application/vnd.apple.mpegurl") ||
        (canPlay(canPlayType, avcMime) && mseSupports?.(avcMime) === true)
      : canPlay(canPlayType, avcMime);
    allowed = videos.every(v => h264(codec(v))) && audios.every(a => aac(codec(a))) && supported;
  } else if (webm) {
    allowed = videos.every(v => vp(codec(v))) && audios.every(a => webAudio(codec(a))) &&
      videos.every(v => audios.every(a => canPlay(canPlayType,
        'video/webm; codecs="' + (codec(v).startsWith("vp08") ? "vp8" : codec(v).startsWith("vp09") ? "vp9" : codec(v)) + ', ' + codec(a) + '"')));
  }
  return allowed ? { allowed: true, reason: "" } : {
    allowed: false, reason: "This browser cannot verify support for the file's audio, video and container."
  };
}

export function getBrowserMediaCapabilities() {
  const video = typeof document === "undefined" ? null : document.createElement("video");
  return { canPlayType: mime => video?.canPlayType?.(mime) || "",
    mseSupports: mime => typeof MediaSource !== "undefined" && MediaSource.isTypeSupported?.(mime) === true };
}
