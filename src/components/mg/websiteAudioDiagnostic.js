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
