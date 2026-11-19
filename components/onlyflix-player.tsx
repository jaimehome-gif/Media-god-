'use client'

import { useState } from 'react'
import { movieServers, episodeServers } from '@/lib/playback-servers'
import { Play, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface OnlyFlixPlayerProps {
  tmdbId: number
  imdbId?: string | null
  seasons?: { name: string; season_number: number; episode_count: number }[]
  title: string
  posterPath?: string | null
}

export function OnlyFlixPlayer({ tmdbId, imdbId, title, posterPath, seasons }: OnlyFlixPlayerProps) {
  const [playing, setPlaying] = useState(false)

  const availableSeasons = seasons?.filter(s => s.season_number > 0 && s.episode_count > 0)
  const [season, setSeason] = useState(availableSeasons?.[0]?.season_number ?? 1)
  const [episode, setEpisode] = useState(1)
  const [serverName, setServerName] = useState('')
  const servers = seasons ? episodeServers(tmdbId, season, episode) : movieServers(tmdbId, imdbId)
  const server = servers.find(s => s.name === serverName) ?? servers[0]
  const currentSeason = availableSeasons?.find(s => s.season_number === season)
  if (!server || (seasons && !currentSeason)) return null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {currentSeason && <>
          <label>Season <select className="bg-background p-2" value={season} onChange={e => {
            setPlaying(false)
            setSeason(Number(e.target.value))
            setEpisode(1)
          }}>
            {availableSeasons?.map(s => <option key={s.season_number} value={s.season_number}>{s.name}</option>)}
          </select></label>
          <label>Episode <select className="bg-background p-2" value={episode} onChange={e => {
            setPlaying(false)
            setEpisode(Number(e.target.value))
          }}>
            {Array.from({ length: currentSeason.episode_count }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
          </select></label>
        </>}
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-2 text-sm">{seasons ? 'Episode servers' : 'Film servers'}</legend>
          {servers.map(option => (
            <Button key={option.name} type="button" size="sm"
              variant={option.name === server.name ? 'default' : 'outline'}
              aria-pressed={option.name === server.name}
              onClick={() => setServerName(option.name)}>
              {option.name}
            </Button>
          ))}
        </fieldset>
      </div>
      {playing ? (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
          <iframe
            key={server.url}
            src={server.url}
            sandbox={server.name === 'OnlyFlix' ? undefined : 'allow-scripts allow-same-origin allow-presentation'}
            title={title}
            className="w-full h-full"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
          />
          <button
            aria-label="Close player"
            onClick={() => setPlaying(false)}
            className="absolute top-3 right-3 w-12 h-12 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-black/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-secondary group">
          {posterPath ? (
            <img
              src={`https://image.tmdb.org/t/p/w780${posterPath}`}
              alt={title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-secondary" />
          )}
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Button
              size="lg"
              className="gap-2 rounded-full w-16 h-16 p-0"
              aria-label={`Play ${title} on ${server.name}`}
              onClick={() => setPlaying(true)}
            >
              <Play className="w-8 h-8 fill-current" />
            </Button>
          </div>
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <p className="text-white text-sm font-medium truncate">{title}</p>
          </div>
        </div>
      )}
    </div>
  )
}
