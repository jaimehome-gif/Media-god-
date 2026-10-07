'use client'

import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import { ExternalLink, Loader2, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DebridVideoControls } from '@/components/debrid-video-controls'

export function DebridVideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'playing' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const isHls = /\.m3u8(?:\?|$)/i.test(src)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const setStatusReady = () => setStatus((c) => (c === 'loading' ? 'ready' : c))
    const onPlaying = () => { setStatus('playing'); setError(null) }
    const onPause = () => setStatus((c) => (c === 'playing' ? 'ready' : c))
    const onError = () => {
      setStatus('error')
      setError('The video could not be loaded or decoded. Real-Debrid may have removed the stream or could not convert this file.')
    }

    video.addEventListener('canplay', setStatusReady)
    video.addEventListener('playing', onPlaying)
    video.addEventListener('pause', onPause)
    video.addEventListener('error', onError)

    if (!isHls) {
      // Direct src — DebridVideoControls sets src={undefined} so we set it here
      video.src = src
      void video.play().catch(() => {})
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
    } else if (Hls.isSupported()) {
      const hls = new Hls()
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
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

      return () => {
        video.removeEventListener('canplay', setStatusReady)
        video.removeEventListener('playing', onPlaying)
        video.removeEventListener('pause', onPause)
        video.removeEventListener('error', onError)
        hls.destroy()
      }
    } else {
      setStatus('error')
      setError('This browser does not support this video stream. Please use a current browser.')
    }

    return () => {
      video.removeEventListener('canplay', setStatusReady)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('error', onError)
    }
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
      {status === 'error' ? (
        <div className="w-full aspect-video rounded-xl bg-black flex items-center justify-center p-6">
          <p role="alert" className="text-sm text-red-500 text-center">{error}</p>
        </div>
      ) : (
        <DebridVideoControls videoRef={videoRef} />
      )}

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
