'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Play, Download, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { DebridVideoPlayer } from '@/components/debrid-video-player'

interface DebridStreamButtonProps {
  title: string
  imdbId: string | null
  mediaType: 'movie' | 'tv'
  seasons?: { id: number; name: string; season_number: number; episode_count: number }[]
}

interface TorrentResult {
  title: string
  size: string
  quality: string
  infoHash: string
  seeders: number
  provider: string
  languages: string[]
}

interface StreamResult {
  torrentId?: string
  status?: string
  downloadUrl?: string | null
  streamingUrl?: string
  filename?: string
  message?: string
  error?: string
  code?: string
}

export function DebridStreamButton({ title, imdbId, mediaType, seasons }: DebridStreamButtonProps) {
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [results, setResults] = useState<TorrentResult[]>([])
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [selectedSeason, setSelectedSeason] = useState(1)
  const [selectedEpisode, setSelectedEpisode] = useState(1)
  const [polling, setPolling] = useState(false)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [blockedHashes, setBlockedHashes] = useState<Set<string>>(new Set())
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollRunRef = useRef(0)

  const stopPolling = useCallback(() => {
    pollRunRef.current++
    if (pollRef.current) {
      clearTimeout(pollRef.current)
      pollRef.current = null
    }
    setPolling(false)
  }, [])

  useEffect(() => () => {
    pollRunRef.current++
    if (pollRef.current) clearTimeout(pollRef.current)
  }, [])

  const pollTorrentStatus = useCallback(async (torrentId: string, infoHash: string) => {
    const run = ++pollRunRef.current
    setPolling(true)
    let attempts = 0
    const maxAttempts = 40 // ~2 minutes at 3s intervals

    const check = async () => {
      attempts++
      try {
        const res = await fetch(`/api/debrid/torrent-status?id=${torrentId}`)
        const data = await res.json()
        if (run !== pollRunRef.current) return

        if (data.error) {
          stopPolling()
          setStreamError(data.error)
          if (data.code === 'CONTENT_BLOCKED') setBlockedHashes((current) => new Set([...current, infoHash]))
          toast.error(data.error)
          return
        }

        if (data.ready && data.streamingUrl) {
          stopPolling()
          setStreamUrl(data.streamingUrl)
          toast.info('Video prepared — loading player...')
          return
        }

        if (attempts >= maxAttempts) {
          stopPolling()
          setStreamError('Real-Debrid is still processing this torrent. Please try again later.')
          toast.error('Real-Debrid is still processing this torrent. Please try again later.')
          return
        }

        pollRef.current = setTimeout(check, 3000)
      } catch {
        if (run !== pollRunRef.current) return
        stopPolling()
        setStreamError('Failed to check torrent status')
        toast.error('Failed to check torrent status')
      }
    }

    check()
  }, [stopPolling])

  const isTV = mediaType === 'tv'
  const validSeasons = seasons?.filter((s) => s.season_number > 0) || []
  const currentSeason = validSeasons.find((s) => s.season_number === selectedSeason)
  const maxEpisodes = currentSeason?.episode_count || 1

  const handleSearch = async () => {
    if (!imdbId) {
      toast.error('No IMDB ID found for this title')
      return
    }

    stopPolling()
    setStreamError(null)
    setBlockedHashes(new Set())
    setSearching(true)
    setResults([])
    setStreamUrl(null)

    try {
      const params = new URLSearchParams({
        title,
        type: isTV ? 'series' : 'movie',
      })
      if (imdbId) params.set('imdbId', imdbId)
      if (isTV) {
        params.set('season', String(selectedSeason))
        params.set('episode', String(selectedEpisode))
      }

      const response = await fetch(`/api/debrid/search?${params}`)
      const data = await response.json()

      if (!response.ok || data.error) {
        setStreamError(data.error || 'Failed to search for torrents')
      } else if (data.streams?.length > 0) {
        setResults(data.streams)
      } else {
        toast.info('No torrents found for this title')
      }
    } catch {
      toast.error('Failed to search for torrents')
    } finally {
      setSearching(false)
    }
  }

  const handleAddMagnet = async (torrent: TorrentResult) => {
    stopPolling()
    setAdding(torrent.infoHash)
    setStreamUrl(null)
    setStreamError(null)

    try {
      const response = await fetch('/api/debrid/add-magnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          infoHash: torrent.infoHash,
        }),
      })

      const data: StreamResult = await response.json()

      if (data.error) {
        setStreamError(data.error)
        if (data.code === 'CONTENT_BLOCKED') setBlockedHashes((current) => new Set([...current, torrent.infoHash]))
        toast.error(data.error)
        return
      }

      if (data.streamingUrl) {
        setStreamUrl(data.streamingUrl)
        toast.info('Video prepared — loading player...')
      } else if (data.torrentId) {
        toast.info('Torrent added — waiting for Real-Debrid to process...')
        pollTorrentStatus(data.torrentId, torrent.infoHash)
      } else {
        toast.info(data.message || 'Torrent added to Real-Debrid. Processing...')
      }
    } catch {
      setStreamError('Failed to add torrent to Real-Debrid')
      toast.error('Failed to add torrent to Real-Debrid')
    } finally {
      setAdding(null)
    }
  }

  return (
    <div className="w-full">
      <Button
        size="lg"
        className="gap-2 w-full sm:w-auto"
        onClick={() => {
          setOpen(!open)
          if (open) stopPolling()
          setStreamError(null)
          if (!open && results.length === 0) {
            handleSearch()
          }
        }}
      >
        {open ? <X className="w-5 h-5" /> : <Download className="w-5 h-5" />}
        Stream via Debrid
      </Button>

      {open && (
        <div className="mt-4 rounded-xl border border-border bg-card p-4 space-y-4">
          {/* Season/Episode selector for TV */}
          {isTV && validSeasons.length > 0 && (
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Season</label>
                <select
                  value={selectedSeason}
                  onChange={(e) => {
                    setSelectedSeason(Number(e.target.value))
                    setSelectedEpisode(1)
                  }}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  {validSeasons.map((s) => (
                    <option key={s.id} value={s.season_number}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Episode</label>
                <select
                  value={selectedEpisode}
                  onChange={(e) => setSelectedEpisode(Number(e.target.value))}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  {Array.from({ length: maxEpisodes }, (_, i) => i + 1).map((ep) => (
                    <option key={ep} value={ep}>
                      Episode {ep}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSearch}
                  disabled={searching}
                  className="gap-2"
                >
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Search
                </Button>
              </div>
            </div>
          )}

          {/* Searching state */}
          {searching && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Searching for torrents...
            </div>
          )}

          {/* Error state */}
          {streamError && !streamUrl && (
            <div role="alert" className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <X className="w-5 h-5 text-red-500" />
              <span className="text-sm text-red-500 font-medium flex-1">{streamError}</span>
            </div>
          )}

          {/* Polling — waiting for Real-Debrid to process */}
          {polling && !streamUrl && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/30">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm text-primary font-medium flex-1">
                Waiting for Real-Debrid to process the torrent...
              </span>
            </div>
          )}

          {/* Accepted streams use Real-Debrid's browser-compatible video output. */}
          {streamUrl && <DebridVideoPlayer key={streamUrl} src={streamUrl} />}

          {results.length > 0 && results.every((torrent) => blockedHashes.has(torrent.infoHash)) && (
            <p role="status" className="text-sm text-muted-foreground">
              Real-Debrid has blocked every source tried for this title. Playback requires an authorised source that Real-Debrid accepts.
            </p>
          )}

          {/* Results list */}
          {!searching && results.length > 0 && (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-2">
                {results.length} torrents found — pick one to stream via Real-Debrid
              </p>
              {results.map((torrent, i) => (
                <div
                  key={`${torrent.infoHash}-${i}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {torrent.title}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
                        {torrent.quality}
                      </span>
                      <span>{torrent.size}</span>
                      <span>👤 {torrent.seeders}</span>
                      {torrent.languages?.length > 0 && (
                        <span>🌐 {torrent.languages.join('+')}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    data-testid={`stream-${torrent.infoHash}`}
                    size="sm"
                    onClick={() => handleAddMagnet(torrent)}
                    disabled={adding !== null || blockedHashes.has(torrent.infoHash)}
                    className="gap-1 flex-shrink-0"
                  >
                    {adding === torrent.infoHash ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                    {blockedHashes.has(torrent.infoHash) ? 'Blocked' : adding === torrent.infoHash ? 'Adding...' : 'Stream'}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* No results */}
          {!searching && results.length === 0 && !streamUrl && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No torrents found. Try a different season/episode or search again.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
