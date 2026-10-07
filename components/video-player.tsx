'use client'

import { useState } from 'react'
import { Play, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface VideoPlayerProps {
  videoKey: string
  title: string
}

export function VideoPlayer({ videoKey, title }: VideoPlayerProps) {
  const [playing, setPlaying] = useState(false)

  if (playing) {
    return (
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${videoKey}?autoplay=1&rel=0`}
          title={title}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        <button
          onClick={() => setPlaying(false)}
          className="absolute top-3 right-3 w-12 h-12 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-black/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-secondary group">
      {/* Thumbnail */}
      <img
        src={`https://img.youtube.com/vi/${videoKey}/maxresdefault.jpg`}
        alt={title}
        className="w-full h-full object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoKey}/hqdefault.jpg`
        }}
      />
      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
        <Button
          size="lg"
          className="gap-2 rounded-full w-16 h-16 p-0"
          onClick={() => setPlaying(true)}
        >
          <Play className="w-8 h-8 fill-current" />
        </Button>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <p className="text-white text-sm font-medium truncate">{title}</p>
      </div>
    </div>
  )
}
