import { NextResponse } from 'next/server'
import { debridRequest } from '@/lib/real-debrid'
import { matchesEpisodeResult, matchesSeriesTitle, matchesExactEpisode } from '@/lib/episode-matching'

interface TorrentResult {
  title: string
  size: string
  quality: string
  infoHash?: string
  torrentId?: string
  seeders: number
  leechers: number
  provider: string
  languages: string[]
}

interface TorrentSearchRow {
  name?: string
  filename?: string
  title?: string
  size?: number | string
  size_bytes?: number | string
  info_hash?: string
  hash?: string
  seeders?: string | number
  seeds?: string | number
  leechers?: string | number
  peers?: string | number
  imdb?: string
  season?: string | number
  episode?: string | number
}
interface LibraryTorrent {
  id: string
  filename: string
  hash: string
  bytes: number
  status: string
}

const validHash = (value: unknown): value is string =>
  typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-z2-7]{32})$/i.test(value)

function formatSize(value: string | number | undefined): string {
  const b = Number(value) || 0
  return b >= 1073741824 ? `${(b / 1073741824).toFixed(1)} GB`
    : b >= 1048576 ? `${(b / 1048576).toFixed(0)} MB` : `${b} B`
}
function quality(title: string): string {
  return title.match(/\b(2160p|1080p|720p|480p|4K)\b/i)?.[1] || 'Unknown'
}
async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { next: { revalidate: 180 }, signal: AbortSignal.timeout(6500) })
  if (!response.ok) throw new Error(`Search provider returned ${response.status}`)
  return response.json()
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const title = params.get('title')?.trim() || ''
  const type = params.get('type') || 'movie'
  const imdbId = params.get('imdbId') || ''
  const seasonText = params.get('season') || ''
  const episodeText = params.get('episode') || ''
  const isTV = type === 'series' || type === 'tv'

  if (!title || title.length > 180) return NextResponse.json({ error: 'A valid title is required' }, { status: 400 })
  const season = Number(seasonText)
  const episode = Number(episodeText)
  if (isTV && (!/^\d{1,2}$/.test(seasonText) || !/^\d{1,3}$/.test(episodeText) || episode < 1)) {
    return NextResponse.json({ error: 'Choose a valid season and episode.' }, { status: 400 })
  }

  const matches = (name: string) => !isTV || matchesEpisodeResult(name, title, season, episode)
  const exact = isTV ? `${title} S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}` : title
  const tasks: Promise<TorrentResult[]>[] = []

  // Search the user's existing authorised Real-Debrid library first. The RD
  // API does not offer global title search; /torrents enumerates owned files.
  const apiKey = process.env.REAL_DEBRID_API_KEY
  if (apiKey && isTV) {
    tasks.push((async () => {
      const torrents = await debridRequest<LibraryTorrent[]>(apiKey, '/torrents?limit=200')
      return (Array.isArray(torrents) ? torrents : [])
        .filter(item => item?.id && typeof item.filename === 'string' && matches(item.filename))
        .filter(item => !['error', 'virus', 'dead', 'magnet_error'].includes(item.status))
        .map(item => ({
          title: item.filename, size: formatSize(item.bytes), quality: quality(item.filename),
          torrentId: item.id, infoHash: validHash(item.hash) ? item.hash : undefined,
          seeders: 0, leechers: 0, provider: 'Real-Debrid Library', languages: [],
        }))
    })().catch(() => []))
  }

  // Independent searches: if one public index fails, other results still show.
  // Query the full episode AND its season so a pack is discoverable too.
  const queries = isTV ? [exact, `${title} S${String(season).padStart(2, '0')}`] : [title]
  for (const query of queries) {
    tasks.push((async () => {
      const data = await getJson(`https://apibay.org/q.php?q=${encodeURIComponent(query)}`)
      if (!Array.isArray(data)) return []
      return (data as TorrentSearchRow[])
        .filter(item => validHash(item.info_hash) && typeof item.name === 'string')
        .filter(item => !imdbId || !item.imdb || item.imdb === '0' ||
          item.imdb.replace(/^tt/, '') === imdbId.replace(/^tt/, ''))
        .filter(item => matches(item.name!))
        .map(item => ({
          title: item.name!, size: formatSize(item.size), quality: quality(item.name!),
          infoHash: item.info_hash!, seeders: Number(item.seeders) || 0,
          leechers: Number(item.leechers) || 0, provider: 'Torrent Index', languages: [],
        }))
    })().catch(() => []))
  }

  if (isTV && /^tt\d+$/.test(imdbId)) {
    tasks.push((async () => {
      const data = await getJson(`https://eztv.re/api/get-torrents?imdb_id=${encodeURIComponent(imdbId.slice(2))}&limit=100`) as {
        torrents?: TorrentSearchRow[]
      }
      return (Array.isArray(data?.torrents) ? data.torrents : [])
        .filter(item => validHash(item.hash))
        .filter(item => {
          const name = item.filename || item.title || ''
          if (!matchesSeriesTitle(name, title)) return false
          // Metadata is helpful but missing/malformed metadata must not make
          // a correctly named episode invisible.
          return matchesEpisodeResult(name, title, season, episode) ||
            (Number(item.season) === season && Number(item.episode) === episode &&
             matchesExactEpisode(name, season, episode))
        })
        .map(item => {
          const name = item.filename || item.title || ''
          return {
            title: name, size: formatSize(item.size_bytes), quality: quality(name),
            infoHash: item.hash!, seeders: Number(item.seeds) || 0,
            leechers: Number(item.peers) || 0, provider: 'Episode Index', languages: [],
          }
        })
    })().catch(() => []))
  }

  const results = (await Promise.all(tasks)).flat()
  const seen = new Set<string>()
  const streams = results
    .filter(item => {
      const key = item.torrentId || item.infoHash?.toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    // Cached personal-library items first, then highest seeded candidates.
    .sort((a, b) => Number(!!b.torrentId) - Number(!!a.torrentId) || b.seeders - a.seeders)
    .slice(0, 40)

  return NextResponse.json({ streams, searched: { title, season: isTV ? season : null, episode: isTV ? episode : null } })
}
