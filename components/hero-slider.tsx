'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Play, Info, Plus, ChevronLeft, ChevronRight, Star, Film, Tv } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { type MediaItem } from '@/lib/tmdb'
import { useSession } from '@/lib/auth-client'
import { addToWatchlist } from '@/app/actions/media'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface HeroSliderProps {
  items: MediaItem[]
}

// Generate consistent gradient based on item id
function getGradient(id: number): string {
  const gradients = [
    'from-red-950 via-rose-900 to-pink-950',
    'from-blue-950 via-indigo-900 to-violet-950',
    'from-emerald-950 via-teal-900 to-cyan-950',
    'from-amber-950 via-orange-900 to-red-950',
    'from-violet-950 via-purple-900 to-fuchsia-950',
    'from-slate-950 via-zinc-900 to-neutral-950',
  ]
  return gradients[id % gradients.length]
}

export function HeroSlider({ items }: HeroSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const { data: session } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const currentItem = items[currentIndex]

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index)
  }, [])

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % items.length)
  }, [items.length])

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length)
  }, [items.length])

  useEffect(() => {
    const timer = setInterval(nextSlide, 8000)
    return () => clearInterval(timer)
  }, [nextSlide])

  if (!currentItem) return null

  const title = currentItem.title || currentItem.name
  const mediaType = currentItem.media_type || 'movie'
  const gradient = getGradient(currentItem.id)

  const handleAddToWatchlist = async () => {
    if (!session?.user) {
      router.push('/sign-in')
      return
    }

    setIsLoading(true)
    try {
      const result = await addToWatchlist({
        mediaId: currentItem.id,
        mediaType,
        title: title || '',
        posterPath: currentItem.poster_path,
      })
      if (result.success) {
        toast.success('Added to watchlist')
      } else {
        toast.info(result.message)
      }
    } catch {
      toast.error('Failed to add to watchlist')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative w-full h-[70vh] min-h-[500px] max-h-[800px]">
      {/* Background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`}>
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          {mediaType === 'movie' ? (
            <Film className="absolute top-1/2 right-1/4 -translate-y-1/2 w-64 h-64 text-white/5" />
          ) : (
            <Tv className="absolute top-1/2 right-1/4 -translate-y-1/2 w-64 h-64 text-white/5" />
          )}
        </div>
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/40 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative h-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 flex items-end pb-16 sm:pb-24">
        <div className="max-w-2xl">
          {/* Rating & Type */}
          <div className="flex items-center gap-3 mb-4">
            {currentItem.vote_average > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/20 text-primary text-sm font-medium">
                <Star className="w-4 h-4 fill-current" />
                {currentItem.vote_average.toFixed(1)}
              </div>
            )}
            <span className="px-2 py-1 rounded-md bg-white/10 text-white/80 text-sm font-medium uppercase">
              {mediaType}
            </span>
            <span className="text-muted-foreground text-sm">
              {currentItem.release_date?.split('-')[0] || currentItem.first_air_date?.split('-')[0]}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 text-balance">
            {title}
          </h1>

          {/* Overview */}
          <p className="text-muted-foreground text-sm sm:text-base mb-6 line-clamp-3 text-pretty">
            {currentItem.overview}
          </p>

          {/* Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link href={`/${mediaType}/${currentItem.id}`}>
                <Play className="w-5 h-5 fill-current" />
                Watch Now
              </Link>
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="gap-2"
              onClick={handleAddToWatchlist}
              disabled={isLoading}
            >
              <Plus className="w-5 h-5" />
              Watchlist
            </Button>
            <Button asChild variant="outline" size="lg" className="gap-2">
              <Link href={`/${mediaType}/${currentItem.id}`}>
                <Info className="w-5 h-5" />
                Details
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation arrows */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 hidden sm:block">
        <Button
          variant="secondary"
          size="icon"
          onClick={prevSlide}
          className="w-10 h-10 rounded-full bg-background/50 backdrop-blur-sm hover:bg-background/80"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
      </div>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:block">
        <Button
          variant="secondary"
          size="icon"
          onClick={nextSlide}
          className="w-10 h-10 rounded-full bg-background/50 backdrop-blur-sm hover:bg-background/80"
        >
          <ChevronRight className="w-6 h-6" />
        </Button>
      </div>

      {/* Dots indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {items.slice(0, 6).map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentIndex
                ? 'bg-primary w-6'
                : 'bg-foreground/30 hover:bg-foreground/50'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
