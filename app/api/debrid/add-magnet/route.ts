import { NextResponse } from 'next/server'

const RD_API = 'https://api.real-debrid.com/rest/1.0'

export async function POST(request: Request) {
  const apiKey = process.env.REAL_DEBRID_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Real-Debrid API key not configured' }, { status: 503 })
  }

  const body = await request.json()
  const { infoHash, fileIdx } = body

  if (!infoHash) {
    return NextResponse.json({ error: 'Info hash is required' }, { status: 400 })
  }

  const magnet = `magnet:?xt=urn:btih:${infoHash}`

  try {
    // Step 1: Add magnet to Real-Debrid
    const addResponse = await fetch(`${RD_API}/torrents/addMagnet`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `magnet=${encodeURIComponent(magnet)}`,
    })

    if (!addResponse.ok) {
      const errText = await addResponse.text()
      console.error('Real-Debrid addMagnet error:', addResponse.status, errText)
      return NextResponse.json({ error: `Failed to add torrent: ${addResponse.status}` }, { status: addResponse.status })
    }

    const added = await addResponse.json()
    const torrentId = added.id

    // Step 2: Select the file
    const fileSelection = fileIdx !== undefined ? String(fileIdx) : 'all'
    const selectResponse = await fetch(`${RD_API}/torrents/selectFiles/${torrentId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `files=${fileSelection}`,
    })

    if (!selectResponse.ok) {
      const errText = await selectResponse.text()
      console.error('Real-Debrid selectFiles error:', selectResponse.status, errText)
      return NextResponse.json({ error: `Failed to select file: ${selectResponse.status}` }, { status: selectResponse.status })
    }

    // Step 3: Get torrent info to find the download link
    const infoResponse = await fetch(`${RD_API}/torrents/info/${torrentId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!infoResponse.ok) {
      return NextResponse.json({ error: 'Failed to get torrent info' }, { status: infoResponse.status })
    }

    const info = await infoResponse.json()
    const links: string[] = info.links || []

    if (links.length === 0) {
      // Torrent might still be downloading
      return NextResponse.json({
        torrentId,
        status: info.status,
        progress: info.progress,
        downloadUrl: null,
        message: 'Torrent added. File is being processed by Real-Debrid.',
      })
    }

    // Step 4: Unrestrict the first link to get the direct download URL
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
      torrentId,
      status: info.status,
      progress: info.progress,
      downloadUrl: unrestricted.download,
      streamingUrl: unrestricted.streaming || unrestricted.download,
      filename: unrestricted.filename || info.filename,
      filesize: unrestricted.filesize || 0,
      message: 'Stream ready!',
    })
  } catch (error) {
    console.error('Real-Debrid add-magnet error:', error)
    return NextResponse.json({ error: 'Failed to process torrent' }, { status: 500 })
  }
}
