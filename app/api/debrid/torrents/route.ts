import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.REAL_DEBRID_API_KEY
  if (!apiKey) {
    return NextResponse.json({ torrents: [] })
  }

  try {
    const response = await fetch('https://api.real-debrid.com/rest/1.0/torrents', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      console.error('Real-Debrid API error:', response.status)
      return NextResponse.json({ torrents: [] }, { status: response.status })
    }

    const torrents = await response.json()
    return NextResponse.json({ torrents })
  } catch (error) {
    console.error('Real-Debrid API error:', error)
    return NextResponse.json({ torrents: [] }, { status: 500 })
  }
}
