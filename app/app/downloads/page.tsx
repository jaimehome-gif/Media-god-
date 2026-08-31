'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function WatchPartyRoom({ params }: { params: { id: string } }) {
  const [messages, setMessages] = useState<string[]>([
    'System: Connected to Watch Party room.',
  ])
  const [input, setInput] = useState('')

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    setMessages((prev) => [...prev, input])
    setInput('')
  }

  return (
    <div className="flex h-screen bg-black text-white">
      <div className="flex-1 flex items-center justify-center bg-zinc-950">
        <div className="text-zinc-500 text-lg">Video Player Sync Canvas ({params.id})</div>
      </div>
      <div className="w-80 border-l border-zinc-800 flex flex-col bg-zinc-900">
        <div className="p-4 border-b border-zinc-800 font-bold">Party Chat</div>
        <div className="flex-1 p-4 overflow-y-auto space-y-2">
          {messages.map((msg, idx) => (
            <div key={idx} className="text-sm bg-zinc-800 p-2 rounded">{msg}</div>
          ))}
        </div>
        <form onSubmit={sendMessage} className="p-3 border-t border-zinc-800 flex gap-2">
          <Input 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="Type a message..." 
            className="bg-zinc-800 border-zinc-700 text-white"
          />
          <Button type="submit">Send</Button>
        </form>
      </div>
    </div>
  )
}
