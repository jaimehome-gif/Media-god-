'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from 'lucide-react'

interface DebridVideoControlsProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
}

const HIDE_DELAY = 3500
const SEEK_STEP = 10
const VOLUME_STEP = 0.1

export function DebridVideoControls({ videoRef }: DebridVideoControlsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [visible, setVisible] = useState(true)

  /* ---- helpers ---- */
  const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) void v.play().catch(() => {})
    else v.pause()
  }, [videoRef])

  const seek = useCallback((delta: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta))
  }, [videoRef])

  const seekTo = useCallback((t: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(0, Math.min(v.duration || 0, t))
  }, [videoRef])

  const changeVolume = useCallback((delta: number) => {
    const v = videoRef.current
    if (!v) return
    const next = Math.max(0, Math.min(1, (v.volume ?? 1) + delta))
    v.volume = next
    v.muted = next === 0
  }, [videoRef])

  const toggleMute = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
  }, [videoRef])

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen()
    else void el.requestFullscreen().catch(() => {})
  }, [])

  /* ---- auto-hide ---- */
  const showControls = useCallback(() => {
    setVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setVisible(false)
    }, HIDE_DELAY)
  }, [videoRef])

  /* ---- video element listeners ---- */
  useEffect(() => {
    const v = videoRef.current
    if (!v) return

    const onTime = () => setCurrent(v.currentTime)
    const onMeta = () => setDuration(v.duration || 0)
    const onProgress = () => {
      if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1))
    }
    const onPlay = () => { setPlaying(true); showControls() }
    const onPause = () => { setPlaying(false); setVisible(true) }
    const onVol = () => { setVolume(v.volume); setMuted(v.muted) }

    v.addEventListener('timeupdate', onTime)
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('durationchange', onMeta)
    v.addEventListener('progress', onProgress)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('volumechange', onVol)

    return () => {
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('durationchange', onMeta)
      v.removeEventListener('progress', onProgress)
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('volumechange', onVol)
    }
  }, [videoRef, showControls])

  /* ---- fullscreen listener ---- */
  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  /* ---- keyboard / remote controls ---- */
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onKey = (e: KeyboardEvent) => {
      // Don't intercept when focus is on the seek slider
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT') {
        if (e.key === 'Escape') target.blur()
        return
      }

      switch (e.key) {
        case ' ':
        case 'Enter':
        case 'MediaPlay':
        case 'MediaPause':
        case 'MediaPlayPause':
          e.preventDefault()
          togglePlay()
          showControls()
          break
        case 'ArrowLeft':
          e.preventDefault()
          seek(-SEEK_STEP)
          showControls()
          break
        case 'ArrowRight':
          e.preventDefault()
          seek(SEEK_STEP)
          showControls()
          break
        case 'ArrowUp':
          e.preventDefault()
          changeVolume(VOLUME_STEP)
          showControls()
          break
        case 'ArrowDown':
          e.preventDefault()
          changeVolume(-VOLUME_STEP)
          showControls()
          break
        case 'f':
        case 'F':
          toggleFullscreen()
          break
        case 'm':
        case 'M':
          toggleMute()
          showControls()
          break
        case 'Escape':
          if (document.fullscreenElement) return // let browser handle
          break
      }
    }

    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }, [togglePlay, seek, changeVolume, toggleMute, toggleFullscreen, showControls])

  const progress = duration > 0 ? (current / duration) * 100 : 0
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="application"
      aria-label="Video player — use arrow keys to seek and change volume, space to play or pause, F for fullscreen"
      className="relative w-full aspect-video rounded-xl overflow-hidden bg-black group focus:outline-none"
      onMouseMove={showControls}
      onTouchStart={showControls}
      onClick={(e) => {
        // tap on the video area (not a control) toggles play
        if (e.target === e.currentTarget || e.target === videoRef.current) {
          togglePlay()
          showControls()
        }
      }}
    >
      <video
        ref={videoRef}
        playsInline
        preload="metadata"
        aria-label="Real-Debrid video player"
        className="w-full h-full"
        onCanPlay={() => {/* parent handles status */}}
      >
        Your browser does not support video playback.
      </video>

      {/* Center play/pause indicator (tap target) */}
      {!playing && (
        <button
          onClick={togglePlay}
          aria-label="Play video"
          className="absolute inset-0 flex items-center justify-center bg-black/30"
        >
          <span className="flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/90 text-black shadow-lg">
            <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-current ml-1" />
          </span>
        </button>
      )}

      {/* Controls bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 px-2 sm:px-4 pb-2 pt-12 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Seek bar */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-white text-xs sm:text-sm tabular-nums min-w-[2.5rem] text-center select-none">
            {formatTime(current)}
          </span>
          <div className="relative flex-1 h-6 flex items-center group/seek">
            {/* buffered track */}
            <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/20" />
            <div
              className="absolute h-1.5 rounded-full bg-white/40"
              style={{ width: `${bufferedPct}%` }}
            />
            {/* progress track */}
            <div
              className="absolute h-1.5 rounded-full bg-red-500"
              style={{ width: `${progress}%` }}
            />
            {/* seek input */}
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={current}
              aria-label="Seek"
              onChange={(e) => seekTo(Number(e.target.value))}
              className="absolute inset-0 w-full h-6 opacity-0 cursor-pointer"
            />
            {/* thumb indicator */}
            <div
              className="absolute w-3 h-3 sm:w-4 sm:h-4 -ml-1.5 sm:-ml-2 rounded-full bg-red-500 shadow pointer-events-none transition-transform group-hover/seek:scale-125"
              style={{ left: `${progress}%` }}
            />
          </div>
          <span className="text-white text-xs sm:text-sm tabular-nums min-w-[2.5rem] text-center select-none">
            {formatTime(duration)}
          </span>
        </div>

        {/* Button row */}
        <div className="flex items-center gap-1 sm:gap-2">
          <ControlButton onClick={togglePlay} label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-current" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />}
          </ControlButton>

          <ControlButton onClick={() => seek(-SEEK_STEP)} label="Rewind 10 seconds">
            <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
          </ControlButton>

          <ControlButton onClick={() => seek(SEEK_STEP)} label="Forward 10 seconds">
            <RotateCw className="w-5 h-5 sm:w-6 sm:h-6" />
          </ControlButton>

          <ControlButton onClick={toggleMute} label={muted ? 'Unmute' : 'Mute'}>
            {muted || volume === 0 ? <VolumeX className="w-5 h-5 sm:w-6 sm:h-6" /> : <Volume2 className="w-5 h-5 sm:w-6 sm:h-6" />}
          </ControlButton>

          {/* spacer pushes fullscreen to the right */}
          <div className="flex-1" />

          <ControlButton onClick={toggleFullscreen} label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {fullscreen ? <Minimize className="w-5 h-5 sm:w-6 sm:h-6" /> : <Maximize className="w-5 h-5 sm:w-6 sm:h-6" />}
          </ControlButton>
        </div>
      </div>
    </div>
  )
}

/* ---- reusable large touch-target button ---- */
function ControlButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-lg text-white hover:bg-white/20 focus:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors"
    >
      {children}
    </button>
  )
}
