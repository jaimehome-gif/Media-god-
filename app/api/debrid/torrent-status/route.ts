import { NextResponse } from 'next/server'
import { DebridError, prepareTorrentStream } from '@/lib/real-debrid'

export async function GET(request: Request) {
  const apiKey = process.env.REAL_DEBRID_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Real-Debrid API key not configured' }, { status: 503 })
  }

  const torrentId = new URL(request.url).searchParams.get('id')
  if (!torrentId || !/^[a-z0-9]+$/i.test(torrentId)) {
    return NextResponse.json({ error: 'A valid torrent ID is required' }, { status: 400 })
  }

  const params = new URL(request.url).searchParams
  const season = params.get('season')
  const episode = params.get('episode')
  const hasEpisode = season !== null || episode !== null
  if (hasEpisode && (!season || !episode || !/^\d{1,2}$/.test(season) || !/^\d{1,3}$/.test(episode)
    || Number(episode) < 1)) {
    return NextResponse.json({ error: 'A valid season and episode are required.' }, { status: 400 })
  }

  try {
    return NextResponse.json(await prepareTorrentStream(apiKey, torrentId,
      hasEpisode ? { season: Number(season), episode: Number(episode) } : undefined))
  } catch (error) {
    if (error instanceof DebridError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    console.error('Real-Debrid torrent-status request failed')
    return NextResponse.json({ error: 'Unable to contact Real-Debrid. Please try again.' }, { status: 502 })
  }
}
