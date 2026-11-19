'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function DebridDashboard() {
  const [torrents, setTorrents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [message, setMessage] = useState('')

  useEffect(() => {
    // Fetch active torrents from your debrid client/API route
    fetch('/api/debrid/torrents')
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 401 ? 'Sign in to view active streams.' : 'Active streams are unavailable.')
        return res.json()
      })
      .then((data) => {
        setTorrents(data.torrents || [])
        setLoading(false)
      })
      .catch((error) => {
        setMessage(error.message)
        setLoading(false)
      })
  }, [])

  return (
    <Card className="bg-zinc-900 border-zinc-800 text-white">
      <CardHeader>
        <CardTitle>Real-Debrid Active Streams</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-zinc-400">Loading active downloads...</p>
        ) : message ? (
          <p role="status" className="text-zinc-400">{message}</p>
        ) : torrents.length === 0 ? (
          <p className="text-zinc-400">No active torrents found.</p>
        ) : (
          <div className="space-y-4">
            {torrents.map((torrent) => (
              <div key={torrent.id} className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                <div>
                  <p className="font-medium">{torrent.filename}</p>
                  <p className="text-sm text-zinc-400">{torrent.status} - {torrent.progress}%</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
