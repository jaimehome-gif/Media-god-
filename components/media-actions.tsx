'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Heart, Users, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSession } from '@/lib/auth-client'
import { addToWatchlist, addToFavorites, createWatchParty } from '@/app/actions/media'
import { toast } from 'sonner'

interface MediaActionsProps {
  mediaId: number
  mediaType: 'movie' | 'tv'
  title: string
  posterPath: string | null
}

export function MediaActions({ mediaId, mediaType, title, posterPath }: MediaActionsProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [inWatchlist, setInWatchlist] = useState(false)
  const [inFavorites, setInFavorites] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleAddToWatchlist = async () => {
    if (!session?.user) {
      router.push('/sign-in')
      return
    }

    setIsLoading(true)
    try {
      const result = await addToWatchlist({ mediaId, mediaType, title, posterPath })
      if (result.success) {
        setInWatchlist(true)
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

  const handleAddToFavorites = async () => {
    if (!session?.user) {
      router.push('/sign-in')
      return
    }

    setIsLoading(true)
    try {
      const result = await addToFavorites({ mediaId, mediaType, title, posterPath })
      if (result.success) {
        setInFavorites(true)
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

  const handleCreateWatchParty = async () => {
    if (!session?.user) {
      router.push('/sign-in')
      return
    }

    setIsLoading(true)
    try {
      const result = await createWatchParty({ mediaId, mediaType, title, posterPath })
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
    <>
      <Button
        variant="secondary"
        size="lg"
        className="gap-2"
        onClick={handleAddToWatchlist}
        disabled={isLoading || inWatchlist}
      >
        {inWatchlist ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
        {inWatchlist ? 'In Watchlist' : 'Watchlist'}
      </Button>
      <Button
        variant="secondary"
        size="lg"
        className="gap-2"
        onClick={handleAddToFavorites}
        disabled={isLoading || inFavorites}
      >
        <Heart className={`w-5 h-5 ${inFavorites ? 'fill-current text-red-500' : ''}`} />
        {inFavorites ? 'Favorited' : 'Favorite'}
      </Button>
      <Button
        variant="outline"
        size="lg"
        className="gap-2"
        onClick={handleCreateWatchParty}
        disabled={isLoading}
      >
        <Users className="w-5 h-5" />
        Watch Party
      </Button>
    </>
  )
}
