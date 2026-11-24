/**
 * Only for browser-managed VOD HLS audio selection. A browser can show
 * the picture from an HLS variant while being unable to decode its audio.
 * Prefer a real decodable track ahead of an unsupported Dolby/DTS/TrueHD
 * track, even when the latter has better language metadata.
 *
 * Unknown codec metadata is not penalized; the app's existing language and
 * commentary preferences still decide the order.
 * Live TV and native VLC do not use this penalty.
 */
export const browserHlsAudioPenalty = (track, canPlayAudio = () => false) => {
  const codec = String(
    track?.audioCodec || track?.codec || track?.attrs?.CODECS || ""
  ).toLowerCase().trim();
  if (!codec) return 0;
  const confirmedIncompatible = -150000;
  if (/\b(?:truehd|mlp|dts(?:-hd)?|dca|ac-?4|ac4)\b/i.test(codec)) {
    return confirmedIncompatible;
  }
  if (/\b(?:e-?ac-?3|ec-?3|eac3|ddp)\b/i.test(codec)) {
    return canPlayAudio('audio/mp4; codecs="ec-3"') ? 0 : confirmedIncompatible;
  }
  if (/\b(?:ac-?3|ac3)\b/i.test(codec)) {
    return canPlayAudio('audio/mp4; codecs="ac-3"') ? 0 : confirmedIncompatible;
  }
  return 0;
};
