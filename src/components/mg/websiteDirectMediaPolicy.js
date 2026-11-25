// Web-only direct-media screening. It does not discover or resolve streams,
// alter DRM/access controls, or make claims about rights to a media URL.
// The public browser engine must not depend on a particular launch button.
// Installed native apps, including those using the public hostname, are excluded.
export const isPublicWebsiteVod = ({ hostname, profile, source, isLive }) =>
  !isLive && source?.mediaType !== "live" &&
  /^(?:www\.)?underworldhub\.co\.uk$/i.test(String(hostname || "")) &&
  profile?.nativePlayerAvailable === false && !profile?.nativeAndroidMobile &&
  !profile?.nativeFireTv && !profile?.mobileApp && !profile?.fireTv;

export const isWebsiteSourcesPlayback = context =>
  isPublicWebsiteVod(context) &&
  Boolean(context.source?.openSourcesDrawer || context.source?.manualSourceSelection || context.active?.preferNativeVlc);

// A transient upstream limit must not reopen a legacy/unfiltered error menu.
// A TV layout heuristic alone is not evidence of an installed native app.
export function isWebsiteRateLimitHold({ hostname, profile, source, isLive, error } = {}) {
  return !isLive && source?.mediaType !== "live" &&
    /^(?:www\.)?underworldhub\.co\.uk$/i.test(String(hostname || "")) &&
    profile?.nativePlayerAvailable === false && !profile?.nativeAndroidMobile &&
    !profile?.nativeFireTv && !profile?.mobileApp && !profile?.nativePlatform &&
    /(?:rate[\s-]*limit|too many requests|\b429\b)/i.test(String(error || ""));
}

const codec = track => String(track?.codec || track?.codec_name || "").trim().toLowerCase();
const h264 = v => /^(?:h[._ -]?264|avc|avc1(?:\..*)?)$/.test(v);
const aac = a => /^(?:aac|aac[ -]?lc|mp4a\.40\.2)$/.test(a);
// Restrict website playback to the tested WebM video/audio combination.
const vp = v => /^(?:vp9|vp09(?:\..*)?)$/.test(v);
const webAudio = a => a === "opus";
const canPlay = (probe, mime) => {
  try { return ["probably", "maybe"].includes(probe?.(mime)); }
  catch { return false; }
};

export function checkWebsiteDirectMedia({ url, item, originalItem, canPlayType, mseSupports } = {}) {
  if (item?.drm || originalItem?.drm) return { allowed: false, reason: "Protected media requires its authorised playback route." };
  if (!url || !item) return { allowed: false, reason: "No verified direct media file is ready." };
  let parsed;
  try { parsed = new URL(url); } catch { return { allowed: false, reason: "Invalid video URL." }; }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) return { allowed: false, reason: "Only secure direct media without embedded credentials is supported." };
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
    // Native HLS container support does not alone prove AAC audio decoding.
    // Require the actual advertised audio/video combination in both paths.
    const supportsAvcAac = canPlay(canPlayType, avcMime);
    let supportsMse = false;
    try { supportsMse = mseSupports?.(avcMime) === true; } catch { /* fail closed */ }
    const supported = supportsAvcAac &&
      (!hls || canPlay(canPlayType, "application/vnd.apple.mpegurl") || supportsMse);
    allowed = videos.every(v => h264(codec(v))) && audios.every(a => aac(codec(a))) && supported;
  } else if (webm) {
    allowed = videos.every(v => vp(codec(v))) && audios.every(a => webAudio(codec(a))) &&
      videos.every(v => audios.every(a => canPlay(canPlayType,
        'video/webm; codecs="' + (codec(v).startsWith("vp09") ? "vp9" : codec(v)) + ', ' + codec(a) + '"')));
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

// A chooser row must be an already inspected direct media rendition. Keep the
// original array indices so filtering never changes the identity of a choice.
export function isWebsiteDirectSourceChoice({ item, originalItem, url, failed = false, ...capabilities } = {}) {
  if (failed || !item || !originalItem) return false;
  const type = String(item.type || "").toLowerCase();
  if (["provider", "external", "youtube", "status", "live"].includes(type) || item.live || item.diagnostic) return false;
  // HTML media elements cannot apply arbitrary per-file request headers.
  if ([item.headers, item.requestHeaders, originalItem.headers, originalItem.requestHeaders]
    .some(headers => headers && Object.keys(headers).length)) return false;
  return checkWebsiteDirectMedia({ url, item, originalItem, ...capabilities }).allowed;
}

const catalogueVideoCodec = /\b(?:[hx][ .-]?26[45]|avc1?|hevc|hev1|hvc1|vp0?[89]|av0?1|xvid|divx|mpeg[ .-]?4(?:[ .-]?part[ .-]?2)?)\b/i;
const catalogueAudioCodec = /^(?:aac(?:[ -]?lc)?|mp4a(?:\.40\.2)?|ac-?3|e-?ac-?3|dts|opus|vorbis|mp3|flac)$/i;
const highRangeRelease = /\b(?:2160p?|4320p?|4k|8k|uhd|hdr(?:10)?|dolby[ .-]?vision|dovi|dv|(?:10|12)[ .-]?bit|hi10p|main[ .-]?10)\b/i;
export const websiteTorrentFilterDescription = "Website torrent filter: SDR releases up to 1080p with a recognised video codec.";
export const noWebsiteTorrentMatch = "No compatible website source found. Look for an SDR release up to 1080p with a listed video codec.";

function standardRangeTrack(track) {
  const transfer = String(track?.color_transfer || track?.colour_transfer || "").toLowerCase();
  return !(Number(track?.height) > 1080 || Number(track?.bits_per_raw_sample || track?.bit_depth) > 8 ||
    /smpte2084|arib-std-b67/.test(transfer) || /(?:10|12)(?:le|be)$/.test(track?.pix_fmt || "") ||
    highRangeRelease.test(track?.profile || ""));
}

// Catalogue torrents without a recognised video format stay out of the website
// queue. A matching release label admits a candidate for an actual decoder test.
export function websiteTorrentCandidate(item) {
  if (!item || item.diagnostic || item.type === "status") return true;
  const isTorrent = item.infoHash || item.info_hash || item.rdTorrentId || item.magnet ||
    item.debridProvider || item.viaRealDebrid || /^(rd|rd_torrent|torrent|magnet)$/.test(item.type) ||
    /^magnet:/i.test(item.src || item.url || "") ||
    /torrentio|mediafusion|comet|aiostreams/i.test(item.addon || "");
  if (!isTorrent) return true;
  if (item.drm || item.cacheRequired === true || item.debridCacheCheckState === "uncached") return false;
  const info = item.mediaInfo || item.media_info;
  const videos = info?.video_tracks || info?.videoTracks;
  const audios = info?.audio_tracks || info?.audioTracks;
  const hints = [item.label, item.name, item.title, item.filename, item.description, item.quality,
    item.audioCodec, item.audio_codec, item.hdr, item.videoCodec, item.video_codec, item.codec,
    item.behaviorHints?.filename, item.behaviorHints?.bingeGroup]
    .filter(Boolean).join(" ").replace(/_/g, " ");
  if (highRangeRelease.test(hints) || item.hdr === true || Number(item.height || item.resolution) > 1080) return false;
  if (Array.isArray(audios) && !audios.some(track => catalogueAudioCodec.test(codec(track)))) return false;
  if (Array.isArray(videos)) return videos.some(track => catalogueVideoCodec.test(codec(track)) && standardRangeTrack(track));
  if (/\b(?:truehd|mlp|pcm)\b/i.test(hints) &&
      !/\b(?:aac|opus|ac-?3|e-?ac-?3|dts|ddp?|vorbis|mp3|flac)\b/i.test(hints)) return false;
  // MPEG-4 by itself is also a container name. Only explicit Part 2 or a
  // codec field identifies the video codec in an uninspected release.
  return catalogueVideoCodec.test(hints.replace(/\bmpeg[ .-]?4\b(?![ .-]?part[ .-]?2)/ig, "")) ||
    catalogueVideoCodec.test(String(item.videoCodec || item.video_codec || ""));
}

// Check the resolved transport separately from discovery and codec metadata.
export function canOpenWebsiteMovi(url, original, rendition) {
  if (original?.drm || rendition?.drm) return false;
  if ([original, rendition].some(item => [item?.headers, item?.requestHeaders]
    .some(headers => Object.keys(headers || {}).length))) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

// Saved personal torrents are explicit user selections, not catalogue results.
// They may be shown as pending before an existing account resolver returns a
// file. This is a chooser state only: checkWebsiteDirectMedia still gates decoding.
export function isWebsiteSavedPersonalPendingChoice({source,item,resolvedUrl,failed=false}={}) {
  if (failed || resolvedUrl || !/^debrid-source:[^\s]+$/.test(String(source?.id || "")) ||
      source?.skipAddonLookup !== true || source?.skipRdLookup !== true ||
      !item || item.drm || item.live || item.diagnostic || item.addon !== "Sources" ||
      String(item.type || "").toLowerCase() !== "rd") return false;
  const magnet = String(item.magnet || "");
  if (!/^magnet:\?xt=urn:btih:[a-z0-9]+(?:&|$)/i.test(magnet)) return false;
  return Array.isArray(source.sources) && source.sources.some(saved =>
    saved?.addon === "Sources" && saved?.type === "rd" && !saved.drm &&
    saved.magnet === magnet);
}
