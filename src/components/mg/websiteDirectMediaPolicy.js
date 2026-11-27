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
  Boolean(context.source?.openSourcesDrawer || context.source?.manualSourceSelection || context.source?.debridManual || context.active?.preferNativeVlc);

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

// Container, video and audio combinations exercised by the website decoder fixtures.
const testedFormats = {
  mp4: { h264: ["aac"] },
  m3u8: { h264: ["aac"] },
  webm: { vp9: ["opus"], vp8: ["vorbis"] },
  mkv: { h264: ["aac", "ac3", "eac3", "dts", "flac", "mp3"], hevc: ["aac"], av1: ["opus"], mpeg4: ["mp3"] },
};

function canonicalCodec(value) {
  const name = String(value || "").trim().toLowerCase();
  if (/^(?:x264|h[.-]?264|avc|avc1(?:\.[a-f0-9]+)?)$/.test(name)) return "h264";
  if (/^(?:x265|h[.-]?265|hevc|hev1|hvc1)$/.test(name)) return "hevc";
  if (/^(?:aac(?:[ -]lc)?|mp4a\.40\.2)$/.test(name)) return "aac";
  if (/^(?:e-?ac-?3|ddp)$/.test(name)) return "eac3";
  if (/^(?:ac-?3|dd)$/.test(name)) return "ac3";
  if (/^(?:mpeg4|xvid|divx)$/.test(name)) return "mpeg4";
  return ({ av01: "av1", vp09: "vp9", vp08: "vp8" })[name] || name;
}

function testedWebsiteFormat(item, url, inspectedOnly, allowIncomplete = false) {
  const info = item.mediaInfo || item.media_info || {};
  const videos = info.video_tracks || info.videoTracks;
  const audios = info.audio_tracks || info.audioTracks;
  const filename = info.filename || item.filename || item.file || item.behaviorHints?.filename || item.label || "";
  const hints = [filename, item.label, item.quality, item.description].filter(Boolean).join(" ").replace(/_/g, " ");
  // Release names and advertised quality are discovery hints, not proof of
  // the resolved file\'s actual resolution, bit depth or colour transfer.
  if (!inspectedOnly && (highRangeRelease.test(hints) || item.hdr === true || Number(item.height || item.resolution) > 1080)) return false;
  const ext = value => /\.([a-z0-9]{2,5})$/i.exec(String(value || ""))?.[1]?.toLowerCase();
  const path = /^https?:/i.test(url || "") ? String(url).split(/[?#]/)[0] : "";
  const container = ext(path) || ext(filename) || ({ "video/mp4":"mp4", "video/webm":"webm",
    "video/x-matroska":"mkv", "application/vnd.apple.mpegurl":"m3u8", "application/x-mpegurl":"m3u8" })[
      String(item.mimeType || item.mime_type || item.contentType || "").toLowerCase().split(";")[0]];
  // A missing container is not a negative codec result. Discovery may keep
  // an eligible file pending inspection; the actual decoder gate may not.
  if (container && !Object.prototype.hasOwnProperty.call(testedFormats, container)) return false;
  if (!container && !allowIncomplete) return false;
  const formats = container ? [testedFormats[container]] : Object.values(testedFormats);
  const supports = (video, audio) => {
    const v = canonicalCodec(video), a = canonicalCodec(audio);
    return formats.some(format => Object.entries(format).some(([name, tracks]) =>
      (name === v || (allowIncomplete && !v)) &&
      (tracks.includes(a) || (allowIncomplete && !a))));
  };
  if (inspectedOnly || videos != null || audios != null) {
    if (!allowIncomplete) {
      return Array.isArray(videos) && videos.length > 0 && Array.isArray(audios) && audios.length > 0 &&
        videos.every(v => v && standardRangeTrack(v) && audios.every(a => supports(codec(v), codec(a))));
    }
    // Missing track arrays are different from an inspected file with no tracks.
    if ((Array.isArray(videos) && !videos.length) || (Array.isArray(audios) && !audios.length)) return false;
    const knownVideos = Array.isArray(videos) ? videos : [{}];
    const knownAudios = Array.isArray(audios) ? audios : [{}];
    return knownVideos.every(v => v && standardRangeTrack(v) &&
      knownAudios.every(a => a && supports(codec(v), codec(a))));
  }
  const video = item.videoCodec || item.video_codec || hints.match(/\b(?:[hx][.-]?26[45]|avc1?|hevc|vp0?[89]|av0?1|xvid|divx)\b/i)?.[0];
  const audio = item.audioCodec || item.audio_codec || hints.match(/\b(?:aac|ac-?3|e-?ac-?3|dts|ddp?|opus|vorbis|flac|mp3|truehd|mlp|pcm)\b/i)?.[0];
  return supports(video, audio);
}

export function websiteRenditionAllowed(url, original, rendition) {
  if (!canOpenWebsiteMovi(url, original, rendition)) return false;
  const file = rendition || original;
  if ((file?.audioRescue?.used || file?.videoRescue?.used) && !(file.mediaInfo || file.media_info)?.rendition_verified) return false;
  return Boolean(file && testedWebsiteFormat(file, url, true));
}

const highRangeRelease = /\b(?:2160p?|4320p?|4k|8k|uhd|hdr(?:10)?|dolby[ .-]?vision|dovi|dv|(?:10|12)[ .-]?bit|hi10p|main[ .-]?10)\b/i;
export const websiteTorrentFilterDescription = "Website playback checks the resolved file for a tested container and compatible audio/video tracks. Unverified discovery labels are not playback results.";
export const noWebsiteTorrentMatch = "Sources were found, but no verified playable file is ready.";

function standardRangeTrack(track) {
  const transfer = String(track?.color_transfer || track?.colour_transfer || "").toLowerCase();
  return !(Number(track?.height) > 1080 || Number(track?.bits_per_raw_sample || track?.bit_depth) > 8 ||
    /smpte2084|arib-std-b67/.test(transfer) || /(?:10|12)(?:le|be)$/.test(track?.pix_fmt || "") ||
    highRangeRelease.test(track?.profile || ""));
}

// Discovery eligibility is not decoder eligibility. Missing codec or container
// metadata must not empty an otherwise eligible source pool. Only an inspected
// rendition that passes websiteRenditionAllowed may open the website decoder.
export function websiteTorrentCandidate(item) {
  if (!item || item.diagnostic || item.type === "status") return true;
  const isTorrent = item.infoHash || item.info_hash || item.rdTorrentId || item.magnet ||
    item.debridProvider || item.viaRealDebrid || /^(rd|rd_torrent|torrent|magnet)$/.test(item.type) ||
    /^magnet:/i.test(item.src || item.url || "") ||
    /torrentio|mediafusion|comet|aiostreams/i.test(item.addon || "");
  // An inspected, secure, already-resolved file is stronger evidence than
  // stale cache labels copied from a discovery row. Never apply this exception
  // to an unresolved magnet or a file with unverified media tracks.
  const resolvedUrl = item.src || item.url;
  if (item.launchQualified === true && websiteRenditionAllowed(resolvedUrl, item, item)) return true;
  if (item.drm || item.cacheRequired === true || item.debridCacheCheckState === "uncached" ||
      (item.debridCacheChecked === true && item.debridCached === false)) return false;
  // A guessed pending strategy (e.g. rd_magnet) or a provider label is
  // not a confirmed cache miss. Keep it eligible for the existing account
  // resolver; explicit cache misses above still cannot autoplay.
  if (isTorrent) return true;
  if (!isTorrent) {
    if (["provider", "external", "youtube", "embed", "live"].includes(String(item.type || "").toLowerCase())) return false;
    const url = item.src || item.url;
    if (!canOpenWebsiteMovi(url, item)) return false;
    const mime = String(item.mimeType || item.mime_type || item.contentType || "").toLowerCase();
    const path = new URL(url).pathname;
    const info = item.mediaInfo || item.media_info;
    if (!Array.isArray(info?.video_tracks || info?.videoTracks) && !/\.(mp4|m4v|mkv|webm|m3u8|avi)$/i.test(path) &&
        !/^video\/|mpegurl/.test(mime)) return false;
  }
  return testedWebsiteFormat(item, item.src || item.url, false, true);
}

// Check the resolved transport separately from discovery and codec metadata.
export function canOpenWebsiteMovi(url, original, rendition) {
  if (original?.drm || rendition?.drm) return false;
  const media = rendition || original;
  const mime = String(media?.mimeType || media?.mime_type || media?.contentType || "").toLowerCase();
  if (/^text\/|html/.test(mime)) return false;
  if ([original, rendition].some(item => [item?.headers, item?.requestHeaders]
    .some(headers => Object.keys(headers || {}).length))) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password && !/\.html?$/i.test(parsed.pathname);
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
