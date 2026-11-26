// Read-only, local diagnostics. Never collect media URLs, titles, tokens,
// account data, track labels, audio samples or other user identifiers.
const count = value => typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
export function websiteAudioSnapshot(video) {
  if (!video) return { mediaElement: false };
  let tracks = null, enabled = null;
  try {
    if (typeof video.audioTracks?.length === "number") {
      tracks = video.audioTracks.length;
      enabled = Array.from(video.audioTracks).filter(track => track.enabled === true).length;
    }
  } catch { /* unsupported browser API */ }
  let frames = null;
  try { frames = count(video.getVideoPlaybackQuality?.().totalVideoFrames); } catch {}
  return {
    mediaElement: true,
    muted: Boolean(video.muted),
    defaultMuted: Boolean(video.defaultMuted),
    volumePercent: count(video.volume * 100),
    paused: Boolean(video.paused),
    readyState: count(video.readyState),
    positionMs: count(video.currentTime * 1000),
    decodedAudioBytes: count(video.webkitAudioDecodedByteCount),
    decodedVideoFrames: frames,
    audioTrackCount: tracks,
    enabledAudioTracks: enabled,
    browserReportsAudio: typeof video.mozHasAudio === "boolean" ? video.mozHasAudio : null,
    mediaErrorCode: count(video.error?.code),
  };
}
export function websiteAudioReport(before, after, sameElement = true) {
  const difference = key => sameElement && before[key] !== null && after[key] !== null &&
    typeof before[key] === "number" && typeof after[key] === "number" &&
    after[key] >= before[key] ? after[key] - before[key] : null;
  return { sameElement, before, after, positionAdvancedMs: difference("positionMs"),
    audioBytesAdvanced: difference("decodedAudioBytes"), videoFramesAdvanced: difference("decodedVideoFrames") };
}

/** Local observations, not a claim that the speakers are audible. */
export function describeWebsiteAudio(report) {
  const a = report?.after;
  if (!a?.mediaElement) return "No browser media element is open.";
  if (!report.sameElement) return "The media element changed during measurement. Capture again.";
  if (a.mediaErrorCode) return a.mediaErrorCode === 4
    ? "The browser rejected the media format or resource. Try a supported personal file."
    : "The browser reported a media playback error (code " + a.mediaErrorCode + ").";
  if (a.muted || a.volumePercent === 0) return "The player output is muted or its volume is zero.";
  if (a.paused) return "Playback is paused. Press Play, then capture again.";
  if (report.positionAdvancedMs === 0) return "Playback did not advance during measurement.";
  if (report.positionAdvancedMs > 0 && report.audioBytesAdvanced > 0)
    return "The browser reports decoded audio and advancing playback. Check device volume and audio output if you cannot hear it.";
  if (report.positionAdvancedMs > 0 && report.videoFramesAdvanced > 0 &&
      report.audioBytesAdvanced === 0)
    return "Picture is advancing, but the browser reports no additional decoded audio bytes. The audio may be absent or unsupported.";
  if (a.audioTrackCount > 0 && a.enabledAudioTracks === 0)
    return "Audio tracks are present, but none are enabled.";
  return "Audio decoding could not be confirmed by this browser's counters. This does not prove the file is silent.";
}

export function restoreWebsiteAudioOutput(video) {
  if (!video || typeof video.volume !== "number" || typeof video.muted !== "boolean") return false;
  try {
    // Explicit viewer action only; never change sources, tracks or autoplay.
    video.muted = false;
    if (video.volume === 0) video.volume = 1;
    return !video.muted && video.volume > 0;
  } catch { return false; }
}
