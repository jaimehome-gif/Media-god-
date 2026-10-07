import { NextResponse } from 'next/server'
import { DebridError, debridRequest, prepareTorrentStream } from '@/lib/real-debrid'

export async function POST(request: Request) {
  const apiKey = process.env.REAL_DEBRID_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Real-Debrid API key not configured' }, { status: 503 })
  }

  try {
    const { infoHash } = await request.json()
    if (typeof infoHash !== 'string' || !/^(?:[a-f0-9]{40}|[a-z2-7]{32})$/i.test(infoHash)) {
      return NextResponse.json({ error: 'A valid torrent info hash is required' }, { status: 400 })
    }

    const added = await debridRequest<{ id: string }>(apiKey, '/torrents/addMagnet', new URLSearchParams({
      magnet: `magnet:?xt=urn:btih:${infoHash}`,
    }))
    return NextResponse.json(await prepareTorrentStream(apiKey, added.id))
  } catch (error) {
    if (error instanceof DebridError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    console.error('Real-Debrid add-magnet request failed')
    return NextResponse.json({ error: 'Unable to contact Real-Debrid. Please try again.' }, { status: 502 })
  }
}
