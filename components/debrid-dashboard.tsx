'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function DebridDashboard() {
  const [torrents, setTorrents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch active torrents from your debrid client/API route
    fetch('/api/debrid/torrents')
      .then((res) => res.json())
      .then((data) => {
        setTorrents(data.torrents || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <Card className="bg-zinc-900 border-zinc-800 text-white">
      <CardHeader>
        <CardTitle>Real-Debrid Active Streams</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-zinc-400">Loading active downloads...</p>
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
