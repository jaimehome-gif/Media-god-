'use client'

import Link from 'next/link'
import { Play, Star, Plus, Heart, Users, Film, Tv } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { type MediaItem, type Movie, type TVShow } from '@/lib/tmdb'
import { useSession } from '@/lib/auth-client'
import { addToWatchlist, addToFavorites, createWatchParty } from '@/app/actions/media'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface MediaCardProps {
  item: MediaItem | Movie | TVShow
  mediaType?: 'movie' | 'tv'
  showRating?: boolean
  size?: 'sm' | 'md' | 'lg'
}

// Generate consistent gradient based on item id
function getGradient(id: number, type: string): string {
  const gradients = [
    'from-red-900 via-red-800 to-rose-900',
    'from-blue-900 via-indigo-900 to-purple-900',
    'from-emerald-900 via-teal-900 to-cyan-900',
    'from-amber-900 via-orange-900 to-red-900',
    'from-violet-900 via-purple-900 to-fuchsia-900',
    'from-slate-900 via-zinc-800 to-neutral-900',
    'from-cyan-900 via-sky-900 to-blue-900',
    'from-pink-900 via-rose-900 to-red-900',
    'from-lime-900 via-green-900 to-emerald-900',
    'from-fuchsia-900 via-pink-900 to-rose-900',
  ]
  return gradients[id % gradients.length]
}

export function MediaCard({ item, mediaType, showRating = true, size = 'md' }: MediaCardProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const type = mediaType || ('media_type' in item ? item.media_type : 'movie')
  const title = 'title' in item ? item.title : item.name
  const date = 'release_date' in item ? item.release_date : ('first_air_date' in item ? item.first_air_date : undefined)
  const year = date ? new Date(date).getFullYear() : null
  const gradient = getGradient(item.id, type)

  const sizeClasses = {
    sm: 'w-[140px]',
    md: 'w-[180px]',
    lg: 'w-[220px]',
  }

  const handleAddToWatchlist = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!session?.user) {
      router.push('/sign-in')
      return
    }

    setIsLoading(true)
    try {
      const result = await addToWatchlist({
        mediaId: item.id,
        mediaType: type,
        title: title || '',
        posterPath: item.poster_path,
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

  const handleAddToFavorites = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!session?.user) {
      router.push('/sign-in')
      return
    }

    setIsLoading(true)
    try {
      const result = await addToFavorites({
        mediaId: item.id,
        mediaType: type,
        title: title || '',
        posterPath: item.poster_path,
      })
      if (result.success) {
        toast.success('Added to favorites')
      } else {
        toast.info(result.message)
      }
    } catch {
      toast.error('Failed to add to favorites')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateWatchParty = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!session?.user) {
      router.push('/sign-in')
      return
    }

    setIsLoading(true)
    try {
      const result = await createWatchParty({
        mediaId: item.id,
        mediaType: type,
        title: title || '',
        posterPath: item.poster_path,
      })
      if (result.success) {
        toast.success('Watch party created!')
        router.push(`/watch-party/${result.partyId}`)
      }
    } catch {
      toast.error('Failed to create watch party')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Link
      href={`/${type}/${item.id}`}
      className={`group flex-shrink-0 ${sizeClasses[size]}`}
    >
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-secondary">
        {/* Gradient poster placeholder */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`}>
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
            {type === 'movie' ? (
              <Film className="w-12 h-12 text-white/30 mb-3" />
            ) : (
              <Tv className="w-12 h-12 text-white/30 mb-3" />
            )}
            <p className="text-white/60 text-xs font-medium text-center line-clamp-3">
              {title}
            </p>
          </div>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-0 left-0 right-0 p-3 flex flex-col gap-2">
            <Button size="sm" className="w-full" disabled={isLoading}>
              <Play className="w-4 h-4 mr-1 fill-current" />
              Watch
            </Button>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                onClick={handleAddToWatchlist}
                disabled={isLoading}
              >
                <Plus className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                onClick={handleAddToFavorites}
                disabled={isLoading}
              >
                <Heart className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                onClick={handleCreateWatchParty}
                disabled={isLoading}
              >
                <Users className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Rating badge */}
        {showRating && item.vote_average > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md bg-background/80 backdrop-blur-sm text-xs font-medium">
            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
            {item.vote_average.toFixed(1)}
          </div>
        )}

        {/* Media type badge */}
        <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-primary/80 backdrop-blur-sm text-xs font-medium uppercase">
          {type}
        </div>
      </div>

      <div className="mt-2 px-1">
        <h3 className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
          {title}
        </h3>
        {year && (
          <p className="text-xs text-muted-foreground mt-0.5">{year}</p>
        )}
      </div>
    </Link>
  )
}
