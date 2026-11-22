/*
 * Real-Debrid sometimes returns the original torrent when its HLS/MP4
 * compatibility rendition is unavailable. A browser may render its video
 * while remaining silent on an unsupported audio codec.
 *
 * Only actual RD-inspected audio tracks can prove a browser mismatch.
 * Release titles, estimated language, unknown tracks and failed inspections
 * never trigger automatic source rejection.
 */
const ORIGINAL_FALLBACK_STATES = new Set([
  "hard_codec_original_probe",
  "transcode_unavailable_original_fallback",
  "forced_audio_rescue_original_probe",
]);

const browserAudioMime = (rawCodec) => {
  const codec = String(rawCodec || "").trim().toLowerCase();
  if (!codec) return "";
  if (/dts|dca/.test(codec)) return 'audio/mp4; codecs="dtsc"';
  if (/true[ ._-]?hd|mlp/.test(codec)) return 'audio/mp4; codecs="mlpa"';
  if (/e[ ._-]?ac[ ._-]?3|eac3|ec[ ._-]?3|ddp|dolby.*digital.*plus/.test(codec)) {
    return 'audio/mp4; codecs="ec-3"';
  }
  if (/(?:^|[^a-z])ac[ ._-]?3(?:[^a-z]|$)|dolby.*digital/.test(codec)) {
    return 'audio/mp4; codecs="ac-3"';
  }
  if (/ac[ ._-]?4/.test(codec)) return 'audio/mp4; codecs="ac-4"';
  // A browser can often play these. Unknown or safe codecs must never be
  // mistaken for confirmed silent playback.
  return "";
};

const audioCanPlay = (mime, canPlayType) => {
  try {
    if (typeof canPlayType === "function") return Boolean(canPlayType(mime));
    if (typeof document === "undefined") return false;
    return Boolean(document.createElement("audio")?.canPlayType?.(mime));
  } catch {
    return false;
  }
};

export function browserCannotDecodeResolvedRdAudio(resolved, {
  canPlayType,
} = {}) {
  if (!resolved?.src ||
    resolved?.audioRescue?.used === true ||
    resolved?.videoRescue?.used === true ||
    !ORIGINAL_FALLBACK_STATES.has(String(resolved?.audioRescue?.state || ""))) {
    return false;
  }

  const info = resolved?.mediaInfo || resolved?.media_info || {};
  const tracks = info?.audio_tracks || info?.audioTracks;
  if (!Array.isArray(tracks) || tracks.length === 0) return false;

  // Every actual track must be positively identified as unsupported. An
  // AAC/MP3 track, an unrecognised codec or incomplete metadata keeps the
  // original file eligible for manual/audio-track selection.
  return tracks.every(track => {
    const mime = browserAudioMime(track?.codec || track?.audioCodec);
    return mime && !audioCanPlay(mime, canPlayType);
  });
}
