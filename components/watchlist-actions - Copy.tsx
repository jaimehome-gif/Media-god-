'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface WatchlistActionsProps {
  mediaId: number
  mediaType: string
  action: (mediaId: number, mediaType: string) => Promise<{ success: boolean }>
}

export function WatchlistActions({ mediaId, mediaType, action }: WatchlistActionsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isRemoved, setIsRemoved] = useState(false)

  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    setIsLoading(true)
    try {
      await action(mediaId, mediaType)
      setIsRemoved(true)
      toast.success('Removed successfully')
    } catch {
      toast.error('Failed to remove')
    } finally {
      setIsLoading(false)
    }
  }

  if (isRemoved) return null

  return (
    <Button
      variant="secondary"
      size="icon"
      className="absolute top-2 right-2 w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-destructive hover:text-destructive-foreground"
      onClick={handleRemove}
      disabled={isLoading}
    >
      <X className="w-4 h-4" />
    </Button>
  )
}
