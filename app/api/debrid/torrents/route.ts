import { NextResponse } from 'next/server'

import { getSessionSafe } from '@/lib/auth'

export async function GET(request: Request) {
  const session = await getSessionSafe(request.headers)
  if (!session?.user?.id) {
    return NextResponse.json({ torrents: [], error: 'Sign in to view active streams.' }, { status: 401 })
  }

  const apiKey = process.env.REAL_DEBRID_API_KEY
  if (!apiKey) {
    return NextResponse.json({ torrents: [] })
  }

  try {
    const response = await fetch('https://api.real-debrid.com/rest/1.0/torrents', {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      console.error('Real-Debrid API error:', response.status)
      return NextResponse.json({ torrents: [] }, { status: response.status })
    }

    const torrents = await response.json()
    return NextResponse.json({ torrents }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('Real-Debrid API error:', error)
    return NextResponse.json({ torrents: [] }, { status: 500 })
  }
}
