'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { joinWatchParty } from '@/app/actions/media'
import { toast } from 'sonner'

export function JoinPartyForm() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return

    setIsLoading(true)
    try {
      const result = await joinWatchParty(code.trim())
      if (result.success) {
        toast.success('Joined watch party!')
        router.push(`/watch-party/${code.trim()}`)
      } else {
        toast.error(result.message || 'Failed to join party')
      }
    } catch {
      toast.error('Failed to join watch party')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleJoin} className="flex gap-3">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter party code..."
        className="flex-1 bg-input border-border"
      />
      <Button type="submit" disabled={isLoading || !code.trim()}>
        {isLoading ? 'Joining...' : 'Join Party'}
      </Button>
    </form>
  )
}
