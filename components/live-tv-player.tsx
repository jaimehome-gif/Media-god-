'use client'

import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import { Volume2, VolumeX, Maximize, Loader2 } from 'lucide-react'

type Props = {
  src: string
  channelName: string
  channelLogo: string
}

export function LiveTvPlayer({ src, channelName, channelLogo }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [muted, setMuted] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let hls: Hls | null = null
    setLoading(true)
    setError(false)

    const onReady = () => setLoading(false)
    const onErr = () => {
      setLoading(false)
      setError(true)
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari)
      video.src = src
      video.addEventListener('loadedmetadata', onReady, { once: true })
      video.addEventListener('error', onErr, { once: true })
      video.play().catch(() => {})
    } else if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true })
      hls.loadSource(src)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, onReady)
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) onErr()
      })
    } else {
      onErr()
    }

    return () => {
      hls?.destroy()
      video.removeEventListener('loadedmetadata', onReady)
      video.removeEventListener('error', onErr)
    }
  }, [src])

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setMuted(video.muted)
  }

  const toggleFullscreen = () => {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      el.requestFullscreen?.()
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-xl overflow-hidden group"
    >
      <video
        ref={videoRef}
        muted={muted}
        autoPlay
        playsInline
        className="w-full h-full object-contain"
      />

      {/* Loading */}
      {loading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
          <p className="text-white/80 text-sm">Tuning to {channelName}…</p>
        </div>
      )}

      {/* Error fallback */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-secondary to-black">
          <span className="text-6xl">{channelLogo}</span>
          <p className="text-white/90 font-semibold">{channelName}</p>
          <p className="text-white/50 text-sm">Live stream unavailable in this region</p>
        </div>
      )}

      {/* Channel watermark */}
      <div className="absolute top-3 right-3 flex items-center gap-2 px-2.5 py-1 rounded-md bg-black/50 backdrop-blur-sm pointer-events-none">
        <span className="text-lg">{channelLogo}</span>
        <span className="text-white text-sm font-medium">{channelName}</span>
      </div>

      {/* LIVE badge */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500 text-white text-xs font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        LIVE
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 inset-x-0 p-3 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={toggleMute}
          className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <button
          onClick={toggleFullscreen}
          className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors ml-auto"
          aria-label="Fullscreen"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
