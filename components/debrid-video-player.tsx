'use client'

import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import { ExternalLink, Loader2, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function DebridVideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'playing' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const isHls = /\.m3u8(?:\?|$)/i.test(src)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !isHls) return
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      return
    }
    if (!Hls.isSupported()) {
      setStatus('error')
      setError('This browser does not support this video stream. Please use a current browser.')
      return
    }

    const hls = new Hls()
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      // Autoplay can be refused after an asynchronous request; the Play button remains available.
      void video.play().catch(() => {})
    })
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) {
        setStatus('error')
        setError('Real-Debrid could not deliver this video stream. It may be unavailable or could not be converted.')
      }
    })
    hls.loadSource(src)
    hls.attachMedia(video)
    return () => hls.destroy()
  }, [src, isHls])

  const play = async () => {
    try {
      await videoRef.current?.play()
    } catch {
      setError('Playback could not start. Use the video controls to try again.')
    }
  }

  return (
    <div className="space-y-3" data-testid="debrid-player">
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={isHls ? undefined : src}
          controls
          autoPlay
          playsInline
          preload="metadata"
          aria-label="Real-Debrid video player"
          className="w-full h-full"
          onCanPlay={() => setStatus((current) => current === 'loading' ? 'ready' : current)}
          onPlaying={() => { setStatus('playing'); setError(null) }}
          onPause={() => setStatus((current) => current === 'playing' ? 'ready' : current)}
          onError={() => {
            setStatus('error')
            setError('The video could not be loaded or decoded. Real-Debrid may have removed the stream or could not convert this file.')
          }}
        >
          Your browser does not support video playback.
        </video>
      </div>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-secondary/50">
        <span role="status" className="text-sm font-medium flex-1 flex items-center gap-2">
          {status === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
          {status === 'loading' ? 'Loading video...' : status === 'playing' ? 'Playing' : status === 'error' ? 'Playback unavailable' : 'Video ready'}
        </span>
        {status !== 'playing' && status !== 'error' && (
          <Button size="sm" onClick={play} className="gap-1">
            <Play className="w-4 h-4" /> Play video
          </Button>
        )}
        <a href={src} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ExternalLink className="w-4 h-4" /> Open in new tab
        </a>
      </div>
    </div>
  )
}
