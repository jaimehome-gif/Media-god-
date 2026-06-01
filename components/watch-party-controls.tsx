'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { endWatchParty } from '@/app/actions/media'
import { toast } from 'sonner'
import { Share2, Copy, LogOut } from 'lucide-react'

interface WatchPartyControlsProps {
  partyId: string
  isHost: boolean
}

export function WatchPartyControls({ partyId, isHost }: WatchPartyControlsProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleCopyLink = () => {
    const url = `${window.location.origin}/watch-party/${partyId}`
    navigator.clipboard.writeText(url)
    toast.success('Link copied to clipboard!')
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(partyId)
    toast.success('Party code copied!')
  }

  const handleEndParty = async () => {
    if (!confirm('Are you sure you want to end this watch party?')) return
    
    setIsLoading(true)
    try {
      const result = await endWatchParty(partyId)
      if (result.success) {
        toast.success('Watch party ended')
        router.push('/watch-party')
      } else {
        toast.error(result.message || 'Failed to end party')
      }
    } catch {
      toast.error('Failed to end watch party')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="secondary" className="gap-2" onClick={handleCopyLink}>
        <Share2 className="w-4 h-4" />
        Share Link
      </Button>
      <Button variant="secondary" className="gap-2" onClick={handleCopyCode}>
        <Copy className="w-4 h-4" />
        Copy Code
      </Button>
      {isHost && (
        <Button
          variant="destructive"
          className="gap-2"
          onClick={handleEndParty}
          disabled={isLoading}
        >
          <LogOut className="w-4 h-4" />
          {isLoading ? 'Ending...' : 'End Party'}
        </Button>
      )}
    </div>
  )
}
