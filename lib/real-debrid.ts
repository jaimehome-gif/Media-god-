import { isVideoFile, isSampleOrTrailer, matchesEpisodeFile, matchesExactEpisode } from './episode-matching'

const RD_API = 'https://api.real-debrid.com/rest/1.0'

export class DebridError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message)
  }
}

export async function debridRequest<T>(apiKey: string, path: string, body?: URLSearchParams): Promise<T> {
  const response = await fetch(`${RD_API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  const data = response.status === 204 ? null : await response.json()

  if (!response.ok) {
    if (data?.error_code === 35 || data?.error === 'infringing_file') {
      throw new DebridError('Real-Debrid has blocked this file for copyright reasons. The app cannot play it or remove that restriction.', 451, 'CONTENT_BLOCKED')
    }
    if (response.status === 401 || data?.error_code === 8) {
      throw new DebridError('The Real-Debrid API key is invalid or expired. Update it in Secrets.', 401, 'INVALID_TOKEN')
    }
    if (data?.error_code === 19) {
      throw new DebridError('An active Real-Debrid Premium subscription is required to play this file.', 403, 'PREMIUM_REQUIRED')
    }
    if (response.status === 429) {
      throw new DebridError('Real-Debrid is receiving too many requests. Please wait before trying again.', 429, 'RATE_LIMITED')
    }
    throw new DebridError(`Real-Debrid could not process this file (${data?.error || response.status}).`, response.status, 'PROVIDER_ERROR')
  }

  return data as T
}

interface TorrentFile {
  id: number
  path: string
  bytes: number
  selected: number
}

interface TorrentInfo {
  status: string
  progress: number
  filename: string
  files: TorrentFile[]
  links: string[]
}

interface UnrestrictedFile {
  id: string
  download: string
  filename: string
  filesize: number
  streamable: number
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

export async function prepareTorrentStream(
  apiKey: string,
  torrentId: string,
  requestedEpisode?: { season: number; episode: number },
) {
  let info = await debridRequest<TorrentInfo>(apiKey, `/torrents/info/${encodeURIComponent(torrentId)}`)

  if (['error', 'magnet_error', 'virus', 'dead'].includes(info.status)) {
    throw new DebridError(`Real-Debrid could not prepare this torrent (${info.status}).`, 422, 'TORRENT_FAILED')
  }

  if (info.status === 'waiting_files_selection') {
    // Real-Debrid file IDs are NOT array indexes. Only select the requested
    // episode from a multi-file pack, never an arbitrary largest video.
    const videos = info.files.filter((file) => isVideoFile(file.path) && !isSampleOrTrailer(file.path))
    const matches = requestedEpisode
      ? videos.filter((file) => matchesEpisodeFile(file.path, requestedEpisode.season, requestedEpisode.episode, info.filename))
      : videos
    const singleEpisodeFile = requestedEpisode && videos.length === 1 &&
      matchesExactEpisode(info.filename, requestedEpisode.season, requestedEpisode.episode)
      ? videos : []
    const video = (matches.length ? matches : singleEpisodeFile)
      .sort((a, b) => b.bytes - a.bytes)[0] ||
      (!requestedEpisode ? [...videos].sort((a, b) => b.bytes - a.bytes)[0] : undefined)
    if (!video) {
      throw new DebridError(requestedEpisode
        ? `This torrent does not contain season ${requestedEpisode.season}, episode ${requestedEpisode.episode}. Choose another source.`
        : 'This torrent does not contain a playable video.', 422,
      requestedEpisode ? 'EPISODE_NOT_FOUND' : 'NO_VIDEO')
    }
    await debridRequest(apiKey, `/torrents/selectFiles/${encodeURIComponent(torrentId)}`, new URLSearchParams({ files: String(video.id) }))
    info = await debridRequest<TorrentInfo>(apiKey, `/torrents/info/${encodeURIComponent(torrentId)}`)
  }

  if (info.status !== 'downloaded' || !info.links?.length) {
    return { torrentId, ready: false, status: info.status, progress: info.progress, message: 'Waiting for Real-Debrid to prepare the video.' }
  }

  // Each Real-Debrid link belongs to the selected file with the SAME index.
  // With a season pack, reject absent episodes rather than playing another one.
  const selected = info.files.filter((file) => file.selected === 1)
  const videos = selected.filter((file) => isVideoFile(file.path) && !isSampleOrTrailer(file.path))
  const matches = requestedEpisode
    ? videos.filter((file) => matchesEpisodeFile(file.path, requestedEpisode.season, requestedEpisode.episode, info.filename))
    : videos
  const singleEpisodeFile = requestedEpisode && videos.length === 1 &&
    matchesExactEpisode(info.filename, requestedEpisode.season, requestedEpisode.episode)
    ? videos : []
  const video = (matches.length ? matches : singleEpisodeFile)
    .sort((a, b) => b.bytes - a.bytes)[0] ||
    (!requestedEpisode ? [...videos].sort((a, b) => b.bytes - a.bytes)[0] : undefined)
  if (!video) {
    throw new DebridError(requestedEpisode
      ? `The requested episode S${String(requestedEpisode.season).padStart(2, '0')}E${String(requestedEpisode.episode).padStart(2, '0')} is not available in this selected torrent.`
      : 'No playable video file is selected.', 422,
    requestedEpisode ? 'EPISODE_NOT_FOUND' : 'NO_VIDEO')
  }
  const linkIndex = selected.findIndex((file) => file.id === video.id)
  const link = info.links[linkIndex]
  if (!link) throw new DebridError('Real-Debrid has not provided a link for the selected video.', 422, 'NO_VIDEO_LINK')

  const file = await debridRequest<UnrestrictedFile>(apiKey, '/unrestrict/link', new URLSearchParams({ link }))
  let streamingUrl: string | undefined

  // `streamable` is a flag, not a URL. Use the official HLS output for browser-compatible MKV/HEVC playback.
  if (file.streamable === 1 && file.id) {
    const formats = await debridRequest<{ apple?: Record<string, string> }>(apiKey, `/streaming/transcode/${encodeURIComponent(file.id)}`)
    streamingUrl = ['medium', 'high', 'low'].map((quality) => formats.apple?.[quality]).find(isHttpUrl)
  }
  if (!streamingUrl && /\.(mp4|m4v|webm)$/i.test(file.filename) && isHttpUrl(file.download)) {
    streamingUrl = file.download
  }
  if (!streamingUrl) {
    throw new DebridError('Real-Debrid has not provided a browser-compatible video stream for this file.', 422, 'UNSUPPORTED_VIDEO')
  }

  return {
    torrentId,
    ready: true,
    status: info.status,
    progress: info.progress,
    streamingUrl,
    downloadUrl: file.download,
    filename: file.filename || info.filename,
    filesize: file.filesize,
  }
}
