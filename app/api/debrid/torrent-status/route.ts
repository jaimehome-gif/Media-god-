import { NextResponse } from 'next/server'

const RD_API = 'https://api.real-debrid.com/rest/1.0'

export async function GET(request: Request) {
  const apiKey = process.env.REAL_DEBRID_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Real-Debrid API key not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const torrentId = searchParams.get('id')

  if (!torrentId) {
    return NextResponse.json({ error: 'Torrent ID is required' }, { status: 400 })
  }

  try {
    const infoResponse = await fetch(`${RD_API}/torrents/info/${torrentId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!infoResponse.ok) {
      return NextResponse.json({ error: 'Failed to get torrent info' }, { status: infoResponse.status })
    }

    const info = await infoResponse.json()
    const links: string[] = info.links || []

    // Not ready yet — still downloading
    if (links.length === 0) {
      return NextResponse.json({
        ready: false,
        status: info.status,
        progress: info.progress,
      })
    }

    // Unrestrict the first link to get the direct streaming URL
    const unrestrictResponse = await fetch(`${RD_API}/unrestrict/link`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `link=${encodeURIComponent(links[0])}`,
    })

    if (!unrestrictResponse.ok) {
      const errText = await unrestrictResponse.text()
      console.error('Real-Debrid unrestrict error:', unrestrictResponse.status, errText)
      return NextResponse.json({ error: `Failed to unrestrict link: ${unrestrictResponse.status}` }, { status: unrestrictResponse.status })
    }

    const unrestricted = await unrestrictResponse.json()

    return NextResponse.json({
      ready: true,
      status: info.status,
      progress: 100,
      streamingUrl: unrestricted.streaming || unrestricted.download,
      filename: unrestricted.filename || info.filename,
    })
  } catch (error) {
    console.error('Real-Debrid torrent-status error:', error)
    return NextResponse.json({ error: 'Failed to check torrent status' }, { status: 500 })
  }
}
