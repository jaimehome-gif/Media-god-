// Conservative, browser-only compatibility gate for already available media.
// Does not perform source discovery, resolve links, bypass access controls, or
// change the native playback pipeline. Metadata is a screening signal only.
const playable = (probe, mime) => {
  try { return ["maybe", "probably"].includes(probe?.(mime)); }
  catch { return false; }
};

export function isWebsiteSourcesRuntime(profile, hostname) {
  return /^(?:www\.)?underworldhub\.co\.uk$/i.test(String(hostname || "")) &&
    !profile?.nativePlayerAvailable && !profile?.nativeAndroidMobile &&
    !profile?.nativeFireTv && !profile?.mobileApp && !profile?.fireTv &&
    !profile?.isFireTv;
}

const videoCodec = (codec) => {
  const value = String(codec || "").trim().toLowerCase();
  if (/^(?:h[._ -]?264|avc|avc1(?:\..*)?)$/.test(value)) return "h264";
  if (/^(?:vp8|vp08(?:\..*)?)$/.test(value)) return "vp8";
  if (/^(?:vp9|vp09(?:\..*)?)$/.test(value)) return "vp9";
  return "";
};
const audioCodec = (codec) => {
  const value = String(codec || "").trim().toLowerCase();
  if (/^(?:aac|aac[ -]?lc|mp4a\.40\.2)$/.test(value)) return "aac";
  if (value === "opus" || value === "vorbis") return value;
  return "";
};
const tracks = (info, source, kind) => {
  const list = info?.[kind + "_tracks"] || info?.[kind + "Tracks"];
  if (Array.isArray(list) && list.length) return list.map(track => track?.codec || track?.codec_name);
  return [source?.[kind + "Codec"] || source?.[kind + "_codec"]];
};
const directUrl = (source) => {
  try {
    const url = new URL(source?.src || source?.url || "");
    return url.protocol === "https:" ? url : null;
  } catch { return null; }
};
const container = (source, url) => {
  const path = url.pathname.toLowerCase();
  const mime = String(source?.mimeType || source?.mime_type || source?.contentType || source?.content_type || "").toLowerCase();
  if (path.endsWith(".m3u8") || /(?:mpegurl|x-mpegurl)/.test(mime)) return "hls";
  if (/\.(?:mp4|m4v)$/.test(path) || /^video\/mp4(?:;|$)/.test(mime)) return "mp4";
  if (path.endsWith(".webm") || /^video\/webm(?:;|$)/.test(mime)) return "webm";
  return "";
};

export function browserMediaCompatible(source, { canPlayType, mseSupports } = {}) {
  const url = directUrl(source);
  if (!url || source?.diagnostic || source?.live ||
      ["provider", "external", "youtube", "status", "live", "rd", "magnet", "torrent", "rd_torrent"].includes(String(source?.type || "").toLowerCase())) return false;
  const format = container(source, url);
  const info = source?.mediaInfo || source?.media_info || {};
  const video = tracks(info, source, "video").map(videoCodec);
  const audio = tracks(info, source, "audio").map(audioCodec);
  if (!video.length || !audio.length || video.some(v => !v) || audio.some(a => !a)) return false;
  if (format === "mp4" || format === "hls") {
    if (!video.every(v => v === "h264") || !audio.every(a => a === "aac")) return false;
    const mime = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
    if (format === "mp4") return playable(canPlayType, mime);
    return playable(canPlayType, "application/vnd.apple.mpegurl") ||
      (playable(canPlayType, mime) && mseSupports?.(mime) === true);
  }
  if (format === "webm") {
    if (!video.every(v => v === "vp8" || v === "vp9") || !audio.every(a => a === "opus" || a === "vorbis")) return false;
    return video.every(v => audio.every(a => playable(canPlayType, 'video/webm; codecs="' + v + ', ' + a + '"')));
  }
  return false;
}

export function filterPublishedWebSources(state, capabilities) {
  if (!state || !state.webSourcesRequest || state.type === "live" || state.mediaType === "live") return state;
  const filter = (items) => (Array.isArray(items) ? items : []).filter(item => browserMediaCompatible(item, capabilities));
  const sources = filter(state.sources);
  const completeSources = filter(state.completeSources);
  const discoveredSources = filter(state.discoveredSources);
  const phase = state.sourceDiagnostics?.phase;
  const searching = ["searching", "fast-start"].includes(phase);
  const primary = sources[0];
  const status = { type: "status", diagnostic: true, src: "", url: "",
    label: searching ? "Checking browser-compatible audio and video…" : "No verified browser-compatible audio and video source is available." };
  return {
    ...state,
    sources: sources.length ? sources : [status],
    completeSources,
    discoveredSources,
    src: primary?.src || primary?.url || "",
    url: primary?.src || primary?.url || "",
  };
}

export function browserPlaybackCapabilities() {
  const video = typeof document !== "undefined" ? document.createElement("video") : null;
  return {
    canPlayType: mime => video?.canPlayType?.(mime) || "",
    mseSupports: mime => typeof MediaSource !== "undefined" && MediaSource.isTypeSupported?.(mime) === true,
  };
}
