import { NextResponse } from 'next/server'

interface TorrentResult {
  title: string
  size: string
  quality: string
  infoHash: string
  seeders: number
  leechers: number
  provider: string
}

function formatSize(bytes: string | number): string {
  const b = Number(bytes)
  if (b >= 1073741824) return `${(b / 1073741824).toFixed(1)} GB`
  if (b >= 1048576) return `${(b / 1048576).toFixed(0)} MB`
  return `${b} B`
}

function extractQuality(name: string): string {
  const match = name.match(/\b(2160p|1080p|720p|480p|4K)\b/i)
  return match ? match[1] : 'Unknown'
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title')
  const imdbId = searchParams.get('imdbId')
  const type = searchParams.get('type') || 'movie'
  const season = searchParams.get('season')
  const episode = searchParams.get('episode')

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  // Build search query
  let query = title
  if (type === 'series' && season && episode) {
    const ep = String(episode).padStart(2, '0')
    const se = String(season).padStart(2, '0')
    query = `${title} S${se}E${ep}`
  }

  try {
    // Search via The Pirate Bay API
    const pbResponse = await fetch(
      `https://apibay.org/q.php?q=${encodeURIComponent(query)}`,
      { next: { revalidate: 300 } }
    )

    let streams: TorrentResult[] = []

    if (pbResponse.ok) {
      const pbData = await pbResponse.json() as any[]
      streams = pbData
        .filter((t) => t.info_hash && t.info_hash !== '0')
        .filter((t) => {
          // Filter by IMDB ID if provided
          if (imdbId && t.imdb && t.imdb !== '0') {
            return t.imdb === imdbId
          }
          return true
        })
        .filter((t) => {
          // For TV, ensure the result matches the season/episode
          if (type === 'series' && season && episode) {
            const se = String(season).padStart(2, '0')
            const ep = String(episode).padStart(2, '0')
            return t.name.toLowerCase().includes(`s${se}e${ep}`)
          }
          return true
        })
        .map((t) => ({
          title: t.name,
          size: formatSize(t.size),
          quality: extractQuality(t.name),
          infoHash: t.info_hash,
          seeders: parseInt(t.seeders) || 0,
          leechers: parseInt(t.leechers) || 0,
          provider: 'The Pirate Bay',
        }))
    }

    // For TV shows, also search EZTV
    if (type === 'series') {
      try {
        const eztvImdb = imdbId?.replace('tt', '') || ''
        const eztvResponse = await fetch(
          `https://eztv.re/api/get-torrents?imdb_id=${eztvImdb}&limit=50`,
          { next: { revalidate: 300 } }
        )
        if (eztvResponse.ok) {
          const eztvData = await eztvResponse.json() as any
          if (eztvData.torrents) {
            const eztvStreams: TorrentResult[] = eztvData.torrents
              .filter((t: any) => {
                // Filter by show name (EZTV imdb_id filter is unreliable)
                const torrentTitle = (t.filename || t.title || '').toLowerCase()
                return torrentTitle.includes(title.toLowerCase())
              })
              .filter((t: any) => {
                if (season && episode) {
                  return parseInt(t.season) === parseInt(season) &&
                         parseInt(t.episode) === parseInt(episode)
                }
                return true
              })
              .map((t: any) => ({
                title: t.filename || t.title,
                size: formatSize(t.size_bytes),
                quality: extractQuality(t.filename || t.title),
                infoHash: t.hash,
                seeders: t.seeds || 0,
                leechers: t.peers || 0,
                provider: 'EZTV',
              }))
            streams = [...streams, ...eztvStreams]
          }
        }
      } catch {
        // EZTV might fail, continue with PB results
      }
    }

    // Deduplicate by infoHash and sort by seeders
    const seen = new Set<string>()
    streams = streams
      .filter((s) => {
        if (seen.has(s.infoHash)) return false
        seen.add(s.infoHash)
        return true
      })
      .sort((a, b) => b.seeders - a.seeders)
      .slice(0, 30)

    return NextResponse.json({ streams })
  } catch (error) {
    console.error('Torrent search error:', error)
    return NextResponse.json({ streams: [] })
  }
}
