import { preferredAudioTrackScore, readTrackPreferences } from "./mediaTrackPreferences.js";

// Media readiness events are notifications, not proof of an absent track.
// Some decoders publish track information after their first loadeddata event.
export function attachDecoderLifecycle(player, callbacks) {
  let closed = false;
  let failed = false;
  const notify = (name, event) => {
    if (!closed && !failed) callbacks()[name]?.(event);
  };
  const fail = () => {
    if (closed || failed) return;
    failed = true;
    try { player.pause(); } catch { /* decoder may not have opened */ }
    callbacks().onFailure?.();
  };
  // Some browser decoder builds deliver loadeddata before metadata or omit
  // the metadata notification. Deliver it once when usable duration and track information
  // are present, so the host's resume handler does not seek repeatedly.
  let metadataDelivered = false;
  let audioPreferenceApplied = false;
  const selectStartupAudio = () => {
    if (audioPreferenceApplied) return;
    const tracks = player.audioTracks;
    if (!tracks || tracks.length < 2) return;
    audioPreferenceApplied = true;
    const language = readTrackPreferences().audioLanguage;
    let bestTrack;
    let bestScore = -Infinity;
    for (const track of tracks) {
      const score = preferredAudioTrackScore(track, language);
      if (score > bestScore || (score === bestScore && track.enabled)) {
        bestTrack = track;
        bestScore = score;
      }
    }
    if (bestTrack && !bestTrack.enabled) bestTrack.enabled = true;
  };
  const metadata = event => {
    if (closed || failed) return;
    selectStartupAudio();
    if (metadataDelivered) return;
    if (!(Number(player.duration) > 0 && Number.isFinite(Number(player.duration)) &&
          (Number(player.videoWidth) > 0 || Number(player.audioTracks?.length) > 0))) return;
    metadataDelivered = true;
    notify("onMetadata", event);
  };
  const progress = event => {
    metadata(event);
    notify("onProgress", event);
  };
  player.addEventListener("error", fail);
  player.addEventListener("loadedmetadata", metadata);
  player.addEventListener("loadeddata", metadata);
  player.addEventListener("durationchange", metadata);
  player.addEventListener("timeupdate", progress);
  return {
    fail,
    dispose() {
      closed = true;
      player.removeEventListener("error", fail);
      player.removeEventListener("loadedmetadata", metadata);
      player.removeEventListener("loadeddata", metadata);
      player.removeEventListener("durationchange", metadata);
      player.removeEventListener("timeupdate", progress);
    },
  };
}
