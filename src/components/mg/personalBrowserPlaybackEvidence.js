// Evidence for user-selected, local media only. No URL, name, or account data
// is collected. Silence at the sampled position is inconclusive, not failure.
export function personalPlaybackEvidence({errorCode, advancedMs, frames, width, audioPeak, audioAvailable, paused} = {}) {
  if (errorCode) return {state:"rejected",reason:"The browser reported a media playback error."};
  if (paused) return {state:"pending",reason:"Press Play to measure the file."};
  if (!(advancedMs > 250 && frames > 0 && width > 0))
    return {state:"pending",reason:"Moving picture has not yet been confirmed."};
  if (audioAvailable && Number.isFinite(audioPeak) && audioPeak > 0.001)
    return {state:"verified",reason:"Moving picture and a non-silent decoded audio signal confirmed."};
  return {state:"pending",reason:"Picture confirmed; audio is silent at this position or cannot be measured. Try another scene."};
}
